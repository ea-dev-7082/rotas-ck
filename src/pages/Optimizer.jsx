import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Route, MapPin, TrendingUp, Loader2, Users, Home } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- COMPONENTES FILHOS ---
import ClientSelector from "../components/optimizer/ClientSelector";
import RouteMap from "../components/optimizer/RouteMap";
import DraggableRouteList from "../components/optimizer/DraggableRouteList";
import NearbyClients from "../components/optimizer/NearbyClients";
import PrintModal from "../components/optimizer/PrintModal";
import VehicleDriverSelector from "../components/optimizer/VehicleDriverSelector";
import NotaFiscalDialog from "../components/optimizer/NotaFiscalDialog";

// --- SERVIÇOS (MAPBOX) ---
import { geocodeMultiple, optimizeRoute, processOptimizationResult } from "../components/optimizer/mapboxService";

const DEFAULT_MATRIZ = "Configure o endereço da matriz em Configurações";

export default function Optimizer() {
  // --- ESTADOS ---
  const [selectedClients, setSelectedClients] = useState([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState(null);
  const [stats, setStats] = useState(null);
  const [nearbyClients, setNearbyClients] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [geocodedClients, setGeocodedClients] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedVeiculo, setSelectedVeiculo] = useState("");
  const [selectedMotorista, setSelectedMotorista] = useState("");
  const [notasFiscais, setNotasFiscais] = useState({});
  const [showNotaFiscalDialog, setShowNotaFiscalDialog] = useState(false);
  const [currentClientForNota, setCurrentClientForNota] = useState("");

  // --- CARREGAMENTO DE DADOS (QUERIES) ---
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

  const { data: veiculos } = useQuery({
    queryKey: ['veiculos', currentUser?.email],
    queryFn: () => currentUser ? base44.entities.Veiculo.filter({ owner: currentUser.email, ativo: true }, 'descricao') : [],
    enabled: !!currentUser,
    initialData: [],
  });

  const { data: motoristas } = useQuery({
    queryKey: ['motoristas', currentUser?.email],
    queryFn: () => currentUser ? base44.entities.Motorista.filter({ owner: currentUser.email, ativo: true }, 'nome') : [],
    enabled: !!currentUser,
    initialData: [],
  });

  // Configurações
  const enderecoMatriz = configs.find(c => c.chave === "endereco_matriz")?.valor || "";
  const mapboxToken = configs.find(c => c.chave === "mapbox_token")?.valor || "";
  const logoUrl = configs.find(c => c.chave === "logo_url")?.valor || "";

  const PONTO_PARTIDA = {
    nome: "Matriz - Ponto de Partida",
    endereco: enderecoMatriz || DEFAULT_MATRIZ
  };

  const selectedVeiculoData = veiculos.find(v => v.id === selectedVeiculo);
  const selectedMotoristaData = motoristas.find(m => m.id === selectedMotorista);

  // --- HELPERS (CÁLCULOS) ---
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

  // --- HANDLERS (AÇÕES) ---

  const handleReset = () => {
    setSelectedClients([]);
    setOptimizedRoute(null);
    setStats(null);
    setNearbyClients(null);
    setGeocodedClients([]);
    setNotasFiscais({});
  };

  const handleOpenNotaFiscal = (clientName) => {
    setCurrentClientForNota(clientName);
    setShowNotaFiscalDialog(true);
  };

  const handleSaveNotaFiscal = (notas) => {
    setNotasFiscais(prev => ({
      ...prev,
      [currentClientForNota]: notas
    }));
  };

  // 1. OTIMIZAÇÃO INICIAL (BLINDADA)
  const handleOptimize = async () => {
    if (selectedClients.length === 0 || !enderecoMatriz || !mapboxToken) return;

    setIsOptimizing(true);
    try {
      // Prepara dados brutos
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
        // Preserva lat/lng originais do banco como backup
        return { 
          nome: cliente.nome, 
          endereco: enderecoFinal,
          latitude: cliente.latitude,
          longitude: cliente.longitude
        };
      });

      const now = new Date();
      const startTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      // Geocodificação
      const matrizData = [{ nome: PONTO_PARTIDA.nome, endereco: PONTO_PARTIDA.endereco }];
      const [matrizGeocodificada] = await geocodeMultiple(matrizData, mapboxToken);
      
      const clientesGeocodificados = await geocodeMultiple(selectedClientesData, mapboxToken);

      // BLINDAGEM: Mescla resultado da API com backup do Banco de Dados
      const clientesFinal = clientesGeocodificados.map((item, index) => {
         const original = selectedClientesData[index];
         return {
             ...item,
             // Se API falhou (null/undefined), usa do banco
             latitude: item.latitude || original.latitude, 
             longitude: item.longitude || original.longitude
         };
      });

      setGeocodedClients(clientesFinal);
      
      // Filtra apenas pontos com coordenadas válidas para otimizar
      const pontosParaOtimizar = [matrizGeocodificada, ...clientesFinal].filter(p => p.latitude && p.longitude);

      if (pontosParaOtimizar.length < 2) {
          throw new Error("Não há coordenadas suficientes para traçar a rota. Verifique os endereços.");
      }

      const optimizationData = await optimizeRoute(pontosParaOtimizar, mapboxToken);
      const result = processOptimizationResult(optimizationData, pontosParaOtimizar, startTime);

      setOptimizedRoute(result.optimized_route);
      setStats({
        distance: result.total_distance_km,
        time: result.total_time_minutes,
        notes: result.optimization_notes,
        routeGeometry: result.route_geometry
      });

      // IA - Clientes Próximos
      const allClientesData = clientes.map(c => ({
        nome: c.nome,
        endereco: c.endereco,
        telefone: c.telefone
      }));

      const nearbyResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um especialista em análise geográfica no Rio de Janeiro.
PONTO DE PARTIDA: ${PONTO_PARTIDA.endereco}
CLIENTES ROTA ATUAL: ${JSON.stringify(selectedClientesData.map(c => ({nome: c.nome, endereco: c.endereco})), null, 2)}
TODOS CLIENTES: ${JSON.stringify(allClientesData, null, 2)}
CRITÉRIOS: Raio de 5-7 km do cliente mais distante OU mesmo bairro.`,
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

  // 2. REORDENAÇÃO (CORRIGIDO: DICIONÁRIO MESTRE)
  const handleReorderRoute = async (newEntregas, priorityIndex) => {
    if (newEntregas.length === 0) return;

    setIsOptimizing(true);
    try {
      const now = new Date();
      const startTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      const matrizData = [{ nome: PONTO_PARTIDA.nome, endereco: PONTO_PARTIDA.endereco }];
      const [matrizGeocodificada] = await geocodeMultiple(matrizData, mapboxToken);

      // --- CRIAÇÃO DO DICIONÁRIO MESTRE DE COORDENADAS ---
      const coordsMap = {};

      // 1. Popula com dados do Banco (Garantia Base)
      clientes.forEach(c => {
        if (c.nome && c.latitude) coordsMap[c.nome.trim()] = { lat: c.latitude, lng: c.longitude };
      });

      // 2. Popula com Cache Recente (Garantia API)
      geocodedClients.forEach(g => {
        if (g.nome && g.latitude) coordsMap[g.nome.trim()] = { lat: g.latitude, lng: g.longitude };
      });

      // 3. Popula com Itens da Lista Atual (Garantia Estado Anterior)
      newEntregas.forEach(item => {
        if (item.client_name && item.latitude) {
            coordsMap[item.client_name.trim()] = { lat: item.latitude, lng: item.longitude };
        }
      });

      // Helper seguro para buscar coordenada
      const getSafeCoords = (name) => {
        const key = name?.trim();
        return coordsMap[key] || null;
      };
      // ----------------------------------------------------

      const beforePriority = newEntregas.slice(0, priorityIndex + 1);
      const afterPriority = newEntregas.slice(priorityIndex + 1);

      let finalRoute;

      if (afterPriority.length > 0) {
        // Garante coordenadas antes de processar
        const afterPriorityWithCoords = afterPriority.map(item => {
          const coords = getSafeCoords(item.client_name);
          return {
            ...item,
            latitude: coords?.lat || item.latitude,
            longitude: coords?.lng || item.longitude,
            nome: item.client_name
          };
        });

        const lastPriorityItem = beforePriority[beforePriority.length - 1];
        const lastCoords = getSafeCoords(lastPriorityItem.client_name);
        
        const lastPriorityRef = {
          latitude: lastCoords?.lat || lastPriorityItem.latitude,
          longitude: lastCoords?.lng || lastPriorityItem.longitude
        };

        const ordenadosPorProximidade = ordenarPorProximidade(afterPriorityWithCoords, lastPriorityRef);

        const todosOsPontos = [
            matrizGeocodificada,
            ...beforePriority.map(item => {
                const c = getSafeCoords(item.client_name);
                return { nome: item.client_name, latitude: c?.lat, longitude: c?.lng };
            }),
            ...ordenadosPorProximidade.map(item => ({
                nome: item.client_name, latitude: item.latitude, longitude: item.longitude
            }))
        ];

        // Filtra para Mapbox
        const pontosValidos = todosOsPontos.filter(p => p.latitude && p.longitude);

        const optimizationData = await optimizeRoute(pontosValidos, mapboxToken);
        const trip = optimizationData.trips?.[0];
        const legs = trip?.legs || [];

        // Reconstrói Rota Visual
        const parseTime = (timeStr) => {
          const [hours, minutes] = timeStr.split(':').map(Number);
          return hours * 60 + minutes;
        };
        const formatTime = (totalMinutes) => {
          const hours = Math.floor(totalMinutes / 60) % 24;
          const minutes = Math.round(totalMinutes % 60);
          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        };

        let currentTime = parseTime(startTime);
        
        const matrizInicio = {
          order: 1,
          client_name: PONTO_PARTIDA.nome,
          address: PONTO_PARTIDA.endereco,
          latitude: matrizGeocodificada.latitude,
          longitude: matrizGeocodificada.longitude,
          estimated_arrival: startTime
        };

        let currentOrder = 2;
        const allDeliveries = [...beforePriority, ...ordenadosPorProximidade];
        
        const deliveryItems = allDeliveries.map((item, idx) => {
          if (legs[idx]) currentTime += legs[idx].duration / 60;
          const arrivalTime = formatTime(currentTime);
          currentTime += 15;

          // AQUI: Recupera a coordenada do Dicionário Mestre para o estado final
          const coords = getSafeCoords(item.client_name);

          return {
            ...item,
            order: currentOrder++,
            latitude: coords?.lat || item.latitude, // Blindagem Final
            longitude: coords?.lng || item.longitude,
            estimated_arrival: arrivalTime
          };
        });

        if (legs[legs.length - 1]) currentTime += legs[legs.length - 1].duration / 60;

        const matrizFim = {
          order: currentOrder,
          client_name: PONTO_PARTIDA.nome,
          address: PONTO_PARTIDA.endereco,
          latitude: matrizGeocodificada.latitude,
          longitude: matrizGeocodificada.longitude,
          estimated_arrival: formatTime(currentTime)
        };

        finalRoute = [matrizInicio, ...deliveryItems, matrizFim];

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

  // 3. ROTA MANUAL (FALLBACK)
  const buildManualRoute = (matrizGeocodificada, entregas, startTime) => {
    const parseTime = (timeStr) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };
    const formatTime = (totalMinutes) => {
      const hours = Math.floor(totalMinutes / 60) % 24;
      const minutes = Math.round(totalMinutes % 60);
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    };

    let currentOrder = 1;
    let currentTime = parseTime(startTime);
    const route = [];

    route.push({
      order: currentOrder++,
      client_name: PONTO_PARTIDA.nome,
      address: PONTO_PARTIDA.endereco,
      latitude: matrizGeocodificada.latitude,
      longitude: matrizGeocodificada.longitude,
      estimated_arrival: startTime
    });

    entregas.forEach((item, idx) => {
      // Tenta achar coordenada no cache ou usa do item
      const geocoded = geocodedClients.find(g => g.nome?.trim() === item.client_name?.trim()) || item;
      
      if (idx > 0) currentTime += 25; else currentTime += 10;

      route.push({
        order: currentOrder++,
        client_name: item.client_name,
        address: item.address,
        latitude: geocoded.latitude || item.latitude,
        longitude: geocoded.longitude || item.longitude,
        estimated_arrival: formatTime(currentTime)
      });
    });

    currentTime += 25;

    route.push({
      order: currentOrder,
      client_name: PONTO_PARTIDA.nome,
      address: PONTO_PARTIDA.endereco,
      latitude: matrizGeocodificada.latitude,
      longitude: matrizGeocodificada.longitude,
      estimated_arrival: formatTime(currentTime)
    });

    return route;
  };

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8">
        
        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center p-2">
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69134403eb36c8c975510ceb/250c13318_image.png" 
                  alt="Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-900">
                  Otimizador de Rotas
                </h1>
                <p className="text-gray-600 text-lg">
                  Selecione os clientes e planeje as entregas do dia
                </p>
              </div>
            </div>

            {/* Logo do Usuário */}
            {logoUrl && (
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-2xl blur opacity-40 group-hover:opacity-60 transition duration-300"></div>
                <div className="relative w-28 h-28 bg-white rounded-2xl shadow-xl flex items-center justify-center p-3 border-2 border-gray-100">
                  <img 
                    src={logoUrl} 
                    alt="Logo da Empresa" 
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            )}
          </div>
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

        {/* STATS */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
          >
            <Card className="bg-white shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Entregas</p>
                    <p className="text-3xl font-bold text-blue-600">{selectedClients.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Distância</p>
                    <p className="text-3xl font-bold text-indigo-600">{stats.distance?.toFixed(1)} km</p>
                  </div>
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-indigo-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Tempo</p>
                    <p className="text-3xl font-bold text-purple-600">{Math.floor(stats.time / 60)}h {stats.time % 60}min</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Route className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* LAYOUT PRINCIPAL */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <Card className="bg-white shadow-xl">
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Users className="w-5 h-5 text-blue-600" />
                  Selecione os Clientes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <VehicleDriverSelector
                  veiculos={veiculos}
                  motoristas={motoristas}
                  selectedVeiculo={selectedVeiculo}
                  selectedMotorista={selectedMotorista}
                  onVeiculoChange={setSelectedVeiculo}
                  onMotoristaChange={setSelectedMotorista}
                />
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
                    className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
                  >
                    {isOptimizing ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Otimizando...</> : <><Route className="w-5 h-5 mr-2" />Otimizar ({selectedClients.length})</>}
                  </Button>
                  {optimizedRoute && (
                    <Button onClick={handleReset} variant="outline" className="h-12 border-2 hover:bg-gray-50">
                      Nova Rota
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
            {stats?.notes && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="mt-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 shadow-lg">
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      Notas de Otimização
                    </h3>
                    <p className="text-gray-700 text-sm leading-relaxed">{stats.notes}</p>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            <AnimatePresence mode="wait">
              {optimizedRoute ? (
                <>
                  <RouteMap route={optimizedRoute} pontoPartida={PONTO_PARTIDA} routeGeometry={stats?.routeGeometry} />
                  <DraggableRouteList 
                    route={optimizedRoute} 
                    onReorder={handleReorderRoute}
                    onPrint={() => setShowPrintModal(true)}
                    notasFiscais={notasFiscais}
                    onOpenNotaFiscal={handleOpenNotaFiscal}
                  />
                  <NearbyClients nearbyClients={nearbyClients} />
                </>
              ) : (
                <Card className="bg-white shadow-xl h-full min-h-[500px]">
                  <CardContent className="p-12 flex flex-col items-center justify-center h-full text-center">
                    <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-6">
                      <Route className="w-12 h-12 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Aguardando Seleção</h3>
                    <p className="text-gray-500 max-w-sm">Selecione os clientes e clique em "Otimizar Rota".</p>
                  </CardContent>
                </Card>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      <PrintModal
        open={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        route={optimizedRoute}
        stats={stats}
        pontoPartida={PONTO_PARTIDA}
        notasFiscais={notasFiscais}
        responsavelExpedicao={currentUser?.full_name}
        veiculoData={selectedVeiculoData}
        motoristaData={selectedMotoristaData}
      />

      <NotaFiscalDialog
        open={showNotaFiscalDialog}
        onClose={() => setShowNotaFiscalDialog(false)}
        clientName={currentClientForNota}
        notasFiscais={notasFiscais[currentClientForNota] || []}
        onSave={handleSaveNotaFiscal}
      />
    </div>
  );
}