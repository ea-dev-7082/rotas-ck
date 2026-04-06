import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { User, AlertCircle, Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import BottomNav from "../components/driver/BottomNav";
import RouteCard from "../components/driver/RouteCard";

const API_BATCH_SIZE = 50;

export default function DriverDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [rotasHoje, setRotasHoje] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  // ========== CARREGAMENTO COMPLETO DE ROTAS ==========
  const loadRotasMotorista = useCallback(async () => {
    if (!currentUser?.email) return;

    setIsLoading(true);
    try {
      let allData = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const batch = await base44.entities.RotaAgendada.filter(
          { motorista_email: currentUser.email },
          "-created_date",
          API_BATCH_SIZE,
          offset
        );

        if (batch && batch.length > 0) {
          allData = [...allData, ...batch];
          offset += batch.length;
          hasMore = batch.length === API_BATCH_SIZE;
        } else {
          hasMore = false;
        }
      }

      // Filtra apenas rotas de hoje ou em andamento
      const today = format(new Date(), "yyyy-MM-dd");
      const rotasFiltradas = allData.filter((r) => {
        const isToday = r.data_prevista === today;
        const isEmAndamento = r.status === "em_andamento";
        const isLiberado = r.status === "liberado";
        return isToday || isEmAndamento || isLiberado;
      });

      setRotasHoje(rotasFiltradas);
    } catch (error) {
      console.error("Erro ao carregar rotas do motorista:", error);
      setRotasHoje([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.email]);

  useEffect(() => {
    if (currentUser?.email) {
      loadRotasMotorista();
    }
  }, [currentUser?.email, loadRotasMotorista]);

  // ========== ATUALIZAÇÃO EM TEMPO REAL ==========
  useEffect(() => {
    const unsubscribe = base44.entities.RotaAgendada.subscribe(() => {
      loadRotasMotorista();
    });

    return unsubscribe;
  }, [loadRotasMotorista]);

  // ========== ROTA ATUAL (em andamento > liberado) ==========
  const rotaAtual =
    rotasHoje.find((r) => r.status === "em_andamento") ||
    rotasHoje.find((r) => r.status === "liberado");

  const outrasRotas = rotasHoje.filter((r) => r.id !== rotaAtual?.id);

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
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-gray-500">Carregando suas rotas...</p>
          </div>
        ) : rotaAtual ? (
          <div className="space-y-4">
            {/* Rota Atual Destacada */}
            <RouteCard route={rotaAtual} isActive />

            {/* Dica */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                💡 <strong>Dica:</strong> Clique em "Ver Rota" para iniciar
                suas entregas. Use a aba Veículo para registrar km
                inicial/final.
              </p>
            </div>

            {/* Outras rotas do dia */}
            {outrasRotas.length > 0 && (
              <div className="mt-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Outras Rotas de Hoje
                </h2>
                <div className="space-y-3">
                  {outrasRotas.map((rota) => (
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
              Você não tem rotas agendadas para hoje. Verifique o histórico
              ou aguarde uma nova atribuição.
            </p>
            <Button asChild variant="outline" size="lg">
              <Link to={createPageUrl("DriverHistory")}>Ver Histórico</Link>
            </Button>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
