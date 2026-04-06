import React, { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import BottomNav from "../components/driver/BottomNav";
import DeliveryCard from "../components/driver/DeliveryCard";
import MarkDeliveredDialog from "../components/driver/MarkDeliveredDialog";
import OccurrenceDialog from "../components/driver/OccurrenceDialog";
import { recalculateRemainingETAs } from "@/lib/recalculateETA";

const API_BATCH_SIZE = 50;

export default function DriverRouteView() {
  const urlParams = new URLSearchParams(window.location.search);
  const rotaId = urlParams.get("rotaId");

  const [rota, setRota] = useState(null);
  const [configs, setConfigs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [markDeliveredOpen, setMarkDeliveredOpen] = useState(false);
  const [occurrenceOpen, setOccurrenceOpen] = useState(false);

  // Evita atualizar status mais de uma vez
  const statusUpdatedRef = useRef(false);
  const queryClient = useQueryClient();

  // ========== CARREGAMENTO DA ROTA ==========
  const loadRota = useCallback(async () => {
    if (!rotaId) return;

    setIsLoading(true);
    try {
      const rotas = await base44.entities.RotaAgendada.filter({ id: rotaId });
      const rotaData = rotas?.[0] || null;
      setRota(rotaData);

      // Carrega configs do gestor (owner) para recálculo de ETAs
      if (rotaData) {
        const ownerEmail = rotaData.owner || rotaData.created_by;
        if (ownerEmail) {
          try {
            const allConfigs = await base44.entities.Configuracao.filter({
              owner: ownerEmail,
            });
            setConfigs(allConfigs || []);
          } catch {
            // RLS pode bloquear — segue sem configs (usa fallback)
            setConfigs([]);
          }
        }
      }
    } catch (error) {
      console.error("Erro ao carregar rota:", error);
      setRota(null);
    } finally {
      setIsLoading(false);
    }
  }, [rotaId]);

  useEffect(() => {
    loadRota();
  }, [loadRota]);

  // ========== ATUALIZA STATUS PARA "EM_ANDAMENTO" (uma única vez) ==========
  useEffect(() => {
    if (!rota || statusUpdatedRef.current) return;

    if (rota.status === "agendado" || rota.status === "liberado") {
      statusUpdatedRef.current = true;
      base44.entities.RotaAgendada.update(rotaId, {
        status: "em_andamento",
      })
        .then(() => {
          setRota((prev) => (prev ? { ...prev, status: "em_andamento" } : prev));
        })
        .catch((err) => {
          console.error("Erro ao atualizar status da rota:", err);
          statusUpdatedRef.current = false;
        });
    }
  }, [rota?.id, rota?.status, rotaId]);

  // ========== DADOS DERIVADOS ==========
  const entregas = rota?.rota?.slice(1, -1) || [];
  const completedCount = entregas.filter(
    (d) => d.status === "delivered"
  ).length;
  const progress =
    entregas.length > 0 ? (completedCount / entregas.length) * 100 : 0;
  const nextDelivery = entregas.find(
    (d) => d.status !== "delivered" && d.status !== "problem"
  );

  // ========== HELPERS ==========
  const handleNavigate = useCallback((delivery) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${delivery.latitude},${delivery.longitude}`;
    window.open(url, "_blank");
  }, []);

  const handleCall = useCallback((phone) => {
    window.open(`tel:${phone}`, "_self");
  }, []);

  const handleMarkDelivered = useCallback((delivery) => {
    setSelectedDelivery(delivery);
    setMarkDeliveredOpen(true);
  }, []);

  const handleOccurrence = useCallback((delivery) => {
    setSelectedDelivery(delivery);
    setOccurrenceOpen(true);
  }, []);

  // ========== CONFIRMAR ENTREGA ==========
  const handleConfirmDelivery = useCallback(
    async ({ notes, receivedBy, photoUrl }) => {
      if (!selectedDelivery || !rota || isSaving) return;

      setIsSaving(true);
      try {
        let updatedRota = rota.rota.map((item) =>
          item.order === selectedDelivery.order
            ? {
                ...item,
                status: "delivered",
                deliveredAt: new Date().toISOString(),
                notes: notes || item.notes,
                receivedBy,
                photoUrl,
              }
            : item
        );

        // Verifica se todas entregas foram concluídas
        const entregasAtualizadas = updatedRota.slice(1, -1);
        const todasConcluidas = entregasAtualizadas.every(
          (e) => e.status === "delivered" || e.status === "problem"
        );
        const novoStatus = todasConcluidas ? "concluido" : "em_andamento";

        // Recalcula ETAs para paradas restantes
        if (!todasConcluidas) {
          setIsRecalculating(true);
          const serviceTime =
            Number(
              configs.find((c) => c.chave === "tempo_parada_entrega")?.valor
            ) ||
            Number(rota.tempo_parada_entrega) ||
            20;
          const trafficBuffer =
            Number(
              configs.find((c) => c.chave === "margem_transito")?.valor
            ) ||
            Number(rota.margem_transito) ||
            10;
          const mapboxToken =
            configs.find((c) => c.chave === "mapbox_token")?.valor ||
            rota.mapbox_token ||
            null;

          try {
            updatedRota = await recalculateRemainingETAs(
              updatedRota,
              selectedDelivery.order,
              serviceTime,
              trafficBuffer,
              mapboxToken
            );
          } catch (err) {
            console.warn("Erro no recálculo de ETAs:", err);
          }
          setIsRecalculating(false);
        }

        // Salva rota atualizada
        await base44.entities.RotaAgendada.update(rotaId, {
          rota: updatedRota,
          status: novoStatus,
        });

        // Atualiza estado local imediatamente (sem precisar recarregar)
        setRota((prev) => ({
          ...prev,
          rota: updatedRota,
          status: novoStatus,
        }));

        // Se concluída, atualiza/cria relatório
        if (todasConcluidas) {
          await atualizarRelatorio(
            updatedRota,
            entregasAtualizadas
          );
        }

        setMarkDeliveredOpen(false);
        setSelectedDelivery(null);
        toast.success("Entrega confirmada com sucesso!");

        // Invalida cache do dashboard do motorista
        queryClient.invalidateQueries({ queryKey: ["rotas-motorista-hoje"] });
      } catch (err) {
        console.error("Erro ao confirmar entrega:", err);
        toast.error("Erro ao salvar. Tente novamente.");
      } finally {
        setIsSaving(false);
        setIsRecalculating(false);
      }
    },
    [selectedDelivery, rota, isSaving, configs, rotaId, queryClient]
  );

  // ========== RELATÓRIO (extraído para manter handleConfirmDelivery legível) ==========
  const atualizarRelatorio = useCallback(
    async (updatedRota, entregasAtualizadas) => {
      try {
        const entregasRealizadas = entregasAtualizadas.filter(
          (e) => e.status === "delivered"
        ).length;
        const entregasComProblema = entregasAtualizadas.filter(
          (e) => e.status === "problem"
        ).length;

        // Busca relatório vinculado (com paginação completa)
        let allRelatorios = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const batch = await base44.entities.Relatorio.filter(
            { rota_agendada_id: rotaId },
            "-created_date",
            API_BATCH_SIZE,
            offset
          );
          if (batch && batch.length > 0) {
            allRelatorios = [...allRelatorios, ...batch];
            offset += batch.length;
            hasMore = batch.length === API_BATCH_SIZE;
          } else {
            hasMore = false;
          }
        }

        if (allRelatorios.length > 0) {
          await base44.entities.Relatorio.update(allRelatorios[0].id, {
            rota: updatedRota,
            status: "concluido",
            data_conclusao: new Date().toISOString(),
            entregas_realizadas: entregasRealizadas,
            entregas_com_problema: entregasComProblema,
          });
        } else {
          await base44.entities.Relatorio.create({
            data_impressao: new Date().toISOString(),
            motorista_nome: rota.motorista_nome || "",
            motorista_telefone: "",
            veiculo_descricao: rota.veiculo_descricao || "",
            veiculo_placa: rota.veiculo_placa || "",
            total_entregas: entregasAtualizadas.length,
            distancia_km: rota.distancia_km || 0,
            tempo_minutos: rota.tempo_minutos || 0,
            endereco_matriz: rota.endereco_matriz || "",
            rota: updatedRota,
            total_volumes: rota.total_volumes || 0,
            rota_agendada_id: rotaId,
            status: "concluido",
            data_conclusao: new Date().toISOString(),
            entregas_realizadas: entregasRealizadas,
            entregas_com_problema: entregasComProblema,
            owner: rota.owner || rota.created_by,
          });
        }
      } catch (err) {
        console.error("Erro ao atualizar relatório:", err);
        // Não bloqueia o fluxo — entrega já foi salva
      }
    },
    [rotaId, rota]
  );

  // ========== CONFIRMAR OCORRÊNCIA ==========
  const handleConfirmOccurrence = useCallback(
    async (occurrenceType, description) => {
      if (!selectedDelivery || !rota || isSaving) return;

      setIsSaving(true);
      try {
        const updatedRota = rota.rota.map((item) =>
          item.order === selectedDelivery.order
            ? {
                ...item,
                status: "problem",
                occurrenceType,
                occurrenceDescription: `${occurrenceType}: ${description}`,
              }
            : item
        );

        await base44.entities.RotaAgendada.update(rotaId, {
          rota: updatedRota,
        });

        // Atualiza estado local
        setRota((prev) => ({ ...prev, rota: updatedRota }));

        setOccurrenceOpen(false);
        setSelectedDelivery(null);
        toast.error("Ocorrência registrada");

        queryClient.invalidateQueries({ queryKey: ["rotas-motorista-hoje"] });
      } catch (err) {
        console.error("Erro ao registrar ocorrência:", err);
        toast.error("Erro ao salvar ocorrência. Tente novamente.");
      } finally {
        setIsSaving(false);
      }
    },
    [selectedDelivery, rota, isSaving, rotaId, queryClient]
  );

  // ========== EARLY RETURNS ==========
  if (!rotaId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 pb-24">
        <div className="text-center px-4">
          <h2 className="text-xl font-semibold mb-4">Rota não encontrada</h2>
          <Button asChild size="lg">
            <Link to={createPageUrl("DriverDashboard")}>Voltar</Link>
          </Button>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 pb-24 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-gray-500">Carregando rota...</p>
        <BottomNav />
      </div>
    );
  }

  if (!rota) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 pb-24">
        <div className="text-center px-4">
          <h2 className="text-xl font-semibold mb-4">Rota não encontrada</h2>
          <Button asChild size="lg">
            <Link to={createPageUrl("DriverDashboard")}>Voltar</Link>
          </Button>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ========== RENDER ==========
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-40">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to={createPageUrl("DriverDashboard")}>
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">
                Rota {rota.data_prevista}
              </h1>
              <p className="text-sm text-gray-500">
                {rota.veiculo_descricao} - {rota.veiculo_placa}
              </p>
            </div>
            {(isSaving || isRecalculating) && (
              <div className="flex items-center gap-1.5 text-blue-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">
                  {isRecalculating ? "Recalculando..." : "Salvando..."}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Progresso</span>
              <span className="font-semibold">
                {completedCount} de {entregas.length} entregas
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        {entregas.map((delivery) => (
          <DeliveryCard
            key={delivery.order}
            delivery={delivery}
            isNext={delivery.order === nextDelivery?.order}
            onMarkDelivered={handleMarkDelivered}
            onReportOccurrence={handleOccurrence}
            onNavigate={handleNavigate}
            onCall={handleCall}
          />
        ))}

        {/* Rota Concluída */}
        {completedCount === entregas.length && entregas.length > 0 && (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Rota Concluída!
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              Todas as entregas foram finalizadas
            </p>
            <Button asChild size="lg">
              <Link to={createPageUrl("DriverDashboard")}>
                Voltar ao Dashboard
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <MarkDeliveredDialog
        open={markDeliveredOpen}
        onOpenChange={setMarkDeliveredOpen}
        onConfirm={handleConfirmDelivery}
        delivery={selectedDelivery}
        isSaving={isSaving}
      />

      <OccurrenceDialog
        open={occurrenceOpen}
        onOpenChange={setOccurrenceOpen}
        onConfirm={handleConfirmOccurrence}
        delivery={selectedDelivery}
        isSaving={isSaving}
      />

      <BottomNav />
    </div>
  );
}
