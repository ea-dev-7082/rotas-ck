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
  // DialogFooter removido para evitar erros de importação
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import moment from "moment";

export default function Relatorios() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedRelatorio, setSelectedRelatorio] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // Filtros
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterLabel, setFilterLabel] = useState("Todos");

  // Ocorrências (Estado local)
  const [occurrences, setOccurrences] = useState({});

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  // --- QUERY DE DADOS ---
  const { data: relatorios, isLoading } = useQuery({
    queryKey: ["relatorios", currentUser?.email],
    queryFn: () =>
      currentUser
        ? base44.entities.Relatorio.filter(
            { owner: currentUser.email },
            "-created_date"
          )
        : [],
    enabled: !!currentUser,
    initialData: [],
  });

  // --- FILTRAGEM ---
  const filteredRelatorios = useMemo(() => {
    return relatorios.filter((relatorio) => {
      if (!startDate && !endDate) return true;

      const dataRelatorio = moment(relatorio.data_impressao);
      const start = startDate ? moment(startDate).startOf("day") : null;
      const end = endDate ? moment(endDate).endOf("day") : null;

      if (start && dataRelatorio.isBefore(start)) return false;
      if (end && dataRelatorio.isAfter(end)) return false;

      return true;
    });
  }, [relatorios, startDate, endDate]);

  // --- ESTATÍSTICAS ---
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

  // --- MUTAÇÕES ---
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Relatorio.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
    },
  });

  const updateOcorrenciasMutation = useMutation({
    mutationFn: async ({ id, rotaAtualizada }) => {
      return base44.entities.Relatorio.update(id, { rota: rotaAtualizada });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
      setShowDetailDialog(false);
      // alert("Ocorrências salvas com sucesso!"); // Pode descomentar se quiser feedback visual
    },
  });

  // --- FUNÇÕES AUXILIARES ---
  const applyQuickFilter = (type) => {
    const now = moment();
    if (type === "dia") {
      setStartDate(now.format("YYYY-MM-DD"));
      setEndDate(now.format("YYYY-MM-DD"));
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

  const handleViewDetails = (relatorio) => {
    setSelectedRelatorio(relatorio);
    const initialOccurrences = {};
    if (relatorio.rota) {
        relatorio.rota.forEach((item, index) => {
            if (item.ocorrencia) {
                initialOccurrences[index] = item.ocorrencia;
            }
        });
    }
    setOccurrences(initialOccurrences);
    setShowDetailDialog(true);
  };

  const handleSaveOccurrences = () => {
    if (!selectedRelatorio) return;

    const novaRota = selectedRelatorio.rota.map((item, index) => ({
        ...item,
        ocorrencia: occurrences[index] || ""
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
            <div class="info-value">${relatorio.veiculo_descricao || "Não informado"}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Total de Entregas</div>
            <div class="info-value">${relatorio.total_entregas || 0}</div>
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
                <td>${item.ocorrencia || "-"}</td>
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
              <h1 className="text-3xl font-bold text-gray-900">Relatórios de Rotas</h1>
              <p className="text-gray-600">Gestão de entregas e ocorrências</p>
            </div>
          </div>

          <div className="flex bg-white p-1 rounded-lg border shadow-sm">
            <Button variant={filterLabel === "Hoje" ? "default" : "ghost"} size="sm" onClick={() => applyQuickFilter("dia")}>Dia</Button>
            <Button variant={filterLabel === "Esta Semana" ? "default" : "ghost"} size="sm" onClick={() => applyQuickFilter("semana")}>Semana</Button>
            <Button variant={filterLabel === "Este Mês" ? "default" : "ghost"} size="sm" onClick={() => applyQuickFilter("mes")}>Mês</Button>
            <Button variant={filterLabel === "Todos" ? "default" : "ghost"} size="sm" onClick={() => applyQuickFilter("todos")}>Todos</Button>
          </div>
        </motion.div>

        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"
        >
            <Card><CardContent className="p-4 flex flex-col items-center justify-center text-center"><p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Rotas</p><p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalRotas}</p></CardContent></Card>
            <Card><CardContent className="p-4 flex flex-col items-center justify-center text-center"><p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Entregas</p><p className="text-2xl font-bold text-purple-600 mt-1">{stats.totalEntregas}</p></CardContent></Card>
            <Card><CardContent className="p-4 flex flex-col items-center justify-center text-center"><p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Km</p><p className="text-2xl font-bold text-blue-600 mt-1">{stats.totalKm.toFixed(1)} km</p></CardContent></Card>
            <Card><CardContent className="p-4 flex flex-col items-center justify-center text-center"><p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Tempo</p><p className="text-2xl font-bold text-orange-600 mt-1">{Math.floor(stats.totalTempo / 60)}h {stats.totalTempo % 60}m</p></CardContent></Card>
        </motion.div>

        <Card className="bg-white shadow-xl border-0">
          <CardHeader className="border-b border-gray-100 pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <BarChart3 className="w-5 h-5 text-gray-500" />
                Histórico: <span className="text-purple-600">{filterLabel}</span>
              </CardTitle>
              <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                  <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setFilterLabel("Personalizado"); }} className="h-8 w-[130px] bg-white text-xs" />
                  <span className="text-gray-400 text-xs">até</span>
                  <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setFilterLabel("Personalizado"); }} className="h-8 w-[130px] bg-white text-xs" />
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-6">
            {isLoading ? <div className="text-center py-8 text-gray-500">Carregando...</div> : filteredRelatorios.length === 0 ? <div className="text-center py-12 text-gray-500">Nenhum relatório encontrado</div> : (
              <ScrollArea className="max-h-[600px]">
                <div className="space-y-4">
                  <AnimatePresence>
                    {filteredRelatorios.map((relatorio) => (
                      <motion.div key={relatorio.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 border border-gray-200 rounded-xl bg-white hover:bg-gray-50">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Badge className="bg-gray-100 text-gray-700"><Calendar className="w-3 h-3 mr-1" />{moment(relatorio.data_impressao).format("DD/MM/YYYY")}</Badge>
                              <Badge className="bg-purple-100 text-purple-700">{relatorio.total_entregas || 0} entregas</Badge>
                            </div>
                            <div className="flex gap-4 text-sm text-gray-600">
                                <span>{relatorio.motorista_nome}</span>
                                <span>{relatorio.veiculo_descricao}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleViewDetails(relatorio)} className="text-blue-600 border-blue-200"><Eye className="w-4 h-4 mr-2" /> Detalhes</Button>
                            <Button variant="ghost" size="icon" onClick={() => handlePrintRelatorio(relatorio)}><Printer className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(relatorio.id)} className="text-red-500"><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl"><FileText className="w-6 h-6 text-purple-600" /> Detalhes e Ocorrências</DialogTitle>
          </DialogHeader>
          {selectedRelatorio && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div><p className="text-xs text-gray-500 font-bold">Data</p><p>{moment(selectedRelatorio.data_impressao).format("DD/MM/YYYY")}</p></div>
                <div><p className="text-xs text-gray-500 font-bold">Motorista</p><p>{selectedRelatorio.motorista_nome}</p></div>
              </div>
              <div>
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-orange-500" /> Ocorrências</h3>
                <div className="space-y-4">
                  {(selectedRelatorio.rota || []).slice(1, -1).map((item, idx) => {
                    const originalIndex = idx + 1; 
                    return (
                    <div key={idx} className="flex flex-col gap-2 p-3 border rounded-lg">
                      <div className="flex justify-between font-bold"><span>{idx + 1}. {item.client_name}</span></div>
                      {/* SUBTITUIÇÃO: Usando textarea HTML padrão em vez do componente Textarea */}
                      <textarea
                        placeholder="Observações..."
                        value={occurrences[originalIndex] || ""}
                        onChange={(e) => setOccurrences(prev => ({ ...prev, [originalIndex]: e.target.value }))}
                        className="w-full p-2 border rounded-md text-sm bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        rows={2}
                      />
                    </div>
                  )})}
                </div>
              </div>
            </div>
          )}
          {/* SUBSTITUIÇÃO: Usando div em vez de DialogFooter */}
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Cancelar</Button>
                <Button onClick={handleSaveOccurrences} disabled={updateOcorrenciasMutation.isPending} className="bg-green-600 text-white hover:bg-green-700">
                    <Save className="w-4 h-4 mr-2" /> Salvar
                </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}