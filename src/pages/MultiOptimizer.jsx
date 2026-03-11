import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Route,
  Loader2,
  Users,
  Home,
  Truck,
  MapPin,
  TrendingUp,
  CalendarClock,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import FleetSelector from "../components/multi-optimizer/FleetSelector";
import MultiRouteMap from "../components/multi-optimizer/MultiRouteMap";
import MultiRouteList from "../components/multi-optimizer/MultiRouteList";
import ClientSelector from "../components/optimizer/ClientSelector";
import { geocodeMultiple } from "../components/optimizer/mapboxService";
import { optimizeMultiRoutes } from "../components/optimizer/mapboxV2Service";

const DEFAULT_MATRIZ = "Configure o endereço da matriz em Configurações";

export default function MultiOptimizer() {
  // --- ESTADOS ---
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedClients, setSelectedClients] = useState([]);
  const [selectedFleet, setSelectedFleet] = useState([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationStatus, setOptimizationStatus] = useState("");
  const [multiRoutes, setMultiRoutes] = useState(null);
  const [droppedServices, setDroppedServices] = useState(null);
  const [matrizGeo, setMatrizGeo] = useState(null);
  const [scheduledRoutes, setScheduledRoutes] = useState({});

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  // --- QUERIES ---
  const { data: clientes, isLoading } = useQuery({
    queryKey: ["clientes-multi", currentUser?.email],
    queryFn: () =>
      currentUser
        ? base44.entities.Cliente.filter(
            { owner: currentUser.email },
            "nome"
          )
        : [],
    enabled: !!currentUser,
    initialData: [],
  });

  const { data: configs } = useQuery({
    queryKey: ["configuracoes-multi", currentUser?.email],
    queryFn: () =>
      currentUser
        ? base44.entities.Configuracao.filter({ owner: currentUser.email })
        : [],
    enabled: !!currentUser,
    initialData: [],
  });

  const { data: veiculos } = useQuery({
    queryKey: ["veiculos-multi", currentUser?.email],
    queryFn: () =>
      currentUser
        ? base44.entities.Veiculo.filter(
            { owner: currentUser.email, ativo: true },
            "descricao"
          )
        : [],
    enabled: !!currentUser,
    initialData: [],
  });

  const { data: motoristas } = useQuery({
    queryKey: ["motoristas-multi", currentUser?.email],
    queryFn: () =>
      currentUser
        ? base44.entities.Motorista.filter(
            { owner: currentUser.email, ativo: true },
            "nome"
          )
        : [],
    enabled: !!currentUser,
    initialData: [],
  });

  // Configurações
  const enderecoMatriz =
    configs.find((c) => c.chave === "endereco_matriz")?.valor || "";
  const mapboxToken =
    configs.find((c) => c.chave === "mapbox_token")?.valor || "";
  const tempoParadaEntrega =
    parseInt(
      configs.find((c) => c.chave === "tempo_parada_entrega")?.valor
    ) || 20;

  const PONTO_PARTIDA = {
    nome: "Matriz - Ponto de Partida",
    endereco: enderecoMatriz || DEFAULT_MATRIZ,
  };

  // --- OTIMIZAÇÃO MULTI-ROTAS ---
  const handleMultiOptimize = async () => {
    if (
      selectedClients.length === 0 ||
      selectedFleet.length === 0 ||
      !enderecoMatriz ||
      !mapboxToken
    ) {
      toast.error("Selecione clientes, veículos e configure o token Mapbox.");
      return;
    }

    setIsOptimizing(true);
    setOptimizationStatus("Geocodificando endereços...");

    // 1. Geocodificar matriz
    const matrizData = [
      { nome: PONTO_PARTIDA.nome, endereco: PONTO_PARTIDA.endereco },
    ];
    const [matrizGeocodificada] = await geocodeMultiple(
      matrizData,
      mapboxToken
    );
    setMatrizGeo(matrizGeocodificada);

    // 2. Geocodificar clientes
    const selectedClientesData = selectedClients.map((id) => {
      const cliente = clientes.find((c) => c.id === id);
      let enderecoFinal;
      if (cliente.usar_endereco_entrega && cliente.endereco_entrega) {
        enderecoFinal = cliente.endereco_entrega;
      } else {
        enderecoFinal = cliente.endereco_num
          ? `${cliente.endereco}, ${cliente.endereco_num}`
          : cliente.endereco;
      }
      return {
        id: cliente.id,
        nome: cliente.nome,
        endereco: enderecoFinal,
        latitude: cliente.latitude,
        longitude: cliente.longitude,
        telefone: cliente.telefone,
        janela_inicio: cliente.janela_inicio,
        janela_fim: cliente.janela_fim,
      };
    });

    const clientesGeocodificados = await geocodeMultiple(
      selectedClientesData,
      mapboxToken
    );

    // Blindagem: mescla API + banco
    const clientesFinal = clientesGeocodificados.map((item, index) => {
      const original = selectedClientesData[index];
      return {
        ...item,
        id: original.id,
        latitude: item.latitude || original.latitude,
        longitude: item.longitude || original.longitude,
        janela_inicio: original.janela_inicio,
        janela_fim: original.janela_fim,
      };
    });

    // Filtra sem coordenadas
    const clientesValidos = clientesFinal.filter(
      (c) => c.latitude && c.longitude
    );

    if (clientesValidos.length < 1) {
      toast.error("Nenhum endereço válido encontrado.");
      setIsOptimizing(false);
      return;
    }

    // 3. Montar veículos com motoristas (suporta seleção por veículo ou motorista)
    const vehiclesData = selectedFleet.map((f, idx) => {
      const veiculo = f.veiculoId ? veiculos.find((v) => v.id === f.veiculoId) : null;
      const motorista = f.motoristaId ? motoristas.find((m) => m.id === f.motoristaId) : null;
      return {
        id: f.veiculoId || `motorista-${f.motoristaId || idx}`,
        name: veiculo?.descricao || (motorista ? `Veículo de ${motorista.nome}` : `Veículo ${idx + 1}`),
        capacidade: veiculo?.capacidade,
        placa: veiculo?.placa || "",
        motorista_nome: motorista?.nome || "",
        motorista_id: motorista?.id || f.motoristaId || "",
        motorista_email: motorista?.email || "",
      };
    });

    setOptimizationStatus("Otimizando rotas...");

    // Hora de início da configuração ou padrão 08:00
    const horaInicio = configs.find((c) => c.chave === "hora_inicio")?.valor || "08:00";

    // 4. Otimizar usando API V1 (divide clientes e otimiza cada rota)
    const processed = await optimizeMultiRoutes({
      matrizCoords: {
        latitude: matrizGeocodificada.latitude,
        longitude: matrizGeocodificada.longitude,
        endereco: PONTO_PARTIDA.endereco,
      },
      vehicles: vehiclesData,
      clients: clientesValidos,
      mapboxToken,
      startTime: horaInicio,
      serviceTime: tempoParadaEntrega,
      trafficBuffer: parseInt(configs.find((c) => c.chave === "margem_transito")?.valor) || 10,
    });

    setMultiRoutes(processed.routes);
    setDroppedServices(processed.dropped);
    setOptimizationStatus("");
    setIsOptimizing(false);

    toast.success(
      `${processed.routes.length} rota(s) otimizada(s) com sucesso!`
    );
  };

  // --- AGENDAR ROTA INDIVIDUAL ---
  const handleScheduleRoute = async (route) => {
    const rotaFormatada = route.stops.map((stop, idx) => ({
      order: idx + 1,
      client_name: stop.client_name,
      client_id: stop.client_id,
      address: stop.address,
      latitude: stop.latitude,
      longitude: stop.longitude,
      estimated_arrival: stop.estimated_arrival,
      status: "pending",
    }));

    const dados = {
      data_agendamento: new Date().toISOString(),
      motorista_id: route.motorista_id || "",
      motorista_nome: route.motorista_nome || "Não informado",
      motorista_email: route.motorista_email || "",
      veiculo_id: route.vehicle_id || "",
      veiculo_descricao: route.vehicle_name || "Não informado",
      veiculo_placa: route.vehicle_placa || "",
      total_entregas: route.total_entregas,
      distancia_km: route.total_distance_km,
      tempo_minutos: route.total_time_minutes,
      endereco_matriz: PONTO_PARTIDA.endereco,
      rota: rotaFormatada,
      status: "agendado",
      owner: currentUser?.email,
    };

    await base44.entities.RotaAgendada.create(dados);
    setScheduledRoutes((prev) => ({ ...prev, [route.vehicle_id]: true }));
    toast.success(`Rota de ${route.vehicle_name} agendada!`);
  };

  const handleScheduleAll = async () => {
    if (!multiRoutes) return;
    for (const route of multiRoutes) {
      if (!scheduledRoutes[route.vehicle_id]) {
        await handleScheduleRoute(route);
      }
    }
    toast.success("Todas as rotas foram agendadas!");
  };

  // --- RESET ---
  const handleReset = () => {
    setSelectedClients([]);
    setMultiRoutes(null);
    setDroppedServices(null);
    setMatrizGeo(null);
    setScheduledRoutes({});
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Multi-Rotas
              </h1>
              <p className="text-gray-500">
                Otimize rotas para múltiplos veículos simultaneamente
              </p>
            </div>
          </div>
          <div
            className={`mt-4 inline-flex items-center gap-2 px-4 py-2 border-2 rounded-lg ${
              enderecoMatriz
                ? "bg-green-50 border-green-200"
                : "bg-yellow-50 border-yellow-200"
            }`}
          >
            <Home
              className={`w-5 h-5 ${
                enderecoMatriz ? "text-green-600" : "text-yellow-600"
              }`}
            />
            <div className="text-left">
              <p
                className={`text-xs font-semibold ${
                  enderecoMatriz ? "text-green-600" : "text-yellow-600"
                }`}
              >
                Ponto de Partida
              </p>
              <p className="text-sm text-gray-700">
                {enderecoMatriz ||
                  "⚠️ Configure o endereço da matriz em Configurações"}
              </p>
            </div>
          </div>
        </motion.div>

        {/* LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* COLUNA ESQUERDA - Seleção */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Seleção de Frota */}
            <FleetSelector
              veiculos={veiculos}
              motoristas={motoristas}
              selectedFleet={selectedFleet}
              onFleetChange={setSelectedFleet}
            />

            {/* Seleção de Clientes */}
            <Card className="bg-white shadow-xl">
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Users className="w-5 h-5 text-indigo-600" />
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
              </CardContent>
            </Card>

            {/* Botão Otimizar */}
            <div className="flex gap-3">
              <Button
                onClick={handleMultiOptimize}
                disabled={
                  isOptimizing ||
                  selectedClients.length === 0 ||
                  selectedFleet.length === 0 ||
                  !enderecoMatriz ||
                  !mapboxToken
                }
                className="flex-1 h-14 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg text-lg"
              >
                {isOptimizing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {optimizationStatus || "Otimizando..."}
                  </>
                ) : (
                  <>
                    <Route className="w-5 h-5 mr-2" />
                    Otimizar Multi-Rotas ({selectedClients.length} clientes,{" "}
                    {selectedFleet.length} veículos)
                  </>
                )}
              </Button>
              {multiRoutes && (
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="h-14 border-2"
                >
                  Nova Otimização
                </Button>
              )}
            </div>
          </motion.div>

          {/* COLUNA DIREITA - Resultado */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <AnimatePresence mode="wait">
              {multiRoutes ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6"
                >
                  {/* Mapa */}
                  <MultiRouteMap routes={multiRoutes} matrizData={matrizGeo} />

                  {/* Botão Agendar Todas */}
                  <div className="flex gap-3">
                    <Button
                      onClick={handleScheduleAll}
                      className="flex-1 h-12 bg-gradient-to-r from-cyan-500 to-blue-600 text-white"
                      disabled={Object.keys(scheduledRoutes).length === multiRoutes.length}
                    >
                      {Object.keys(scheduledRoutes).length ===
                      multiRoutes.length ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 mr-2" />
                          Todas Agendadas
                        </>
                      ) : (
                        <>
                          <CalendarClock className="w-5 h-5 mr-2" />
                          Agendar Todas as Rotas
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Lista de Rotas */}
                  <MultiRouteList
                    routes={multiRoutes}
                    dropped={droppedServices}
                    onSelectRoute={handleScheduleRoute}
                  />
                </motion.div>
              ) : (
                <Card className="bg-white shadow-xl h-full min-h-[500px]">
                  <CardContent className="p-12 flex flex-col items-center justify-center h-full text-center">
                    <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-200 rounded-full flex items-center justify-center mb-6">
                      <Truck className="w-12 h-12 text-indigo-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Multi-Rotas
                    </h3>
                    <p className="text-gray-500 max-w-sm">
                      Selecione os veículos da frota e os clientes para gerar
                      rotas otimizadas para todos os veículos simultaneamente.
                    </p>
                    <div className="mt-6 space-y-2 text-sm text-gray-400">
                      <p>1. Selecione veículos e motoristas</p>
                      <p>2. Selecione os clientes</p>
                      <p>3. Clique em "Otimizar Multi-Rotas"</p>
                    </div>
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