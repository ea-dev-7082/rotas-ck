import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle, CheckCircle2, Droplets, Settings2,
  CircleDot, ChevronDown, ChevronUp, Save, Loader2
} from "lucide-react";
import moment from "moment";

const DEFAULTS = {
  troca_oleo_km: 10000,
  troca_oleo_dias: 180,
  revisao_preventiva_km: 20000,
  revisao_preventiva_dias: 365,
  pneu_km: 40000,
};

const TIPOS_ALERTA = [
  {
    key: "troca_oleo",
    label: "Troca de Óleo",
    icon: Droplets,
    campo_km: "troca_oleo_km",
    campo_dias: "troca_oleo_dias",
    tipos_registro: ["troca_oleo"],
  },
  {
    key: "revisao_preventiva",
    label: "Revisão Preventiva",
    icon: Settings2,
    campo_km: "revisao_preventiva_km",
    campo_dias: "revisao_preventiva_dias",
    tipos_registro: ["manutencao_preventiva"],
  },
  {
    key: "pneu",
    label: "Troca de Pneus",
    icon: CircleDot,
    campo_km: "pneu_km",
    campo_dias: null,
    tipos_registro: ["pneu"],
  },
];

export default function VehicleAlertInfo({ veiculoId, registros, currentUser }) {
  const [showConfig, setShowConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localConfig, setLocalConfig] = useState(null);
  const queryClient = useQueryClient();

  // Busca config salva para este veículo
  const { data: configData } = useQuery({
    queryKey: ["config-alerta-veiculo", veiculoId],
    queryFn: async () => {
      const all = await base44.entities.ConfigAlertaVeiculo.filter({ veiculo_id: veiculoId });
      return all[0] || null;
    },
    enabled: !!veiculoId,
  });

  // Busca RegistroDiarioVeiculo para este veículo (km_inicial/km_final)
  const { data: registrosDiarios = [] } = useQuery({
    queryKey: ["registros-diarios-veiculo", veiculoId],
    queryFn: () => base44.entities.RegistroDiarioVeiculo.filter({ veiculo_id: veiculoId }, "-data", 50),
    enabled: !!veiculoId,
    initialData: [],
  });

  // Busca RotaAgendada para este veículo (km_inicial/km_final)
  const { data: rotasVeiculo = [] } = useQuery({
    queryKey: ["rotas-veiculo-km", veiculoId],
    queryFn: () => base44.entities.RotaAgendada.filter({ veiculo_id: veiculoId }, "-created_date", 50),
    enabled: !!veiculoId,
    initialData: [],
  });

  const config = localConfig || configData || {};

  const getVal = (campo) => config[campo] ?? DEFAULTS[campo] ?? 0;

  // Registros deste veículo
  const veiculoRegistros = useMemo(() => {
    return (registros || []).filter(r => r.veiculo_id === veiculoId);
  }, [registros, veiculoId]);

  // Km atual = maior km entre TODAS as fontes
  const kmAtual = useMemo(() => {
    let max = 0;
    const check = (v) => { if (v > max) max = v; };
    // ManutencaoVeiculo
    veiculoRegistros.forEach(r => check(Number(r.km_atual) || 0));
    // RegistroDiarioVeiculo
    registrosDiarios.forEach(r => {
      check(Number(r.km_inicial) || 0);
      check(Number(r.km_final) || 0);
    });
    // RotaAgendada
    rotasVeiculo.forEach(r => {
      check(Number(r.km_inicial) || 0);
      check(Number(r.km_final) || 0);
    });
    return max;
  }, [veiculoRegistros, registrosDiarios, rotasVeiculo]);

  // Calcular alertas
  const alertas = useMemo(() => {
    return TIPOS_ALERTA.map(tipo => {
      const ultimoRegistro = [...veiculoRegistros]
        .filter(r => tipo.tipos_registro.includes(r.tipo))
        .sort((a, b) => moment(b.data).valueOf() - moment(a.data).valueOf())[0];

      const kmUltimo = ultimoRegistro ? (Number(ultimoRegistro.km_atual) || 0) : 0;
      const dataUltimo = ultimoRegistro ? moment(ultimoRegistro.data) : null;

      const intervaloKm = getVal(tipo.campo_km);
      const intervaloDias = tipo.campo_dias ? getVal(tipo.campo_dias) : null;

      let kmRestante = null;
      let diasRestante = null;
      let severidade = "ok";

      // Cálculo por km
      if (intervaloKm > 0 && kmAtual > 0) {
        if (kmUltimo > 0) {
          kmRestante = intervaloKm - (kmAtual - kmUltimo);
        } else {
          kmRestante = 0; // nunca fez
        }
      }

      // Cálculo por dias
      if (intervaloDias && intervaloDias > 0 && dataUltimo) {
        diasRestante = intervaloDias - moment().diff(dataUltimo, "days");
      } else if (intervaloDias && !dataUltimo) {
        diasRestante = 0;
      }

      // Severidade
      if ((kmRestante !== null && kmRestante <= 0) || (diasRestante !== null && diasRestante <= 0)) {
        severidade = "critico";
      } else if (
        (kmRestante !== null && kmRestante <= intervaloKm * 0.1) ||
        (diasRestante !== null && diasRestante <= 15)
      ) {
        severidade = "atencao";
      } else if (
        (kmRestante !== null && kmRestante <= intervaloKm * 0.2) ||
        (diasRestante !== null && diasRestante <= 30)
      ) {
        severidade = "proximo";
      }

      return {
        ...tipo,
        ultimoRegistro,
        kmUltimo,
        dataUltimo,
        kmRestante,
        diasRestante,
        severidade,
      };
    });
  }, [veiculoRegistros, kmAtual, config]);

  const handleSaveConfig = async () => {
    setSaving(true);
    const payload = {
      veiculo_id: veiculoId,
      troca_oleo_km: Number(getVal("troca_oleo_km")),
      troca_oleo_dias: Number(getVal("troca_oleo_dias")),
      revisao_preventiva_km: Number(getVal("revisao_preventiva_km")),
      revisao_preventiva_dias: Number(getVal("revisao_preventiva_dias")),
      pneu_km: Number(getVal("pneu_km")),
      owner: currentUser?.email || "",
    };

    if (configData?.id) {
      await base44.entities.ConfigAlertaVeiculo.update(configData.id, payload);
    } else {
      await base44.entities.ConfigAlertaVeiculo.create(payload);
    }

    queryClient.invalidateQueries({ queryKey: ["config-alerta-veiculo", veiculoId] });
    queryClient.invalidateQueries({ queryKey: ["configs-alerta-veiculos"] });
    setSaving(false);
    setLocalConfig(null);
  };

  const updateLocalConfig = (campo, valor) => {
    setLocalConfig(prev => ({
      ...DEFAULTS,
      ...(configData || {}),
      ...(prev || {}),
      [campo]: valor,
    }));
  };

  if (!veiculoId) return null;

  const temAlertaPendente = alertas.some(a => a.severidade !== "ok");

  return (
    <div className="space-y-2">
      {/* Resumo de alertas */}
      <div className={`p-3 rounded-lg border ${temAlertaPendente ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {temAlertaPendente ? (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            )}
            <span className="text-sm font-medium text-gray-800">
              {temAlertaPendente ? "Alertas de manutenção" : "Manutenções em dia"}
            </span>
            {kmAtual > 0 && (
              <Badge variant="outline" className="text-[10px]">
                Km atual: {kmAtual.toLocaleString("pt-BR")}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowConfig(!showConfig)}
            className="h-7 text-xs text-gray-500"
          >
            {showConfig ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
            {showConfig ? "Ocultar config" : "Configurar intervalos"}
          </Button>
        </div>

        {/* Lista de alertas */}
        <div className="space-y-1.5">
          {alertas.map(alerta => {
            const Icon = alerta.icon;
            const sevColors = {
              critico: "text-red-600 bg-red-100",
              atencao: "text-amber-600 bg-amber-100",
              proximo: "text-blue-600 bg-blue-100",
              ok: "text-green-600 bg-green-100",
            };
            const sevLabels = {
              critico: "Atrasado",
              atencao: "Atenção",
              proximo: "Próximo",
              ok: "Em dia",
            };

            return (
              <div key={alerta.key} className="flex items-center gap-2 text-xs">
                <Icon className={`w-3.5 h-3.5 ${sevColors[alerta.severidade].split(" ")[0]}`} />
                <span className="font-medium text-gray-700 w-28">{alerta.label}</span>
                <Badge className={`${sevColors[alerta.severidade]} text-[10px] px-1.5 py-0`}>
                  {sevLabels[alerta.severidade]}
                </Badge>
                <span className="text-gray-500">
                  {alerta.kmRestante !== null && alerta.kmRestante !== undefined ? (
                    alerta.kmRestante <= 0
                      ? `${Math.abs(alerta.kmRestante).toLocaleString("pt-BR")} km atrasado`
                      : `faltam ${alerta.kmRestante.toLocaleString("pt-BR")} km`
                  ) : "sem dados de km"}
                  {alerta.diasRestante !== null && alerta.diasRestante !== undefined && (
                    <> · {alerta.diasRestante <= 0
                      ? `${Math.abs(alerta.diasRestante)} dias atrasado`
                      : `${alerta.diasRestante} dias`
                    }</>
                  )}
                </span>
                {alerta.dataUltimo && (
                  <span className="text-gray-400 ml-auto">
                    Último: {alerta.dataUltimo.format("DD/MM/YY")}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Configuração de intervalos */}
      {showConfig && (
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
          <p className="text-xs font-medium text-gray-600">
            Intervalos para este veículo (salvos automaticamente):
          </p>

          {TIPOS_ALERTA.map(tipo => (
            <div key={tipo.key} className="flex items-center gap-3">
              <span className="text-xs text-gray-600 w-32 shrink-0">{tipo.label}</span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  className="w-24 h-7 text-xs"
                  value={getVal(tipo.campo_km)}
                  onChange={e => updateLocalConfig(tipo.campo_km, Number(e.target.value))}
                  placeholder="km"
                />
                <span className="text-[10px] text-gray-400">km</span>
              </div>
              {tipo.campo_dias && (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    className="w-20 h-7 text-xs"
                    value={getVal(tipo.campo_dias)}
                    onChange={e => updateLocalConfig(tipo.campo_dias, Number(e.target.value))}
                    placeholder="dias"
                  />
                  <span className="text-[10px] text-gray-400">dias</span>
                </div>
              )}
            </div>
          ))}

          <Button
            size="sm"
            onClick={handleSaveConfig}
            disabled={saving || !localConfig}
            className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
            Salvar Intervalos
          </Button>
        </div>
      )}
    </div>
  );
}