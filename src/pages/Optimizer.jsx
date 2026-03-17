import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Route, MapPin, TrendingUp, Loader2, Users, Home, Edit } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- COMPONENTES FILHOS ---
import ClientSelector from "../components/optimizer/ClientSelector";
import RouteMap from "../components/optimizer/RouteMap";
import DraggableRouteList from "../components/optimizer/DraggableRouteList";
import NearbyClients from "../components/optimizer/NearbyClients";
import PrintModal from "../components/optimizer/PrintModal";
import VehicleDriverSelector from "../components/optimizer/VehicleDriverSelector";
import NotaFiscalDialog from "../components/optimizer/NotaFiscalDialog";
import MaintenanceAlerts from "../components/manutencao/MaintenanceAlerts";

// --- SERVIÇOS (MAPBOX) ---
import { geocodeMultiple, optimizeRoute, getDirections, processOptimizationResult, TIME_CONFIG } from "../components/optimizer/mapboxService";

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
  const [editingRotaAgendadaId, setEditingRotaAgendadaId] = useState(null);

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
  const nomeEmpresa = configs.find(c => c.chave === "nome_empresa")?.valor || "";
  const tempoParadaEntrega = parseInt(configs.find(c => c.chave === "tempo_parada_entrega")?.valor) || 20;
  const margemTransito = parseInt(configs.find(c => c.chave === "margem_transito")?.valor) || 10;

  const PONTO_PARTIDA = {
    nome: "Matriz - Ponto de Partida",
    endereco: enderecoMatriz || DEFAULT_MATRIZ
  };

  const selectedVeiculoData = veiculos.find(v => v.id === selectedVeiculo);
  const selectedMotoristaData = motoristas.find(m => m.id === selectedMotorista);

  // Carrega rota agendada se vier da URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const rotaAgendadaId = urlParams.get('rotaAgendadaId');
    
    if (rotaAgendadaId && clientes.length > 0) {
      loadRotaAgendada(rotaAgendadaId);
    }
  }, [clientes]);

  const loadRotaAgendada = async (rotaId) => {
    try {
      const rotasAgendadas = await base44.entities.RotaAgendada.filter({ id: rotaId });
      const rotaAgendada = rotasAgendadas[0];
      
      if (!rotaAgendada) return;

      setEditingRotaAgendadaId(rotaId);

      // Seleciona motorista e veículo
      if (rotaAgendada.motorista_id) setSelectedMotorista(rotaAgendada.motorista_id);
      if (rotaAgendada.veiculo_id) setSelectedVeiculo(rotaAgendada.veiculo_id);

      // Extrai clientes da rota (exceto matriz)
      const entregas = rotaAgendada.rota?.slice(1, -1) || [];
      
      // Encontra IDs dos clientes pelo nome
      const clientIds = [];
      const notasCarregadas = {};
      
      entregas.forEach(entrega => {
        const cliente = clientes.find(c => c.nome === entrega.client_name);
        if (cliente) {
          clientIds.push(cliente.id);
        }
        // Carrega notas fiscais
        if (entrega.notas_fiscais && entrega.notas_fiscais.length > 0) {
          notasCarregadas[entrega.client_name] = entrega.notas_fiscais;
        }
      });

      setSelectedClients(clientIds);
      setNotasFiscais(notasCarregadas);

      // Carrega a rota otimizada
      setOptimizedRoute(rotaAgendada.rota);
      setStats({
        distance: rotaAgendada.distancia_km,
        time: rotaAgendada.tempo_minutos
      });

      // Limpa URL
      window.history.replaceState({}, '', window.location.pathname);
      
    } catch (error) {
      console.error("Erro ao carregar rota agendada:", error);
    }
  };

  // Upload de Logo
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // Salvar URL da logo nas configurações
      const existing = configs.find(c => c.chave === "logo_url");
      if (existing) {
        await base44.entities.Configuracao.update(existing.id, { valor: file_url });
      } else {
        await base44.entities.Configuracao.create({ 
          chave: "logo_url", 
          valor: file_url, 
          owner: currentUser?.email 
        });
      }
      
      // Recarregar página para atualizar logo
      window.location.reload();
    } catch (error) {
      console.error("Erro ao fazer upload da logo:", error);
    }
  };

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
    setEditingRotaAgendadaId(null);
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
      const result = processOptimizationResult(optimizationData, pontosParaOtimizar, startTime, tempoParadaEntrega, margemTransito);

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

  // 2. REORDENAÇÃO — reordena itens restantes por proximidade a partir da posição movida
  const handleReorderRoute = async (newEntregas, priorityIndex) => {
    if (newEntregas.length === 0) return;

    setIsOptimizing(true);
    try {
      const now = new Date();
      const startTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      const matrizData = [{ nome: PONTO_PARTIDA.nome, endereco: PONTO_PARTIDA.endereco }];
      const [matrizGeocodificada] = await geocodeMultiple(matrizData, mapboxToken);

      // --- DICIONÁRIO MESTRE DE COORDENADAS ---
      const coordsMap = {};
      clientes.forEach(c => {
        if (c.nome && c.latitude) coordsMap[c.nome.trim()] = { lat: c.latitude, lng: c.longitude };
      });
      geocodedClients.forEach(g => {
        if (g.nome && g.latitude) coordsMap[g.nome.trim()] = { lat: g.latitude, lng: g.longitude };
      });
      newEntregas.forEach(item => {
        if (item.client_name && item.latitude) coordsMap[item.client_name.trim()] = { lat: item.latitude, lng: item.longitude };
      });
      const getSafeCoords = (name) => coordsMap[name?.trim()] || null;

      // Enriquece entregas com coordenadas
      const enriched = newEntregas.map(item => {
        const c = getSafeCoords(item.client_name);
        return {
          ...item,
          latitude: c?.lat || item.latitude,
          longitude: c?.lng || item.longitude
        };
      });

      // --- REORDENAÇÃO POR PROXIMIDADE ---
      // Itens até a posição do drag (inclusive) ficam fixos
      // Itens após são reordenados por nearest-neighbor a partir do último fixo
      const fixedPart = enriched.slice(0, priorityIndex + 1);
      const remainingPart = enriched.slice(priorityIndex + 1);

      // Ponto de referência: último item fixo (ou matriz se não houver)
      const lastFixed = fixedPart.length > 0 
        ? fixedPart[fixedPart.length - 1] 
        : matrizGeocodificada;

      const reordered = ordenarPorProximidade(
        remainingPart.filter(p => p.latitude && p.longitude),
        { latitude: lastFixed.latitude, longitude: lastFixed.longitude }
      );

      // Itens sem coordenadas vão ao final
      const semCoords = remainingPart.filter(p => !p.latitude || !p.longitude);
      const allDeliveries = [...fixedPart, ...reordered, ...semCoords];

      // Pontos para a Directions API (na ordem final)
      const pontosOrdenados = [
        matrizGeocodificada,
        ...allDeliveries,
        matrizGeocodificada // retorno
      ].filter(p => p.latitude && p.longitude);

      // Usa Directions API (respeita a ordem) 
      const directionsData = await getDirections(pontosOrdenados, mapboxToken);
      const route = directionsData.routes?.[0];
      const legs = route?.legs || [];

      // Helpers
      const parseTime = (timeStr) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
      };
      const formatTime = (totalMinutes) => {
        const hours = Math.floor(totalMinutes / 60) % 24;
        const minutes = Math.round(totalMinutes % 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      };

      const TRAFFIC_BUFFER = 1 + (margemTransito / 100);
      const SERVICE_TIME = tempoParadaEntrega;
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
      const deliveryItems = allDeliveries.map((item, idx) => {
        if (legs[idx]) {
          const legDurationMinutes = (legs[idx].duration || 0) / 60;
          currentTime += Math.round(legDurationMinutes * TRAFFIC_BUFFER);
        }

        const arrivalTime = formatTime(currentTime);
        currentTime += SERVICE_TIME;

        const coords = getSafeCoords(item.client_name);
        return {
          ...item,
          order: currentOrder++,
          latitude: coords?.lat || item.latitude,
          longitude: coords?.lng || item.longitude,
          estimated_arrival: arrivalTime
        };
      });

      // Último leg = retorno à matriz
      const returnLegIdx = allDeliveries.length;
      if (legs[returnLegIdx]) {
        const returnMinutes = (legs[returnLegIdx].duration || 0) / 60;
        currentTime += Math.round(returnMinutes * TRAFFIC_BUFFER);
      }

      const matrizFim = {
        order: currentOrder,
        client_name: PONTO_PARTIDA.nome,
        address: PONTO_PARTIDA.endereco,
        latitude: matrizGeocodificada.latitude,
        longitude: matrizGeocodificada.longitude,
        estimated_arrival: formatTime(currentTime)
      };

      const finalRoute = [matrizInicio, ...deliveryItems, matrizFim];
      setOptimizedRoute(finalRoute);

      if (route) {
        const totalDrivingMinutes = legs.reduce((sum, leg) => sum + Math.round(((leg.duration || 0) / 60) * TRAFFIC_BUFFER), 0);
        const totalServiceTime = allDeliveries.length * SERVICE_TIME;

        setStats(prev => ({
          ...prev,
          distance: (route.distance || 0) / 1000,
          time: totalDrivingMinutes + totalServiceTime,
          routeGeometry: route.geometry?.coordinates || []
        }));
      }

    } catch (error) {
      console.error("Erro ao reordenar rota:", error);
    }
    setIsOptimizing(false);
  };

  // 4. ATUALIZAR HORÁRIOS (RECALCULA COM HORA ATUAL)
  const handleRefreshTimes = async () => {
    if (!optimizedRoute || optimizedRoute.length === 0) return;
    
    const entregas = optimizedRoute.slice(1, -1);
    await handleReorderRoute(entregas, entregas.length - 1);
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
      
      // Tempo médio entre entregas (incluindo deslocamento e parada)
    if (idx > 0) currentTime += tempoParadaEntrega + 5; else currentTime += 10;

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
        
        {/* ALERTAS DE MANUTENÇÃO */}
        <MaintenanceAlerts currentUser={currentUser} />

        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <Route className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                                  {editingRotaAgendadaId ? "Editando Rota Agendada" : "Otimizador de Rotas"}
                                </h1>
              <p className="text-gray-500">
                Selecione os clientes e planeje as entregas do dia
              </p>
            </div>
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
                    onRefreshTimes={handleRefreshTimes}
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
            onSaveRelatorio={async (data) => {
              await base44.entities.Relatorio.create({ ...data, owner: currentUser?.email });
            }}
            onSaveAgendado={async (data) => {
                    if (editingRotaAgendadaId) {
                      // Atualiza rota existente
                      await base44.entities.RotaAgendada.update(editingRotaAgendadaId, data);
                      setEditingRotaAgendadaId(null);
                      return { id: editingRotaAgendadaId };
                    } else {
                      // Cria nova rota
                      const result = await base44.entities.RotaAgendada.create({ ...data, owner: currentUser?.email });
                      return result;
                    }
                  }}
            nomeEmpresa={nomeEmpresa}
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