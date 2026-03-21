import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Truck, MapPin, Clock, CheckCircle2, AlertTriangle, 
  Package, Eye, RefreshCw, User, History, Home, PanelRightOpen, PanelRightClose
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ReturnPanel from "@/components/emrota/ReturnPanel";
import HistoricoDiaDialog from "@/components/emrota/HistoricoDiaDialog";

export default function RotasEmAndamento() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showHistorico, setShowHistorico] = useState(false);
  const [showReturnPanel, setShowReturnPanel] = useState(true);
  // Guarda IDs de rotas que já foram finalizadas para não sumir do retorno
  const [finishedRouteIds, setFinishedRouteIds] = useState(new Set());
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  const { data: rotasEmAndamento, isLoading } = useQuery({
    queryKey: ["rotas-em-andamento", currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return [];
      const rotas = await base44.entities.RotaAgendada.filter(
        { owner: currentUser.email },
        "-created_date"
      );
      const today = format(new Date(), "yyyy-MM-dd");
      return rotas.filter(r => 
        r.status === "em_andamento" || 
        r.status === "liberado" ||
        (r.status === "agendado" && r.data_prevista === today) ||
        (r.status === "concluido" && r.updated_date && format(new Date(r.updated_date), "yyyy-MM-dd") === today)
      );
    },
    enabled: !!currentUser,
    initialData: [],
  });

  // Rastreia rotas que foram concluídas para manter no painel de retorno
  useEffect(() => {
    if (!rotasEmAndamento || rotasEmAndamento.length === 0) return;
    
    const newFinished = new Set(finishedRouteIds);
    rotasEmAndamento.forEach((rota) => {
      if (rota.status === "concluido") {
        newFinished.add(rota.id);
      }
    });
    
    // Só atualiza se houve mudança
    if (newFinished.size !== finishedRouteIds.size) {
      setFinishedRouteIds(newFinished);
    }
  }, [rotasEmAndamento]);

  // Atualização em tempo real
  useEffect(() => {
    const unsubscribe = base44.entities.RotaAgendada.subscribe((event) => {
      queryClient.invalidateQueries({ queryKey: ["rotas-em-andamento"] });
    });
    
    return unsubscribe;
  }, [queryClient]);

  const calcularProgresso = (rota) => {
    const entregas = rota.rota?.slice(1, -1) || [];
    const entregues = entregas.filter(e => e.status === "delivered").length;
    return entregas.length > 0 ? (entregues / entregas.length) * 100 : 0;
  };

  const contarEntregas = (rota) => {
    const entregas = rota.rota?.slice(1, -1) || [];
    return {
      total: entregas.length,
      entregues: entregas.filter(e => e.status === "delivered").length,
      problemas: entregas.filter(e => e.status === "problem").length,
      pendentes: entregas.filter(e => !e.status || e.status === "pending").length,
    };
  };

  // Rotas com todas entregas finalizadas OU status concluído (para o painel de retorno)
  const rotasRetorno = (rotasEmAndamento || []).filter((rota) => {
    // Rota já marcada como concluída (status no banco)
    if (rota.status === "concluido") return true;
    
    // Rota que já foi finalizada anteriormente (evita piscar)
    if (finishedRouteIds.has(rota.id)) return true;
    
    const entregas = rota.rota?.slice(1, -1) || [];
    if (entregas.length === 0) return false;
    return entregas.every((e) => e.status === "delivered" || e.status === "problem");
  });

  // Rotas ainda em andamento (não finalizadas e não concluídas)
  const rotasAtivas = (rotasEmAndamento || []).filter((rota) => {
    // Rota concluída nunca aparece nos cards ativos
    if (rota.status === "concluido") return false;
    
    // Rota que já foi registrada como finalizada também não aparece
    if (finishedRouteIds.has(rota.id)) return false;
    
    const entregas = rota.rota?.slice(1, -1) || [];
    if (entregas.length === 0) return true;
    return !entregas.every((e) => e.status === "delivered" || e.status === "problem");
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Truck className="w-7 h-7 text-blue-600" />
              Rotas em Andamento
            </h1>
            <p className="text-gray-500 mt-1">
              Acompanhe as entregas em tempo real
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              onClick={() => setShowHistorico(true)}
            >
              <History className="w-4 h-4 mr-2" />
              Histórico do Dia
            </Button>
            {rotasRetorno.length > 0 && (
              <Button 
                variant="outline"
                onClick={() => setShowReturnPanel(!showReturnPanel)}
                className="relative"
              >
                {showReturnPanel ? <PanelRightClose className="w-4 h-4 mr-2" /> : <PanelRightOpen className="w-4 h-4 mr-2" />}
                Retorno
                <Badge className="ml-2 bg-emerald-100 text-emerald-800 text-xs">{rotasRetorno.length}</Badge>
              </Button>
            )}
            <Button 
              variant="outline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["rotas-em-andamento"] })}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>

        <div className={`flex gap-6 ${showReturnPanel && rotasRetorno.length > 0 ? '' : ''}`}>
          {/* Coluna principal */}
          <div className={`flex-1 ${showReturnPanel && rotasRetorno.length > 0 ? 'min-w-0' : ''}`}>
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-48 bg-white rounded-xl animate-pulse" />
                ))}
              </div>
            ) : rotasAtivas.length === 0 && rotasRetorno.length === 0 ? (
              <Card className="bg-white">
                <CardContent className="p-12 text-center">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Truck className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Nenhuma rota em andamento
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Não há entregas em andamento no momento. Agende uma nova rota pelo Otimizador.
                  </p>
                  <Button asChild>
                    <Link to={createPageUrl("Optimizer")}>Ir para Otimizador</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : rotasAtivas.length === 0 ? (
              <Card className="bg-white">
                <CardContent className="p-8 text-center">
                  <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Todas as entregas foram finalizadas
                  </h3>
                  <p className="text-gray-500 text-sm">
                    Os motoristas estão retornando para a base. Veja o painel "Retorno" ao lado.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rotasAtivas.map((rota) => {
                  const progresso = calcularProgresso(rota);
                  const contagem = contarEntregas(rota);

                  return (
                    <Card key={rota.id} className="bg-white hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-400" />
                              {rota.motorista_nome || "Motorista não definido"}
                            </CardTitle>
                            <p className="text-sm text-gray-500 mt-1">
                              {rota.veiculo_descricao} • {rota.veiculo_placa}
                            </p>
                          </div>
                          <Badge className={
                            rota.status === "em_andamento" 
                              ? "bg-blue-100 text-blue-800" 
                              : rota.status === "liberado"
                              ? "bg-cyan-100 text-cyan-800"
                              : "bg-yellow-100 text-yellow-800"
                          }>
                            {rota.status === "em_andamento" ? "Em Andamento" : rota.status === "liberado" ? "Enviada" : "Agendada"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div className="p-2 bg-gray-50 rounded">
                            <div className="text-lg font-bold text-gray-900">{contagem.total}</div>
                            <div className="text-xs text-gray-500">Total</div>
                          </div>
                          <div className="p-2 bg-green-50 rounded">
                            <div className="text-lg font-bold text-green-600">{contagem.entregues}</div>
                            <div className="text-xs text-gray-500">Entregues</div>
                          </div>
                          <div className="p-2 bg-yellow-50 rounded">
                            <div className="text-lg font-bold text-yellow-600">{contagem.pendentes}</div>
                            <div className="text-xs text-gray-500">Pendentes</div>
                          </div>
                          <div className="p-2 bg-red-50 rounded">
                            <div className="text-lg font-bold text-red-600">{contagem.problemas}</div>
                            <div className="text-xs text-gray-500">Problemas</div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Progresso</span>
                            <span className="font-medium">{Math.round(progresso)}%</span>
                          </div>
                          <Progress value={progresso} className="h-2" />
                        </div>

                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {rota.data_prevista 
                              ? format(new Date(rota.data_prevista), "dd/MM/yyyy")
                              : format(new Date(rota.created_date), "dd/MM/yyyy")}
                          </div>
                          {rota.total_volumes > 0 && (
                            <div className="flex items-center gap-1">
                              <Package className="w-4 h-4" />
                              {rota.total_volumes} volumes
                            </div>
                          )}
                        </div>

                        <Button asChild className="w-full" variant="outline">
                          <Link to={`${createPageUrl("EmRota")}?rotaId=${rota.id}`}>
                            <Eye className="w-4 h-4 mr-2" />
                            Ver Detalhes
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Painel lateral de Retorno */}
          {showReturnPanel && rotasRetorno.length > 0 && (
            <div className="w-80 shrink-0 hidden lg:block">
              <div className="sticky top-24">
                <div className="flex items-center gap-2 mb-3">
                  <Home className="w-5 h-5 text-emerald-600" />
                  <h2 className="font-bold text-gray-900">Retorno à Base</h2>
                  <Badge className="bg-emerald-100 text-emerald-800 text-xs">{rotasRetorno.length}</Badge>
                </div>
                <ReturnPanel rotas={rotasRetorno} />
              </div>
            </div>
          )}
        </div>

        {/* Painel de Retorno mobile */}
        {showReturnPanel && rotasRetorno.length > 0 && (
          <div className="lg:hidden mt-6">
            <div className="flex items-center gap-2 mb-3">
              <Home className="w-5 h-5 text-emerald-600" />
              <h2 className="font-bold text-gray-900">Retorno à Base</h2>
              <Badge className="bg-emerald-100 text-emerald-800 text-xs">{rotasRetorno.length}</Badge>
            </div>
            <ReturnPanel rotas={rotasRetorno} />
          </div>
        )}

        {/* Histórico do Dia Dialog */}
        <HistoricoDiaDialog 
          open={showHistorico} 
          onClose={() => setShowHistorico(false)} 
          userEmail={currentUser?.email} 
        />
      </div>
    </div>
  );
}
