import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Car, Plus, Pencil, Trash2, Bike, Gauge, Fuel, History, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function Veiculos() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVeiculo, setEditingVeiculo] = useState(null);
  const [formData, setFormData] = useState({
    descricao: "",
    tipo: "carro",
    placa: "",
    capacidade: "",
    ativo: true,
  });

  const { data: veiculos = [], isLoading } = useQuery({
    queryKey: ["veiculos"],
    queryFn: () => base44.entities.Veiculo.list(),
    initialData: [],
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Veiculo.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["veiculos"] });
      toast.success("Veículo cadastrado!");
      closeDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Veiculo.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["veiculos"] });
      toast.success("Veículo atualizado!");
      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Veiculo.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["veiculos"] });
      toast.success("Veículo excluído!");
    },
  });

  const openDialog = (veiculo = null) => {
    if (veiculo) {
      setEditingVeiculo(veiculo);
      setFormData({
        descricao: veiculo.descricao || "",
        tipo: veiculo.tipo || "carro",
        placa: veiculo.placa || "",
        capacidade: veiculo.capacidade || "",
        ativo: veiculo.ativo !== false,
      });
    } else {
      setEditingVeiculo(null);
      setFormData({
        descricao: "",
        tipo: "carro",
        placa: "",
        capacidade: "",
        ativo: true,
      });
    }
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingVeiculo(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.descricao) {
      toast.error("Preencha a descrição do veículo");
      return;
    }
    if (editingVeiculo) {
      updateMutation.mutate({ id: editingVeiculo.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (veiculo) => {
    if (confirm(`Deseja excluir o veículo "${veiculo.descricao}"?`)) {
      deleteMutation.mutate(veiculo.id);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Car className="w-6 h-6" />
            Veículos
          </h1>
          <p className="text-gray-500">Gerencie os veículos da frota</p>
        </div>
        <Button onClick={() => openDialog()} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Novo Veículo
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : veiculos.length === 0 ? (
        <Card className="p-12 text-center">
          <Car className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Nenhum veículo cadastrado</h3>
          <p className="text-gray-500 mb-4">Cadastre veículos para usar nas rotas</p>
          <Button onClick={() => openDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Cadastrar Veículo
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {veiculos.map((veiculo) => (
            <Card key={veiculo.id} className={`${!veiculo.ativo ? "opacity-60" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      veiculo.tipo === "moto" ? "bg-orange-100" : "bg-blue-100"
                    }`}>
                      {veiculo.tipo === "moto" ? (
                        <Bike className="w-5 h-5 text-orange-600" />
                      ) : (
                        <Car className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base">{veiculo.descricao}</CardTitle>
                      <p className="text-sm text-gray-500">{veiculo.placa || "Sem placa"}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    veiculo.ativo !== false
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}>
                    {veiculo.ativo !== false ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tipo:</span>
                    <span className="font-medium">{veiculo.tipo === "moto" ? "Moto" : "Carro"}</span>
                  </div>
                  {veiculo.capacidade && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Capacidade:</span>
                      <span className="font-medium">{veiculo.capacidade}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openDialog(veiculo)}
                  >
                    <Pencil className="w-3 h-3 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => handleDelete(veiculo)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de Cadastro/Edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingVeiculo ? "Editar Veículo" : "Novo Veículo"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição *</Label>
              <Input
                id="descricao"
                placeholder="Ex: Fiorino Branca"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) => setFormData({ ...formData, tipo: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="carro">Carro</SelectItem>
                  <SelectItem value="moto">Moto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="placa">Placa</Label>
              <Input
                id="placa"
                placeholder="ABC-1234"
                value={formData.placa}
                onChange={(e) => setFormData({ ...formData, placa: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacidade">Capacidade</Label>
              <Input
                id="capacidade"
                placeholder="Ex: 500kg ou 50 volumes"
                value={formData.capacidade}
                onChange={(e) => setFormData({ ...formData, capacidade: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="ativo">Veículo ativo</Label>
              <Switch
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={closeDialog} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
                {editingVeiculo ? "Salvar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}