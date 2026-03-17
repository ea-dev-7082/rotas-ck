import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

export default function DriverRouteView() {
  const urlParams = new URLSearchParams(window.location.search);
  const rotaId = urlParams.get("rotaId");

  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [markDeliveredOpen, setMarkDeliveredOpen] = useState(false);
  const [occurrenceOpen, setOccurrenceOpen] = useState(false);

  const queryClient = useQueryClient();

  // Busca rota
  const { data: rota, isLoading } = useQuery({
    queryKey: ["rota-driver", rotaId],
    queryFn: async () => {
      const rotas = await base44.entities.RotaAgendada.filter({ id: rotaId });
      return rotas[0];
    },
    enabled: !!rotaId,
  });

  // Mutation para atualizar rota
  const updateRotaMutation = useMutation({
    mutationFn: (updatedRota) => base44.entities.RotaAgendada.update(rotaId, updatedRota),
    onSuccess: () => {
      queryClient.invalidateQueries(["rota-driver", rotaId]);
    },
  });

  // Extrai entregas (exclui matriz início e fim)
  const entregas = rota?.rota?.slice(1, -1) || [];
  const completedCount = entregas.filter((d) => d.status === "delivered").length;
  const progress = entregas.length > 0 ? (completedCount / entregas.length) * 100 : 0;

  // Encontra próxima entrega pendente
  const nextDelivery = entregas.find((d) => d.status !== "delivered" && d.status !== "problem");

  // Atualiza status da rota para "em_andamento" ao abrir
  useEffect(() => {
    if (rota && rota.status === "agendado") {
      updateRotaMutation.mutate({ status: "em_andamento" });
    }
  }, [rota?.id]);

  // Handlers
  const handleNavigate = (delivery) => {
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${delivery.latitude},${delivery.longitude}`;
    window.open(googleMapsUrl, "_blank");
  };

  const handleCall = (phone) => {
    window.open(`tel:${phone}`, "_self");
  };

  const handleMarkDelivered = (delivery) => {
    setSelectedDelivery(delivery);
    setMarkDeliveredOpen(true);
  };

  const handleOccurrence = (delivery) => {
    setSelectedDelivery(delivery);
    setOccurrenceOpen(true);
  };

  const handleConfirmDelivery = async ({ notes, receivedBy, photoUrl }) => {
    if (!selectedDelivery || !rota) return;

    const updatedRota = rota.rota.map((item) =>
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

    await updateRotaMutation.mutateAsync({
      rota: updatedRota,
      status: novoStatus,
    });

    // Atualiza relatório existente quando a rota é concluída
    if (todasConcluidas) {
      try {
        const entregasRealizadas = entregasAtualizadas.filter(e => e.status === "delivered").length;
        const entregasComProblema = entregasAtualizadas.filter(e => e.status === "problem").length;

        // Busca relatório vinculado a esta rota
        const relatorios = await base44.entities.Relatorio.filter({ rota_agendada_id: rotaId });
        
        if (relatorios.length > 0) {
          // Atualiza o relatório existente com dados de conclusão
          await base44.entities.Relatorio.update(relatorios[0].id, {
            rota: updatedRota,
            status: "concluido",
            data_conclusao: new Date().toISOString(),
            entregas_realizadas: entregasRealizadas,
            entregas_com_problema: entregasComProblema,
          });
        } else {
          // Fallback: cria relatório se não existir (rota antiga sem relatório vinculado)
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
      }
    }

    setMarkDeliveredOpen(false);
    setSelectedDelivery(null);
    toast.success("Entrega confirmada com sucesso!");
  };

  const handleConfirmOccurrence = async (occurrenceType, description) => {
    if (!selectedDelivery || !rota) return;

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

    await updateRotaMutation.mutateAsync({ rota: updatedRota });

    setOccurrenceOpen(false);
    setSelectedDelivery(null);
    toast.error("Ocorrência registrada");
  };

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 pb-24">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
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
            <h3 className="text-xl font-bold text-gray-900 mb-2">Rota Concluída!</h3>
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
      />

      <OccurrenceDialog
        open={occurrenceOpen}
        onOpenChange={setOccurrenceOpen}
        onConfirm={handleConfirmOccurrence}
        delivery={selectedDelivery}
      />

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}