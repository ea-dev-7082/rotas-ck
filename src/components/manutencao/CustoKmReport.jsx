import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, Fuel, Wrench, Car } from "lucide-react";

export default function CustoKmReport({ registros, veiculos }) {
  const relatorio = useMemo(() => {
    // Agrupa por veículo
    const porVeiculo = {};
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
          km_min: Infinity,
          km_max: 0,
          registros: 0
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

      if (reg.km_atual) {
        const km = Number(reg.km_atual);
        if (km < v.km_min) v.km_min = km;
        if (km > v.km_max) v.km_max = km;
      }
    });

    return Object.values(porVeiculo).map(v => {
      const kmRodados = v.km_max > 0 && v.km_min < Infinity ? v.km_max - v.km_min : 0;
      return {
        ...v,
        km_rodados: kmRodados,
        custo_por_km: kmRodados > 0 ? v.total_geral / kmRodados : 0,
        km_por_litro: v.total_litros > 0 && kmRodados > 0 ? kmRodados / v.total_litros : 0
      };
    });
  }, [registros]);

  const totais = useMemo(() => {
    return relatorio.reduce((acc, v) => ({
      combustivel: acc.combustivel + v.total_combustivel,
      manutencao: acc.manutencao + v.total_manutencao,
      geral: acc.geral + v.total_geral,
      registros: acc.registros + v.registros
    }), { combustivel: 0, manutencao: 0, geral: 0, registros: 0 });
  }, [relatorio]);

  const chartData = relatorio.map(v => ({
    name: `${v.placa || v.descricao}`,
    Combustível: Number(v.total_combustivel.toFixed(2)),
    Manutenção: Number(v.total_manutencao.toFixed(2))
  }));

  return (
    <div className="space-y-6">
      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            <Car className="w-5 h-5 mx-auto mb-1 text-purple-500" />
            <p className="text-xs text-gray-500 uppercase font-medium">Registros</p>
            <p className="text-xl font-bold text-purple-600">{totais.registros}</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Custos por Veículo</CardTitle>
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
                  <Bar dataKey="Combustível" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Manutenção" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela custo/km por veículo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Custo por Km Rodado</CardTitle>
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
                      <td className="py-2 px-3 text-right">{v.km_rodados > 0 ? v.km_rodados.toLocaleString("pt-BR") : "-"}</td>
                      <td className="py-2 px-3 text-right text-blue-600">R$ {v.total_combustivel.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-orange-600">R$ {v.total_manutencao.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-bold">R$ {v.total_geral.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right">
                        {v.custo_por_km > 0 ? (
                          <Badge className={v.custo_por_km > 2 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}>
                            R$ {v.custo_por_km.toFixed(2)}
                          </Badge>
                        ) : "-"}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {v.km_por_litro > 0 ? `${v.km_por_litro.toFixed(1)} km/L` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}