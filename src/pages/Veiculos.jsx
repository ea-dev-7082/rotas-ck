import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Car, Bike, Gauge, Fuel, History, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function Veiculos() {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [registroDialogOpen, setRegistroDialogOpen] = useState(false);
  const [historicoDialogOpen, setHistoricoDialogOpen] = useState(false);
  const [selectedVeiculo, setSelectedVeiculo] = useState(null);
  const [registroData, setRegistroData] = useState({
    motorista_nome: "",
    km_inicial: "",
    km_final: "",
    abastecimento: { litros: "", valor: "", posto: "", observacoes: "" },
    observacoes: "",
  });

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  const today = format(new Date(), "yyyy-MM-dd");

  // Busca apenas veículos ativos da empresa do usuário (pelo created_by)
  const { data: veiculos = [], isLoading } = useQuery({
    queryKey: ["veiculos", currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return [];
      const allVeiculos = await base44.entities.Veiculo.list();
      // Filtra apenas veículos ativos criados pelo usuário atual
      return allVeiculos.filter(v => v.created_by === currentUser.email && v.ativo !== false);
    },
    enabled: !!currentUser,
    initialData: [],
  });

  // Busca registros diários dos veículos
  const { data: registrosDia = [] } = useQuery({
    queryKey: ["registros-dia", today],
    queryFn: () => base44.entities.RegistroDiarioVeiculo.filter({ data: today }),
    initialData: [],
  });

  // Busca histórico de registros (últimos 30 dias)
  const { data: historico = [] } = useQuery({
    queryKey: ["historico-veiculo", selectedVeiculo?.id],
    queryFn: () => base44.entities.RegistroDiarioVeiculo.filter(
      { veiculo_id: selectedVeiculo?.id },
      "-data",
      30
    ),
    enabled: !!selectedVeiculo && historicoDialogOpen,
    initialData: [],
  });

  const createRegistroMutation = useMutation({
    mutationFn: (data) => base44.entities.RegistroDiarioVeiculo.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registros-dia"] });
      toast.success("Registro criado!");
      setRegistroDialogOpen(false);
    },
  });

  const updateRegistroMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RegistroDiarioVeiculo.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registros-dia"] });
      toast.success("Registro atualizado!");
      setRegistroDialogOpen(false);
    },
  });

  // Retorna o registro do dia para um veículo
  const getRegistroDia = (veiculoId) => {
    return registrosDia.find(r => r.veiculo_id === veiculoId);
  };

  const openRegistroDialog = (veiculo) => {
    setSelectedVeiculo(veiculo);
    const registro = getRegistroDia(veiculo.id);
    if (registro) {
      setRegistroData({
        motorista_nome: registro.motorista_nome || "",
        km_inicial: registro.km_inicial || "",
        km_final: registro.km_final || "",
        abastecimento: registro.abastecimento || { litros: "", valor: "", posto: "", observacoes: "" },
        observacoes: registro.observacoes || "",
      });
    } else {
      setRegistroData({
        motorista_nome: "",
        km_inicial: "",
        km_final: "",
        abastecimento: { litros: "", valor: "", posto: "", observacoes: "" },
        observacoes: "",
      });
    }
    setRegistroDialogOpen(true);
  };

  const handleSaveRegistro = () => {
    if (!selectedVeiculo || !registroData.km_inicial) {
      toast.error("Preencha a quilometragem inicial");
      return;
    }

    const registro = getRegistroDia(selectedVeiculo.id);
    const data = {
      veiculo_id: selectedVeiculo.id,
      veiculo_descricao: selectedVeiculo.descricao,
      veiculo_placa: selectedVeiculo.placa,
      data: today,
      motorista_email: currentUser?.email,
      motorista_nome: registroData.motorista_nome,
      km_inicial: registroData.km_inicial,
      km_final: registroData.km_final || null,
      observacoes: registroData.observacoes,
      status: registroData.km_final ? "fechado" : "aberto",
    };

    if (registroData.abastecimento.litros || registroData.abastecimento.valor) {
      data.abastecimento = {
        litros: registroData.abastecimento.litros ? Number(registroData.abastecimento.litros) : null,
        valor: registroData.abastecimento.valor ? Number(registroData.abastecimento.valor) : null,
        posto: registroData.abastecimento.posto,
        observacoes: registroData.abastecimento.observacoes,
      };
    }

    if (!registro) {
      data.hora_inicio = new Date().toISOString();
      createRegistroMutation.mutate(data);
    } else {
      if (registroData.km_final && !registro.km_final) {
        data.hora_fim = new Date().toISOString();
      }
      updateRegistroMutation.mutate({ id: registro.id, data });
    }
  };

  const openHistoricoDialog = (veiculo) => {
    setSelectedVeiculo(veiculo);
    setHistoricoDialogOpen(true);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Gauge className="w-6 h-6" />
            Veículos
          </h1>
          <p className="text-gray-500">Registro e monitoramento de quilometragem e abastecimento</p>
        </div>
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
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Nenhum veículo ativo</h3>
          <p className="text-gray-500">Cadastre veículos em Configurações para monitorá-los aqui</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {veiculos.map((veiculo) => {
            const registro = getRegistroDia(veiculo.id);
            return (
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

                  {/* Status do dia */}
                  {registro && (
                    <div className={`mt-3 p-2 rounded-lg text-xs ${
                      registro.status === "fechado" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"
                    }`}>
                      <div className="flex items-center gap-1">
                        <Gauge className="w-3 h-3" />
                        <span>Km: {registro.km_inicial}{registro.km_final ? ` → ${registro.km_final}` : ""}</span>
                      </div>
                      {registro.motorista_nome && (
                        <p className="mt-1">Motorista: {registro.motorista_nome}</p>
                      )}
                      {registro.abastecimento?.litros && (
                        <div className="flex items-center gap-1 mt-1">
                          <Fuel className="w-3 h-3" />
                          <span>{registro.abastecimento.litros}L</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openRegistroDialog(veiculo)}
                    >
                      <Gauge className="w-3 h-3 mr-1" />
                      {registro ? "Atualizar Km" : "Registrar Km"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openHistoricoDialog(veiculo)}
                    >
                      <History className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="flex gap-2 mt-2">
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
            );
          })}
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

      {/* Dialog de Registro Diário */}
      <Dialog open={registroDialogOpen} onOpenChange={setRegistroDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gauge className="w-5 h-5" />
              Registro Diário - {selectedVeiculo?.descricao}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-gray-500 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </div>
            
            <div className="space-y-2">
              <Label>Motorista</Label>
              <Input
                placeholder="Nome do motorista"
                value={registroData.motorista_nome}
                onChange={(e) => setRegistroData({ ...registroData, motorista_nome: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Km Inicial *</Label>
                <Input
                  type="number"
                  placeholder="Ex: 45230"
                  value={registroData.km_inicial}
                  onChange={(e) => setRegistroData({ ...registroData, km_inicial: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Km Final</Label>
                <Input
                  type="number"
                  placeholder="Ex: 45320"
                  value={registroData.km_final}
                  onChange={(e) => setRegistroData({ ...registroData, km_final: e.target.value })}
                />
              </div>
            </div>

            {registroData.km_inicial && registroData.km_final && (
              <div className="p-2 bg-blue-50 rounded-lg text-sm text-blue-700">
                Km percorrido: <strong>{Number(registroData.km_final) - Number(registroData.km_inicial)} km</strong>
              </div>
            )}

            {/* Abastecimento */}
            <div className="border-t pt-4">
              <Label className="flex items-center gap-2 mb-3">
                <Fuel className="w-4 h-4 text-amber-600" />
                Abastecimento (opcional)
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Litros</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 45.5"
                    value={registroData.abastecimento.litros}
                    onChange={(e) => setRegistroData({
                      ...registroData,
                      abastecimento: { ...registroData.abastecimento, litros: e.target.value }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 250.00"
                    value={registroData.abastecimento.valor}
                    onChange={(e) => setRegistroData({
                      ...registroData,
                      abastecimento: { ...registroData.abastecimento, valor: e.target.value }
                    })}
                  />
                </div>
              </div>
              <div className="space-y-2 mt-3">
                <Label className="text-xs">Posto</Label>
                <Input
                  placeholder="Nome do posto"
                  value={registroData.abastecimento.posto}
                  onChange={(e) => setRegistroData({
                    ...registroData,
                    abastecimento: { ...registroData.abastecimento, posto: e.target.value }
                  })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Problemas, ocorrências, etc."
                value={registroData.observacoes}
                onChange={(e) => setRegistroData({ ...registroData, observacoes: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRegistroDialogOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveRegistro}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Salvar Registro
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Histórico */}
      <Dialog open={historicoDialogOpen} onOpenChange={setHistoricoDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Histórico - {selectedVeiculo?.descricao}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {historico.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nenhum registro encontrado</p>
            ) : (
              historico.map((reg) => (
                <div key={reg.id} className="p-3 bg-gray-50 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">
                      {format(new Date(reg.data), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                    <Badge variant={reg.status === "fechado" ? "default" : "secondary"}>
                      {reg.status === "fechado" ? "Fechado" : "Aberto"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p><span className="text-gray-500">Km Inicial:</span> {reg.km_inicial}</p>
                    <p><span className="text-gray-500">Km Final:</span> {reg.km_final || "-"}</p>
                    {reg.motorista_nome && (
                      <p className="col-span-2"><span className="text-gray-500">Motorista:</span> {reg.motorista_nome}</p>
                    )}
                    {reg.km_inicial && reg.km_final && (
                      <p className="col-span-2 text-blue-600 font-medium">
                        Percorrido: {Number(reg.km_final) - Number(reg.km_inicial)} km
                      </p>
                    )}
                  </div>
                  {reg.abastecimento?.litros && (
                    <div className="mt-2 pt-2 border-t text-sm">
                      <p className="text-amber-700 flex items-center gap-1">
                        <Fuel className="w-3 h-3" />
                        {reg.abastecimento.litros}L - R$ {reg.abastecimento.valor}
                        {reg.abastecimento.posto && ` (${reg.abastecimento.posto})`}
                      </p>
                    </div>
                  )}
                  {reg.observacoes && (
                    <p className="mt-2 text-xs text-gray-600">{reg.observacoes}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}