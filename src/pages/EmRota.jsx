import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Truck, MapPin, Clock, CheckCircle2, AlertTriangle, 
  Package, ArrowLeft, RefreshCw, Phone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const statusLabels = {
  pending: "Pendente",
  in_progress: "Em Progresso",
  delivered: "Entregue",
  problem: "Problema",
};

const statusColors = {
  pending: "bg-gray-100 text-gray-800",
  in_progress: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  problem: "bg-red-100 text-red-800",
};

const statusIcons = {
  pending: <Clock className="w-4 h-4" />,
  in_progress: <Truck className="w-4 h-4" />,
  delivered: <CheckCircle2 className="w-4 h-4" />,
  problem: <AlertTriangle className="w-4 h-4" />,
};

export default function EmRota() {
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const rotaId = urlParams.get("rotaId");

  const { data: rota, isLoading } = useQuery({
    queryKey: ["rota-em-andamento", rotaId],
    queryFn: async () => {
      if (!rotaId) return null;
      const rotas = await base44.entities.RotaAgendada.filter({ id: rotaId });
      return rotas[0] || null;
    },
    enabled: !!rotaId,
    refetchInterval: 10000, // Atualiza a cada 10 segundos
  });

  // Atualização em tempo real
  useEffect(() => {
    const unsubscribe = base44.entities.RotaAgendada.subscribe((event) => {
      if (event.id === rotaId) {
        queryClient.invalidateQueries({ queryKey: ["rota-em-andamento", rotaId] });
      }
    });
    
    return unsubscribe;
  }, [rotaId, queryClient]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="h-32 bg-white rounded-xl animate-pulse" />
          <div className="h-64 bg-white rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!rota) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Rota não encontrada</h2>
          <p className="text-gray-500 mb-6">A rota solicitada não existe ou foi removida.</p>
          <Button asChild>
            <Link to={createPageUrl("Agendados")}>Voltar para Agendados</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Calcula estatísticas
  const entregas = rota.rota?.slice(1, -1) || [];
  const entregasRealizadas = entregas.filter(e => e.status === "delivered").length;
  const entregasComProblema = entregas.filter(e => e.status === "problem").length;
  const entregasPendentes = entregas.filter(e => !e.status || e.status === "pending").length;
  const progress = entregas.length > 0 ? (entregasRealizadas / entregas.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to={createPageUrl("Agendados")}>
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Acompanhamento em Tempo Real</h1>
              <p className="text-sm text-gray-500">
                {rota.motorista_nome} • {rota.veiculo_descricao}
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["rota-em-andamento", rotaId] })}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                Status da Rota
              </CardTitle>
              <Badge className={
                rota.status === "em_andamento" ? "bg-blue-100 text-blue-800" :
                rota.status === "concluido" ? "bg-green-100 text-green-800" :
                "bg-gray-100 text-gray-800"
              }>
                {rota.status === "em_andamento" ? "Em Andamento" :
                 rota.status === "concluido" ? "Concluída" :
                 rota.status === "agendado" ? "Agendada" : rota.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{entregas.length}</div>
                <div className="text-sm text-gray-500">Total</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{entregasRealizadas}</div>
                <div className="text-sm text-gray-500">Entregues</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{entregasPendentes}</div>
                <div className="text-sm text-gray-500">Pendentes</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{entregasComProblema}</div>
                <div className="text-sm text-gray-500">Problemas</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Progresso</span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>
          </CardContent>
        </Card>

        {/* Lista de Entregas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              Entregas ({entregas.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {entregas.map((entrega, index) => (
                <div 
                  key={index}
                  className={`p-4 rounded-lg border transition-all ${
                    entrega.status === "delivered" ? "bg-green-50 border-green-200" :
                    entrega.status === "problem" ? "bg-red-50 border-red-200" :
                    entrega.status === "in_progress" ? "bg-blue-50 border-blue-200" :
                    "bg-white border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">
                          {index + 1}. {entrega.client_name}
                        </span>
                        <Badge className={statusColors[entrega.status || "pending"]}>
                          {statusIcons[entrega.status || "pending"]}
                          <span className="ml-1">{statusLabels[entrega.status || "pending"]}</span>
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
                        <MapPin className="w-3 h-3" />
                        {entrega.address}
                      </div>

                      {entrega.phone && (
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Phone className="w-3 h-3" />
                          {entrega.phone}
                        </div>
                      )}

                      {entrega.status === "delivered" && (
                        <div className="mt-2 text-sm text-green-700">
                          <div>✓ Entregue às {entrega.deliveredAt ? format(new Date(entrega.deliveredAt), "HH:mm") : "--:--"}</div>
                          {entrega.receivedBy && <div>Recebido por: {entrega.receivedBy}</div>}
                        </div>
                      )}

                      {entrega.status === "problem" && (
                        <div className="mt-2 text-sm text-red-700">
                          <div>⚠️ {entrega.occurrenceType}</div>
                          {entrega.occurrenceDescription && <div>{entrega.occurrenceDescription}</div>}
                        </div>
                      )}

                      {entrega.notes && (
                        <div className="mt-2 text-sm text-gray-600 italic">
                          📝 {entrega.notes}
                        </div>
                      )}
                    </div>

                    <div className="text-right text-sm text-gray-500">
                      <Clock className="w-4 h-4 inline mr-1" />
                      {entrega.estimated_arrival}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}