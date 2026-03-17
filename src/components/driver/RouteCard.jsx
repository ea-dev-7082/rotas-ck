import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Clock, Truck, MapPin, ArrowRight, Package } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusLabels = {
  agendado: "Agendada",
  liberado: "Liberada",
  em_andamento: "Em Andamento",
  concluido: "Concluída",
  cancelado: "Cancelada",
};

const statusColors = {
  agendado: "bg-gray-100 text-gray-800",
  liberado: "bg-cyan-100 text-cyan-800",
  em_andamento: "bg-blue-100 text-blue-800",
  concluido: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
};

export default function RouteCard({ route, isActive = false }) {
  // Calcula progresso baseado nas entregas (exclui matriz início e fim)
  const entregas = route.rota?.slice(1, -1) || [];
  const completedCount = entregas.filter((e) => e.status === "delivered").length;
  const totalDeliveries = entregas.length;
  const progress = totalDeliveries > 0 ? (completedCount / totalDeliveries) * 100 : 0;

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className={`w-full ${isActive ? "border-2 border-blue-500" : "border border-gray-200"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">
              Rota {formatDate(route.data_prevista)}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span>
                {route.rota?.[0]?.estimated_arrival || "08:00"} - {route.rota?.[route.rota.length - 1]?.estimated_arrival || "--:--"}
              </span>
            </div>
          </div>
          <Badge className={statusColors[route.status]}>
            {statusLabels[route.status]}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Truck className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">
              {route.veiculo_descricao || "Veículo"} - {route.veiculo_placa || "---"}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">
              {completedCount} de {totalDeliveries} entregas
            </span>
          </div>

          {route.total_volumes > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Package className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">
                {route.total_volumes} volumes
              </span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Progresso</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Button asChild className="w-full h-12" size="lg">
          <Link to={`${createPageUrl("DriverRouteView")}?rotaId=${route.id}`}>
            {route.status === "em_andamento" ? "Continuar Rota" : "Ver Rota"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}