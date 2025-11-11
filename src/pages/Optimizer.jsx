import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Route, MapPin, TrendingUp, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import AddressInput from "../components/optimizer/AddressInput";
import RouteMap from "../components/optimizer/RouteMap";
import OptimizedList from "../components/optimizer/OptimizedList";

export default function Optimizer() {
  const [addresses, setAddresses] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState(null);
  const [stats, setStats] = useState(null);

  const handleOptimize = async () => {
    if (!addresses.trim()) return;

    setIsOptimizing(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um especialista em otimização de rotas de entrega. Analise os seguintes endereços e:
1. Determine a ordem mais eficiente de visitação considerando:
   - Proximidade geográfica entre pontos
   - Trânsito típico para o horário atual
   - Minimização de voltas desnecessárias
2. Estime coordenadas aproximadas (latitude, longitude) para cada endereço
3. Calcule tempo total estimado e distância total

Endereços para otimizar:
${addresses}

IMPORTANTE: Considere que a otimização deve começar do ponto de partida mais comum (centro da região) e retornar no final se necessário.`,
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
                  address: { type: "string" },
                  latitude: { type: "number" },
                  longitude: { type: "number" },
                  estimated_arrival: { type: "string" }
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
    } catch (error) {
      console.error("Erro ao otimizar rota:", error);
    }
    setIsOptimizing(false);
  };

  const handleReset = () => {
    setAddresses("");
    setOptimizedRoute(null);
    setStats(null);
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
            Planeje entregas eficientes com análise de trânsito em tempo real
          </p>
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
                    <p className="text-sm text-gray-500 mb-1">Pontos de Entrega</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {optimizedRoute?.length || 0}
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
          {/* Left Column - Input */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-white shadow-xl">
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  Endereços de Entrega
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <AddressInput
                  value={addresses}
                  onChange={setAddresses}
                  disabled={isOptimizing}
                />

                <div className="flex gap-3 mt-6">
                  <Button
                    onClick={handleOptimize}
                    disabled={isOptimizing || !addresses.trim()}
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
                        Otimizar Rota
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
                  <RouteMap route={optimizedRoute} />
                  <OptimizedList route={optimizedRoute} />
                </>
              ) : (
                <Card className="bg-white shadow-xl h-full min-h-[500px]">
                  <CardContent className="p-12 flex flex-col items-center justify-center h-full text-center">
                    <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-6">
                      <Route className="w-12 h-12 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Aguardando Endereços
                    </h3>
                    <p className="text-gray-500 max-w-sm">
                      Insira os endereços de entrega ao lado e clique em
                      "Otimizar Rota" para visualizar a melhor sequência
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