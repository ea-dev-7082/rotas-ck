import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Home, CheckCircle2, Loader2, X } from "lucide-react";
import { format } from "date-fns";

const API_BATCH_SIZE = 50;

/**
 * Busca TODOS os relatórios paginando em batches.
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

export default function ReturnPanel({ rotas, onDismiss, onRotaUpdated }) {
  const [closingId, setClosingId] = useState(null);
  const [dismissingId, setDismissingId] = useState(null);
  const [relatoriosVinculados, setRelatoriosVinculados] = useState([]);
  const [isLoadingRelatorios, setIsLoadingRelatorios] = useState(false);

  // IDs das rotas visíveis
  const rotaIdsKey = rotas.map((r) => r.id).sort().join(",");

  // ========== CARREGAMENTO DE RELATÓRIOS VINCULADOS ==========
  const loadRelatoriosVinculados = useCallback(async () => {
    const rotaIds = rotas.map((r) => r.id);
    if (rotaIds.length === 0) {
      setRelatoriosVinculados([]);
      return;
    }

    setIsLoadingRelatorios(true);
    try {
      const allRelatorios = await fetchAllPaginated(
        base44.entities.Relatorio,
        "-created_date"
      );

      // Filtra apenas os vinculados às rotas visíveis
      const rotaIdSet = new Set(rotaIds);
      const vinculados = allRelatorios.filter((r) =>
        rotaIdSet.has(r.rota_agendada_id)
      );

      setRelatoriosVinculados(vinculados);
    } catch (error) {
      console.error("Erro ao carregar relatórios vinculados:", error);
      setRelatoriosVinculados([]);
    } finally {
      setIsLoadingRelatorios(false);
    }
  }, [rotaIdsKey]);

  useEffect(() => {
    loadRelatoriosVinculados();
  }, [loadRelatoriosVinculados]);

  // ========== HELPER: buscar relatório por rota ==========
  const getRelatorioParaRota = useCallback(
    (rotaId) => {
      return relatoriosVinculados.find((r) => r.rota_agendada_id === rotaId);
    },
    [relatoriosVinculados]
  );

  // ========== PASSO 1: Marcar como concluído ==========
  const handleRetornou = useCallback(
    async (rota) => {
      if (closingId) return;
      setClosingId(rota.id);

      const relatorio = getRelatorioParaRota(rota.id);
      const horaRetorno =
        rota.hora_retorno || relatorio?.hora_retorno || new Date().toISOString();

      try {
        const rotaAtualizada = await base44.entities.RotaAgendada.update(
          rota.id,
          {
            status: "concluido",
            hora_retorno: horaRetorno,
          }
        );

        const rotaMaisRecente = rotaAtualizada || rota;

        if (relatorio) {
          const rotaRealAtualizada = (rotaMaisRecente.rota || []).map(
            (item) => ({
              order: item.order,
              client_name: item.client_name,
              address: item.address,
              estimated_arrival: item.estimated_arrival,
              latitude: item.latitude,
              longitude: item.longitude,
              notas_fiscais: item.notas_fiscais || [],
              volume_total: item.volume_total || 0,
              status: item.status || null,
              deliveredAt: item.deliveredAt || null,
              receivedBy: item.receivedBy || null,
              notes: item.notes || null,
              occurrenceType: item.occurrenceType || null,
              occurrenceDescription: item.occurrenceDescription || null,
            })
          );

          await base44.entities.Relatorio.update(relatorio.id, {
            rota: rotaRealAtualizada,
            hora_retorno: horaRetorno,
            status: "concluido",
          });

          // Atualiza o relatório no state local
          setRelatoriosVinculados((prev) =>
            prev.map((r) =>
              r.id === relatorio.id
                ? { ...r, hora_retorno: horaRetorno, status: "concluido" }
                : r
            )
          );
        }

        // Notifica o parent para atualizar dados
        if (onRotaUpdated) onRotaUpdated(rota.id, "concluido");
      } catch (error) {
        console.error("Erro ao finalizar rota:", error);
      } finally {
        setClosingId(null);
      }
    },
    [closingId, getRelatorioParaRota, onRotaUpdated]
  );

  // ========== PASSO 2: Dispensar definitivamente ==========
  const handleDismiss = useCallback(
    async (rota) => {
      if (dismissingId) return;
      setDismissingId(rota.id);

      try {
        const updates = {
          fechado_retorno: true,
          hora_retorno: rota.hora_retorno || new Date().toISOString(),
        };
        if (rota.status !== "concluido") {
          updates.status = "concluido";
        }

        await base44.entities.RotaAgendada.update(rota.id, updates);
      } catch (error) {
        console.error("Erro ao dispensar rota:", error);
      }

      // Remove da tela SEMPRE (mesmo com erro — não trava o usuário)
      if (onDismiss) onDismiss(rota.id);

      // Remove relatório vinculado do state local
      setRelatoriosVinculados((prev) =>
        prev.filter((r) => r.rota_agendada_id !== rota.id)
      );

      setDismissingId(null);
    },
    [dismissingId, onDismiss]
  );

  // ========== EMPTY STATE ==========
  if (rotas.length === 0) {
    return (
      <Card className="bg-white border-dashed">
        <CardContent className="p-6 text-center text-gray-400">
          <Home className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum motorista em retorno</p>
        </CardContent>
      </Card>
    );
  }

  // ========== RENDER ==========
  return (
    <div className="space-y-3">
      {rotas.map((rota) => {
        const entregas = rota.rota?.slice(1, -1) || [];
        const entregues = entregas.filter(
          (e) => e.status === "delivered"
        ).length;
        const problemas = entregas.filter(
          (e) => e.status === "problem"
        ).length;
        const isClosing = closingId === rota.id;
        const isDismissing = dismissingId === rota.id;

        const ultimaEntrega = [...entregas]
          .filter((e) => e.deliveredAt)
          .sort(
            (a, b) => new Date(b.deliveredAt) - new Date(a.deliveredAt)
          )[0];

        const matrizRetorno = rota.rota?.[rota.rota.length - 1];

        const relatorio = getRelatorioParaRota(rota.id);
        const horaRetornoRegistrada =
          rota.hora_retorno || relatorio?.hora_retorno;
        const jaFinalizado = !!horaRetornoRegistrada;

        return (
          <Card
            key={rota.id}
            className="bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200 relative"
          >
            <CardContent className="p-4">
              {/* Botão X para dispensar rápido */}
              <button
                onClick={() => handleDismiss(rota)}
                disabled={isDismissing}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-gray-200/80 hover:bg-red-100 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors z-10"
                title="Dispensar da tela"
              >
                {isDismissing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <X className="w-3 h-3" />
                )}
              </button>

              <div className="flex items-center justify-between mb-2 pr-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                    <Home className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {rota.motorista_nome || "Motorista"}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {rota.veiculo_descricao} • {rota.veiculo_placa}
                    </p>
                  </div>
                </div>
                <Badge className="bg-emerald-100 text-emerald-800 text-xs shrink-0">
                  {jaFinalizado ? "Finalizado" : "Retornando"}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center mt-3">
                <div className="bg-white/60 rounded p-2">
                  <div className="text-sm font-bold text-green-600">
                    {entregues}
                  </div>
                  <div className="text-[10px] text-gray-500">Entregues</div>
                </div>
                <div className="bg-white/60 rounded p-2">
                  <div className="text-sm font-bold text-red-600">
                    {problemas}
                  </div>
                  <div className="text-[10px] text-gray-500">Problemas</div>
                </div>
                <div className="bg-white/60 rounded p-2">
                  <div className="text-sm font-bold text-gray-900">
                    {matrizRetorno?.estimated_arrival || "--:--"}
                  </div>
                  <div className="text-[10px] text-gray-500">ETA Retorno</div>
                </div>
              </div>

              {ultimaEntrega?.deliveredAt && (
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  Última entrega:{" "}
                  {format(new Date(ultimaEntrega.deliveredAt), "HH:mm")}
                </p>
              )}

              {horaRetornoRegistrada && (
                <p className="text-xs text-emerald-700 mt-1 flex items-center gap-1 font-medium">
                  <Home className="w-3 h-3" />
                  Retorno registrado:{" "}
                  {format(new Date(horaRetornoRegistrada), "HH:mm")}
                </p>
              )}

              {!jaFinalizado ? (
                <Button
                  onClick={() => handleRetornou(rota)}
                  disabled={isClosing || isDismissing}
                  className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {isClosing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Finalizando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Retornou
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={() => handleDismiss(rota)}
                  disabled={isDismissing || isClosing}
                  variant="ghost"
                  className="w-full mt-3 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-medium"
                >
                  {isDismissing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Removendo...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Rota Finalizada — Dispensar
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
