import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import {
  Truck, Clock, CheckCircle2, Package, Eye, RefreshCw,
  User, History, Home, PanelRightOpen, PanelRightClose, Loader2, Wifi, WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ReturnPanel from "@/components/emrota/ReturnPanel";
import HistoricoDiaDialog from "@/components/emrota/HistoricoDiaDialog";

const API_BATCH_SIZE = 50;
const POLL_INTERVAL = 20000;     // Polling a cada 20s (seguro e confiável)
const FETCH_THROTTLE = 5000;     // Min 5s entre fetches (subscribe + poll não colidem)

/**
 * Busca TODOS os registros de uma entidade com filtro, paginando em batches.
 */
async function fetchAllFiltered(entity, filter, sortField = "-created_date") {
  let allData = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const batch = await entity.filter(filter, sortField, API_BATCH_SIZE, offset);
    if (batch && batch.length > 0) {
      allData = [...allData, ...batch];
      offset += batch.length;
      hasMore = batch.length === API_BATCH_SIZE;
    } else {
      hasMore = false;
    }
  }

  return allData;
}

export default function RotasEmAndamento() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showHistorico, setShowHistorico] = useState(false);
  const [showReturnPanel, setShowReturnPanel] = useState(true);
  const [dismissedRouteIds, setDismissedRouteIds] = useState(new Set());

  // Data
  const [rotasEmAndamento, setRotasEmAndamento] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isLive, setIsLive] = useState(true);

  // Controle de throttle e lifecycle
  const lastFetchTime = useRef(0);
  const pollIntervalRef = useRef(null);
  const isMounted = useRef(true);

  // ========== AUTH ==========
  useEffect(() => {
    base44.auth
      .me()
      .then(setCurrentUser)
      .catch((err) => console.error("Erro ao carregar usuário:", err));
  }, []);

  // ========== CLEANUP ==========
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // ========== CARREGAMENTO COM PAGINAÇÃO + THROTTLE ==========
  const loadRotas = useCallback(
    async (silent = false) => {
      if (!currentUser?.email) return;

      // Throttle: ignora se buscou há menos de FETCH_THROTTLE ms
      const now = Date.now();
      if (silent && now - lastFetchTime.current < FETCH_THROTTLE) {
        return;
      }
      lastFetchTime.current = now;

      if (!silent) setIsLoading(true);
      else setIsRefreshing(true);

      try {
        const allRotas = await fetchAllFiltered(
          base44.entities.RotaAgendada,
          { owner: currentUser.email },
          "-created_date"
        );

        const today = format(new Date(), "yyyy-MM-dd");

        const filtered = allRotas.filter((r) => {
          if (r.fechado_retorno === true) return false;

          return (
            r.status === "em_andamento" ||
            r.status === "liberado" ||
            (r.status === "agendado" && r.data_prevista === today) ||
            (r.status === "concluido" &&
              r.updated_date &&
              format(new Date(r.updated_date), "yyyy-MM-dd") === today)
          );
        });

        if (isMounted.current) {
          setRotasEmAndamento(filtered);
          setLastUpdated(new Date());
        }
      } catch (error) {
        console.error("Erro ao carregar rotas:", error);
        if (!silent && isMounted.current) setRotasEmAndamento([]);
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [currentUser?.email]
  );

  // ========== CARREGAMENTO INICIAL ==========
  useEffect(() => {
    if (currentUser?.email) {
      loadRotas();
    }
  }, [currentUser?.email, loadRotas]);

  // ========== POLLING COMO MECANISMO PRINCIPAL ==========
  useEffect(() => {
    if (!currentUser?.email) return;

    // Verifica se há rotas ativas que precisam de atualização
    const hasActiveRoutes =
      rotasEmAndamento.length === 0 || // Ainda carregando, precisa checar
      rotasEmAndamento.some(
        (r) => r.status !== "concluido" && r.status !== "cancelado"
      );

    if (hasActiveRoutes) {
      pollIntervalRef.current = setInterval(() => {
        loadRotas(true);
      }, POLL_INTERVAL);
      setIsLive(true);
    } else {
      setIsLive(false);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [currentUser?.email, loadRotas, rotasEmAndamento]);

  // ========== SUBSCRIBE COMO ACELERADOR (complementar ao polling) ==========
  useEffect(() => {
    if (!currentUser?.email) return;

    let unsubscribe;
    try {
      unsubscribe = base44.entities.RotaAgendada.subscribe(() => {
        // Subscribe acelera: dispara fetch respeitando throttle
        loadRotas(true);
      });
    } catch (error) {
      console.warn("Subscribe não disponível, usando apenas polling:", error);
    }

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [currentUser?.email, loadRotas]);

  // ========== VISIBILITY API: pausa/retoma ao trocar aba ==========
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        lastFetchTime.current = 0; // Bypass throttle
        loadRotas(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadRotas]);

  // ========== REFRESH MANUAL ==========
  const handleRefresh = useCallback(() => {
    if (!isRefreshing) {
      lastFetchTime.current = 0; // Bypass throttle
      loadRotas(true);
    }
  }, [isRefreshing, loadRotas]);

  // ========== DISMISS ROUTE (retorno) ==========
  const handleDismissRoute = useCallback((rotaId) => {
    setDismissedRouteIds((prev) => new Set([...prev, rotaId]));
    // Também remove do state local para resposta instantânea
    setRotasEmAndamento((prev) =>
      prev.map((r) =>
        r.id === rotaId ? { ...r, fechado_retorno: true } : r
      )
    );
  }, []);

  // ========== ROTA UPDATED (callback do ReturnPanel) ==========
  const handleRotaUpdated = useCallback((rotaId, newStatus) => {
    setRotasEmAndamento((prev) =>
      prev.map((r) =>
        r.id === rotaId ? { ...r, status: newStatus } : r
      )
    );
  }, []);

  // ========== CÁLCULOS DERIVADOS ==========
  const calcularProgresso = useCallback((rota) => {
    const entregas = rota.rota?.slice(1, -1) || [];
    const entregues = entregas.filter((e) => e.status === "delivered").length;
    return entregas.length > 0 ? (entregues / entregas.length) * 100 : 0;
  }, []);

  const contarEntregas = useCallback((rota) => {
    const entregas = rota.rota?.slice(1, -1) || [];
    return {
      total: entregas.length,
      entregues: entregas.filter((e) => e.status === "delivered").length,
      problemas: entregas.filter((e) => e.status === "problem").length,
      pendentes: entregas.filter(
        (e) => !e.status || e.status === "pending"
      ).length,
    };
  }, []);

  // Rotas para o painel de retorno
  const rotasRetorno = useMemo(() => {
    return rotasEmAndamento.filter((rota) => {
      if (rota.fechado_retorno === true) return false;
      if (dismissedRouteIds.has(rota.id)) return false;
      if (rota.status === "concluido") return true;

      const entregas = rota.rota?.slice(1, -1) || [];
      if (entregas.length === 0) return false;
      return entregas.every(
        (e) => e.status === "delivered" || e.status === "problem"
      );
    });
  }, [rotasEmAndamento, dismissedRouteIds]);

  // Rotas ativas (cards principais)
  const rotasAtivas = useMemo(() => {
    return rotasEmAndamento.filter((rota) => {
      if (rota.fechado_retorno === true) return false;
      if (rota.status === "concluido") return false;
      if (dismissedRouteIds.has(rota.id)) return false;

      const entregas = rota.rota?.slice(1, -1) || [];
      if (entregas.length === 0) return true;
      return !entregas.every(
        (e) => e.status === "delivered" || e.status === "problem"
      );
    });
  }, [rotasEmAndamento, dismissedRouteIds]);

  // ========== STATUS MAP ==========
  const statusConfig = {
    em_andamento: { label: "Em Andamento", className: "bg-blue-100 text-blue-800" },
    liberado: { label: "Enviada", className: "bg-cyan-100 text-cyan-800" },
    agendado: { label: "Agendada", className: "bg-yellow-100 text-yellow-800" },
  };

  // ========== RENDER ==========
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Truck className="w-7 h-7 text-blue-600" />
              Rotas em Andamento
            </h1>
            <p className="text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
              Acompanhe as entregas em tempo real
              {/* Indicador ao vivo */}
              {isLive ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  Ao vivo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                  <WifiOff className="w-3 h-3" />
                  Pausado
                </span>
              )}
              {lastUpdated && (
                <span className="text-xs text-gray-400">
                  • {format(lastUpdated, "HH:mm:ss")}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setShowHistorico(true)}>
              <History className="w-4 h-4 mr-2" />
              Histórico do Dia
            </Button>
            {rotasRetorno.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setShowReturnPanel(!showReturnPanel)}
                className="relative"
              >
                {showReturnPanel ? (
                  <PanelRightClose className="w-4 h-4 mr-2" />
                ) : (
                  <PanelRightOpen className="w-4 h-4 mr-2" />
                )}
                Retorno
                <Badge className="ml-2 bg-emerald-100 text-emerald-800 text-xs">
                  {rotasRetorno.length}
                </Badge>
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Atualizar
            </Button>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Coluna principal */}
          <div
            className={`flex-1 ${
              showReturnPanel && rotasRetorno.length > 0 ? "min-w-0" : ""
            }`}
          >
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                <p className="text-sm text-gray-500">
                  Carregando rotas em andamento...
                </p>
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
                    Não há entregas em andamento no momento.
                  </p>
                  <Button asChild>
                    <Link to={createPageUrl("Optimizer")}>
                      Ir para Otimizador
                    </Link>
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
                    {rotasRetorno.length > 0
                      ? 'Os motoristas estão retornando para a base. Veja o painel "Retorno" ao lado.'
                      : "Todas as rotas do dia foram concluídas com sucesso!"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rotasAtivas.map((rota) => {
                  const progresso = calcularProgresso(rota);
                  const contagem = contarEntregas(rota);
                  const status = statusConfig[rota.status] || {
                    label: rota.status,
                    className: "bg-gray-100 text-gray-800",
                  };

                  return (
                    <Card
                      key={rota.id}
                      className="bg-white hover:shadow-lg transition-shadow"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-400 shrink-0" />
                              <span className="truncate">
                                {rota.motorista_nome || "Motorista não definido"}
                              </span>
                            </CardTitle>
                            <p className="text-sm text-gray-500 mt-1 truncate">
                              {rota.veiculo_descricao} • {rota.veiculo_placa}
                            </p>
                          </div>
                          <Badge className={status.className}>
                            {status.label}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div className="p-2 bg-gray-50 rounded">
                            <div className="text-lg font-bold text-gray-900">
                              {contagem.total}
                            </div>
                            <div className="text-xs text-gray-500">Total</div>
                          </div>
                          <div className="p-2 bg-green-50 rounded">
                            <div className="text-lg font-bold text-green-600">
                              {contagem.entregues}
                            </div>
                            <div className="text-xs text-gray-500">Entregues</div>
                          </div>
                          <div className="p-2 bg-yellow-50 rounded">
                            <div className="text-lg font-bold text-yellow-600">
                              {contagem.pendentes}
                            </div>
                            <div className="text-xs text-gray-500">Pendentes</div>
                          </div>
                          <div className="p-2 bg-red-50 rounded">
                            <div className="text-lg font-bold text-red-600">
                              {contagem.problemas}
                            </div>
                            <div className="text-xs text-gray-500">Problemas</div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Progresso</span>
                            <span className="font-medium">
                              {Math.round(progresso)}%
                            </span>
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

          {/* Painel lateral - Desktop */}
          {showReturnPanel && rotasRetorno.length > 0 && (
            <div className="w-80 shrink-0 hidden lg:block">
              <div className="sticky top-24">
                <div className="flex items-center gap-2 mb-3">
                  <Home className="w-5 h-5 text-emerald-600" />
                  <h2 className="font-bold text-gray-900">Retorno à Base</h2>
                  <Badge className="bg-emerald-100 text-emerald-800 text-xs">
                    {rotasRetorno.length}
                  </Badge>
                </div>
                <ReturnPanel
                  rotas={rotasRetorno}
                  onDismiss={handleDismissRoute}
                  onRotaUpdated={handleRotaUpdated}
                />
              </div>
            </div>
          )}
        </div>

        {/* Painel - Mobile */}
        {showReturnPanel && rotasRetorno.length > 0 && (
          <div className="lg:hidden mt-6">
            <div className="flex items-center gap-2 mb-3">
              <Home className="w-5 h-5 text-emerald-600" />
              <h2 className="font-bold text-gray-900">Retorno à Base</h2>
              <Badge className="bg-emerald-100 text-emerald-800 text-xs">
                {rotasRetorno.length}
              </Badge>
            </div>
            <ReturnPanel
              rotas={rotasRetorno}
              onDismiss={handleDismissRoute}
              onRotaUpdated={handleRotaUpdated}
            />
          </div>
        )}

        <HistoricoDiaDialog
          open={showHistorico}
          onClose={() => setShowHistorico(false)}
          userEmail={currentUser?.email}
        />
      </div>
    </div>
  );
}
