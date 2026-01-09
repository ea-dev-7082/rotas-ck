import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarClock,
  Calendar,
  Clock,
  MapPin,
  Truck,
  User,
  Trash2,
  Eye,
  Route,
  Filter,
  X,
  Package,
  FileText,
  RefreshCw,
  Plus,
  Edit,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import moment from "moment";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

import { geocodeMultiple, optimizeRoute, processOptimizationResult, TIME_CONFIG } from "../components/optimizer/mapboxService";
import NotaFiscalDialog from "../components/optimizer/NotaFiscalDialog";

export default function Agendados() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedRota, setSelectedRota] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [filterMotorista, setFilterMotorista] = useState("todos");
  const [isReoptimizing, setIsReoptimizing] = useState(false);
  
  // Notas Fiscais
  const [showNotaFiscalDialog, setShowNotaFiscalDialog] = useState(false);
  const [currentClientForNota, setCurrentClientForNota] = useState(null);
  const [currentClientIndex, setCurrentClientIndex] = useState(null);
  const [editedNotas, setEditedNotas] = useState({});

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  // --- QUERIES ---
  const { data: rotasAgendadas, isLoading } = useQuery({
    queryKey: ["rotasAgendadas", currentUser?.email],
    queryFn: () =>
      currentUser
        ? base44.entities.RotaAgendada.filter(
            { owner: currentUser.email },
            "-created_date"
          )
        : [],
    enabled: !!currentUser,
    initialData: []
  });

  const { data: configs } = useQuery({
    queryKey: ['configuracoes', currentUser?.email],
    queryFn: () => currentUser ? base44.entities.Configuracao.filter({ owner: currentUser.email }) : [],
    enabled: !!currentUser,
    initialData: [],
  });

  const mapboxToken = configs.find(c => c.chave === "mapbox_token")?.valor || "";

  // Lista de motoristas únicos
  const motoristas = useMemo(() => {
    const names = rotasAgendadas
      .map(r => r.motorista_nome)
      .filter(Boolean);
    return [...new Set(names)];
  }, [rotasAgendadas]);

  // Filtrar por motorista
  const filteredRotas = useMemo(() => {
    if (filterMotorista === "todos") return rotasAgendadas;
    return rotasAgendadas.filter(r => r.motorista_nome === filterMotorista);
  }, [rotasAgendadas, filterMotorista]);

  // Agrupar por motorista
  const rotasAgrupadas = useMemo(() => {
    const grupos = {};
    filteredRotas.forEach(rota => {
      const key = rota.motorista_nome || "Sem Motorista";
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(rota);
    });
    return grupos;
  }, [filteredRotas]);

  // --- MUTATIONS ---
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RotaAgendada.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rotasAgendadas"] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RotaAgendada.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rotasAgendadas"] });
    }
  });

  // --- FUNÇÕES ---

  const handleViewDetails = (rota) => {
    setSelectedRota(rota);
    // Inicializa notas editadas com as existentes
    const notas = {};
    if (rota.rota) {
      rota.rota.forEach((item, idx) => {
        if (item.notas_fiscais) {
          notas[idx] = item.notas_fiscais;
        }
      });
    }
    setEditedNotas(notas);
    setShowDetailDialog(true);
  };

  const handleOpenNotaFiscal = (clientName, index) => {
    setCurrentClientForNota(clientName);
    setCurrentClientIndex(index);
    setShowNotaFiscalDialog(true);
  };

  const handleSaveNotaFiscal = (notas) => {
    setEditedNotas(prev => ({
      ...prev,
      [currentClientIndex]: notas
    }));
  };

  const handleSaveChanges = async () => {
    if (!selectedRota) return;

    // Atualiza a rota com as notas editadas
    const novaRota = selectedRota.rota.map((item, idx) => {
      const notas = editedNotas[idx] || item.notas_fiscais || [];
      const volumeTotal = notas.reduce((acc, n) => acc + (Number(n.volume) || 0), 0);
      return {
        ...item,
        notas_fiscais: notas,
        volume_total: volumeTotal
      };
    });

    const totalVolumes = novaRota.reduce((acc, item) => acc + (item.volume_total || 0), 0);

    await updateMutation.mutateAsync({
      id: selectedRota.id,
      data: {
        rota: novaRota,
        total_volumes: totalVolumes
      }
    });

    setShowDetailDialog(false);
    alert("Alterações salvas com sucesso!");
  };

  // Re-otimizar rota
  const handleReoptimize = async () => {
    if (!selectedRota || !mapboxToken) return;

    setIsReoptimizing(true);
    try {
      const now = new Date();
      const startTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      // Pega matriz e entregas
      const matriz = selectedRota.rota[0];
      const entregas = selectedRota.rota.slice(1, -1);

      // Geocodifica matriz
      const matrizData = [{ nome: matriz.client_name, endereco: matriz.address }];
      const [matrizGeocodificada] = await geocodeMultiple(matrizData, mapboxToken);

      // Geocodifica entregas
      const entregasData = entregas.map(e => ({
        nome: e.client_name,
        endereco: e.address,
        latitude: e.latitude,
        longitude: e.longitude,
        notas_fiscais: editedNotas[selectedRota.rota.indexOf(e)] || e.notas_fiscais || []
      }));

      const entregasGeocodificadas = await geocodeMultiple(entregasData, mapboxToken);

      // Otimiza
      const pontosParaOtimizar = [matrizGeocodificada, ...entregasGeocodificadas].filter(p => p.latitude && p.longitude);

      if (pontosParaOtimizar.length < 2) {
        throw new Error("Não há coordenadas suficientes para traçar a rota.");
      }

      const optimizationData = await optimizeRoute(pontosParaOtimizar, mapboxToken);
      const result = processOptimizationResult(optimizationData, pontosParaOtimizar, startTime);

      // Reconstrói rota com notas fiscais preservadas
      const novaRota = result.optimized_route.map((item, idx) => {
        // Encontra as notas fiscais originais pelo nome do cliente
        const originalEntrega = entregas.find(e => e.client_name === item.client_name);
        const editedIdx = entregas.indexOf(originalEntrega);
        const notas = editedIdx >= 0 ? (editedNotas[editedIdx + 1] || originalEntrega?.notas_fiscais || []) : [];
        const volumeTotal = notas.reduce((acc, n) => acc + (Number(n.volume) || 0), 0);

        return {
          ...item,
          notas_fiscais: notas,
          volume_total: volumeTotal
        };
      });

      const totalVolumes = novaRota.reduce((acc, item) => acc + (item.volume_total || 0), 0);

      await updateMutation.mutateAsync({
        id: selectedRota.id,
        data: {
          rota: novaRota,
          distancia_km: result.total_distance_km,
          tempo_minutos: result.total_time_minutes,
          total_volumes: totalVolumes
        }
      });

      // Atualiza estado local
      setSelectedRota(prev => ({
        ...prev,
        rota: novaRota,
        distancia_km: result.total_distance_km,
        tempo_minutos: result.total_time_minutes,
        total_volumes: totalVolumes
      }));

      alert("Rota re-otimizada com sucesso!");

    } catch (error) {
      console.error("Erro ao re-otimizar:", error);
      alert("Erro ao re-otimizar: " + error.message);
    }
    setIsReoptimizing(false);
  };

  const getStatusBadge = (status) => {
    const styles = {
      agendado: "bg-blue-100 text-blue-700",
      em_andamento: "bg-yellow-100 text-yellow-700",
      concluido: "bg-green-100 text-green-700",
      cancelado: "bg-red-100 text-red-700"
    };
    const labels = {
      agendado: "Agendado",
      em_andamento: "Em Andamento",
      concluido: "Concluído",
      cancelado: "Cancelado"
    };
    return (
      <Badge className={styles[status] || styles.agendado}>
        {labels[status] || "Agendado"}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100 p-6">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <CalendarClock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Rotas Agendadas</h1>
              <p className="text-gray-600">Gerencie rotas planejadas por motorista</p>
            </div>
          </div>

          {/* Filtro por Motorista */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <Select value={filterMotorista} onValueChange={setFilterMotorista}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por motorista" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Motoristas</SelectItem>
                {motoristas.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Lista de Rotas Agendadas */}
        <Card className="bg-white shadow-xl border-0">
          <CardHeader className="border-b border-gray-100 pb-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Route className="w-5 h-5 text-cyan-600" />
              Rotas Planejadas
              <Badge variant="outline" className="ml-2">
                {filteredRotas.length} rota(s)
              </Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-6">
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Carregando...</div>
            ) : filteredRotas.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <CalendarClock className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">Nenhuma rota agendada</p>
                <p className="text-sm mt-2">Use o Otimizador para criar e agendar rotas</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[600px]">
                {Object.entries(rotasAgrupadas).map(([motorista, rotas]) => (
                  <div key={motorista} className="mb-6">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
                      <User className="w-5 h-5 text-gray-600" />
                      <h3 className="font-bold text-gray-800">{motorista}</h3>
                      <Badge variant="secondary">{rotas.length} rota(s)</Badge>
                    </div>

                    <div className="space-y-3">
                      <AnimatePresence>
                        {rotas.map((rota) => (
                          <motion.div
                            key={rota.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="p-4 border border-gray-200 rounded-xl hover:shadow-md transition-all bg-white hover:bg-gray-50"
                          >
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2 flex-wrap">
                                  <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-200">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    {moment(rota.data_agendamento).format("DD/MM/YYYY")}
                                  </Badge>
                                  <Badge variant="outline" className="border-gray-300">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {moment(rota.data_agendamento).format("HH:mm")}
                                  </Badge>
                                  {getStatusBadge(rota.status)}
                                  <Badge className="bg-cyan-100 text-cyan-700 hover:bg-cyan-200 border-0">
                                    <MapPin className="w-3 h-3 mr-1" />
                                    {rota.total_entregas || 0} entregas
                                  </Badge>
                                  {rota.total_volumes > 0 && (
                                    <Badge className="bg-purple-100 text-purple-700">
                                      <Package className="w-3 h-3 mr-1" />
                                      {rota.total_volumes} vol.
                                    </Badge>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mt-2">
                                  <div className="flex items-center gap-1.5">
                                    <Truck className="w-4 h-4 text-gray-400" />
                                    <span className="truncate">{rota.veiculo_descricao || "-"}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Route className="w-4 h-4 text-gray-400" />
                                    <span>{rota.distancia_km?.toFixed(1) || 0} km</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-gray-400" />
                                    <span>
                                      {Math.floor((rota.tempo_minutos || 0) / 60)}h{" "}
                                      {(rota.tempo_minutos || 0) % 60}m
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 mt-3 md:mt-0">
                                <Link to={createPageUrl("Optimizer") + `?rotaAgendadaId=${rota.id}`}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-cyan-600 border-cyan-200 hover:bg-cyan-50"
                                  >
                                    <Edit className="w-4 h-4 mr-2" />
                                    Editar Rota
                                  </Button>
                                </Link>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewDetails(rota)}
                                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                >
                                  <Eye className="w-4 h-4 mr-2" />
                                  Detalhes
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteMutation.mutate(rota.id)}
                                  className="text-gray-500 hover:text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                ))}
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Detalhes */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <CalendarClock className="w-6 h-6 text-cyan-600" />
              Detalhes da Rota Agendada
            </DialogTitle>
          </DialogHeader>

          {selectedRota && (
            <div className="space-y-6">
              {/* Resumo */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Data</p>
                  <p className="font-semibold">{moment(selectedRota.data_agendamento).format("DD/MM/YYYY")}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Motorista</p>
                  <p className="font-semibold truncate">{selectedRota.motorista_nome || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Veículo</p>
                  <p className="font-semibold truncate">{selectedRota.veiculo_descricao || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Distância</p>
                  <p className="font-semibold">{selectedRota.distancia_km?.toFixed(1) || 0} km</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Tempo</p>
                  <p className="font-semibold">
                    {Math.floor((selectedRota.tempo_minutos || 0) / 60)}h {(selectedRota.tempo_minutos || 0) % 60}m
                  </p>
                </div>
              </div>

              {/* Botão Re-otimizar */}
              <div className="flex justify-end">
                <Button
                  onClick={handleReoptimize}
                  disabled={isReoptimizing || !mapboxToken}
                  className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white"
                >
                  {isReoptimizing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Re-otimizando...</>
                  ) : (
                    <><RefreshCw className="w-4 h-4 mr-2" /> Re-otimizar Rota</>
                  )}
                </Button>
              </div>

              {/* Lista de Entregas */}
              <div>
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-500" />
                  Entregas ({(selectedRota.rota?.length || 2) - 2})
                </h3>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {(selectedRota.rota || []).slice(1, -1).map((item, idx) => {
                    const notas = editedNotas[idx + 1] || item.notas_fiscais || [];
                    const volumeTotal = notas.reduce((acc, n) => acc + (Number(n.volume) || 0), 0);

                    return (
                      <div key={idx} className="flex flex-col gap-3 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-gray-900">{item.client_name}</p>
                            <p className="text-sm text-gray-500">{item.address}</p>
                          </div>
                          {item.estimated_arrival && (
                            <Badge variant="secondary">{item.estimated_arrival}</Badge>
                          )}
                        </div>

                        {/* Notas Fiscais */}
                        <div className="ml-11 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-sm">
                              <Package className="w-4 h-4 text-purple-500" />
                              <span className="font-medium">{volumeTotal} volumes</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <FileText className="w-4 h-4 text-gray-500" />
                              <span>{notas.length} NF(s)</span>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenNotaFiscal(item.client_name, idx + 1)}
                            className="gap-2"
                          >
                            <Edit className="w-4 h-4" />
                            Editar NFs
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 mt-4 border-t pt-4">
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveChanges}
              disabled={updateMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Nota Fiscal */}
      <NotaFiscalDialog
        open={showNotaFiscalDialog}
        onClose={() => setShowNotaFiscalDialog(false)}
        clientName={currentClientForNota}
        notasFiscais={editedNotas[currentClientIndex] || []}
        onSave={handleSaveNotaFiscal}
      />
    </div>
  );
}