import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Truck, MapPin, Clock, CheckCircle2, AlertTriangle,
  Package, ArrowLeft, RefreshCw, Phone, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const statusLabels = {
  pending: "Pendente",
  in_progress: "Em Progresso",
  delivered: "Entregue",
  problem: "Problema",
};

const statusColors = {
  pending: "bg-gray-100 text-gray-800",
  in_progress: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  problem: "bg-red-100 text-red-800",
};

const statusIcons = {
  pending: <Clock className="w-4 h-4" />,
  in_progress: <Truck className="w-4 h-4" />,
  delivered: <CheckCircle2 className="w-4 h-4" />,
  problem: <AlertTriangle className="w-4 h-4" />,
};

const rotaStatusMap = {
  em_andamento: { label: "Em Andamento", className: "bg-blue-100 text-blue-800" },
  concluido: { label: "Concluída", className: "bg-green-100 text-green-800" },
  agendado: { label: "Agendada", className: "bg-gray-100 text-gray-800" },
  liberado: { label: "Liberada", className: "bg-yellow-100 text-yellow-800" },
  cancelado: { label: "Cancelada", className: "bg-red-100 text-red-800" },
};

export default function EmRota() {
  const urlParams = new URLSearchParams(window.location.search);
  const rotaId = urlParams.get("rotaId");

  const [rota, setRota] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // ========== CARREGAMENTO DA ROTA ==========
  const loadRota = useCallback(
    async (silent = false) => {
      if (!rotaId) return;

      if (!silent) setIsLoading(true);
      else setIsRefreshing(true);

      try {
        const rotas = await base44.entities.RotaAgendada.filter({ id: rotaId });
        setRota(rotas?.[0] || null);
        setLastUpdated(new Date());
      } catch (error) {
        console.error("Erro ao carregar rota:", error);
        if (!silent) setRota(null);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [rotaId]
  );

  // Carregamento inicial
  useEffect(() => {
    loadRota();
  }, [loadRota]);

  // ========== TEMPO REAL VIA SUBSCRIBE (sem polling redundante) ==========
  useEffect(() => {
    if (!rotaId) return;

    const unsubscribe = base44.entities.RotaAgendada.subscribe((event) => {
      // Recarrega silenciosamente quando houver mudança
      loadRota(true);
    });

    return unsubscribe;
  }, [rotaId, loadRota]);

  // ========== REFRESH MANUAL ==========
  const handleRefresh = () => {
    if (!isRefreshing) loadRota(true);
  };

  // ========== EARLY RETURNS ==========
  if (!rotaId) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Rota não especificada
          </h2>
          <Button asChild>
            <Link to={createPageUrl("Agendados")}>Voltar para Agendados</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-gray-500">Carregando rota...</p>
      </div>
    );
  }

  if (!rota) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Rota não encontrada
          </h2>
          <p className="text-gray-500 mb-6">
            A rota solicitada não existe ou foi removida.
          </p>
          <Button asChild>
            <Link to={createPageUrl("Agendados")}>Voltar para Agendados</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ========== DADOS DERIVADOS ==========
  const entregas = rota.rota?.slice(1, -1) || [];
  const entregasRealizadas = entregas.filter(
    (e) => e.status === "delivered"
  ).length;
  const entregasComProblema = entregas.filter(
    (e) => e.status === "problem"
  ).length;
  const entregasPendentes = entregas.filter(
    (e) => !e.status || e.status === "pending"
  ).length;
  const entregasEmProgresso = entregas.filter(
    (e) => e.status === "in_progress"
  ).length;
  const progress =
    entregas.length > 0
      ? (entregasRealizadas / entregas.length) * 100
      : 0;

  // Tempo médio por entrega (com proteção contra NaN/Infinity)
  const entregasComTempo = entregas.filter((e) => e.deliveredAt);
  let tempoMedioEntrega = null;
  if (entregasComTempo.length >= 2) {
    let totalDiffMinutes = 0;
    let validPairs = 0;
    for (let i = 1; i < entregasComTempo.length; i++) {
      const prev = new Date(entregasComTempo[i - 1].deliveredAt);
      const curr = new Date(entregasComTempo[i].deliveredAt);
      if (!isNaN(prev.getTime()) && !isNaN(curr.getTime())) {
        const diffMin = (curr - prev) / 1000 / 60;
        if (diffMin > 0 && diffMin < 480) {
          // Ignora diffs negativos ou absurdos (> 8h)
          totalDiffMinutes += diffMin;
          validPairs++;
        }
      }
    }
    if (validPairs > 0) {
      tempoMedioEntrega = Math.round(totalDiffMinutes / validPairs);
    }
  }

  const rotaStatus = rotaStatusMap[rota.status] || {
    label: rota.status,
    className: "bg-gray-100 text-gray-800",
  };

  // ========== RENDER ==========
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to={createPageUrl("Agendados")}>
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Acompanhamento em Tempo Real
              </h1>
              <p className="text-sm text-gray-500">
                {rota.motorista_nome} • {rota.veiculo_descricao}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-gray-400 hidden sm:block">
                Atualizado às {format(lastUpdated, "HH:mm:ss")}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Atualizar
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                Status da Rota
              </CardTitle>
              <Badge className={rotaStatus.className}>{rotaStatus.label}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {entregas.length}
                </div>
                <div className="text-sm text-gray-500">Total</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {entregasRealizadas}
                </div>
                <div className="text-sm text-gray-500">Entregues</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {entregasEmProgresso}
                </div>
                <div className="text-sm text-gray-500">Em Progresso</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {entregasPendentes}
                </div>
                <div className="text-sm text-gray-500">Pendentes</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {entregasComProblema}
                </div>
                <div className="text-sm text-gray-500">Problemas</div>
              </div>
            </div>

            {/* Info adicional da rota */}
            {(rota.hora_saida || rota.km_inicial || tempoMedioEntrega || rota.total_volumes > 0) && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 pt-4 border-t">
                {rota.hora_saida && (
                  <div className="text-center p-3 bg-indigo-50 rounded-lg">
                    <div className="text-lg font-bold text-indigo-600">
                      {format(new Date(rota.hora_saida), "HH:mm")}
                    </div>
                    <div className="text-xs text-gray-500">Saída</div>
                  </div>
                )}
                {rota.km_inicial && (
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="text-lg font-bold text-purple-600">
                      {rota.km_inicial} km
                    </div>
                    <div className="text-xs text-gray-500">KM Inicial</div>
                  </div>
                )}
                {tempoMedioEntrega && (
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <div className="text-lg font-bold text-orange-600">
                      {tempoMedioEntrega} min
                    </div>
                    <div className="text-xs text-gray-500">
                      Tempo Médio/Entrega
                    </div>
                  </div>
                )}
                {rota.total_volumes > 0 && (
                  <div className="text-center p-3 bg-teal-50 rounded-lg">
                    <div className="text-lg font-bold text-teal-600">
                      {rota.total_volumes}
                    </div>
                    <div className="text-xs text-gray-500">Volumes</div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Progresso</span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>
          </CardContent>
        </Card>

        {/* Lista de Entregas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              Entregas ({entregas.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {entregas.map((entrega, index) => (
                <div
                  key={entrega.order ?? index}
                  className={`p-4 rounded-lg border transition-all ${
                    entrega.status === "delivered"
                      ? "bg-green-50 border-green-200"
                      : entrega.status === "problem"
                      ? "bg-red-50 border-red-200"
                      : entrega.status === "in_progress"
                      ? "bg-blue-50 border-blue-200"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium text-gray-900">
                          {index + 1}. {entrega.client_name}
                        </span>
                        <Badge
                          className={
                            statusColors[entrega.status || "pending"]
                          }
                        >
                          {statusIcons[entrega.status || "pending"]}
                          <span className="ml-1">
                            {statusLabels[entrega.status || "pending"]}
                          </span>
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{entrega.address}</span>
                      </div>

                      {entrega.phone && (
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Phone className="w-3 h-3 shrink-0" />
                          {entrega.phone}
                        </div>
                      )}

                      {entrega.status === "delivered" && (
                        <div className="mt-2 p-2 bg-green-100 rounded text-sm text-green-700 space-y-1">
                          <div className="font-medium">
                            ✓ Entregue às{" "}
                            {entrega.deliveredAt
                              ? format(new Date(entrega.deliveredAt), "HH:mm")
                              : "--:--"}
                          </div>
                          {entrega.receivedBy && (
                            <div>
                              👤 Recebido por:{" "}
                              <strong>{entrega.receivedBy}</strong>
                            </div>
                          )}
                          {entrega.photoUrl && (
                            <div className="mt-2">
                              <a
                                href={entrega.photoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 underline text-xs"
                              >
                                📷 Ver comprovante
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      {entrega.status === "problem" && (
                        <div className="mt-2 p-2 bg-red-100 rounded text-sm text-red-700 space-y-1">
                          <div className="font-medium">
                            ⚠️{" "}
                            {entrega.occurrenceType || "Problema registrado"}
                          </div>
                          {entrega.occurrenceDescription && (
                            <div className="text-red-600">
                              {entrega.occurrenceDescription}
                            </div>
                          )}
                          {entrega.deliveredAt && (
                            <div className="text-xs text-red-500">
                              Registrado às{" "}
                              {format(
                                new Date(entrega.deliveredAt),
                                "HH:mm"
                              )}
                            </div>
                          )}
                          {entrega.photoUrl && (
                            <div className="mt-1">
                              <a
                                href={entrega.photoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 underline text-xs"
                              >
                                📷 Ver foto da ocorrência
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      {entrega.notes && (
                        <div className="mt-2 text-sm text-gray-600 italic">
                          📝 {entrega.notes}
                        </div>
                      )}

                      {entrega.notas_fiscais &&
                        entrega.notas_fiscais.length > 0 && (
                          <div className="mt-2 text-xs text-gray-500">
                            📄 NF:{" "}
                            {entrega.notas_fiscais
                              .map((n) => n.numero)
                              .join(", ")}
                            {entrega.volume_total > 0 && (
                              <span className="ml-2">
                                • {entrega.volume_total} vol.
                              </span>
                            )}
                          </div>
                        )}
                    </div>

                    <div className="text-right text-sm space-y-1 shrink-0 ml-3">
                      <div className="text-gray-500 flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3" />
                        <span>
                          Prev: {entrega.estimated_arrival || "--:--"}
                        </span>
                      </div>
                      {entrega.status === "delivered" && entrega.deliveredAt && (
                        <div className="text-green-600 font-medium text-xs">
                          ✓ {format(new Date(entrega.deliveredAt), "HH:mm")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
