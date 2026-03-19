import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Home, CheckCircle2, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function ReturnPanel({ rotas }) {
  const [closingId, setClosingId] = useState(null);
  const [dismissedIds, setDismissedIds] = useState([]);
  const queryClient = useQueryClient();

  const motoristasRetorno = rotas.filter((rota) => {
    const entregas = rota.rota?.slice(1, -1) || [];
    if (entregas.length === 0) return false;
    return entregas.every(
      (e) => e.status === "delivered" || e.status === "problem"
    );
  });

  // Busca relatórios vinculados às rotas em retorno para saber quais já foram fechados
  const rotaIds = motoristasRetorno.map((r) => r.id);
  const { data: relatoriosVinculados } = useQuery({
    queryKey: ["relatorios-vinculados", rotaIds.join(",")],
    queryFn: async () => {
      if (rotaIds.length === 0) return [];
      // Busca todos relatórios do usuário e filtra pelos IDs
      const todos = await base44.entities.Relatorio.list("-created_date", 100);
      return todos.filter((r) => rotaIds.includes(r.rota_agendada_id));
    },
    enabled: rotaIds.length > 0,
    initialData: [],
  });

  const getRelatorioParaRota = (rotaId) => {
    return relatoriosVinculados.find((r) => r.rota_agendada_id === rotaId);
  };

  const handleRetornou = async (rota) => {
    setClosingId(rota.id);
    const agora = new Date().toISOString();

    // 1. Atualiza a RotaAgendada para concluído com hora de retorno (se ainda não)
    if (rota.status !== "concluido") {
      await base44.entities.RotaAgendada.update(rota.id, {
        status: "concluido",
        hora_retorno: agora,
      });
    }

    // 2. Busca o relatório vinculado e atualiza com dados reais
    const relatorio = getRelatorioParaRota(rota.id);
    if (relatorio) {
      // Pega a rota da RotaAgendada com dados reais (deliveredAt, status, notes, etc.)
      const rotaRealAtualizada = (rota.rota || []).map((item) => ({
        order: item.order,
        client_name: item.client_name,
        address: item.address,
        estimated_arrival: item.estimated_arrival,
        latitude: item.latitude,
        longitude: item.longitude,
        notas_fiscais: item.notas_fiscais || [],
        volume_total: item.volume_total || 0,
        // Dados reais das entregas
        status: item.status || null,
        deliveredAt: item.deliveredAt || null,
        receivedBy: item.receivedBy || null,
        notes: item.notes || null,
        occurrenceType: item.occurrenceType || null,
        occurrenceDescription: item.occurrenceDescription || null,
      }));

      await base44.entities.Relatorio.update(relatorio.id, {
        rota: rotaRealAtualizada,
        hora_retorno: agora,
        status: "concluido",
      });
    }

    // 3. Remove o cartão da lista e invalida queries
    setDismissedIds((prev) => [...prev, rota.id]);
    queryClient.invalidateQueries({ queryKey: ["rotas-em-andamento"] });
    queryClient.invalidateQueries({ queryKey: ["relatorios"] });
    queryClient.invalidateQueries({ queryKey: ["relatorios-vinculados"] });
    setClosingId(null);
  };

  const visibleRotas = motoristasRetorno.filter((r) => !dismissedIds.includes(r.id));

  if (visibleRotas.length === 0) {
    return (
      <Card className="bg-white border-dashed">
        <CardContent className="p-6 text-center text-gray-400">
          <Home className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum motorista em retorno</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {motoristasRetorno.map((rota) => {
        const entregas = rota.rota?.slice(1, -1) || [];
        const entregues = entregas.filter((e) => e.status === "delivered").length;
        const problemas = entregas.filter((e) => e.status === "problem").length;
        const isClosing = closingId === rota.id;

        const ultimaEntrega = [...entregas]
          .filter((e) => e.deliveredAt)
          .sort((a, b) => new Date(b.deliveredAt) - new Date(a.deliveredAt))[0];

        const matrizRetorno = rota.rota?.[rota.rota.length - 1];

        // Verifica se o relatório vinculado já foi fechado
        const relatorio = getRelatorioParaRota(rota.id);
        const relatorioFechado = relatorio?.status === "concluido";

        return (
          <Card key={rota.id} className="bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                    <Home className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">
                      {rota.motorista_nome || "Motorista"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {rota.veiculo_descricao} • {rota.veiculo_placa}
                    </p>
                  </div>
                </div>
                <Badge className="bg-emerald-100 text-emerald-800 text-xs">
                  {relatorioFechado ? "Finalizado" : "Retornando"}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center mt-3">
                <div className="bg-white/60 rounded p-2">
                  <div className="text-sm font-bold text-green-600">{entregues}</div>
                  <div className="text-[10px] text-gray-500">Entregues</div>
                </div>
                <div className="bg-white/60 rounded p-2">
                  <div className="text-sm font-bold text-red-600">{problemas}</div>
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
                  Última entrega: {format(new Date(ultimaEntrega.deliveredAt), "HH:mm")}
                </p>
              )}

              {/* Botão Retornou - aparece se relatório não foi fechado ainda */}
              {!relatorioFechado ? (
                <Button
                  onClick={() => handleRetornou(rota)}
                  disabled={isClosing}
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
                <div className="mt-3 flex items-center justify-center gap-2 text-emerald-700 bg-emerald-100 rounded-lg py-2 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Rota Finalizada
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}