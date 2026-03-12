import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Fuel, Wrench, CircleDot, Car } from "lucide-react";
import moment from "moment";

const TIPO_CONFIG = {
  abastecimento: { label: "Abastecimento", color: "bg-blue-100 text-blue-700", icon: Fuel },
  troca_oleo: { label: "Troca de Óleo", color: "bg-yellow-100 text-yellow-700", icon: CircleDot },
  manutencao_preventiva: { label: "Preventiva", color: "bg-green-100 text-green-700", icon: Wrench },
  manutencao_corretiva: { label: "Corretiva", color: "bg-red-100 text-red-700", icon: Wrench },
  pneu: { label: "Pneu", color: "bg-orange-100 text-orange-700", icon: CircleDot },
  outros: { label: "Outros", color: "bg-gray-100 text-gray-700", icon: Car }
};

export default function ManutencaoList({ registros, onEdit, onDelete }) {
  if (!registros || registros.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Wrench className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>Nenhum registro encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {registros.map((reg) => {
        const config = TIPO_CONFIG[reg.tipo] || TIPO_CONFIG.outros;
        const Icon = config.icon;
        return (
          <div key={reg.id} className="flex items-center gap-4 p-4 bg-white border rounded-xl hover:shadow-md transition-all">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.color}`}>
              <Icon className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge className={config.color}>{config.label}</Badge>
                <span className="text-sm text-gray-500">{moment(reg.data).format("DD/MM/YYYY")}</span>
                {reg.km_atual && <span className="text-xs text-gray-400">{Number(reg.km_atual).toLocaleString("pt-BR")} km</span>}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="font-semibold text-gray-900">{reg.veiculo_descricao} {reg.veiculo_placa}</span>
                {reg.posto && <span className="text-gray-500">• {reg.posto}</span>}
              </div>
              {reg.descricao && <p className="text-xs text-gray-500 mt-1 truncate">{reg.descricao}</p>}
              {reg.tipo === "abastecimento" && reg.litros && (
                <p className="text-xs text-blue-600 mt-0.5">{reg.litros}L × R$ {Number(reg.preco_litro || 0).toFixed(2)}/L</p>
              )}
            </div>

            <div className="text-right shrink-0">
              <p className="text-lg font-bold text-gray-900">R$ {Number(reg.valor).toFixed(2)}</p>
            </div>

            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="icon" onClick={() => onEdit(reg)} className="text-gray-400 hover:text-blue-600">
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onDelete(reg.id)} className="text-gray-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}