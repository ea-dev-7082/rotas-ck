import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, FileText, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BottomNav from "../components/driver/BottomNav";
import RouteCard from "../components/driver/RouteCard";

export default function DriverHistory() {
  const [currentUser, setCurrentUser] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  const { data: rotas, isLoading } = useQuery({
    queryKey: ["rotas-historico", currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return [];
      // Com RLS atualizado, busca rotas pelo email do motorista
      const todasRotas = await base44.entities.RotaAgendada.list("-data_prevista", 50);
      return todasRotas.filter(r => r.motorista_email === currentUser.email);
    },
    enabled: !!currentUser,
    initialData: [],
  });

  const filteredRotas = statusFilter === "all" 
    ? rotas 
    : rotas.filter(r => r.status === statusFilter);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-40">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Histórico
              </h1>
              <p className="text-sm text-gray-500">
                Suas rotas anteriores
              </p>
            </div>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="flex-1 h-10">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="agendado">Agendadas</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="concluido">Concluídas</SelectItem>
                <SelectItem value="cancelado">Canceladas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-md mx-auto px-4 py-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredRotas.length > 0 ? (
          <div className="space-y-4">
            {filteredRotas.map((rota) => (
              <RouteCard key={rota.id} route={rota} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nenhuma rota encontrada
            </h3>
            <p className="text-sm text-gray-500">
              {statusFilter !== "all" 
                ? "Tente alterar o filtro de status"
                : "Você ainda não possui rotas registradas"}
            </p>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}