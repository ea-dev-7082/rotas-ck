import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Wrench, Plus, Filter, Download, Fuel, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import moment from "moment";

import ManutencaoForm from "../components/manutencao/ManutencaoForm";
import ManutencaoList from "../components/manutencao/ManutencaoList";
import CustoKmReport from "../components/manutencao/CustoKmReport";

export default function Manutencao() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [filterVeiculo, setFilterVeiculo] = useState("todos");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [startDate, setStartDate] = useState(moment().startOf("month").format("YYYY-MM-DD"));
  const [endDate, setEndDate] = useState(moment().endOf("month").format("YYYY-MM-DD"));

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  const { data: veiculos } = useQuery({
    queryKey: ["veiculos-manutencao", currentUser?.email],
    queryFn: async () => {
      const allVeiculos = await base44.entities.Veiculo.list();
      return allVeiculos.filter(v =>
        v.owner === currentUser.email || v.created_by === currentUser.email
      );
    },
    enabled: !!currentUser,
    initialData: []
  });

  const { data: registros, isLoading } = useQuery({
    queryKey: ["manutencao", currentUser?.email],
    queryFn: async () => {
      const allRecords = await base44.entities.ManutencaoVeiculo.list("-data");
      return allRecords.filter(r =>
        r.owner === currentUser.email ||
        r.created_by === currentUser.email
      );
    },
    enabled: !!currentUser,
    initialData: []
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ManutencaoVeiculo.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["manutencao"] })
  });

  const filteredRegistros = useMemo(() => {
    return registros.filter(reg => {
      if (filterVeiculo !== "todos" && reg.veiculo_id !== filterVeiculo) return false;
      if (filterTipo !== "todos" && reg.tipo !== filterTipo) return false;
      if (startDate && moment(reg.data).isBefore(moment(startDate))) return false;
      if (endDate && moment(reg.data).isAfter(moment(endDate).endOf("day"))) return false;
      return true;
    });
  }, [registros, filterVeiculo, filterTipo, startDate, endDate]);

  const handleEdit = (item) => {
    setEditItem(item);
    setShowForm(true);
  };

  const handleNew = () => {
    setEditItem(null);
    setShowForm(true);
  };

  const handleExportCSV = () => {
    const headers = ["Data", "Veículo", "Placa", "Tipo", "Km", "Valor", "Litros", "R$/L", "Local", "Descrição"];
    const rows = filteredRegistros.map(r => [
      moment(r.data).format("DD/MM/YYYY"),
      r.veiculo_descricao,
      r.veiculo_placa,
      r.tipo,
      r.km_atual || "",
      Number(r.valor).toFixed(2),
      r.litros || "",
      r.preco_litro ? Number(r.preco_litro).toFixed(2) : "",
      r.posto || "",
      r.descricao || ""
    ]);

    const csv = "\uFEFF" + [
      headers.join(";"),
      ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `manutencao_${moment(startDate).format("DDMMYYYY")}_${moment(endDate).format("DDMMYYYY")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100 p-6">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Manutenção & Combustível</h1>
              <p className="text-gray-600">Controle de custos por veículo</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportCSV} disabled={filteredRegistros.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
            <Button onClick={handleNew} className="bg-green-600 hover:bg-green-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Novo Registro
            </Button>
          </div>
        </motion.div>

        {/* Filtros */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-3 mb-6 bg-white p-4 rounded-xl border shadow-sm"
        >
          <Filter className="w-4 h-4 text-gray-400" />

          <Select value={filterVeiculo} onValueChange={setFilterVeiculo}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os veículos</SelectItem>
              {veiculos.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.descricao} - {v.placa}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="abastecimento">Abastecimento</SelectItem>
              <SelectItem value="troca_oleo">Troca de Óleo</SelectItem>
              <SelectItem value="manutencao_preventiva">Preventiva</SelectItem>
              <SelectItem value="manutencao_corretiva">Corretiva</SelectItem>
              <SelectItem value="pneu">Pneu</SelectItem>
              <SelectItem value="outros">Outros</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-[150px] h-9"
          />
          <span className="text-gray-400 text-sm">até</span>
          <Input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="w-[150px] h-9"
          />

          <Badge variant="secondary" className="ml-auto">
            {filteredRegistros.length} registro(s)
          </Badge>
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="registros">
          <TabsList className="mb-4">
            <TabsTrigger value="registros" className="gap-2">
              <Fuel className="w-4 h-4" />
              Registros
            </TabsTrigger>
            <TabsTrigger value="relatorio" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Relatório Custo/Km
            </TabsTrigger>
          </TabsList>

          <TabsContent value="registros">
            <Card className="bg-white/80 shadow-xl border-0">
              <CardContent className="p-6">
                {isLoading ? (
                  <div className="text-center py-8 text-gray-500">Carregando...</div>
                ) : (
                  <ManutencaoList
                    registros={filteredRegistros}
                    onEdit={handleEdit}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="relatorio">
            {/* ✅ CORREÇÃO: Passa startDate e endDate para o relatório */}
            <CustoKmReport
              registros={filteredRegistros}
              veiculos={veiculos}
              currentUser={currentUser}
              startDate={startDate}
              endDate={endDate}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog de formulário */}
      <ManutencaoForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditItem(null); }}
        veiculos={veiculos}
        editItem={editItem}
        currentUser={currentUser}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["manutencao"] })}
      />
    </div>
  );
}
