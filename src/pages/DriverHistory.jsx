import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, FileText, Filter, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import BottomNav from "../components/driver/BottomNav";
import RouteCard from "../components/driver/RouteCard";

const API_BATCH_SIZE = 50;

export default function DriverHistory() {
  const [currentUser, setCurrentUser] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [rotas, setRotas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  // ========== CARREGAMENTO COMPLETO DE ROTAS ==========
  const loadHistorico = useCallback(async () => {
    if (!currentUser?.email) return;

    setIsLoading(true);
    try {
      let allData = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const batch = await base44.entities.RotaAgendada.filter(
          { motorista_email: currentUser.email },
          "-data_prevista",
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

      // Exclui rotas apenas agendadas — motorista só vê rotas enviadas/liberadas
      const rotasVisiveis = allData.filter((r) => r.status !== "agendado");
      setRotas(rotasVisiveis);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
      setRotas([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.email]);

  useEffect(() => {
    if (currentUser?.email) {
      loadHistorico();
    }
  }, [currentUser?.email, loadHistorico]);

  // ========== FILTRO LOCAL POR STATUS ==========
  const filteredRotas =
    statusFilter === "all"
      ? rotas
      : rotas.filter((r) => r.status === statusFilter);

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
                {rotas.length} rota{rotas.length !== 1 ? "s" : ""} registrada
                {rotas.length !== 1 ? "s" : ""}
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
                <SelectItem value="all">Todas ({rotas.length})</SelectItem>
                <SelectItem value="liberado">
                  Liberadas ({rotas.filter((r) => r.status === "liberado").length})
                </SelectItem>
                <SelectItem value="em_andamento">
                  Em Andamento ({rotas.filter((r) => r.status === "em_andamento").length})
                </SelectItem>
                <SelectItem value="concluido">
                  Concluídas ({rotas.filter((r) => r.status === "concluido").length})
                </SelectItem>
                <SelectItem value="cancelado">
                  Canceladas ({rotas.filter((r) => r.status === "cancelado").length})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-md mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-gray-500">Carregando histórico...</p>
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
