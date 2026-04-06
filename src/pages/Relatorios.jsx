import React, { useState, useEffect, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FileText, Calendar, Clock, MapPin, Truck, User, Trash2, Eye,
  Printer, Route, Filter, X, BarChart3, Save, AlertTriangle,
  LayoutGrid, Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import moment from "moment";
import { format } from "date-fns";
import RoteiroEntregaDialog from "../components/relatorios/RoteiroEntregaDialog";
import InfiniteScrollSentinel from "@/components/common/InfiniteScrollSentinel";

const API_BATCH_SIZE = 50;

/**
 * Busca TODOS os registros paginando sequencialmente.
 */
async function fetchAllPaginated(entity, sortField = "-created_date") {
  let allData = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const batch = await entity.list(sortField, API_BATCH_SIZE, offset);
    if (batch && batch.length > 0) {
      allData = [...allData, ...batch];
      offset += batch.length;
      hasMore = batch.length === API_BATCH_SIZE;
    } else {
      hasMore = false;
    }
  }

  return allData;
}

export default function Relatorios() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedRelatorio, setSelectedRelatorio] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // Data
  const [relatorios, setRelatorios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterLabel, setFilterLabel] = useState("Todos");
  const [searchMotorista, setSearchMotorista] = useState("");
  const [searchNotaFiscal, setSearchNotaFiscal] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [showTimeDialog, setShowTimeDialog] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);

  // Ocorrências
  const [occurrences, setOccurrences] = useState({});
  const [isSavingOccurrences, setIsSavingOccurrences] = useState(false);
  const [showRoteiroDialog, setShowRoteiroDialog] = useState(false);

  // Delete
  const [deletingId, setDeletingId] = useState(null);

  // ========== AUTH ==========
  useEffect(() => {
    base44.auth
      .me()
      .then(setCurrentUser)
      .catch((err) => console.error("Erro ao carregar usuário:", err));
  }, []);

  // ========== CARREGAMENTO COM PAGINAÇÃO COMPLETA ==========
  const loadRelatorios = useCallback(async () => {
    if (!currentUser?.email) return;

    setIsLoading(true);
    try {
      const allData = await fetchAllPaginated(
        base44.entities.Relatorio,
        "-created_date"
      );
      setRelatorios(allData);
    } catch (error) {
      console.error("Erro ao carregar relatórios:", error);
      setRelatorios([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.email]);

  useEffect(() => {
    if (currentUser?.email) {
      loadRelatorios();
    }
  }, [currentUser?.email, loadRelatorios]);

  // ========== AUTO-SET DATE RANGE ==========
  const hasSetInitialDates = React.useRef(false);

  useEffect(() => {
    if (
      relatorios.length > 0 &&
      !hasSetInitialDates.current &&
      !startDate &&
      !endDate &&
      filterLabel === "Todos"
    ) {
      hasSetInitialDates.current = true;
      const datas = relatorios
        .map((r) => r.data_impressao)
        .filter(Boolean)
        .sort();

      if (datas.length > 0) {
        setStartDate(moment(datas[0]).format("YYYY-MM-DD"));
        setEndDate(moment(datas[datas.length - 1]).format("YYYY-MM-DD"));
      }
    }
  }, [relatorios.length, startDate, endDate, filterLabel]);

  // ========== FILTRAGEM ==========
  const filteredRelatorios = useMemo(() => {
    return relatorios.filter((relatorio) => {
      const dataRelatorio = moment(relatorio.data_impressao);

      if (startDate || endDate) {
        let start = startDate ? moment(startDate) : null;
        let end = endDate ? moment(endDate) : null;

        if (start) {
          if (startTime) {
            const [h, m] = startTime.split(":");
            start = start.clone().hour(parseInt(h)).minute(parseInt(m));
          } else {
            start = start.startOf("day");
          }
        }
        if (end) {
          if (endTime) {
            const [h, m] = endTime.split(":");
            end = end.clone().hour(parseInt(h)).minute(parseInt(m));
          } else {
            end = end.endOf("day");
          }
        }

        if (start && dataRelatorio.isBefore(start)) return false;
        if (end && dataRelatorio.isAfter(end)) return false;
      }

      if (searchMotorista) {
        const motoristaNome = (relatorio.motorista_nome || "").toLowerCase();
        if (!motoristaNome.includes(searchMotorista.toLowerCase()))
          return false;
      }

      if (searchNotaFiscal) {
        const searchLower = searchNotaFiscal.toLowerCase();
        const rota = relatorio.rota || [];
        const notasEncontradas = rota.some((item) => {
          const notas = item.notas_fiscais || [];
          return notas.some((n) =>
            (n.numero || "").toLowerCase().includes(searchLower)
          );
        });
        const notasAntigo = relatorio.notas_fiscais || {};
        const notasAntigoFound = Object.values(notasAntigo)
          .flat()
          .some((n) =>
            (n.numero || "").toLowerCase().includes(searchLower)
          );
        if (!notasEncontradas && !notasAntigoFound) return false;
      }

      return true;
    });
  }, [
    relatorios,
    startDate,
    endDate,
    startTime,
    endTime,
    searchMotorista,
    searchNotaFiscal,
  ]);

  // ========== VIRTUAL SCROLL ==========
  const visibleRelatorios = filteredRelatorios.slice(0, visibleCount);
  const hasMoreRelatorios = visibleRelatorios.length < filteredRelatorios.length;

  const handleLoadMoreRelatorios = useCallback(() => {
    setVisibleCount((prev) => prev + 20);
  }, []);

  // Reset visibleCount quando filtros mudam
  useEffect(() => {
    setVisibleCount(30);
  }, [startDate, endDate, startTime, endTime, searchMotorista, searchNotaFiscal]);

  // ========== ESTATÍSTICAS ==========
  const stats = useMemo(() => {
    return filteredRelatorios.reduce(
      (acc, curr) => ({
        totalRotas: acc.totalRotas + 1,
        totalEntregas: acc.totalEntregas + (curr.total_entregas || 0),
        totalKm: acc.totalKm + (curr.distancia_km || 0),
        totalTempo: acc.totalTempo + (curr.tempo_minutos || 0),
      }),
      { totalRotas: 0, totalEntregas: 0, totalKm: 0, totalTempo: 0 }
    );
  }, [filteredRelatorios]);

  // ========== LISTA DE MOTORISTAS (para filtro select) ==========
  const motoristas = useMemo(() => {
    return [
      ...new Set(relatorios.map((r) => r.motorista_nome).filter(Boolean)),
    ].sort();
  }, [relatorios]);

  // ========== DELETE ==========
  const handleDelete = useCallback(
    async (id) => {
      if (deletingId) return;
      setDeletingId(id);
      try {
        await base44.entities.Relatorio.delete(id);
        // Remove do state local sem recarregar
        setRelatorios((prev) => prev.filter((r) => r.id !== id));
      } catch (error) {
        console.error("Erro ao excluir relatório:", error);
        alert("Erro ao excluir relatório. Tente novamente.");
      } finally {
        setDeletingId(null);
      }
    },
    [deletingId]
  );

  // ========== OCORRÊNCIAS ==========
  const handleViewDetails = useCallback((relatorio) => {
    setSelectedRelatorio(relatorio);
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
  }, []);

  const handleSaveOccurrences = useCallback(async () => {
    if (!selectedRelatorio || isSavingOccurrences) return;

    setIsSavingOccurrences(true);
    try {
      const novaRota = selectedRelatorio.rota.map((item, index) => ({
        ...item,
        notes: occurrences[index] || item.notes || "",
      }));

      await base44.entities.Relatorio.update(selectedRelatorio.id, {
        rota: novaRota,
      });

      // Atualiza state local
      setRelatorios((prev) =>
        prev.map((r) =>
          r.id === selectedRelatorio.id ? { ...r, rota: novaRota } : r
        )
      );

      setShowDetailDialog(false);
      alert("Ocorrências salvas com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar ocorrências:", error);
      alert("Erro ao salvar. Tente novamente.");
    } finally {
      setIsSavingOccurrences(false);
    }
  }, [selectedRelatorio, occurrences, isSavingOccurrences]);

  // ========== FILTROS RÁPIDOS ==========
  const applyQuickFilter = useCallback((type) => {
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
  }, []);

  const clearAllFilters = useCallback(() => {
    setStartDate("");
    setEndDate("");
    setStartTime("");
    setEndTime("");
    setSearchMotorista("");
    setSearchNotaFiscal("");
    setFilterLabel("Todos");
    hasSetInitialDates.current = false;
  }, []);

  // ========== IMPRESSÃO ==========
  const handlePrintRelatorio = useCallback((relatorio) => {
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
            ${entregas
              .map(
                (item, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${item.client_name}</td>
                <td>${item.address}</td>
                <td>${item.notes || "-"}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
        <div class="footer">
          <p>Responsável: ${relatorio.responsavel_expedicao || "Não informado"}</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  }, []);

  // ========== EXPORT CSV ==========
  const handleExportCSV = useCallback(() => {
    if (filteredRelatorios.length === 0) return;

    const headers = [
      "Data",
      "Hora",
      "Motorista",
      "Veículo",
      "Placa",
      "Entregas",
      "Distância (km)",
      "Tempo (min)",
    ];
    const rows = filteredRelatorios.map((r) => [
      moment(r.data_impressao).format("DD/MM/YYYY"),
      moment(r.data_impressao).format("HH:mm"),
      r.motorista_nome || "",
      r.veiculo_descricao || "",
      r.veiculo_placa || "",
      r.total_entregas || 0,
      r.distancia_km?.toFixed(1) || 0,
      r.tempo_minutos || 0,
    ]);

    const csv =
      "\uFEFF" +
      [
        headers.join(";"),
        ...rows.map((r) =>
          r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")
        ),
      ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorios_${moment().format("DDMMYYYY_HHmm")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filteredRelatorios]);

  // ========== RENDER ==========
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
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Relatórios de Rotas
              </h1>
              <p className="text-gray-600">
                Gestão de entregas e ocorrências
                {!isLoading && (
                  <span className="text-gray-400 ml-2">
                    • {relatorios.length} relatório
                    {relatorios.length !== 1 ? "s" : ""} total
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowRoteiroDialog(true)}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold shadow-sm"
            >
              <LayoutGrid className="w-4 h-4 mr-2" />
              Roteiro de Entrega
            </Button>

            <div className="flex bg-white p-1 rounded-lg border shadow-sm">
              {[
                { label: "Dia", key: "dia", active: "Hoje" },
                { label: "Semana", key: "semana", active: "Esta Semana" },
                { label: "Mês", key: "mes", active: "Este Mês" },
                { label: "Todos", key: "todos", active: "Todos" },
              ].map(({ label, key, active }) => (
                <Button
                  key={key}
                  variant={filterLabel === active ? "default" : "ghost"}
                  size="sm"
                  onClick={() => applyQuickFilter(key)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Estatísticas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"
        >
          <Card>
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rotas Realizadas
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.totalRotas}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Entregas
              </p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {stats.totalEntregas}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Km Percorridos
              </p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {stats.totalKm.toFixed(1)} km
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tempo em Rota
              </p>
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
                Histórico:{" "}
                <span className="text-purple-600">{filterLabel}</span>
              </CardTitle>

              <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                <span className="text-sm text-gray-500 font-medium whitespace-nowrap hidden sm:inline">
                  <Filter className="w-3 h-3 inline mr-1" />
                  Personalizado:
                </span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setFilterLabel("Personalizado");
                  }}
                  className="h-8 w-[130px] text-sm"
                />
                <span className="text-gray-400 text-xs">até</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setFilterLabel("Personalizado");
                  }}
                  className="h-8 w-[130px] text-sm"
                />
                {(startDate ||
                  endDate ||
                  searchMotorista ||
                  searchNotaFiscal) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearAllFilters}
                    className="h-8 w-8 text-gray-500 hover:text-red-500"
                    title="Limpar filtros"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
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
                  {motoristas.map((motorista) => (
                    <option key={motorista} value={motorista}>
                      {motorista}
                    </option>
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
              {filteredRelatorios.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  className="ml-auto"
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Exportar CSV
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                <p className="text-sm text-gray-500">
                  Carregando relatórios...
                </p>
              </div>
            ) : filteredRelatorios.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">
                  {relatorios.length === 0
                    ? "Nenhum relatório salvo"
                    : "Nenhum relatório encontrado neste período"}
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-[600px] pr-4">
                <div className="space-y-4 min-w-0">
                  <AnimatePresence>
                    {visibleRelatorios.map((relatorio) => (
                      <motion.div
                        key={relatorio.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="p-4 border border-gray-200 rounded-xl hover:shadow-md transition-all bg-white hover:bg-gray-50"
                      >
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-200">
                                <Calendar className="w-3 h-3 mr-1" />
                                {moment(relatorio.data_impressao).format(
                                  "DD/MM/YYYY"
                                )}
                              </Badge>
                              <Badge
                                variant="outline"
                                className="border-gray-300"
                              >
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
                                <User className="w-4 h-4 text-gray-400 shrink-0" />
                                <span className="font-medium text-gray-900 truncate">
                                  {relatorio.motorista_nome || "S/ Motorista"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Truck className="w-4 h-4 text-gray-400 shrink-0" />
                                <span className="truncate">
                                  {relatorio.veiculo_descricao || "-"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Route className="w-4 h-4 text-gray-400 shrink-0" />
                                <span>
                                  {relatorio.distancia_km?.toFixed(1)} km
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                                <span>
                                  {Math.floor(
                                    (relatorio.tempo_minutos || 0) / 60
                                  )}
                                  h {(relatorio.tempo_minutos || 0) % 60}m
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 mt-3 md:mt-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(relatorio)}
                              className="text-blue-600 border-blue-200 hover:bg-blue-50"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Detalhes
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePrintRelatorio(relatorio)}
                              className="text-gray-500 hover:text-green-600 hover:bg-green-50"
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(relatorio.id)}
                              disabled={deletingId === relatorio.id}
                              className="text-gray-500 hover:text-red-600 hover:bg-red-50"
                            >
                              {deletingId === relatorio.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {hasMoreRelatorios && (
                    <InfiniteScrollSentinel
                      onLoadMore={handleLoadMoreRelatorios}
                      hasMore={hasMoreRelatorios}
                      isLoading={false}
                    />
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Detalhes */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FileText className="w-6 h-6 text-purple-600" />
              Detalhes e Ocorrências
            </DialogTitle>
          </DialogHeader>

          {selectedRelatorio && (
            <div className="space-y-6">
              {/* Resumo */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">
                    Data
                  </p>
                  <p className="font-semibold">
                    {moment(selectedRelatorio.data_impressao).format(
                      "DD/MM/YYYY"
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">
                    Motorista
                  </p>
                  <p className="font-semibold truncate">
                    {selectedRelatorio.motorista_nome}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">
                    Veículo
                  </p>
                  <p className="font-semibold truncate">
                    {selectedRelatorio.veiculo_descricao}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">
                    Expedição
                  </p>
                  <p className="font-semibold truncate">
                    {selectedRelatorio.responsavel_expedicao || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">
                    Retorno
                  </p>
                  <p className="font-semibold truncate">
                    {selectedRelatorio.hora_retorno
                      ? format(
                          new Date(selectedRelatorio.hora_retorno),
                          "HH:mm"
                        )
                      : (selectedRelatorio.rota || []).slice(-1)[0]
                          ?.estimated_arrival || "-"}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {selectedRelatorio.hora_retorno ? "Registrado" : "Previsto"}
                  </p>
                </div>
              </div>

              {/* Lista de Entregas */}
              <div>
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  Registro de Ocorrências
                </h3>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {(selectedRelatorio.rota || [])
                    .slice(1, -1)
                    .map((item, idx) => {
                      const originalIndex = idx + 1;

                      return (
                        <div
                          key={idx}
                          className="flex flex-col gap-3 p-4 bg-white border border-gray-200 rounded-lg shadow-sm"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-900">
                                {item.client_name}
                              </p>
                              <p className="text-sm text-gray-500 truncate">
                                {item.address}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              {item.status === "delivered" &&
                                item.deliveredAt && (
                                  <Badge className="bg-green-100 text-green-700 text-xs">
                                    Entregue:{" "}
                                    {format(
                                      new Date(item.deliveredAt),
                                      "HH:mm"
                                    )}
                                  </Badge>
                                )}
                              {item.estimated_arrival && (
                                <Badge
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  Previsto: {item.estimated_arrival}
                                </Badge>
                              )}
                              {(item.status === "problem" ||
                                item.occurrenceType) && (
                                <Badge className="bg-red-100 text-red-700 text-xs">
                                  Problema
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="ml-11">
                            <label className="text-xs font-semibold text-gray-500 mb-1 block">
                              Observações / Ocorrência:
                            </label>
                            <Textarea
                              placeholder="Ex: Cliente ausente, endereço não localizado..."
                              value={occurrences[originalIndex] || ""}
                              onChange={(e) =>
                                setOccurrences((prev) => ({
                                  ...prev,
                                  [originalIndex]: e.target.value,
                                }))
                              }
                              className="text-sm min-h-[60px] bg-yellow-50/50 border-yellow-200 focus:border-yellow-400"
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 mt-4 border-t pt-4">
            <Button
              variant="outline"
              onClick={() => setShowDetailDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveOccurrences}
              disabled={isSavingOccurrences}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isSavingOccurrences ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Ocorrências
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Horário */}
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
              Selecione o intervalo de horário para filtrar os relatórios de
              hoje.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  De:
                </label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-10"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Até:
                </label>
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
            <Button onClick={() => setShowTimeDialog(false)}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Roteiro */}
      <RoteiroEntregaDialog
        open={showRoteiroDialog}
        onClose={() => setShowRoteiroDialog(false)}
        userEmail={currentUser?.email}
      />
    </div>
  );
}
