import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Home, CheckCircle2, Clock, Truck } from "lucide-react";
import { format } from "date-fns";

export default function ReturnPanel({ rotas }) {
  // Motoristas em retorno = todas entregas concluídas (delivered/problem) mas rota ainda "em_andamento" ou "concluido"
  const motoristasRetorno = rotas.filter((rota) => {
    const entregas = rota.rota?.slice(1, -1) || [];
    if (entregas.length === 0) return false;
    const todasFinalizadas = entregas.every(
      (e) => e.status === "delivered" || e.status === "problem"
    );
    return todasFinalizadas;
  });

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

        // Última entrega concluída
        const ultimaEntrega = [...entregas]
          .filter((e) => e.deliveredAt)
          .sort((a, b) => new Date(b.deliveredAt) - new Date(a.deliveredAt))[0];

        // ETA retorno (último item da rota = matriz)
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
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}