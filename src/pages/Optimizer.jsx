import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Route, MapPin, TrendingUp, Loader2, Users, Home } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import ClientSelector from "../components/optimizer/ClientSelector";
import RouteMap from "../components/optimizer/RouteMap";
import DraggableRouteList from "../components/optimizer/DraggableRouteList";
import NearbyClients from "../components/optimizer/NearbyClients";
import PrintModal from "../components/optimizer/PrintModal";
import { geocodeMultiple, optimizeRoute, processOptimizationResult } from "../components/optimizer/mapboxService";

const DEFAULT_MATRIZ = "Configure o endereço da matriz em Configurações";

export default function Optimizer() {
  const [selectedClients, setSelectedClients] = useState([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState(null);
  const [stats, setStats] = useState(null);
  const [nearbyClients, setNearbyClients] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [geocodedClients, setGeocodedClients] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  const { data: clientes, isLoading } = useQuery({
    queryKey: ['clientes', currentUser?.email],
    queryFn: () => currentUser ? base44.entities.Cliente.filter({ owner: currentUser.email }, 'nome') : [],
    enabled: !!currentUser,
    initialData: [],
  });

  const { data: configs } = useQuery({
    queryKey: ['configuracoes', currentUser?.email],
    queryFn: () => currentUser ? base44.entities.Configuracao.filter({ owner: currentUser.email }) : [],
    enabled: !!currentUser,
    initialData: [],
  });

  const enderecoMatriz = configs.find(c => c.chave === "endereco_matriz")?.valor || "";
  const mapboxToken = configs.find(c => c.chave === "mapbox_token")?.valor || "";

  const PONTO_PARTIDA = {
    nome: "Matriz - Ponto de Partida",
    endereco: enderecoMatriz || DEFAULT_MATRIZ
  };

  const handleOptimize = async () => {
    if (selectedClients.length === 0 || !enderecoMatriz || !mapboxToken) return;

    setIsOptimizing(true);
    try {
      const selectedClientesData = selectedClients.map(id => {
        const cliente = clientes.find(c => c.id === id);
        let enderecoFinal;
        if (cliente.usar_endereco_entrega && cliente.endereco_entrega) {
          enderecoFinal = cliente.endereco_entrega;
        } else {
          enderecoFinal = cliente.endereco_num 
            ? `${cliente.endereco}, ${cliente.endereco_num}`
            : cliente.endereco;
        }
        return { 
          nome: cliente.nome, 
          endereco: enderecoFinal
        };
      });

      const allClientesData = clientes.map(c => ({
        nome: c.nome,
        endereco: c.endereco,
        endereco_num: c.endereco_num,
        telefone: c.telefone,
        observacoes: c.observacoes
      }));

      const now = new Date();
      const startTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      const matrizData = [{ nome: PONTO_PARTIDA.nome, endereco: PONTO_PARTIDA.endereco }];
      const [matrizGeocodificada] = await geocodeMultiple(matrizData, mapboxToken);
      
      const clientesGeocodificados = await geocodeMultiple(selectedClientesData, mapboxToken);

      if (clientesGeocodificados.length === 0) {
        throw new Error("Não foi possível geocodificar os endereços dos clientes");
      }

      setGeocodedClients(clientesGeocodificados);
      
      const pontosParaOtimizar = [matrizGeocodificada, ...clientesGeocodificados];
      const optimizationData = await optimizeRoute(pontosParaOtimizar, mapboxToken);
      const result = processOptimizationResult(optimizationData, pontosParaOtimizar, startTime);

      setOptimizedRoute(result.optimized_route);
      setStats({
        distance: result.total_distance_km,
        time: result.total_time_minutes,
        notes: result.optimization_notes,
        routeGeometry: result.route_geometry
      });

      const nearbyResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um especialista em análise geográfica no Rio de Janeiro.

PONTO DE PARTIDA (MATRIZ):
${PONTO_PARTIDA.endereco}

CLIENTES QUE RECEBERÃO ENTREGAS HOJE:
${JSON.stringify(selectedClientesData, null, 2)}

TODOS OS CLIENTES DISPONÍVEIS (incluindo os selecionados):
${JSON.stringify(allClientesData, null, 2)}

CRITÉRIOS OBRIGATÓRIOS PARA CLIENTES PRÓXIMOS:

1. DISTÂNCIA DA MATRIZ:
   - Identifique qual cliente da lista de entregas está MAIS LONGE da matriz
   - Clientes próximos devem estar em um raio de 5-7 km de distância deste cliente mais distante
   - OU devem pertencer ao MESMO BAIRRO de algum cliente que receberá entrega

2. ANÁLISE GEOGRÁFICA:
   - Calcule distâncias reais usando as coordenadas geográficas
   - Considere a geografia do Rio de Janeiro (não incluir clientes em direção totalmente oposta)
   - Priorize clientes que estão realmente "no caminho" ou na mesma região

3. SELEÇÃO:
   - NÃO inclua clientes que já estão na lista de entregas de hoje
   - Liste no máximo 6-8 clientes mais estratégicos
   - Para cada um, calcule a distância aproximada do cliente de entrega mais próximo

4. JUSTIFICATIVA:
   - Explique claramente por que cada cliente próximo foi selecionado
   - Mencione se está no mesmo bairro ou dentro do raio de 5-7km 
   - Informe qual cliente de entrega está mais próximo (Não inclua a Matriz como entrega)

IMPORTANTE:
- Seja rigoroso com os critérios de distância (5-7 km do mais longe OU mesmo bairro)
- Só sugira clientes que realmente valem a visita pela proximidade`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            nearby_clients: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  nome: { type: "string" },
                  endereco: { type: "string" },
                  telefone: { type: "string" },
                  proximity_reason: { type: "string" }
                }
              }
            }
          }
        }
      });

      setNearbyClients(nearbyResult.nearby_clients || []);

    } catch (error) {
      console.error("Erro ao otimizar rota:", error);
    }
    setIsOptimizing(false);
  };

  const handleReset = () => {
    setSelectedClients([]);
    setOptimizedRoute(null);
    setStats(null);
    setNearbyClients(null);
    setGeocodedClients([]);
  };

  const calcularDistancia = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const ordenarPorProximidade = (pontos, pontoInicial) => {
    if (pontos.length === 0) return [];

    const ordenados = [];
    let restantes = [...pontos];
    let atual = pontoInicial;

    while (restantes.length > 0) {
      let maisProximoIdx = 0;
      let menorDistancia = Infinity;

      restantes.forEach((ponto, idx) => {
        const dist = calcularDistancia(
          atual.latitude, atual.longitude,
          ponto.latitude, ponto.longitude
        );
        if (dist < menorDistancia) {
          menorDistancia = dist;
          maisProximoIdx = idx;
        }
      });

      const maisProximo = restantes[maisProximoIdx];
      ordenados.push(maisProximo);
      restantes.splice(maisProximoIdx, 1);
      atual = maisProximo;
    }

    return ordenados;
  };

  const handleReorderRoute = async (newEntregas, priorityIndex) => {
    if (newEntregas.length === 0) return;

    setIsOptimizing(true);
    try {
      const now = new Date();
      const startTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      const matrizData = [{ nome: PONTO_PARTIDA.nome, endereco: PONTO_PARTIDA.endereco }];
      const [matrizGeocodificada] = await geocodeMultiple(matrizData, mapboxToken);

      const beforePriority = newEntregas.slice(0, priorityIndex + 1);
      const afterPriority = newEntregas.slice(priorityIndex + 1);

      let finalRoute;

      if (afterPriority.length > 0) {
        const afterPriorityWithCoords = afterPriority.map(item => {
          const geocoded = geocodedClients.find(g => g.nome === item.client_name);
          return {
            ...item,
            latitude: geocoded?.latitude || item.latitude,
            longitude: geocoded?.longitude || item.longitude,
            nome: item.client_name
          };
        });

        const lastPriorityItem = beforePriority[beforePriority.length - 1];
        const lastPriorityCoords = geocodedClients.find(g => g.nome === lastPriorityItem.client_name) || {
          latitude: lastPriorityItem.latitude,
          longitude: lastPriorityItem.longitude
        };

        const ordenadosPorProximidade = ordenarPorProximidade(afterPriorityWithCoords, lastPriorityCoords);

        const todosOsPontos = [
          matrizGeocodificada,
          ...beforePriority.map(item => {
            const geocoded = geocodedClients.find(g => g.nome === item.client_name);
            return {
              nome: item.client_name,
              endereco: item.address,
              latitude: geocoded?.latitude || item.latitude,
              longitude: geocoded?.longitude || item.longitude
            };
          }),
          ...ordenadosPorProximidade.map(item => ({
            nome: item.client_name,
            endereco: item.address,
            latitude: item.latitude,
            longitude: item.longitude
          }))
        ];

        const optimizationData = await optimizeRoute(todosOsPontos, mapboxToken);

        const matrizInicio = {
          order: 1,
          client_name: PONTO_PARTIDA.nome,
          address: PONTO_PARTIDA.endereco,
          latitude: matrizGeocodificada.latitude,
          longitude: matrizGeocodificada.longitude,
          estimated_arrival: startTime
        };

        let currentOrder = 2;
        const beforeItems = beforePriority.map((item) => ({
          ...item,
          order: currentOrder++
        }));

        const afterItems = ordenadosPorProximidade.map((item) => ({
          ...item,
          order: currentOrder++
        }));

        const matrizFim = {
          order: currentOrder,
          client_name: PONTO_PARTIDA.nome,
          address: PONTO_PARTIDA.endereco,
          latitude: matrizGeocodificada.latitude,
          longitude: matrizGeocodificada.longitude,
          estimated_arrival: "--:--"
        };

        finalRoute = [matrizInicio, ...beforeItems, ...afterItems, matrizFim];

        const trip = optimizationData.trips?.[0];
        if (trip) {
          setStats(prev => ({
            ...prev,
            distance: (trip.distance || 0) / 1000,
            time: Math.round((trip.duration || 0) / 60),
            routeGeometry: trip.geometry?.coordinates || []
          }));
        }
      } else {
        finalRoute = buildManualRoute(matrizGeocodificada, newEntregas, startTime);
      }

      setOptimizedRoute(finalRoute);

    } catch (error) {
      console.error("Erro ao reordenar rota:", error);
    }
    setIsOptimizing(false);
  };

  const buildManualRoute = (matrizGeocodificada, entregas, startTime) => {
    let currentOrder = 1;
    const route = [];

    route.push({
      order: currentOrder++,
      client_name: PONTO_PARTIDA.nome,
      address: PONTO_PARTIDA.endereco,
      latitude: matrizGeocodificada.latitude,
      longitude: matrizGeocodificada.longitude,
      estimated_arrival: startTime
    });

    entregas.forEach((item) => {
      const geocoded = geocodedClients.find(g => g.nome === item.client_name) || item;
      route.push({
        order: currentOrder++,
        client_name: item.client_name,
        address: item.address,
        latitude: geocoded.latitude || item.latitude,
        longitude: geocoded.longitude || item.longitude,
        estimated_arrival: "--:--"
      });
    });

    route.push({
      order: currentOrder,
      client_name: PONTO_PARTIDA.nome,
      address: PONTO_PARTIDA.endereco,
      latitude: matrizGeocodificada.latitude,
      longitude: matrizGeocodificada.longitude,
      estimated_arrival: "--:--"
    });

    return route;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl mb-4 shadow-lg">
            <Route className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Otimizador de Rotas
          </h1>
          <p className="text-gray-600 text-lg">
            Selecione os clientes e planeje as entregas do dia
          </p>
          
          {/* Ponto de Partida Display */}
          <div className={`mt-4 inline-flex items-center gap-2 px-4 py-2 border-2 rounded-lg ${enderecoMatriz ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
            <Home className={`w-5 h-5 ${enderecoMatriz ? 'text-green-600' : 'text-yellow-600'}`} />
            <div className="text-left">
              <p className={`text-xs font-semibold ${enderecoMatriz ? 'text-green-600' : 'text-yellow-600'}`}>
                Ponto de Partida
              </p>
              <p className="text-sm text-gray-700">
                {enderecoMatriz || "⚠️ Configure o endereço da matriz em Configurações"}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
          >
            <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Entregas Hoje</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {selectedClients.length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Distância Total</p>
                    <p className="text-3xl font-bold text-indigo-600">
                      {stats.distance?.toFixed(1)} km
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-indigo-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Tempo Estimado</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {Math.floor(stats.time / 60)}h {stats.time % 60}min
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Route className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Client Selection */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-white shadow-xl">
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Users className="w-5 h-5 text-blue-600" />
                  Selecione os Clientes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ClientSelector
                  clientes={clientes}
                  selectedClients={selectedClients}
                  onSelectionChange={setSelectedClients}
                  isLoading={isLoading}
                />

                <div className="flex gap-3 mt-6">
                  <Button
                    onClick={handleOptimize}
                    disabled={isOptimizing || selectedClients.length === 0 || !enderecoMatriz || !mapboxToken}
                    className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all"
                  >
                    {isOptimizing ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Otimizando...
                      </>
                    ) : (
                      <>
                        <Route className="w-5 h-5 mr-2" />
                        Otimizar Rota ({selectedClients.length})
                      </>
                    )}
                  </Button>

                  {optimizedRoute && (
                    <Button
                      onClick={handleReset}
                      variant="outline"
                      className="h-12 border-2 hover:bg-gray-50"
                    >
                      Nova Rota
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Optimization Notes */}
            {stats?.notes && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="mt-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 shadow-lg">
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      Notas de Otimização
                    </h3>
                    <p className="text-gray-700 text-sm leading-relaxed">
                      {stats.notes}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </motion.div>

          {/* Right Column - Results */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            <AnimatePresence mode="wait">
              {optimizedRoute ? (
                <>
                  <RouteMap route={optimizedRoute} pontoPartida={PONTO_PARTIDA} routeGeometry={stats?.routeGeometry} />
                  <DraggableRouteList 
                    route={optimizedRoute} 
                    onReorder={handleReorderRoute}
                    onPrint={() => setShowPrintModal(true)}
                  />
                  <NearbyClients nearbyClients={nearbyClients} />
                </>
              ) : (
                <Card className="bg-white shadow-xl h-full min-h-[500px]">
                  <CardContent className="p-12 flex flex-col items-center justify-center h-full text-center">
                    <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-6">
                      <Route className="w-12 h-12 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Aguardando Seleção
                    </h3>
                    <p className="text-gray-500 max-w-sm">
                      Selecione os clientes que receberão entregas hoje e clique
                      em "Otimizar Rota" para visualizar a melhor sequência
                    </p>
                  </CardContent>
                </Card>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* Print Modal */}
      <PrintModal
        open={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        route={optimizedRoute}
        stats={stats}
        pontoPartida={PONTO_PARTIDA}
      />
    </div>
  );
}