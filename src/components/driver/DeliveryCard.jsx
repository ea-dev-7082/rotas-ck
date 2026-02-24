import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Clock, Package, FileText } from "lucide-react";

const statusLabels = {
  pending: "Pendente",
  in_progress: "Em Rota",
  delivered: "Entregue",
  problem: "Problema",
};

const statusVariants = {
  pending: "secondary",
  in_progress: "default",
  delivered: "outline",
  problem: "destructive",
};

const statusColors = {
  pending: "bg-gray-100 text-gray-800",
  in_progress: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  problem: "bg-red-100 text-red-800",
};

export default function DeliveryCard({
  delivery,
  isNext = false,
  onMarkDelivered,
  onReportOccurrence,
  onNavigate,
  onCall,
  onViewNotas,
}) {
  const status = delivery.status || "pending";

  return (
    <Card className={`w-full ${isNext ? "border-2 border-blue-500 shadow-lg" : "border border-gray-200"}`}>
      <CardContent className="pt-5 pb-4 px-4">
        {isNext && (
          <div className="mb-4 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700 text-center font-medium">
              🎯 Próxima entrega
            </p>
          </div>
        )}

        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  {delivery.order - 1}
                </span>
                <span className="text-xs text-gray-500 truncate">
                  {delivery.notas_fiscais?.length > 0 
                    ? `NF: ${delivery.notas_fiscais.map(n => n.numero).join(", ")}`
                    : "Sem NF"
                  }
                </span>
              </div>
              <h3 className="font-semibold text-base truncate">{delivery.client_name}</h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span>Previsto: {delivery.estimated_arrival}</span>
              </div>
            </div>
            <Badge className={statusColors[status]}>
              {statusLabels[status]}
            </Badge>
          </div>

          {/* Address */}
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm break-words">{delivery.address}</p>
            </div>
          </div>

          {/* Notas Fiscais */}
          {delivery.notas_fiscais && delivery.notas_fiscais.length > 0 && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm text-indigo-800 font-medium">
                    {delivery.notas_fiscais.length} NF(s) - {delivery.volume_total || 0} vol.
                  </span>
                </div>
                {onViewNotas && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => onViewNotas(delivery)}
                    className="text-indigo-600 h-7 px-2"
                  >
                    Ver
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Notes / Observations */}
          {delivery.notes && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Obs:</strong> {delivery.notes}
              </p>
            </div>
          )}

          {/* Occurrence description */}
          {delivery.occurrenceDescription && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>Ocorrência:</strong> {delivery.occurrenceDescription}
              </p>
            </div>
          )}

          {/* Delivered info */}
          {status === "delivered" && delivery.deliveredAt && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Entregue em:</strong> {new Date(delivery.deliveredAt).toLocaleString("pt-BR")}
              </p>
              {delivery.receivedBy && (
                <p className="text-sm text-green-700 mt-1">
                  <strong>Recebido por:</strong> {delivery.receivedBy}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          {status !== "delivered" && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => onNavigate(delivery)}
                  className="w-full h-12 text-sm"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Navegar
                </Button>

                {delivery.phone && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => onCall(delivery.phone)}
                    className="w-full h-12 text-sm"
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Ligar
                  </Button>
                )}
              </div>

              {status !== "problem" && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="lg"
                    onClick={() => onMarkDelivered(delivery)}
                    className="w-full h-12 bg-green-600 hover:bg-green-700 text-white text-sm"
                  >
                    Confirmar Entrega
                  </Button>

                  <Button
                    variant="destructive"
                    size="lg"
                    onClick={() => onReportOccurrence(delivery)}
                    className="w-full h-12 text-sm"
                  >
                    Ocorrência
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}