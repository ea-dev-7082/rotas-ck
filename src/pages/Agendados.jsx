import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import moment from "moment";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Agendados() {
  const [currentUser, setCurrentUser] = useState(null);
  const [filterMotorista, setFilterMotorista] = useState("todos");
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  const { data: rotasAgendadas = [], isLoading } = useQuery({
    queryKey: ["rotasAgendadas", currentUser?.email],
    queryFn: () =>
      currentUser
        ? base44.entities.RotaAgendada.filter(
            { owner: currentUser.email },
            "-created_date",
            100
          )
        : [],
    enabled: !!currentUser,
    staleTime: 2 * 60 * 1000,
  });

  const motoristas = useMemo(() => {
    const names = rotasAgendadas.map(r => r.motorista_nome).filter(Boolean);
    return [...new Set(names)];
  }, [rotasAgendadas]);

  const filteredRotas = useMemo(() => {
    const ativas = rotasAgendadas.filter(r => r.status !== "concluido" && r.status !== "cancelado");
    if (filterMotorista === "todos") return ativas;
    return ativas.filter(r => r.motorista_nome === filterMotorista);
  }, [rotasAgendadas, filterMotorista]);

  const rotasAgrupadas = useMemo(() => {
    const grupos = {};
    filteredRotas.forEach(rota => {
      const key = rota.motorista_nome || "Sem Motorista";
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(rota);
    });
    return grupos;
  }, [filteredRotas]);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RotaAgendada.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rotasAgendadas"] }),
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
              <h1 className="text-3xl font-bold text-gray-900">Rotas Agendadas</h1>
              <p className="text-gray-600">Lista de rotas salvas para edição ou envio</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <Select value={filterMotorista} onValueChange={setFilterMotorista}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por motorista" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Motoristas</SelectItem>
                {motoristas.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Carregando...</div>
            ) : filteredRotas.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <CalendarClock className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">Nenhuma rota agendada</p>
                <p className="text-sm mt-2">Use o Otimizador para criar e agendar rotas</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[600px]">
                {Object.entries(rotasAgrupadas).map(([motorista, rotas]) => (
                  <div key={motorista} className="mb-6">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
                      <User className="w-5 h-5 text-gray-600" />
                      <h3 className="font-bold text-gray-800">{motorista}</h3>
                      <Badge variant="secondary">{rotas.length} rota(s)</Badge>
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
                                    {moment(rota.data_agendamento).format("DD/MM/YYYY")}
                                  </Badge>
                                  <Badge variant="outline" className="border-gray-300">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {moment(rota.data_agendamento).format("HH:mm")}
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
                                    <span className="truncate">{rota.veiculo_descricao || "-"}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Route className="w-4 h-4 text-gray-400" />
                                    <span>{rota.distancia_km?.toFixed(1) || 0} km</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-gray-400" />
                                    <span>
                                      {Math.floor((rota.tempo_minutos || 0) / 60)}h{" "}
                                      {(rota.tempo_minutos || 0) % 60}m
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 mt-3 md:mt-0">
                                <Link to={createPageUrl("Optimizer") + `?rotaAgendadaId=${rota.id}`}>
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
                                  onClick={() => deleteMutation.mutate(rota.id)}
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
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}