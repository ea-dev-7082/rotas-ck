import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input"; // NOVO: Import do Input
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  Filter, // NOVO: Ícone de filtro
  X, // NOVO: Ícone para limpar
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import moment from "moment";

export default function Relatorios() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedRelatorio, setSelectedRelatorio] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // NOVO: Estados para o filtro de datas
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

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

  // NOVO: Lógica de filtragem no front-end
  const filteredRelatorios = relatorios.filter((relatorio) => {
    if (!startDate && !endDate) return true;

    const dataRelatorio = moment(relatorio.data_impressao);
    const start = startDate ? moment(startDate).startOf("day") : null;
    const end = endDate ? moment(endDate).endOf("day") : null;

    if (start && dataRelatorio.isBefore(start)) return false;
    if (end && dataRelatorio.isAfter(end)) return false;

    return true;
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Relatorio.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["relatorios"] });
    },
  });

  const handleViewDetails = (relatorio) => {
    setSelectedRelatorio(relatorio);
    setShowDetailDialog(true);
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
          <div class="info-item" style="grid-column: span 2;">
            <div class="info-label">Matriz</div>
            <div class="info-value">${relatorio.endereco_matriz || "Não informado"}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Cliente</th>
              <th>Endereço</th>
              <th>Chegada Prevista</th>
            </tr>
          </thead>
          <tbody>
            ${entregas.map((item, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${item.client_name}</td>
                <td>${item.address}</td>
                <td>${item.estimated_arrival || "-"}</td>
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
      <div className="container mx-auto max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Relatórios</h1>
              <p className="text-gray-600">Histórico de rotas impressas</p>
            </div>
          </div>
        </motion.div>

        {/* Lista de Relatórios */}
        <Card className="bg-white shadow-xl">
          <CardHeader className="border-b border-gray-100 pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Route className="w-5 h-5 text-purple-600" />
                Rotas Salvas ({filteredRelatorios.length})
              </CardTitle>

              {/* NOVO: Área de Filtros */}
              <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 font-medium whitespace-nowrap hidden sm:inline">
                    <Filter className="w-3 h-3 inline mr-1" />
                    Período:
                  </span>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-8 w-[130px] bg-white text-xs"
                  />
                  <span className="text-gray-400 text-xs">até</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-8 w-[130px] bg-white text-xs"
                  />
                </div>
                {(startDate || endDate) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setStartDate("");
                      setEndDate("");
                    }}
                    className="h-8 w-8 text-gray-500 hover:text-red-500"
                    title="Limpar filtros"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-6">
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">
                Carregando...
              </div>
            ) : filteredRelatorios.length === 0 ? (
              // ALTERAÇÃO: Mensagem diferente se for filtro ou lista vazia real
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">
                  {relatorios.length === 0
                    ? "Nenhum relatório salvo"
                    : "Nenhum relatório encontrado neste período"}
                </p>
                {relatorios.length === 0 && (
                  <p className="text-sm">
                    Os relatórios são salvos ao imprimir uma rota
                  </p>
                )}
              </div>
            ) : (
              <ScrollArea className="max-h-[600px]">
                <div className="space-y-4">
                  <AnimatePresence>
                    {/* ALTERAÇÃO: Usando filteredRelatorios no map */}
                    {filteredRelatorios.map((relatorio) => (
                      <motion.div
                        key={relatorio.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="p-4 border-2 rounded-xl hover:shadow-md transition-all bg-gradient-to-r from-white to-gray-50"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Badge className="bg-purple-100 text-purple-700">
                                <Calendar className="w-3 h-3 mr-1" />
                                {moment(relatorio.data_impressao).format(
                                  "DD/MM/YYYY"
                                )}
                              </Badge>
                              <Badge variant="outline">
                                <Clock className="w-3 h-3 mr-1" />
                                {moment(relatorio.data_impressao).format(
                                  "HH:mm"
                                )}
                              </Badge>
                              <Badge className="bg-blue-100 text-blue-700">
                                <MapPin className="w-3 h-3 mr-1" />
                                {relatorio.total_entregas || 0} entregas
                              </Badge>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-600 mt-3">
                              {relatorio.motorista_nome && (
                                <div className="flex items-center gap-1">
                                  <User className="w-4 h-4 text-gray-400" />
                                  {relatorio.motorista_nome}
                                </div>
                              )}
                              {relatorio.veiculo_descricao && (
                                <div className="flex items-center gap-1">
                                  <Truck className="w-4 h-4 text-gray-400" />
                                  {relatorio.veiculo_descricao}
                                </div>
                              )}
                              {relatorio.distancia_km && (
                                <div className="flex items-center gap-1">
                                  <Route className="w-4 h-4 text-gray-400" />
                                  {relatorio.distancia_km.toFixed(1)} km
                                </div>
                              )}
                              {relatorio.tempo_minutos && (
                                <div className="flex items-center gap-1">
                                  <Clock className="w-4 h-4 text-gray-400" />
                                  {Math.floor(relatorio.tempo_minutos / 60)}h{" "}
                                  {relatorio.tempo_minutos % 60}min
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-2 ml-4">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewDetails(relatorio)}
                              className="hover:bg-blue-50 hover:text-blue-600"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePrintRelatorio(relatorio)}
                              className="hover:bg-green-50 hover:text-green-600"
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(relatorio.id)}
                              className="hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
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

      {/* Dialog de Detalhes (Sem alterações, código omitido para brevidade se desejar, mas mantido funcionalmente igual) */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              Detalhes do Relatório
            </DialogTitle>
          </DialogHeader>

          {selectedRelatorio && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 font-medium">Data/Hora Impressão</p>
                  <p className="font-semibold">
                    {moment(selectedRelatorio.data_impressao).format("DD/MM/YYYY [às] HH:mm")}
                  </p>
                </div>
                {/* ... Resto dos detalhes ... */}
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 font-medium">Total de Entregas</p>
                  <p className="font-semibold">{selectedRelatorio.total_entregas || 0}</p>
                </div>
                {/* Mantive a estrutura original do modal aqui */}
                 <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 font-medium">Motorista</p>
                  <p className="font-semibold">{selectedRelatorio.motorista_nome || "Não informado"}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 font-medium">Veículo</p>
                  <p className="font-semibold">
                    {selectedRelatorio.veiculo_descricao || "Não informado"}
                    {selectedRelatorio.veiculo_placa && ` (${selectedRelatorio.veiculo_placa})`}
                  </p>
                </div>
                 <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 font-medium">Distância</p>
                  <p className="font-semibold">{selectedRelatorio.distancia_km?.toFixed(1) || 0} km</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 font-medium">Tempo Estimado</p>
                  <p className="font-semibold">
                    {Math.floor((selectedRelatorio.tempo_minutos || 0) / 60)}h {(selectedRelatorio.tempo_minutos || 0) % 60}min
                  </p>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 font-medium mb-1">Matriz</p>
                <p className="text-sm">{selectedRelatorio.endereco_matriz || "Não informado"}</p>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">Rota</p>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {(selectedRelatorio.rota || []).slice(1, -1).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 bg-blue-50 rounded-lg">
                      <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.client_name}</p>
                        <p className="text-xs text-gray-500">{item.address}</p>
                      </div>
                      {item.estimated_arrival && (
                        <Badge variant="outline" className="text-xs">
                          {item.estimated_arrival}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}