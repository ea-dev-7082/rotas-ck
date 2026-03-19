import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Home, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function ReturnPanel({ rotas }) {
  const [closingId, setClosingId] = useState(null);
  const queryClient = useQueryClient();

  const motoristasRetorno = rotas.filter((rota) => {
    const entregas = rota.rota?.slice(1, -1) || [];
    if (entregas.length === 0) return false;
    return entregas.every(
      (e) => e.status === "delivered" || e.status === "problem"
    );
  });

  const handleRetornou = async (rota) => {
    setClosingId(rota.id);
    const agora = new Date().toISOString();

    // 1. Atualiza a RotaAgendada para concluído com hora de retorno
    await base44.entities.RotaAgendada.update(rota.id, {
      status: "concluido",
      hora_retorno: agora,
    });

    // 2. Busca o relatório vinculado a esta rota
    const relatorios = await base44.entities.Relatorio.filter({
      rota_agendada_id: rota.id,
    });

    if (relatorios.length > 0) {
      const relatorio = relatorios[0];

      // Monta a rota atualizada com dados reais das entregas
      const rotaAtualizada = (rota.rota || []).map((item) => ({
        ...item,
        // Preserva dados já existentes no relatório e sobrepõe com dados reais da rota
        status: item.status || undefined,
        deliveredAt: item.deliveredAt || undefined,
        receivedBy: item.receivedBy || undefined,
        notes: item.notes || undefined,
        occurrenceType: item.occurrenceType || undefined,
        occurrenceDescription: item.occurrenceDescription || undefined,
        notas_fiscais: item.notas_fiscais || [],
        volume_total: item.volume_total || 0,
      }));

      await base44.entities.Relatorio.update(relatorio.id, {
        rota: rotaAtualizada,
        hora_retorno: agora,
        status: "concluido",
      });
    }

    // 3. Invalida queries para atualizar a UI
    queryClient.invalidateQueries({ queryKey: ["rotas-em-andamento"] });
    queryClient.invalidateQueries({ queryKey: ["relatorios"] });
    setClosingId(null);
  };

  if (motoristasRetorno.length === 0) {
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
                  Retornando
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

              {/* Botão Retornou */}
              {rota.status !== "concluido" && (
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
              )}

              {rota.status === "concluido" && (
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