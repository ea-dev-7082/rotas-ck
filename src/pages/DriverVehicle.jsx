import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Car, Fuel, Wrench, Plus, Camera, Image, CircleDot, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import BottomNav from "../components/driver/BottomNav";

const TIPOS = [
  { value: "abastecimento", label: "Abastecimento", icon: Fuel, color: "bg-blue-100 text-blue-700" },
  { value: "troca_oleo", label: "Troca de Óleo", icon: CircleDot, color: "bg-yellow-100 text-yellow-700" },
  { value: "manutencao_preventiva", label: "Preventiva", icon: Wrench, color: "bg-green-100 text-green-700" },
  { value: "manutencao_corretiva", label: "Corretiva", icon: Wrench, color: "bg-red-100 text-red-700" },
  { value: "pneu", label: "Pneu", icon: CircleDot, color: "bg-orange-100 text-orange-700" },
  { value: "outros", label: "Outros", icon: Car, color: "bg-gray-100 text-gray-700" },
];

export default function DriverVehicle() {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedVeiculo, setSelectedVeiculo] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  const [form, setForm] = useState({
    tipo: "abastecimento",
    data: format(new Date(), "yyyy-MM-dd"),
    km_atual: "",
    valor: "",
    tipo_combustivel: "gasolina",
    litros: "",
    metros_cubicos: "",
    preco_litro: "",
    preco_m3: "",
    posto: "",
    descricao: "",
    foto_comprovante: "",
  });

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  const { data: veiculos = [] } = useQuery({
    queryKey: ["veiculos-driver"],
    queryFn: async () => {
      if (!currentUser) return [];
      // Busca veículos via rotas atribuídas ao motorista
      const rotas = await base44.entities.RotaAgendada.list("-created_date", 10);
      const owners = [...new Set(rotas.map(r => r.created_by).filter(Boolean))];
      if (owners.length === 0) return [];
      const allVeiculos = await base44.entities.Veiculo.list();
      return allVeiculos.filter(v => owners.includes(v.created_by));
    },
    enabled: !!currentUser,
    initialData: [],
  });



  const { data: registros = [] } = useQuery({
    queryKey: ["manutencao-driver", selectedVeiculo?.id],
    queryFn: () => base44.entities.ManutencaoVeiculo.filter(
      { veiculo_id: selectedVeiculo.id },
      "-data",
      20
    ),
    enabled: !!selectedVeiculo,
    initialData: [],
  });

  const resetForm = () => {
    setForm({
      tipo: "abastecimento",
      data: format(new Date(), "yyyy-MM-dd"),
      km_atual: "",
      valor: "",
      tipo_combustivel: "gasolina",
      litros: "",
      metros_cubicos: "",
      preco_litro: "",
      preco_m3: "",
      posto: "",
      descricao: "",
      foto_comprovante: "",
    });
  };

  const handleUploadFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(prev => ({ ...prev, foto_comprovante: file_url }));
    setUploadingFoto(false);
    toast.success("Foto anexada!");
  };

  const handleSave = async () => {
    if (!selectedVeiculo || !form.valor) {
      toast.error("Preencha o valor");
      return;
    }
    setIsSaving(true);

    const isGNV = form.tipo_combustivel === "gnv";
    const payload = {
      veiculo_id: selectedVeiculo.id,
      veiculo_descricao: selectedVeiculo.descricao,
      veiculo_placa: selectedVeiculo.placa,
      tipo: form.tipo,
      data: form.data,
      km_atual: form.km_atual ? Number(form.km_atual) : null,
      valor: Number(form.valor),
      tipo_combustivel: form.tipo === "abastecimento" ? form.tipo_combustivel : null,
      litros: !isGNV && form.litros ? Number(form.litros) : null,
      metros_cubicos: isGNV && form.metros_cubicos ? Number(form.metros_cubicos) : null,
      preco_litro: !isGNV && form.preco_litro ? Number(form.preco_litro) : null,
      preco_m3: isGNV && form.preco_m3 ? Number(form.preco_m3) : null,
      posto: form.posto,
      descricao: form.descricao,
      foto_comprovante: form.foto_comprovante,
      owner: selectedVeiculo.owner || selectedVeiculo.created_by || currentUser?.email || "",
    };

    await base44.entities.ManutencaoVeiculo.create(payload);
    toast.success("Registro salvo!");
    queryClient.invalidateQueries({ queryKey: ["manutencao-driver"] });
    resetForm();
    setShowForm(false);
    setIsSaving(false);
  };

  const isAbastecimento = form.tipo === "abastecimento";
  const isGNV = form.tipo_combustivel === "gnv";

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-40">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Wrench className="w-5 h-5" />
              Veículo
            </h1>
            <p className="text-sm text-gray-500">Registros de manutenção e abastecimento</p>
          </div>
          {selectedVeiculo && (
            <Button
              size="sm"
              onClick={() => { resetForm(); setShowForm(true); }}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="w-4 h-4 mr-1" /> Novo
            </Button>
          )}
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        {/* Seleção de Veículo */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Car className="w-4 h-4 text-blue-600" />
              Selecione o Veículo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {veiculos.length > 0 ? (
              <div className="space-y-2">
                {veiculos.map((veiculo) => (
                  <button
                    key={veiculo.id}
                    onClick={() => setSelectedVeiculo(veiculo)}
                    className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                      selectedVeiculo?.id === veiculo.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-gray-50 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{veiculo.descricao}</p>
                        <p className="text-sm text-gray-500">Placa: {veiculo.placa || "Não informada"}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        veiculo.tipo === "moto"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {veiculo.tipo === "moto" ? "Moto" : "Carro"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Nenhum veículo disponível</p>
            )}
          </CardContent>
        </Card>

        {/* Formulário de Novo Registro */}
        {showForm && selectedVeiculo && (
          <Card className="border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="w-4 h-4 text-green-600" />
                Novo Registro — {selectedVeiculo.descricao}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data</Label>
                  <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
                </div>
                <div>
                  <Label>Km Atual</Label>
                  <Input type="number" placeholder="Ex: 45000" value={form.km_atual} onChange={e => setForm(f => ({ ...f, km_atual: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor (R$) *</Label>
                  <Input type="number" step="0.01" placeholder="0.00" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
                </div>
                <div>
                  <Label>Posto / Oficina</Label>
                  <Input placeholder="Nome do local" value={form.posto} onChange={e => setForm(f => ({ ...f, posto: e.target.value }))} />
                </div>
              </div>

              {isAbastecimento && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 space-y-3">
                  <div>
                    <Label className="text-blue-700">Tipo de Combustível</Label>
                    <Select value={form.tipo_combustivel} onValueChange={v => setForm(f => ({ ...f, tipo_combustivel: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gasolina">Gasolina</SelectItem>
                        <SelectItem value="alcool">Álcool/Etanol</SelectItem>
                        <SelectItem value="gnv">GNV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {isGNV ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-blue-700">m³</Label>
                        <Input type="number" step="0.01" placeholder="Ex: 15" value={form.metros_cubicos} onChange={e => setForm(f => ({ ...f, metros_cubicos: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-blue-700">R$/m³</Label>
                        <Input type="number" step="0.01" placeholder="Ex: 4.50" value={form.preco_m3} onChange={e => setForm(f => ({ ...f, preco_m3: e.target.value }))} />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-blue-700">Litros</Label>
                        <Input type="number" step="0.01" placeholder="Ex: 40" value={form.litros} onChange={e => setForm(f => ({ ...f, litros: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-blue-700">R$/Litro</Label>
                        <Input type="number" step="0.01" placeholder="Ex: 5.89" value={form.preco_litro} onChange={e => setForm(f => ({ ...f, preco_litro: e.target.value }))} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <Label>Observações</Label>
                <Textarea placeholder="Detalhes..." value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} />
              </div>

              <div>
                <Label>Comprovante</Label>
                <div className="flex items-center gap-2">
                  <label className="flex-1">
                    <input type="file" accept="image/*" capture="environment" onChange={handleUploadFoto} className="hidden" />
                    <Button type="button" variant="outline" className="w-full" disabled={uploadingFoto} asChild>
                      <span>
                        <Camera className="w-4 h-4 mr-2" />
                        {uploadingFoto ? "Enviando..." : "Tirar Foto / Anexar"}
                      </span>
                    </Button>
                  </label>
                  {form.foto_comprovante && (
                    <a href={form.foto_comprovante} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm hover:underline flex items-center gap-1">
                      <Image className="w-4 h-4" /> Ver
                    </a>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
                <Button onClick={handleSave} disabled={isSaving || !form.valor} className="flex-1 bg-green-600 hover:bg-green-700">
                  {isSaving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Histórico */}
        {selectedVeiculo && !showForm && (
          <Card>
            <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowHistorico(!showHistorico)}>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Fuel className="w-4 h-4 text-amber-600" />
                  Últimos Registros
                  <Badge variant="secondary" className="text-xs">{registros.length}</Badge>
                </span>
                {showHistorico ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </CardTitle>
            </CardHeader>
            {showHistorico && (
              <CardContent className="space-y-2 pt-0">
                {registros.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">Nenhum registro ainda</p>
                ) : (
                  registros.map(reg => {
                    const tipoConfig = TIPOS.find(t => t.value === reg.tipo) || TIPOS[5];
                    const Icon = tipoConfig.icon;
                    return (
                      <div key={reg.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tipoConfig.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-medium">{tipoConfig.label}</span>
                            <span className="text-xs text-gray-400">{format(new Date(reg.data), "dd/MM/yy")}</span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900">R$ {Number(reg.valor).toFixed(2)}</p>
                          {reg.tipo === "abastecimento" && (
                            <p className="text-xs text-blue-600">
                              {reg.tipo_combustivel === "gnv"
                                ? `${reg.metros_cubicos || 0} m³ • GNV`
                                : `${reg.litros || 0}L • ${reg.tipo_combustivel === "alcool" ? "Álcool" : "Gasolina"}`
                              }
                            </p>
                          )}
                          {reg.km_atual && <p className="text-xs text-gray-400">{Number(reg.km_atual).toLocaleString("pt-BR")} km</p>}
                        </div>
                        {reg.foto_comprovante && (
                          <a href={reg.foto_comprovante} target="_blank" rel="noopener noreferrer" className="shrink-0">
                            <Image className="w-4 h-4 text-blue-500" />
                          </a>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            )}
          </Card>
        )}
      </div>

      <BottomNav />
    </div>
  );
}