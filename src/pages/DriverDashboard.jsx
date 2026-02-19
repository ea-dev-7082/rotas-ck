import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { User, AlertCircle, Truck, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import BottomNav from "../components/driver/BottomNav";
import RouteCard from "../components/driver/RouteCard";

export default function DriverDashboard() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  // Busca rotas do motorista para hoje
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: rotasHoje, isLoading } = useQuery({
    queryKey: ["rotas-motorista-hoje", currentUser?.email, today],
    queryFn: async () => {
      if (!currentUser) return [];
      // Busca rotas onde motorista_email = email do usuário logado
      // Com RLS atualizado, o motorista consegue ver rotas onde seu email está cadastrado
      const todasRotas = await base44.entities.RotaAgendada.list("-created_date");
      
      console.log("DEBUG - Email do usuário:", currentUser.email);
      console.log("DEBUG - Total rotas retornadas:", todasRotas.length);
      console.log("DEBUG - Rotas:", todasRotas.map(r => ({ id: r.id, motorista_email: r.motorista_email, status: r.status })));
      
      // Filtra rotas deste motorista (hoje ou em andamento ou sem data_prevista)
      const rotasFiltradas = todasRotas.filter(r => 
        r.motorista_email === currentUser.email && 
        (r.data_prevista === today || r.status === "em_andamento" || !r.data_prevista)
      );
      
      console.log("DEBUG - Rotas filtradas:", rotasFiltradas.length);
      
      return rotasFiltradas;
    },
    enabled: !!currentUser,
    initialData: [],
  });

  // Encontra rota atual (em andamento) ou próxima agendada
  const rotaAtual = rotasHoje.find(r => r.status === "em_andamento") || 
                    rotasHoje.find(r => r.status === "agendado");

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-40">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Rota Atual</h1>
            <p className="text-sm text-gray-500">
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-md mx-auto px-4 py-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-48 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        ) : rotaAtual ? (
          <div className="space-y-4">
            {/* Rota Atual Destacada */}
            <RouteCard route={rotaAtual} isActive />

            {/* Dica */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                💡 <strong>Dica:</strong> Clique em "Ver Rota" para iniciar suas entregas. Use a aba Veículo para registrar km inicial/final.
              </p>
            </div>

            {/* Outras rotas do dia */}
            {rotasHoje.filter(r => r.id !== rotaAtual.id).length > 0 && (
              <div className="mt-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Outras Rotas de Hoje
                </h2>
                <div className="space-y-3">
                  {rotasHoje
                    .filter(r => r.id !== rotaAtual.id)
                    .map((rota) => (
                      <RouteCard key={rota.id} route={rota} />
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nenhuma rota para hoje
            </h3>
            <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">
              Você não tem rotas agendadas para hoje. Verifique o histórico ou aguarde uma nova atribuição.
            </p>
            <Button asChild variant="outline" size="lg">
              <Link to={createPageUrl("DriverHistory")}>
                Ver Histórico
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}