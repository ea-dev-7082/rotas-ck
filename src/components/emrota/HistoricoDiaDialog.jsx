import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Truck,
  Package,
  Loader2,
} from "lucide-react";

const statusBadge = {
  agendado: { label: "Agendada", cls: "bg-yellow-100 text-yellow-800" },
  liberado: { label: "Liberada", cls: "bg-cyan-100 text-cyan-800" },
  em_andamento: { label: "Em Andamento", cls: "bg-blue-100 text-blue-800" },
  concluido: { label: "Concluída", cls: "bg-green-100 text-green-800" },
  cancelado: { label: "Cancelada", cls: "bg-red-100 text-red-800" },
};

export default function HistoricoDiaDialog({ open, onClose, userEmail }) {
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: rotas, isLoading } = useQuery({
    queryKey: ["historico-dia", userEmail, today],
    queryFn: async () => {
      if (!userEmail) return [];
      const all = await base44.entities.RotaAgendada.filter(
        { owner: userEmail },
        "-created_date"
      );
      return all.filter((r) => r.data_prevista === today);
    },
    enabled: !!userEmail && open,
    initialData: [],
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Histórico de Rotas — {format(new Date(), "dd/MM/yyyy")}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : rotas.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Truck className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>Nenhuma rota para hoje.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rotas.map((rota) => {
              const entregas = rota.rota?.slice(1, -1) || [];
              const entregues = entregas.filter(
                (e) => e.status === "delivered"
              ).length;
              const problemas = entregas.filter(
                (e) => e.status === "problem"
              ).length;
              const progress =
                entregas.length > 0
                  ? (entregues / entregas.length) * 100
                  : 0;
              const badge = statusBadge[rota.status] || statusBadge.agendado;

              return (
                <div
                  key={rota.id}
                  className="border rounded-lg p-4 bg-white space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {rota.motorista_nome || "Sem motorista"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {rota.veiculo_descricao} • {rota.veiculo_placa}
                      </p>
                    </div>
                    <Badge className={badge.cls}>{badge.label}</Badge>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="bg-gray-50 rounded p-2">
                      <div className="font-bold text-gray-900">
                        {entregas.length}
                      </div>
                      <div className="text-gray-500">Total</div>
                    </div>
                    <div className="bg-green-50 rounded p-2">
                      <div className="font-bold text-green-600">{entregues}</div>
                      <div className="text-gray-500">Entregues</div>
                    </div>
                    <div className="bg-red-50 rounded p-2">
                      <div className="font-bold text-red-600">{problemas}</div>
                      <div className="text-gray-500">Problemas</div>
                    </div>
                    <div className="bg-blue-50 rounded p-2">
                      <div className="font-bold text-blue-600">
                        {entregas.length - entregues - problemas}
                      </div>
                      <div className="text-gray-500">Pendentes</div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Progresso</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>

                  {/* Lista resumida de entregas */}
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {entregas.map((e, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {e.status === "delivered" ? (
                            <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                          ) : e.status === "problem" ? (
                            <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
                          ) : (
                            <Clock className="w-3 h-3 text-gray-400 shrink-0" />
                          )}
                          <span className="truncate">{e.client_name}</span>
                        </div>
                        <div className="text-gray-400 ml-2 shrink-0">
                          {e.status === "delivered" && e.deliveredAt
                            ? format(new Date(e.deliveredAt), "HH:mm")
                            : e.estimated_arrival || "--:--"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}