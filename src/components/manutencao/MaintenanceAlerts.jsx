import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle, Wrench, X, Bell, BellRing,
  Droplets, CircleDot, Clock, Car, Settings2,
  ChevronDown, ChevronUp, CheckCircle2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import moment from "moment";

// ═══════════════════════════════════════════════════
// CONFIGURAÇÃO DOS ALERTAS
// Ajuste os valores de intervalo_km e intervalo_dias
// conforme a necessidade da sua frota
// ═══════════════════════════════════════════════════
const ALERTAS_CONFIG = {
  troca_oleo: {
    label: "Troca de Óleo",
    icon: Droplets,
    intervalo_km: 10000,       // a cada 10.000 km
    intervalo_dias: 180,       // ou a cada 6 meses
    antecedencia_km: 1000,     // avisa 1.000 km antes
    antecedencia_dias: 15,     // avisa 15 dias antes
    tipos_registro: ["troca_oleo"],  // campo "tipo" da entidade ManutencaoVeiculo
  },
  revisao_preventiva: {
    label: "Revisão Preventiva",
    icon: Settings2,
    intervalo_km: 20000,
    intervalo_dias: 365,
    antecedencia_km: 2000,
    antecedencia_dias: 30,
    tipos_registro: ["manutencao_preventiva"],
  },
  pneu: {
    label: "Troca de Pneus",
    icon: CircleDot,
    intervalo_km: 40000,
    intervalo_dias: null,      // só por km
    antecedencia_km: 3000,
    antecedencia_dias: null,
    tipos_registro: ["pneu"],
  },
};

const SEVERIDADE_STYLES = {
  critico: {
    cor: "bg-red-50 border-red-200",
    badge: "bg-red-100 text-red-700",
    icon_cor: "text-red-600",
    label: "Crítico",
  },
  atencao: {
    cor: "bg-amber-50 border-amber-200",
    badge: "bg-amber-100 text-amber-700",
    icon_cor: "text-amber-600",
    label: "Atenção",
  },
  proximo: {
    cor: "bg-blue-50 border-blue-200",
    badge: "bg-blue-100 text-blue-700",
    icon_cor: "text-blue-600",
    label: "Próximo",
  },
  ok: {
    cor: "bg-green-50 border-green-200",
    badge: "bg-green-100 text-green-700",
    icon_cor: "text-green-600",
    label: "OK",
  },
};

export default function MaintenanceAlerts({ registros = [], veiculos = [] }) {
  const [expandido, setExpandido] = useState(true);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [dismissed, setDismissed] = useState([]);

  // Busca configs de alerta personalizadas por veículo
  const { data: configsAlerta = [] } = useQuery({
    queryKey: ["configs-alerta-veiculos"],
    queryFn: () => base44.entities.ConfigAlertaVeiculo.list(),
    initialData: [],
  });

  const getConfigVeiculo = (veiculoId) => {
    return configsAlerta.find(c => c.veiculo_id === veiculoId) || {};
  };

  // ═══════════════════════════════════════════════════
  // Km atual de cada veículo = maior "km_atual" entre
  // todos os registros de ManutencaoVeiculo desse veículo
  // ═══════════════════════════════════════════════════
  const kmAtualPorVeiculo = useMemo(() => {
    const mapa = {};
    registros.forEach(reg => {
      const vid = reg.veiculo_id;
      const km = Number(reg.km_atual) || 0;
      if (km > 0 && (!mapa[vid] || km > mapa[vid])) {
        mapa[vid] = km;
      }
    });
    return mapa;
  }, [registros]);

  // ═══════════════════════════════════════════════════
  // Último registro de cada "tipo" por veículo
  // Usa o campo "data" (format: date) para ordenar
  // ═══════════════════════════════════════════════════
  const ultimoRegistroPorTipoVeiculo = useMemo(() => {
    const mapa = {};
    const sorted = [...registros].sort((a, b) =>
      moment(b.data).valueOf() - moment(a.data).valueOf()
    );
    sorted.forEach(reg => {
      const vid = reg.veiculo_id;
      if (!mapa[vid]) mapa[vid] = {};
      // Guarda apenas o primeiro (mais recente) de cada tipo
      if (!mapa[vid][reg.tipo]) mapa[vid][reg.tipo] = reg;
      // Guarda também o último registro de qualquer tipo
      if (!mapa[vid]._qualquer) mapa[vid]._qualquer = reg;
    });
    return mapa;
  }, [registros]);

  // ═══════════════════════════════════════════════════
  // GERAR ALERTAS para cada veículo
  // ═══════════════════════════════════════════════════
  const alertas = useMemo(() => {
    const lista = [];

    veiculos.forEach(veiculo => {
      const vid = veiculo.id;
      const kmAtual = kmAtualPorVeiculo[vid] || 0;
      const registrosVeiculo = ultimoRegistroPorTipoVeiculo[vid] || {};
      const descricao = `${veiculo.descricao || "Veículo"} (${veiculo.placa || ""})`;

      // ── Alertas por tipo de manutenção ──
      // Busca config personalizada para este veículo
      const configVeiculo = getConfigVeiculo(veiculo.id);

      Object.entries(ALERTAS_CONFIG).forEach(([chave, config]) => {
        const IconComponent = config.icon;

        // Usa intervalo personalizado se existir, senão usa default
        const intervaloKmKey = chave === "troca_oleo" ? "troca_oleo_km"
          : chave === "revisao_preventiva" ? "revisao_preventiva_km"
          : chave === "pneu" ? "pneu_km" : null;
        const intervaloDiasKey = chave === "troca_oleo" ? "troca_oleo_dias"
          : chave === "revisao_preventiva" ? "revisao_preventiva_dias"
          : null;

        const intervaloKmReal = intervaloKmKey && configVeiculo[intervaloKmKey]
          ? Number(configVeiculo[intervaloKmKey])
          : config.intervalo_km;
        const intervaloDiasReal = intervaloDiasKey && configVeiculo[intervaloDiasKey]
          ? Number(configVeiculo[intervaloDiasKey])
          : config.intervalo_dias;
        const antecedenciaKmReal = intervaloKmReal ? Math.round(intervaloKmReal * 0.1) : config.antecedencia_km;
        const antecedenciaDiasReal = intervaloDiasReal ? Math.min(30, Math.round(intervaloDiasReal * 0.08)) : config.antecedencia_dias;

        // Encontra o último registro desse tipo (ex: "troca_oleo")
        let ultimoRegistro = null;
        config.tipos_registro.forEach(tipo => {
          const reg = registrosVeiculo[tipo];
          if (reg && (!ultimoRegistro || moment(reg.data).isAfter(moment(ultimoRegistro.data)))) {
            ultimoRegistro = reg;
          }
        });

        const kmUltimo = ultimoRegistro ? (Number(ultimoRegistro.km_atual) || 0) : 0;
        const dataUltimo = ultimoRegistro ? moment(ultimoRegistro.data) : null;
        const hoje = moment();

        // ── Cálculo por KM ──
        let kmRestante = null;
        let alertaKm = false;
        let criticoKm = false;

        if (intervaloKmReal && kmAtual > 0) {
          if (kmUltimo > 0) {
            const kmDesde = kmAtual - kmUltimo;
            kmRestante = intervaloKmReal - kmDesde;
            if (kmRestante <= 0) { criticoKm = true; alertaKm = true; }
            else if (kmRestante <= antecedenciaKmReal) { alertaKm = true; }
          } else {
            // Nunca fez esse tipo — alerta crítico
            alertaKm = true;
            criticoKm = true;
          }
        }

        // ── Cálculo por TEMPO ──
        let diasRestante = null;
        let alertaTempo = false;
        let criticoTempo = false;

        if (intervaloDiasReal) {
          if (dataUltimo) {
            const diasDesde = hoje.diff(dataUltimo, "days");
            diasRestante = intervaloDiasReal - diasDesde;
            if (diasRestante <= 0) { criticoTempo = true; alertaTempo = true; }
            else if (diasRestante <= antecedenciaDiasReal) { alertaTempo = true; }
          } else {
            // Nunca fez — alerta crítico
            alertaTempo = true;
            criticoTempo = true;
          }
        }

        // ── Definir severidade ──
        let severidade;
        if (criticoKm || criticoTempo) {
          severidade = "critico";
        } else if (alertaKm || alertaTempo) {
          const metadeKm = antecedenciaKmReal ? antecedenciaKmReal / 2 : 0;
          const metadeDias = antecedenciaDiasReal ? antecedenciaDiasReal / 2 : 0;
          if ((kmRestante !== null && kmRestante <= metadeKm) ||
              (diasRestante !== null && diasRestante <= metadeDias)) {
            severidade = "atencao";
          } else {
            severidade = "proximo";
          }
        } else {
          severidade = "ok";
        }

        // ── Montar mensagem ──
        let mensagem = "";
        if (!ultimoRegistro) {
          mensagem = `Nenhum registro de ${config.label.toLowerCase()} encontrado`;
        } else {
          const partes = [];
          if (kmRestante !== null) {
            partes.push(kmRestante <= 0
              ? `${Math.abs(kmRestante).toLocaleString("pt-BR")} km atrasado`
              : `faltam ${kmRestante.toLocaleString("pt-BR")} km`
            );
          }
          if (diasRestante !== null) {
            partes.push(diasRestante <= 0
              ? `${Math.abs(diasRestante)} dias atrasado`
              : `faltam ${diasRestante} dias`
            );
          }
          if (partes.length === 0) partes.push("Em dia");
          mensagem = partes.join(" · ");
        }

        lista.push({
          id: `${vid}_${chave}`,
          veiculo_descricao: descricao,
          label: config.label,
          icon: IconComponent,
          severidade,
          mensagem,
          kmAtual,
          kmUltimo,
          kmRestante,
          diasRestante,
          dataUltimo: dataUltimo ? dataUltimo.format("DD/MM/YYYY") : null,
        });
      });

      // ── Alerta: Sem nenhuma manutenção há muito tempo ──
      const ultimoQualquer = registrosVeiculo._qualquer;
      if (ultimoQualquer) {
        const diasSem = moment().diff(moment(ultimoQualquer.data), "days");
        if (diasSem > 90) {
          lista.push({
            id: `${vid}_sem_manutencao`,
            veiculo_descricao: descricao,
            label: "Sem Manutenção",
            icon: Clock,
            severidade: diasSem > 180 ? "critico" : "atencao",
            mensagem: `Último registro há ${diasSem} dias (${moment(ultimoQualquer.data).format("DD/MM/YYYY")})`,
            kmRestante: null,
            diasRestante: null,
            dataUltimo: moment(ultimoQualquer.data).format("DD/MM/YYYY"),
            kmAtual: null,
            kmUltimo: null,
          });
        }
      } else {
        // Veículo sem nenhum registro em ManutencaoVeiculo
        lista.push({
          id: `${vid}_sem_registro`,
          veiculo_descricao: descricao,
          label: "Sem Registros",
          icon: Clock,
          severidade: "atencao",
          mensagem: "Nenhum registro de manutenção encontrado para este veículo",
          kmRestante: null,
          diasRestante: null,
          dataUltimo: null,
          kmAtual: null,
          kmUltimo: null,
        });
      }
    });

    // Ordena: críticos primeiro
    const ordem = { critico: 0, atencao: 1, proximo: 2, ok: 3 };
    lista.sort((a, b) => ordem[a.severidade] - ordem[b.severidade]);
    return lista;
  }, [veiculos, kmAtualPorVeiculo, ultimoRegistroPorTipoVeiculo]);

  // ── Contadores ──
  const contadores = useMemo(() => ({
    critico: alertas.filter(a => a.severidade === "critico").length,
    atencao: alertas.filter(a => a.severidade === "atencao").length,
    proximo: alertas.filter(a => a.severidade === "proximo").length,
    ok: alertas.filter(a => a.severidade === "ok").length,
    total: alertas.filter(a => a.severidade !== "ok").length,
  }), [alertas]);

  // Alertas visíveis (toggle + dismissed)
  const alertasVisiveis = (mostrarTodos
    ? alertas
    : alertas.filter(a => a.severidade !== "ok")
  ).filter(a => !dismissed.includes(a.id));

  if (alertas.length === 0) return null;

  return (
    <Collapsible open={expandido} onOpenChange={setExpandido}>
      <Card className="border shadow-sm overflow-hidden">
        {/* ── Header colapsável ── */}
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                {contadores.total > 0 ? (
                  <div className="relative">
                    <BellRing className="w-5 h-5 text-amber-600 animate-pulse" />
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {contadores.total}
                    </span>
                  </div>
                ) : (
                  <Bell className="w-5 h-5 text-green-600" />
                )}
                <CardTitle className="text-base">Alertas de Manutenção</CardTitle>
                <div className="flex items-center gap-1.5">
                  {contadores.critico > 0 && (
                    <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0">
                      {contadores.critico} crítico{contadores.critico > 1 ? "s" : ""}
                    </Badge>
                  )}
                  {contadores.atencao > 0 && (
                    <Badge className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0">
                      {contadores.atencao} atenção
                    </Badge>
                  )}
                  {contadores.proximo > 0 && (
                    <Badge className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0">
                      {contadores.proximo} próximo{contadores.proximo > 1 ? "s" : ""}
                    </Badge>
                  )}
                  {contadores.total === 0 && (
                    <Badge className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0">
                      Tudo em dia ✓
                    </Badge>
                  )}
                </div>
              </div>
              {expandido ? (
                <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        {/* ── Conteúdo ── */}
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 space-y-3">
            {/* Toggle todos/pendentes */}
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setMostrarTodos(!mostrarTodos);
                }}
                className="text-xs text-gray-500 h-7"
              >
                {mostrarTodos
                  ? `Mostrar apenas pendentes (${contadores.total})`
                  : `Mostrar todos (${alertas.length})`
                }
              </Button>
            </div>

            {/* Lista de alertas */}
            {alertasVisiveis.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
                <p className="text-sm">Nenhum alerta pendente!</p>
              </div>
            ) : (
              <AnimatePresence>
                <div className="space-y-2">
                  {alertasVisiveis.map(alerta => {
                    const sev = SEVERIDADE_STYLES[alerta.severidade];
                    const IconComp = alerta.icon;

                    return (
                      <motion.div
                        key={alerta.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className={`flex items-start gap-3 p-3 rounded-lg border ${sev.cor} transition-all`}
                      >
                        {/* Ícone */}
                        <div className={`mt-0.5 shrink-0 ${sev.icon_cor}`}>
                          <IconComp className="w-4 h-4" />
                        </div>

                        {/* Conteúdo */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-800">
                              {alerta.label}
                            </span>
                            <Badge className={`${sev.badge} text-[10px] px-1.5 py-0`}>
                              {sev.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
                            <Car className="w-3 h-3" />
                            {alerta.veiculo_descricao}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {alerta.mensagem}
                          </p>
                          {/* Info do último registro */}
                          {alerta.dataUltimo && (
                            <p className="text-[10px] text-gray-400 mt-1">
                              Último: {alerta.dataUltimo}
                              {alerta.kmUltimo > 0 && ` · ${alerta.kmUltimo.toLocaleString("pt-BR")} km`}
                              {alerta.kmAtual > 0 && ` → Atual: ${alerta.kmAtual.toLocaleString("pt-BR")} km`}
                            </p>
                          )}
                        </div>

                        {/* Indicador km restante */}
                        {alerta.kmRestante !== null && alerta.kmRestante !== undefined && (
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-bold ${
                              alerta.kmRestante <= 0 ? "text-red-600" :
                              alerta.kmRestante <= 1000 ? "text-amber-600" :
                              "text-blue-600"
                            }`}>
                              {alerta.kmRestante <= 0
                                ? `+${Math.abs(alerta.kmRestante).toLocaleString("pt-BR")}`
                                : alerta.kmRestante.toLocaleString("pt-BR")
                              }
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {alerta.kmRestante <= 0 ? "km atrasado" : "km restantes"}
                            </p>
                          </div>
                        )}

                        {/* Botão dispensar */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDismissed(prev => [...prev, alerta.id]);
                          }}
                          className="shrink-0 p-1 rounded hover:bg-black/5 mt-0.5"
                          title="Dispensar alerta"
                        >
                          <X className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              </AnimatePresence>
            )}

            {/* Legenda + info */}
            <div className="flex flex-wrap gap-3 pt-2 border-t text-[10px] text-gray-400">
              <span>🔴 Crítico = atrasado ou nunca feito</span>
              <span>🟡 Atenção = muito próximo do limite</span>
              <span>🔵 Próximo = dentro da antecedência</span>
              <span>🟢 OK = em dia</span>
            </div>
            <p className="text-[10px] text-gray-300">
              * O km atual é baseado no maior km_atual registrado em Manutenção & Combustível para cada veículo.
            </p>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}