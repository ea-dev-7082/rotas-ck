import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Route, MapPin, TrendingUp, Loader2, Users, Home } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import ClientSelector from "../components/optimizer/ClientSelector";
import RouteMap from "../components/optimizer/RouteMap";
import OptimizedList from "../components/optimizer/OptimizedList";
import NearbyClients from "../components/optimizer/NearbyClients";

const PONTO_PARTIDA = {
  nome: "Matriz - Ponto de Partida",
  endereco: "R. Soares Meireles, 421 - Pilares, Rio de Janeiro - RJ, CEP: 20760-691"
};

export default function Optimizer() {
  const [selectedClients, setSelectedClients] = useState([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState(null);
  const [stats, setStats] = useState(null);
  const [nearbyClients, setNearbyClients] = useState(null);

  const { data: clientes, isLoading } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list('nome'),
    initialData: [],
  });

  const handleOptimize = async () => {
    if (selectedClients.length === 0) return;

    setIsOptimizing(true);
    try {
      const selectedClientesData = selectedClients.map(id => {
        const cliente = clientes.find(c => c.id === id);
        return { 
          nome: cliente.nome, 
          endereco: cliente.endereco,
          endereco_num: cliente.endereco_num
        };
      });

      const allClientesData = clientes.map(c => ({
        nome: c.nome,
        endereco: c.endereco,
        endereco_num: c.endereco_num,
        telefone: c.telefone,
        observacoes: c.observacoes
      }));

      const clientesDataStr = selectedClientesData.map(c => 
        `${c.nome} - ${c.endereco}${c.endereco_num ? `, Nº ${c.endereco_num}` : ''}`
      ).join('\n');

      // Get current time
      const now = new Date();
      const startTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      // Optimize route
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um especialista em otimização de rotas de entrega no Rio de Janeiro. 

HORÁRIO DE SAÍDA: ${startTime}

PONTO DE PARTIDA OBRIGATÓRIO:
${PONTO_PARTIDA.nome}
${PONTO_PARTIDA.endereco}

CLIENTES PARA ENTREGAR (com endereços completos incluindo número):
${clientesDataStr}

INSTRUÇÕES DETALHADAS:

1. ESTRUTURA DA ROTA:
   - O primeiro ponto (order: 1) é SEMPRE a Matriz (ponto de partida) com horário de saída ${startTime}
   - Organize os clientes na ordem mais eficiente de visitação
   - O último ponto é o RETORNO à Matriz

2. OTIMIZAÇÃO GEOGRÁFICA:
   - Agrupe entregas por REGIÃO/BAIRRO (ex: todos de Bangu juntos, depois Campo Grande, etc)
   - Minimize deslocamentos entre bairros distantes
   - Evite "voltas" - mantenha uma sequência lógica geográfica
   - Considere o trânsito típico do Rio de Janeiro no horário atual

3. CÁLCULO DE TEMPO (SEJA REALISTA):
   - Considere 15-20 minutos por entrega (estacionar, localizar, entregar, recibo)
   - Adicione tempo de deslocamento entre pontos baseado em:
     * Distância real entre endereços
     * Condições de trânsito do Rio de Janeiro
     * Tipo de via (avenida principal = mais rápido, ruas locais = mais lento)
   - Para cada ponto, calcule: horário_anterior + tempo_deslocamento + tempo_entrega

4. ENDEREÇOS E COORDENADAS:
   - Use o endereço COMPLETO com número para cada parada
   - Pesquise as coordenadas GPS REAIS e PRECISAS de cada endereço
   - Valide que as coordenadas estão no Rio de Janeiro

5. FORMATO DE HORÁRIO:
   - Use formato HH:MM (ex: 09:30, 14:45)
   - Seja preciso e realista com base no tempo acumulado

IMPORTANTE: 
- Numere os clientes em ordem de visitação (1=Matriz saída, 2-N=entregas, último=Matriz retorno)
- Cada horário deve ser calculado somando tempo de deslocamento + tempo de entrega do ponto anterior
- Inclua o endereço COMPLETO com número em cada parada`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            optimized_route: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  order: { type: "number" },
                  client_name: { type: "string" },
                  address: { type: "string" },
                  street: { type: "string" },
                  number: { type: "string" },
                  neighborhood: { type: "string" },
                  latitude: { type: "number" },
                  longitude: { type: "number" },
                  estimated_arrival: { type: "string" },
                  travel_time_from_previous: { type: "number" },
                  delivery_time: { type: "number" }
                }
              }
            },
            total_distance_km: { type: "number" },
            total_time_minutes: { type: "number" },
            optimization_notes: { type: "string" }
          }
        }
      });

      setOptimizedRoute(result.optimized_route);
      setStats({
        distance: result.total_distance_km,
        time: result.total_time_minutes,
        notes: result.optimization_notes
      });

      // Find nearby clients for promotions
      const nearbyResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um especialista em análise geográfica no Rio de Janeiro.

CLIENTES QUE RECEBERÃO ENTREGAS HOJE:
${JSON.stringify(selectedClientesData, null, 2)}

TODOS OS CLIENTES DISPONÍVEIS (incluindo os selecionados):
${JSON.stringify(allClientesData, null, 2)}

Sua tarefa:
1. Identifique clientes que NÃO estão na lista de entregas de hoje
2. Mas que estão geograficamente próximos (no mesmo bairro ou região) dos clientes que receberão entregas
3. Estes são clientes que podem ser visitados para oferecer promoções, já que o entregador estará na região
4. Para cada cliente próximo identificado, explique por que vale a pena visitá-lo (proximidade, mesma rua, mesmo bairro, etc)
5. Liste no máximo 6-8 clientes próximos mais estratégicos
6. Priorize clientes que estão no caminho ou muito próximos

IMPORTANTE:
- NÃO inclua clientes que já estão na lista de entregas de hoje
- Foque em clientes que representam oportunidades reais de negócio por estarem no caminho`,
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
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-50 border-2 border-green-200 rounded-lg">
            <Home className="w-5 h-5 text-green-600" />
            <div className="text-left">
              <p className="text-xs text-green-600 font-semibold">Ponto de Partida</p>
              <p className="text-sm text-gray-700">{PONTO_PARTIDA.endereco}</p>
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
                    disabled={isOptimizing || selectedClients.length === 0}
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
                  <RouteMap route={optimizedRoute} pontoPartida={PONTO_PARTIDA} />
                  <OptimizedList route={optimizedRoute} />
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
    </div>
  );
}