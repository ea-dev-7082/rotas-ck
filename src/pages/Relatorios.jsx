import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; // NOVO: Para escrever a ocorrência
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter // NOVO
} from "@/components/ui/dialog";
import {
  FileText,
  Calendar,
  Clock,
  MapPin,
  Truck,
  User,
  Trash2,
  Eye,
  Printer,
  Route,
  Filter,
  X,
  BarChart3,
  Save,
  AlertTriangle,
  LayoutGrid
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import moment from "moment";
import { format } from "date-fns";
import RoteiroEntregaDialog from "../components/relatorios/RoteiroEntregaDialog";

export default function Relatorios() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedRelatorio, setSelectedRelatorio] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // Filtros
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterLabel, setFilterLabel] = useState("Todos");
  const [searchMotorista, setSearchMotorista] = useState("");
  const [searchNotaFiscal, setSearchNotaFiscal] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [showTimeDialog, setShowTimeDialog] = useState(false);

  // Ocorrências (Estado local para edição no modal)
  const [occurrences, setOccurrences] = useState({});
  const [showRoteiroDialog, setShowRoteiroDialog] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  // --- QUERY DE DADOS ---
  const { data: relatorios, isLoading } = useQuery({
    queryKey: ["relatorios", currentUser?.email],
    queryFn: () =>
    currentUser ?
    base44.entities.Relatorio.filter(
      { owner: currentUser.email },
      "-created_date"
    ) :
    [],
    enabled: !!currentUser,
    initialData: []
  });

  // --- FILTRAGEM ---
  const filteredRelatorios = useMemo(() => {
    return relatorios.filter((relatorio) => {
      const dataRelatorio = moment(relatorio.data_impressao);
      
      // Filtro de data
      if (startDate || endDate) {
        let start = startDate ? moment(startDate) : null;
        let end = endDate ? moment(endDate) : null;
        
        // Aplica horário se definido
        if (start) {
          if (startTime) {
            const [h, m] = startTime.split(':');
            start = start.clone().hour(parseInt(h)).minute(parseInt(m));
          } else {
            start = start.startOf("day");
          }
        }
        if (end) {
          if (endTime) {
            const [h, m] = endTime.split(':');
            end = end.clone().hour(parseInt(h)).minute(parseInt(m));
          } else {
            end = end.endOf("day");
          }
        }
        
        if (start && dataRelatorio.isBefore(start)) return false;
        if (end && dataRelatorio.isAfter(end)) return false;
      }

      // Filtro de motorista
      if (searchMotorista) {
        const motoristaNome = (relatorio.motorista_nome || "").toLowerCase();
        if (!motoristaNome.includes(searchMotorista.toLowerCase())) return false;
      }

      // Filtro de nota fiscal
      if (searchNotaFiscal) {
        const rota = relatorio.rota || [];
        const notasEncontradas = rota.some(item => {
          const notas = item.notas_fiscais || [];
          return notas.some(n => (n.numero || "").toLowerCase().includes(searchNotaFiscal.toLowerCase()));
        });
        const notasAntigo = relatorio.notas_fiscais || {};
        const notasAntigoFound = Object.values(notasAntigo).flat().some(n => 
          (n.numero || "").toLowerCase().includes(searchNotaFiscal.toLowerCase())
        );
        if (!notasEncontradas && !notasAntigoFound) return false;
      }

      return true;
    });
  }, [relatorios, startDate, endDate, startTime, endTime, searchMotorista, searchNotaFiscal]);

  // --- ESTATÍSTICAS (RESUMO DETALHADO) ---
  const stats = useMemo(() => {
    return filteredRelatorios.reduce(
      (acc, curr) => ({
        totalRotas: acc.totalRotas + 1,
        totalEntregas: acc.totalEntregas + (curr.total_entregas || 0),
        totalKm: acc.totalKm + (curr.distancia_km || 0),
        totalTempo: acc.totalTempo + (curr.tempo_minutos || 0)
      }),
      { totalRotas: 0, totalEntregas: 0, totalKm: 0, totalTempo: 0 }
    );
  }, [filteredRelatorios]);

  // --- MUTAÇÕES ---
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Relatorio.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
    }
  });

  // Nova Mutation para Salvar Ocorrências
  const updateOcorrenciasMutation = useMutation({
    mutationFn: async ({ id, rotaAtualizada }) => {
      return base44.entities.Relatorio.update(id, { rota: rotaAtualizada });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
      setShowDetailDialog(false);
      alert("Ocorrências salvas com sucesso!");
    }
  });

  // --- FUNÇÕES AUXILIARES ---

  const applyQuickFilter = (type) => {
    const now = moment();
    if (type === "dia") {
      setStartDate(now.format("YYYY-MM-DD"));
      setEndDate(now.format("YYYY-MM-DD"));
      setShowTimeDialog(true);
      setFilterLabel("Hoje");
    } else if (type === "semana") {
      setStartDate(now.clone().startOf("week").format("YYYY-MM-DD"));
      setEndDate(now.clone().endOf("week").format("YYYY-MM-DD"));
      setFilterLabel("Esta Semana");
    } else if (type === "mes") {
      setStartDate(now.clone().startOf("month").format("YYYY-MM-DD"));
      setEndDate(now.clone().endOf("month").format("YYYY-MM-DD"));
      setFilterLabel("Este Mês");
    } else {
      setStartDate("");
      setEndDate("");
      setFilterLabel("Todos");
    }
  };

  const clearAllFilters = () => {
    setStartDate("");
    setEndDate("");
    setStartTime("");
    setEndTime("");
    setSearchMotorista("");
    setSearchNotaFiscal("");
    setFilterLabel("Todos");
  };

  const handleViewDetails = (relatorio) => {
    setSelectedRelatorio(relatorio);
    // Carrega ocorrências existentes para o estado local
    const initialOccurrences = {};
    if (relatorio.rota) {
      relatorio.rota.forEach((item, index) => {
        if (item.notes) {
          initialOccurrences[index] = item.notes;
        }
      });
    }
    setOccurrences(initialOccurrences);
    setShowDetailDialog(true);
  };

  const handleSaveOccurrences = () => {
    if (!selectedRelatorio) return;

    // Cria uma cópia da rota e injeta as ocorrências no campo 'notes'
    const novaRota = selectedRelatorio.rota.map((item, index) => ({
      ...item,
      notes: occurrences[index] || item.notes || ""
    }));

    updateOcorrenciasMutation.mutate({
      id: selectedRelatorio.id,
      rotaAtualizada: novaRota
    });
  };

  const handlePrintRelatorio = (relatorio) => {
    const rota = relatorio.rota || [];
    const entregas = rota.slice(1, -1);

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório de Rota</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
          .info-item { padding: 8px; background: #f5f5f5; border-radius: 4px; }
          .info-label { font-weight: bold; font-size: 12px; color: #666; }
          .info-value { font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #333; color: white; }
          tr:nth-child(even) { background: #f9f9f9; }
          .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #666; }
          .ocorrencia-box { color: red; font-style: italic; font-size: 10px; margin-top: 4px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Relatório de Rota</h1>
          <p>Impresso em: ${moment(relatorio.data_impressao).format("DD/MM/YYYY [às] HH:mm")}</p>
        </div>
        
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Motorista</div>
            <div class="info-value">${relatorio.motorista_nome || "Não informado"}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Veículo</div>
            <div class="info-value">${relatorio.veiculo_descricao || "Não informado"} ${relatorio.veiculo_placa ? `(${relatorio.veiculo_placa})` : ""}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Total de Entregas</div>
            <div class="info-value">${relatorio.total_entregas || 0}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Distância / Tempo</div>
            <div class="info-value">${relatorio.distancia_km?.toFixed(1) || 0} km / ${Math.floor((relatorio.tempo_minutos || 0) / 60)}h ${(relatorio.tempo_minutos || 0) % 60}min</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Cliente</th>
              <th>Endereço</th>
              <th>Ocorrência</th>
            </tr>
          </thead>
          <tbody>
            ${entregas.map((item, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${item.client_name}</td>
                <td>${item.address}</td>
                <td>${item.notes || "-"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        
        <div class="footer">
          <p>Responsável: ${relatorio.responsavel_expedicao || "Não informado"}</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100 p-6">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Relatórios de Rotas</h1>
              <p className="text-gray-600">Gestão de entregas e ocorrências</p>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowRoteiroDialog(true)}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold shadow-sm"
            >
              <LayoutGrid className="w-4 h-4 mr-2" />
              Roteiro de Entrega
            </Button>

          {/* Botões de Filtro Rápido */}
          <div className="flex bg-white p-1 rounded-lg border shadow-sm">
            <Button
              variant={filterLabel === "Hoje" ? "default" : "ghost"}
              size="sm" onClick={() => applyQuickFilter("dia")}>

                Dia
            </Button>
            <Button
              variant={filterLabel === "Esta Semana" ? "default" : "ghost"}
              size="sm" onClick={() => applyQuickFilter("semana")}>

                Semana
            </Button>
            <Button
              variant={filterLabel === "Este Mês" ? "default" : "ghost"}
              size="sm" onClick={() => applyQuickFilter("mes")}>

                Mês
            </Button>
             <Button
              variant={filterLabel === "Todos" ? "default" : "ghost"}
              size="sm" onClick={() => applyQuickFilter("todos")}>

                Todos
            </Button>
          </div>
          </div>
        </motion.div>

        {/* --- DASHBOARD DE ESTATÍSTICAS (NOVO) --- */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">

            <Card>
                <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Rotas Realizadas</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalRotas}</p>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Entregas</p>
                    <p className="text-2xl font-bold text-purple-600 mt-1">{stats.totalEntregas}</p>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Km Percorridos</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{stats.totalKm.toFixed(1)} km</p>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Tempo em Rota</p>
                    <p className="text-2xl font-bold text-orange-600 mt-1">
                        {Math.floor(stats.totalTempo / 60)}h {stats.totalTempo % 60}m
                    </p>
                </CardContent>
            </Card>
        </motion.div>

        {/* Lista de Relatórios */}
        <Card className="bg-white shadow-xl border-0">
          <CardHeader className="border-b border-gray-100 pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <BarChart3 className="w-5 h-5 text-gray-500" />
                Histórico: <span className="text-purple-600">{filterLabel}</span>
              </CardTitle>

              {/* Área de Filtros Manuais */}
              <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 font-medium whitespace-nowrap hidden sm:inline">
                    <Filter className="w-3 h-3 inline mr-1" />
                    Personalizado:
                  </span>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => {setStartDate(e.target.value);setFilterLabel("Personalizado");}} className="bg-white px-1 py-1 text-xs rounded-md flex border border-input shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm h-8 w-[130px]" />


                  <span className="text-gray-400 text-xs">até</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => {setEndDate(e.target.value);setFilterLabel("Personalizado");}} className="bg-white px-1 py-1 text-xs rounded-md flex border border-input shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm h-8 w-[130px]" />


                </div>
                {(startDate || endDate || searchMotorista || searchNotaFiscal) &&
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearAllFilters}
                  className="h-8 w-8 text-gray-500 hover:text-red-500"
                  title="Limpar filtros">
                    <X className="w-4 h-4" />
                  </Button>
                }
              </div>
            </div>
            
            {/* Filtros de busca */}
            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <select
                  value={searchMotorista}
                  onChange={(e) => setSearchMotorista(e.target.value)}
                  className="h-9 w-[180px] text-sm border border-gray-200 rounded-md px-3 bg-white focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Todos os motoristas</option>
                  {[...new Set(relatorios.map(r => r.motorista_nome).filter(Boolean))].sort().map((motorista) => (
                    <option key={motorista} value={motorista}>{motorista}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar nota fiscal..."
                  value={searchNotaFiscal}
                  onChange={(e) => setSearchNotaFiscal(e.target.value)}
                  className="h-9 w-[180px] text-sm"
                />
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-6">
            {isLoading ?
            <div className="text-center py-8 text-gray-500">
                Carregando...
              </div> :
            filteredRelatorios.length === 0 ?
            <div className="text-center py-12 text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">
                  {relatorios.length === 0 ?
                "Nenhum relatório salvo" :
                "Nenhum relatório encontrado neste período"}
                </p>
              </div> :

            <ScrollArea className="max-h-[600px]">
                <div className="space-y-4">
                  <AnimatePresence>
                    {filteredRelatorios.map((relatorio) =>
                  <motion.div
                    key={relatorio.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-4 border border-gray-200 rounded-xl hover:shadow-md transition-all bg-white hover:bg-gray-50">

                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-200">
                                <Calendar className="w-3 h-3 mr-1" />
                                {moment(relatorio.data_impressao).format(
                              "DD/MM/YYYY"
                            )}
                              </Badge>
                              <Badge variant="outline" className="border-gray-300">
                                <Clock className="w-3 h-3 mr-1" />
                                {moment(relatorio.data_impressao).format(
                              "HH:mm"
                            )}
                              </Badge>
                              <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-0">
                                <MapPin className="w-3 h-3 mr-1" />
                                {relatorio.total_entregas || 0} entregas
                              </Badge>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mt-2">
                              <div className="flex items-center gap-1.5">
                                <User className="w-4 h-4 text-gray-400" />
                                <span className="font-medium text-gray-900">{relatorio.motorista_nome || "S/ Motorista"}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Truck className="w-4 h-4 text-gray-400" />
                                <span className="truncate max-w-[150px]">{relatorio.veiculo_descricao || "-"}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Route className="w-4 h-4 text-gray-400" />
                                <span>{relatorio.distancia_km?.toFixed(1)} km</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-gray-400" />
                                <span>
                                  {Math.floor((relatorio.tempo_minutos || 0) / 60)}h{" "}
                                  {(relatorio.tempo_minutos || 0) % 60}m
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 mt-3 md:mt-0">
                            <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(relatorio)}
                          className="text-blue-600 border-blue-200 hover:bg-blue-50">

                              <Eye className="w-4 h-4 mr-2" />
                              Detalhes
                            </Button>
                            <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePrintRelatorio(relatorio)}
                          className="text-gray-500 hover:text-green-600 hover:bg-green-50">

                              <Printer className="w-4 h-4" />
                            </Button>
                            <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(relatorio.id)}
                          className="text-gray-500 hover:text-red-600 hover:bg-red-50">

                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                  )}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            }
          </CardContent>
        </Card>
      </div>

      {/* --- DIALOG DE DETALHES COM OCORRÊNCIAS --- */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FileText className="w-6 h-6 text-purple-600" />
              Detalhes e Ocorrências
            </DialogTitle>
          </DialogHeader>

          {selectedRelatorio &&
          <div className="space-y-6">
              {/* Resumo do Relatório */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Data</p>
                  <p className="font-semibold">{moment(selectedRelatorio.data_impressao).format("DD/MM/YYYY")}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-500 uppercase font-bold">Motorista</p>
                    <p className="font-semibold truncate">{selectedRelatorio.motorista_nome}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-500 uppercase font-bold">Veículo</p>
                    <p className="font-semibold truncate">{selectedRelatorio.veiculo_descricao}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-500 uppercase font-bold">Expedição</p>
                    <p className="font-semibold truncate">{selectedRelatorio.responsavel_expedicao || "-"}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-500 uppercase font-bold">Retorno</p>
                    <p className="font-semibold truncate">
                      {selectedRelatorio.hora_retorno
                        ? format(new Date(selectedRelatorio.hora_retorno), "HH:mm")
                        : ((selectedRelatorio.rota || []).slice(-1)[0]?.estimated_arrival || "-")}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {selectedRelatorio.hora_retorno ? "Registrado" : "Previsto"}
                    </p>
                </div>
              </div>

              {/* Lista de Entregas com Campo de Ocorrência */}
              <div>
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    Registro de Ocorrências
                </h3>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {(selectedRelatorio.rota || []).slice(1, -1).map((item, idx) => {
                  // Ajuste de índice: O array 'rota' inclui origem e destino, mas o slice(1, -1) remove.
                  // Para acessar o índice correto na rota original, precisamos somar 1.
                  const originalIndex = idx + 1;

                  return (
                    <div key={idx} className="flex flex-col gap-3 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-gray-900">{item.client_name}</p>
                          <p className="text-sm text-gray-500">{item.address}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {item.deliveredAt && (
                            <Badge className="bg-green-100 text-green-700 text-xs">
                              Entregue: {format(new Date(item.deliveredAt), "HH:mm")}
                            </Badge>
                          )}
                          {item.estimated_arrival && (
                            <Badge variant="secondary" className="text-xs">
                              Previsto: {item.estimated_arrival}
                            </Badge>
                          )}
                          {item.status === "problem" && (
                            <Badge className="bg-red-100 text-red-700 text-xs">Problema</Badge>
                          )}
                        </div>
                      </div>
                      
                      {/* Campo de Ocorrência */}
                      <div className="ml-11">
                        <label className="text-xs font-semibold text-gray-500 mb-1 block">
                            Observações / Ocorrência:
                        </label>
                        <Textarea
                          placeholder="Ex: Cliente ausente, endereço não localizado..."
                          value={occurrences[originalIndex] || ""}
                          onChange={(e) => setOccurrences((prev) => ({
                            ...prev,
                            [originalIndex]: e.target.value
                          }))}
                          className="text-sm min-h-[60px] bg-yellow-50/50 border-yellow-200 focus:border-yellow-400" />

                      </div>
                    </div>);
                })}
                </div>
              </div>
            </div>
          }

            <DialogFooter className="gap-2 mt-4 border-t pt-4">
                <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                    Cancelar
                </Button>
                <Button
              onClick={handleSaveOccurrences}
              disabled={updateOcorrenciasMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white">

                    <Save className="w-4 h-4 mr-2" />
                    {updateOcorrenciasMutation.isPending ? "Salvando..." : "Salvar Ocorrências"}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG DE SELEÇÃO DE HORÁRIO --- */}
      <Dialog open={showTimeDialog} onOpenChange={setShowTimeDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Filtrar por Horário
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-500">
              Selecione o intervalo de horário para filtrar os relatórios de hoje.
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">De:</label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-10"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Até:</label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setStartTime("");
                setEndTime("");
                setShowTimeDialog(false);
              }}
            >
              Dia Inteiro
            </Button>
            <Button onClick={() => setShowTimeDialog(false)}>
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* --- DIALOG ROTEIRO DE ENTREGA --- */}
      <RoteiroEntregaDialog
        open={showRoteiroDialog}
        onClose={() => setShowRoteiroDialog(false)}
        userEmail={currentUser?.email}
      />
    </div>);

}