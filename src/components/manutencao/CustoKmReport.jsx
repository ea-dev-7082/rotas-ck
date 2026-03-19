import React, { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, Fuel, Wrench, Car, Gauge } from "lucide-react";

export default function CustoKmReport({ registros, veiculos, currentUser }) {
  // Busca registros diários de veículos para km reais
  const { data: registrosDiarios = [] } = useQuery({
    queryKey: ["registros-diarios-report", currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      const all = await base44.entities.RegistroDiarioVeiculo.list("-data", 500);
      return all.filter(r =>
        r.owner === currentUser.email || r.created_by === currentUser.email
      );
    },
    enabled: !!currentUser?.email,
    initialData: [],
  });

  const relatorio = useMemo(() => {
    const porVeiculo = {};

    // Acumula custos dos registros de manutenção
    registros.forEach(reg => {
      if (!porVeiculo[reg.veiculo_id]) {
        porVeiculo[reg.veiculo_id] = {
          veiculo_id: reg.veiculo_id,
          descricao: reg.veiculo_descricao || "Veículo",
          placa: reg.veiculo_placa || "",
          total_combustivel: 0,
          total_manutencao: 0,
          total_geral: 0,
          total_litros: 0,
          registros: 0,
          km_rodados_diarios: 0,
          dias_registrados: 0,
          total_combustivel_diario: 0,
          litros_diarios: 0,
        };
      }
      const v = porVeiculo[reg.veiculo_id];
      v.registros++;
      v.total_geral += Number(reg.valor) || 0;

      if (reg.tipo === "abastecimento") {
        v.total_combustivel += Number(reg.valor) || 0;
        v.total_litros += Number(reg.litros) || 0;
      } else {
        v.total_manutencao += Number(reg.valor) || 0;
      }
    });

    // Acumula km dos registros diários
    registrosDiarios.forEach(rd => {
      const vid = rd.veiculo_id;
      if (!porVeiculo[vid]) {
        const veiculo = veiculos.find(v => v.id === vid);
        porVeiculo[vid] = {
          veiculo_id: vid,
          descricao: rd.veiculo_descricao || veiculo?.descricao || "Veículo",
          placa: rd.veiculo_placa || veiculo?.placa || "",
          total_combustivel: 0,
          total_manutencao: 0,
          total_geral: 0,
          total_litros: 0,
          registros: 0,
          km_rodados_diarios: 0,
          dias_registrados: 0,
          total_combustivel_diario: 0,
          litros_diarios: 0,
        };
      }
      const v = porVeiculo[vid];
      const kmI = Number(rd.km_inicial) || 0;
      const kmF = Number(rd.km_final) || 0;
      if (kmI > 0 && kmF > 0 && kmF > kmI) {
        v.km_rodados_diarios += (kmF - kmI);
        v.dias_registrados++;
      }
      // Combustível dos registros diários (abastecimentos inline)
      if (rd.abastecimentos && rd.abastecimentos.length > 0) {
        rd.abastecimentos.forEach(ab => {
          v.total_combustivel_diario += Number(ab.valor) || 0;
          v.litros_diarios += Number(ab.litros) || 0;
        });
      }
    });

    return Object.values(porVeiculo).map(v => {
      const kmTotal = v.km_rodados_diarios;
      // Custo combustível combinado (manutenção + diário)
      const custoCombustivelTotal = v.total_combustivel + v.total_combustivel_diario;
      const litrosTotal = v.total_litros + v.litros_diarios;
      return {
        ...v,
        km_rodados: kmTotal,
        custo_combustivel_km: kmTotal > 0 ? custoCombustivelTotal / kmTotal : 0,
        custo_total_km: kmTotal > 0 ? (custoCombustivelTotal + v.total_manutencao) / kmTotal : 0,
        km_por_litro: litrosTotal > 0 && kmTotal > 0 ? kmTotal / litrosTotal : 0,
        custo_combustivel_total: custoCombustivelTotal,
        litros_total: litrosTotal,
      };
    });
  }, [registros, registrosDiarios, veiculos]);

  const totais = useMemo(() => {
    return relatorio.reduce((acc, v) => ({
      combustivel: acc.combustivel + v.custo_combustivel_total,
      manutencao: acc.manutencao + v.total_manutencao,
      geral: acc.geral + v.custo_combustivel_total + v.total_manutencao,
      kmTotal: acc.kmTotal + v.km_rodados,
      registros: acc.registros + v.registros,
    }), { combustivel: 0, manutencao: 0, geral: 0, kmTotal: 0, registros: 0 });
  }, [relatorio]);

  const custoMedioGeralKm = totais.kmTotal > 0 ? totais.geral / totais.kmTotal : 0;

  const chartData = relatorio.filter(v => v.km_rodados > 0).map(v => ({
    name: `${v.placa || v.descricao}`,
    "R$/Km Combustível": Number(v.custo_combustivel_km.toFixed(2)),
    "R$/Km Total": Number(v.custo_total_km.toFixed(2)),
  }));

  return (
    <div className="space-y-6">
      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Fuel className="w-5 h-5 mx-auto mb-1 text-blue-500" />
            <p className="text-xs text-gray-500 uppercase font-medium">Combustível</p>
            <p className="text-xl font-bold text-blue-600">R$ {totais.combustivel.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Wrench className="w-5 h-5 mx-auto mb-1 text-orange-500" />
            <p className="text-xs text-gray-500 uppercase font-medium">Manutenção</p>
            <p className="text-xl font-bold text-orange-600">R$ {totais.manutencao.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-green-500" />
            <p className="text-xs text-gray-500 uppercase font-medium">Total Geral</p>
            <p className="text-xl font-bold text-green-600">R$ {totais.geral.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Gauge className="w-5 h-5 mx-auto mb-1 text-indigo-500" />
            <p className="text-xs text-gray-500 uppercase font-medium">Km Rodados</p>
            <p className="text-xl font-bold text-indigo-600">{totais.kmTotal.toLocaleString("pt-BR")}</p>
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
                  <Tooltip formatter={(value) => `R$ ${value.toFixed(2)}`} />
                  <Legend />
                  <Bar dataKey="R$/Km Combustível" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="R$/Km Total" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela custo/km por veículo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Custo por Km Rodado (baseado nos registros diários)</CardTitle>
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
                    <th className="py-2 px-3 font-semibold text-gray-600 text-right">Km Rodados</th>
                    <th className="py-2 px-3 font-semibold text-gray-600 text-right">Dias</th>
                    <th className="py-2 px-3 font-semibold text-gray-600 text-right">Combustível</th>
                    <th className="py-2 px-3 font-semibold text-gray-600 text-right">Manutenção</th>
                    <th className="py-2 px-3 font-semibold text-gray-600 text-right">Total</th>
                    <th className="py-2 px-3 font-semibold text-gray-600 text-right">R$/Km</th>
                    <th className="py-2 px-3 font-semibold text-gray-600 text-right">Km/L</th>
                  </tr>
                </thead>
                <tbody>
                  {relatorio.map(v => (
                    <tr key={v.veiculo_id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium">{v.descricao} <span className="text-gray-400">{v.placa}</span></td>
                      <td className="py-2 px-3 text-right">{v.km_rodados > 0 ? v.km_rodados.toLocaleString("pt-BR") : <span className="text-gray-400">-</span>}</td>
                      <td className="py-2 px-3 text-right">{v.dias_registrados || <span className="text-gray-400">-</span>}</td>
                      <td className="py-2 px-3 text-right text-blue-600">R$ {v.custo_combustivel_total.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-orange-600">R$ {v.total_manutencao.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-bold">R$ {(v.custo_combustivel_total + v.total_manutencao).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right">
                        {v.custo_total_km > 0 ? (
                          <Badge className={v.custo_total_km > 2 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}>
                            R$ {v.custo_total_km.toFixed(2)}
                          </Badge>
                        ) : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {v.km_por_litro > 0 ? `${v.km_por_litro.toFixed(1)} km/L` : <span className="text-gray-400">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-3">* Km rodados são calculados a partir dos registros diários (km inicial → km final). Custos incluem abastecimentos e manutenções do período filtrado.</p>
        </CardContent>
      </Card>
    </div>
  );
}