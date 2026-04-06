import React, { useState, useEffect, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarClock,
  Calendar,
  Clock,
  MapPin,
  Truck,
  User,
  Trash2,
  Route,
  Filter,
  Package,
  Edit,
  Loader2,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import moment from "moment";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import InfiniteScrollSentinel from "@/components/common/InfiniteScrollSentinel";

// Hook de debounce para a busca
function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function Agendados() {
  const [currentUser, setCurrentUser] = useState(null);
  const [filterMotorista, setFilterMotorista] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  // ========== CARREGAMENTO COMPLETO DE ROTAS ==========
  const [allRotas, setAllRotas] = useState([]);
  const [isFullyLoaded, setIsFullyLoaded] = useState(false);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const pageSize = 100;

  const loadAllRotas = useCallback(async () => {
    if (!currentUser || isLoadingAll) return;

    setIsLoadingAll(true);
    setIsFullyLoaded(false);

    try {
      let allData = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const batch = await base44.entities.RotaAgendada.filter(
          { owner: currentUser.email },
          "-created_date",
          pageSize,
          offset
        );

        if (batch && batch.length > 0) {
          allData = [...allData, ...batch];
          offset += pageSize;
          // Atualiza progressivamente para o usuário já ver resultados
          setAllRotas([...allData]);
          hasMore = batch.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      setAllRotas(allData);
      setIsFullyLoaded(true);
    } catch (error) {
      console.error("Erro ao carregar rotas agendadas:", error);
    } finally {
      setIsLoadingAll(false);
    }
  }, [currentUser, pageSize]);

  // Carrega todos ao montar ou quando o usuário muda
  useEffect(() => {
    if (currentUser) {
      loadAllRotas();
    }
  }, [currentUser?.email]);

  // ========== FILTROS E BUSCA LOCAL ==========
  const motoristas = useMemo(() => {
    const names = allRotas.map((r) => r.motorista_nome).filter(Boolean);
    return [...new Set(names)];
  }, [allRotas]);

  const filteredRotas = useMemo(() => {
    // 1. Filtra apenas ativas (não concluídas nem canceladas)
    let resultado = allRotas.filter(
      (r) => r.status !== "concluido" && r.status !== "cancelado"
    );

    // 2. Filtro por motorista
    if (filterMotorista !== "todos") {
      resultado = resultado.filter(
        (r) => r.motorista_nome === filterMotorista
      );
    }

    // 3. Busca textual local
    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      resultado = resultado.filter((rota) => {
        const motorista = (rota.motorista_nome || "").toLowerCase();
        const veiculo = (rota.veiculo_descricao || "").toLowerCase();
        const data = rota.data_agendamento
          ? moment(rota.data_agendamento).format("DD/MM/YYYY")
          : "";
        const status = (rota.status || "").toLowerCase();

        return (
          motorista.includes(term) ||
          veiculo.includes(term) ||
          data.includes(term) ||
          status.includes(term)
        );
      });
    }

    return resultado;
  }, [allRotas, filterMotorista, debouncedSearch]);

  // ========== PAGINAÇÃO VISUAL (apenas para renderização) ==========
  const [visibleCount, setVisibleCount] = useState(30);

  // Reseta contagem visível quando filtros mudam
  useEffect(() => {
    setVisibleCount(30);
  }, [debouncedSearch, filterMotorista]);

  const rotasAgrupadas = useMemo(() => {
    const grupos = {};
    // Agrupa apenas as visíveis (até visibleCount)
    const visibleRotas = filteredRotas.slice(0, visibleCount);
    visibleRotas.forEach((rota) => {
      const key = rota.motorista_nome || "Sem Motorista";
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(rota);
    });
    return grupos;
  }, [filteredRotas, visibleCount]);

  const hasMoreVisible = visibleCount < filteredRotas.length;

  const handleLoadMoreVisible = useCallback(() => {
    setVisibleCount((prev) => prev + 30);
  }, []);

  // ========== MUTATIONS ==========
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RotaAgendada.delete(id),
    onSuccess: (_, deletedId) => {
      // Remove localmente para feedback imediato
      setAllRotas((prev) => prev.filter((r) => r.id !== deletedId));
    },
  });

  const getStatusBadge = (status) => {
    const styles = {
      agendado: "bg-gray-100 text-gray-700",
      liberado: "bg-cyan-100 text-cyan-700",
      em_andamento: "bg-yellow-100 text-yellow-700",
      concluido: "bg-green-100 text-green-700",
      cancelado: "bg-red-100 text-red-700",
    };
    const labels = {
      agendado: "Agendado",
      liberado: "Enviado ao Motorista",
      em_andamento: "Em Andamento",
      concluido: "Concluído",
      cancelado: "Cancelado",
    };
    return (
      <Badge className={styles[status] || styles.agendado}>
        {labels[status] || "Agendado"}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100 p-6">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <CalendarClock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Rotas Agendadas
              </h1>
              <p className="text-gray-600">
                Lista de rotas salvas para edição ou envio
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Campo de busca */}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar motorista, veículo, data..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* Filtro por motorista */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <Select
                value={filterMotorista}
                onValueChange={setFilterMotorista}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por motorista" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Motoristas</SelectItem>
                  {motoristas.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Card className="bg-white shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">
                    {debouncedSearch || filterMotorista !== "todos"
                      ? "Resultados do Filtro"
                      : "Total de Rotas Ativas"}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold text-cyan-600">
                      {filteredRotas.length}
                    </p>
                    {(debouncedSearch || filterMotorista !== "todos") && (
                      <p className="text-sm text-gray-400">
                        de{" "}
                        {
                          allRotas.filter(
                            (r) =>
                              r.status !== "concluido" &&
                              r.status !== "cancelado"
                          ).length
                        }{" "}
                        ativa(s)
                      </p>
                    )}
                    {!isFullyLoaded && isLoadingAll && (
                      <div className="flex items-center gap-1 text-sm text-gray-400">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        carregando...
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-16 h-16 bg-cyan-100 rounded-2xl flex items-center justify-center">
                  <CalendarClock className="w-8 h-8 text-cyan-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <Card className="bg-white shadow-xl border-0">
          <CardHeader className="border-b border-gray-100 pb-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Route className="w-5 h-5 text-cyan-600" />
              Rotas Planejadas
              <Badge variant="outline" className="ml-2">
                {filteredRotas.length} rota(s)
              </Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-6">
            {isLoadingAll && allRotas.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-500 mr-2" />
                Carregando rotas...
              </div>
            ) : filteredRotas.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <CalendarClock className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">
                  {debouncedSearch || filterMotorista !== "todos"
                    ? "Nenhuma rota encontrada para o filtro aplicado"
                    : "Nenhuma rota agendada"}
                </p>
                <p className="text-sm mt-2">
                  {debouncedSearch || filterMotorista !== "todos"
                    ? "Tente alterar os filtros de busca"
                    : "Use o Otimizador para criar e agendar rotas"}
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-[600px]">
                {Object.entries(rotasAgrupadas).map(([motorista, rotas]) => (
                  <div key={motorista} className="mb-6">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
                      <User className="w-5 h-5 text-gray-600" />
                      <h3 className="font-bold text-gray-800">{motorista}</h3>
                      <Badge variant="secondary">
                        {rotas.length} rota(s)
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      <AnimatePresence>
                        {rotas.map((rota) => (
                          <motion.div
                            key={rota.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="p-4 border border-gray-200 rounded-xl hover:shadow-md transition-all bg-white hover:bg-gray-50"
                          >
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2 flex-wrap">
                                  <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-200">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    {moment(rota.data_agendamento).format(
                                      "DD/MM/YYYY"
                                    )}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className="border-gray-300"
                                  >
                                    <Clock className="w-3 h-3 mr-1" />
                                    {moment(rota.data_agendamento).format(
                                      "HH:mm"
                                    )}
                                  </Badge>
                                  {getStatusBadge(rota.status)}
                                  <Badge className="bg-cyan-100 text-cyan-700 hover:bg-cyan-200 border-0">
                                    <MapPin className="w-3 h-3 mr-1" />
                                    {rota.total_entregas || 0} entregas
                                  </Badge>
                                  {rota.total_volumes > 0 && (
                                    <Badge className="bg-purple-100 text-purple-700">
                                      <Package className="w-3 h-3 mr-1" />
                                      {rota.total_volumes} vol.
                                    </Badge>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-gray-600 mt-2">
                                  <div className="flex items-center gap-1.5">
                                    <Truck className="w-4 h-4 text-gray-400" />
                                    <span className="truncate">
                                      {rota.veiculo_descricao || "-"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Route className="w-4 h-4 text-gray-400" />
                                    <span>
                                      {rota.distancia_km?.toFixed(1) || 0} km
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-gray-400" />
                                    <span>
                                      {Math.floor(
                                        (rota.tempo_minutos || 0) / 60
                                      )}
                                      h {(rota.tempo_minutos || 0) % 60}m
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 mt-3 md:mt-0">
                                <Link
                                  to={
                                    createPageUrl("Optimizer") +
                                    `?rotaAgendadaId=${rota.id}`
                                  }
                                >
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-cyan-600 border-cyan-200 hover:bg-cyan-50"
                                  >
                                    <Edit className="w-4 h-4 mr-2" />
                                    Abrir no Otimizador
                                  </Button>
                                </Link>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    deleteMutation.mutate(rota.id)
                                  }
                                  className="text-gray-500 hover:text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                ))}

                {/* Infinite scroll para renderização visual */}
                {hasMoreVisible && (
                  <InfiniteScrollSentinel
                    onLoadMore={handleLoadMoreVisible}
                    hasMore={hasMoreVisible}
                    isLoading={false}
                  />
                )}
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
