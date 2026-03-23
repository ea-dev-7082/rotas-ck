import React, { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { TrendingUp, Fuel, Wrench, Car, Gauge, AlertTriangle } from "lucide-react";
import moment from "moment";

export default function CustoKmReport({
  registros,
  veiculos,
  currentUser,
  startDate,
  endDate,
}) {
  // Busca registros diários de veículos para km reais
  const { data: registrosDiarios = [], isLoading: loadingDiarios } = useQuery({
    queryKey: ["registros-diarios-report", currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      return base44.entities.RegistroDiarioVeiculo.list("-data", 500);
    },
    enabled: !!currentUser?.email,
    initialData: [],
  });

  // Busca rotas agendadas para km (km_inicial/km_final das rotas)
  const { data: rotasAgendadas = [] } = useQuery({
    queryKey: ["rotas-km-report", currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      return base44.entities.RotaAgendada.list("-created_date", 500);
    },
    enabled: !!currentUser?.email,
    initialData: [],
  });

  // Filtra rotas pelo período
  const rotasFiltradas = useMemo(() => {
    if (!startDate || !endDate) return rotasAgendadas;
    const inicio = moment(startDate).startOf("day");
    const fim = moment(endDate).endOf("day");
    return rotasAgendadas.filter(r => {
      const dataR = moment(r.data_prevista || r.data_agendamento);
      return dataR.isSameOrAfter(inicio) && dataR.isSameOrBefore(fim);
    });
  }, [rotasAgendadas, startDate, endDate]);

  // ✅ CORREÇÃO 1: Filtrar registros diários pelo MESMO período dos filtros da página
  const registrosDiariosFiltrados = useMemo(() => {
    if (!startDate || !endDate) return registrosDiarios;
    const inicio = moment(startDate).startOf("day");
    const fim = moment(endDate).endOf("day");
    return registrosDiarios.filter(rd => {
      if (!rd.data) return false;
      const dataRd = moment(rd.data);
      return dataRd.isSameOrAfter(inicio) && dataRd.isSameOrBefore(fim);
    });
  }, [registrosDiarios, startDate, endDate]);

  // ✅ CORREÇÃO 2: Detectar se abastecimentos dos registros diários já existem em ManutencaoVeiculo
  // Para evitar duplicação, criamos um Set de identificadores únicos
  const idsAbastecimentoManutencao = useMemo(() => {
    const ids = new Set();
    registros.forEach(reg => {
      if (reg.tipo === "abastecimento") {
        // Cria chave única: veiculo + data + valor (para identificar duplicatas)
        const chave = `${reg.veiculo_id}_${moment(reg.data).format("YYYY-MM-DD")}_${Number(reg.valor).toFixed(2)}`;
        ids.add(chave);
      }
    });
    return ids;
  }, [registros]);

  const relatorio = useMemo(() => {
    const porVeiculo = {};

    // Helper para criar/obter entrada do veículo
    const getOrCreate = (vid, descricao, placa) => {
      if (!porVeiculo[vid]) {
        porVeiculo[vid] = {
          veiculo_id: vid,
          descricao: descricao || "Veículo",
          placa: placa || "",
          total_combustivel: 0,
          total_manutencao: 0,
          total_litros: 0,
          registros_count: 0,
          km_rodados_diarios: 0,
          dias_registrados: 0,
        };
      }
      return porVeiculo[vid];
    };

    // ────────────────────────────────────────────────
    // PASSO 1: Acumular custos dos registros de manutenção (já vêm filtrados por data)
    // ────────────────────────────────────────────────
    registros.forEach(reg => {
      const v = getOrCreate(reg.veiculo_id, reg.veiculo_descricao, reg.veiculo_placa);
      v.registros_count++;

      if (reg.tipo === "abastecimento") {
        v.total_combustivel += Number(reg.valor) || 0;
        v.total_litros += Number(reg.litros) || 0;
      } else {
        v.total_manutencao += Number(reg.valor) || 0;
      }
    });

    // ────────────────────────────────────────────────
    // PASSO 2: Acumular km dos registros diários (FILTRADOS pelo mesmo período)
    // ────────────────────────────────────────────────
    registrosDiariosFiltrados.forEach(rd => {
      const vid = rd.veiculo_id;
      const veiculo = veiculos.find(v => v.id === vid);
      const v = getOrCreate(
        vid,
        rd.veiculo_descricao || veiculo?.descricao,
        rd.veiculo_placa || veiculo?.placa
      );

      // Acumula km rodados
      const kmI = Number(rd.km_inicial) || 0;
      const kmF = Number(rd.km_final) || 0;
      if (kmI > 0 && kmF > 0 && kmF > kmI) {
        v.km_rodados_diarios += (kmF - kmI);
        v.dias_registrados++;
      }

      // Só soma abastecimentos inline se NÃO existem já em ManutencaoVeiculo
      if (rd.abastecimentos && rd.abastecimentos.length > 0) {
        rd.abastecimentos.forEach(ab => {
          const chave = `${vid}_${moment(rd.data).format("YYYY-MM-DD")}_${Number(ab.valor).toFixed(2)}`;
          if (idsAbastecimentoManutencao.has(chave)) return;

          v.total_combustivel += Number(ab.valor) || 0;
          v.total_litros += Number(ab.litros) || 0;
          v.registros_count++;
        });
      }
    });

    // ────────────────────────────────────────────────
    // PASSO 2B: Acumular km das rotas agendadas (FILTRADAS pelo mesmo período)
    // ────────────────────────────────────────────────
    rotasFiltradas.forEach(rota => {
      if (!rota.veiculo_id) return;
      const vid = rota.veiculo_id;
      const veiculo = veiculos.find(v => v.id === vid);
      const v = getOrCreate(
        vid,
        rota.veiculo_descricao || veiculo?.descricao,
        rota.veiculo_placa || veiculo?.placa
      );

      const kmI = Number(rota.km_inicial) || 0;
      const kmF = Number(rota.km_final) || 0;
      if (kmI > 0 && kmF > 0 && kmF > kmI) {
        v.km_rodados_diarios += (kmF - kmI);
        v.dias_registrados++;
      }
    });

    // ────────────────────────────────────────────────
    // PASSO 3: Calcular métricas
    // ────────────────────────────────────────────────
    return Object.values(porVeiculo).map(v => {
      const kmTotal = v.km_rodados_diarios;
      const custoTotal = v.total_combustivel + v.total_manutencao;

      return {
        ...v,
        km_rodados: kmTotal,
        custo_total: custoTotal,
        custo_combustivel_km: kmTotal > 0 ? v.total_combustivel / kmTotal : 0,
        custo_manutencao_km: kmTotal > 0 ? v.total_manutencao / kmTotal : 0,
        custo_total_km: kmTotal > 0 ? custoTotal / kmTotal : 0,
        km_por_litro: v.total_litros > 0 && kmTotal > 0 ? kmTotal / v.total_litros : 0,
      };
    });
  }, [registros, registrosDiariosFiltrados, rotasFiltradas, veiculos, idsAbastecimentoManutencao]);

  // ────────────────────────────────────────────────
  // Totais gerais
  // ────────────────────────────────────────────────
  const totais = useMemo(() => {
    return relatorio.reduce(
      (acc, v) => ({
        combustivel: acc.combustivel + v.total_combustivel,
        manutencao: acc.manutencao + v.total_manutencao,
        geral: acc.geral + v.custo_total,
        kmTotal: acc.kmTotal + v.km_rodados,
        registros: acc.registros + v.registros_count,
      }),
      { combustivel: 0, manutencao: 0, geral: 0, kmTotal: 0, registros: 0 }
    );
  }, [relatorio]);

  const custoMedioGeralKm = totais.kmTotal > 0 ? totais.geral / totais.kmTotal : 0;

  // Dados do gráfico — só veículos com km > 0
  const chartData = relatorio
    .filter(v => v.km_rodados > 0)
    .map(v => ({
      name: v.placa || v.descricao,
      "R$/Km Combustível": Number(v.custo_combustivel_km.toFixed(2)),
      "R$/Km Manutenção": Number(v.custo_manutencao_km.toFixed(2)),
      "R$/Km Total": Number(v.custo_total_km.toFixed(2)),
    }));

  // Veículos sem km registrados (para alerta)
  const veiculosSemKm = relatorio.filter(v => v.km_rodados === 0 && v.custo_total > 0);

  if (loadingDiarios) {
    return (
      <div className="text-center py-12 text-gray-500">
        Carregando registros diários...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alerta de veículos sem km */}
      {veiculosSemKm.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                {veiculosSemKm.length} veículo(s) com custos mas sem km registrados no período:
              </p>
              <p className="text-xs text-amber-700 mt-1">
                {veiculosSemKm.map(v => `${v.descricao} (${v.placa})`).join(", ")}
              </p>
              <p className="text-xs text-amber-600 mt-1">
                O cálculo de R$/Km só é possível quando há registros diários com km inicial e final preenchidos.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Fuel className="w-5 h-5 mx-auto mb-1 text-blue-500" />
            <p className="text-xs text-gray-500 uppercase font-medium">Combustível</p>
            <p className="text-xl font-bold text-blue-600">
              R$ {totais.combustivel.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Wrench className="w-5 h-5 mx-auto mb-1 text-orange-500" />
            <p className="text-xs text-gray-500 uppercase font-medium">Manutenção</p>
            <p className="text-xl font-bold text-orange-600">
              R$ {totais.manutencao.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-green-500" />
            <p className="text-xs text-gray-500 uppercase font-medium">Total Geral</p>
            <p className="text-xl font-bold text-green-600">
              R$ {totais.geral.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Gauge className="w-5 h-5 mx-auto mb-1 text-indigo-500" />
            <p className="text-xs text-gray-500 uppercase font-medium">Km Rodados</p>
            <p className="text-xl font-bold text-indigo-600">
              {totais.kmTotal.toLocaleString("pt-BR")}
            </p>
          </CardContent>
        </Card>
        <Card className="border-2 border-purple-200 bg-purple-50">
          <CardContent className="p-4 text-center">
            <Car className="w-5 h-5 mx-auto mb-1 text-purple-500" />
            <p className="text-xs text-purple-700 uppercase font-medium">Média R$/Km</p>
            <p className="text-2xl font-bold text-purple-700">
              {custoMedioGeralKm > 0 ? `R$ ${custoMedioGeralKm.toFixed(2)}` : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Período de referência */}
      <div className="text-center">
        <Badge variant="outline" className="text-xs text-gray-500">
          Período: {moment(startDate).format("DD/MM/YYYY")} até{" "}
          {moment(endDate).format("DD/MM/YYYY")} — {registrosDiariosFiltrados.length}{" "}
          registro(s) diário(s) no período
        </Badge>
      </div>

      {/* Gráfico */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Custo por Km por Veículo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip
                    formatter={(value) => `R$ ${Number(value).toFixed(2)}`}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="R$/Km Combustível"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="R$/Km Manutenção"
                    fill="#f97316"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="R$/Km Total"
                    fill="#8b5cf6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela custo/km por veículo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Custo por Km Rodado (baseado nos registros diários)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {relatorio.length === 0 ? (
            <p className="text-center text-gray-400 py-4">Sem dados suficientes</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 px-3 font-semibold text-gray-600">Veículo</th>
                    <th className="py-2 px-3 font-semibold text-gray-600 text-right">
                      Km Rodados
                    </th>
                    <th className="py-2 px-3 font-semibold text-gray-600 text-right">
                      Dias
                    </th>
                    <th className="py-2 px-3 font-semibold text-gray-600 text-right">
                      Combustível
                    </th>
                    <th className="py-2 px-3 font-semibold text-gray-600 text-right">
                      Manutenção
                    </th>
                    <th className="py-2 px-3 font-semibold text-gray-600 text-right">
                      Total
                    </th>
                    <th className="py-2 px-3 font-semibold text-gray-600 text-right">
                      R$/Km
                    </th>
                    <th className="py-2 px-3 font-semibold text-gray-600 text-right">
                      Km/L
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {relatorio.map(v => (
                    <tr key={v.veiculo_id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium">
                        {v.descricao}{" "}
                        <span className="text-gray-400">{v.placa}</span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        {v.km_rodados > 0 ? (
                          v.km_rodados.toLocaleString("pt-BR")
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {v.dias_registrados > 0 ? (
                          v.dias_registrados
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right text-blue-600">
                        R$ {v.total_combustivel.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right text-orange-600">
                        R$ {v.total_manutencao.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right font-bold">
                        R$ {v.custo_total.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {v.custo_total_km > 0 ? (
                          <Badge
                            className={
                              v.custo_total_km > 2
                                ? "bg-red-100 text-red-700"
                                : v.custo_total_km > 1
                                ? "bg-amber-100 text-amber-700"
                                : "bg-green-100 text-green-700"
                            }
                          >
                            R$ {v.custo_total_km.toFixed(2)}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {v.km_por_litro > 0 ? (
                          <span
                            className={
                              v.km_por_litro < 6
                                ? "text-red-600 font-medium"
                                : v.km_por_litro > 10
                                ? "text-green-600 font-medium"
                                : "text-gray-700"
                            }
                          >
                            {v.km_por_litro.toFixed(1)} km/L
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Linha de totais */}
                {relatorio.length > 1 && (
                  <tfoot>
                    <tr className="border-t-2 bg-gray-50 font-semibold">
                      <td className="py-2 px-3">TOTAL</td>
                      <td className="py-2 px-3 text-right">
                        {totais.kmTotal > 0
                          ? totais.kmTotal.toLocaleString("pt-BR")
                          : "-"}
                      </td>
                      <td className="py-2 px-3 text-right">-</td>
                      <td className="py-2 px-3 text-right text-blue-600">
                        R$ {totais.combustivel.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right text-orange-600">
                        R$ {totais.manutencao.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right font-bold">
                        R$ {totais.geral.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {custoMedioGeralKm > 0 ? (
                          <Badge className="bg-purple-100 text-purple-700">
                            R$ {custoMedioGeralKm.toFixed(2)}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">-</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-3">
            * Km rodados são calculados a partir dos registros diários e rotas (km inicial → km
            final) dentro do período selecionado. Custos de combustível e manutenção também
            são do mesmo período.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}