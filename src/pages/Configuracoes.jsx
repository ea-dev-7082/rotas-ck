import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Settings,
  Key,
  Save,
  Truck,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Home,
  Car,
  Bike,
  LogOut,
  Mail,
  Send,
  Loader2,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function Configuracoes() {
  const [enderecoMatriz, setEnderecoMatriz] = useState("");
  const [matrizSaved, setMatrizSaved] = useState(false);
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [empresaSaved, setEmpresaSaved] = useState(false);
  const [tempoParadaEntrega, setTempoParadaEntrega] = useState("20");
  const [tempoParadaSaved, setTempoParadaSaved] = useState(false);
  const [margemTransito, setMargemTransito] = useState("10");
  const [margemTransitoSaved, setMargemTransitoSaved] = useState(false);

  const [showMotoristaDialog, setShowMotoristaDialog] = useState(false);
  const [editingMotorista, setEditingMotorista] = useState(null);
  const [motoristaForm, setMotoristaForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    cnh: "",
    ativo: true,
  });
  const [sendingInvite, setSendingInvite] = useState(null);

  const [showVeiculoDialog, setShowVeiculoDialog] = useState(false);
  const [editingVeiculo, setEditingVeiculo] = useState(null);
  const [veiculoForm, setVeiculoForm] = useState({
    descricao: "",
    tipo: "carro",
    placa: "",
    capacidade: "",
    ativo: true,
  });

  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  // --- QUERIES ---
  const { data: configs } = useQuery({
    queryKey: ["configuracoes", currentUser?.email],
    queryFn: () => currentUser ? base44.entities.Configuracao.filter({ owner: currentUser.email }) : [],
    enabled: !!currentUser,
    initialData: [],
  });

  const { data: motoristas } = useQuery({
    queryKey: ["motoristas", currentUser?.email],
    queryFn: () => currentUser ? base44.entities.Motorista.filter({ owner: currentUser.email }, "nome") : [],
    enabled: !!currentUser,
    initialData: [],
  });

  const { data: veiculos } = useQuery({
    queryKey: ["veiculos", currentUser?.email],
    queryFn: () => currentUser ? base44.entities.Veiculo.filter({ owner: currentUser.email }, "descricao") : [],
    enabled: !!currentUser,
    initialData: [],
  });

  // Carregar dados iniciais
  useEffect(() => {
    if (configs.length > 0) {
      setEnderecoMatriz(configs.find(c => c.chave === "endereco_matriz")?.valor || "");
      setNomeEmpresa(configs.find(c => c.chave === "nome_empresa")?.valor || "");
      setTempoParadaEntrega(configs.find(c => c.chave === "tempo_parada_entrega")?.valor || "20");
      setMargemTransito(configs.find(c => c.chave === "margem_transito")?.valor || "10");
    }
  }, [configs]);

  // --- MUTATIONS ---
  const saveConfigMutation = useMutation({
    mutationFn: async ({ chave, valor }) => {
      const existing = configs.find((c) => c.chave === chave);
      if (existing) {
        return base44.entities.Configuracao.update(existing.id, { chave, valor, owner: currentUser?.email });
      }
      return base44.entities.Configuracao.create({ chave, valor, owner: currentUser?.email });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["configuracoes"] });
      if (variables.chave === "endereco_matriz") { setMatrizSaved(true); setTimeout(() => setMatrizSaved(false), 3000); }
      if (variables.chave === "nome_empresa") { setEmpresaSaved(true); setTimeout(() => setEmpresaSaved(false), 3000); }
      if (variables.chave === "tempo_parada_entrega") { setTempoParadaSaved(true); setTimeout(() => setTempoParadaSaved(false), 3000); }
      if (variables.chave === "margem_transito") { setMargemTransitoSaved(true); setTimeout(() => setMargemTransitoSaved(false), 3000); }
    },
  });

  const createVeiculoMutation = useMutation({
    mutationFn: (data) => base44.entities.Veiculo.create({ ...data, owner: currentUser?.email }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["veiculos"] }); handleCloseVeiculoDialog(); },
  });

  const updateVeiculoMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Veiculo.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["veiculos"] }); handleCloseVeiculoDialog(); },
  });

  const deleteVeiculoMutation = useMutation({
    mutationFn: (id) => base44.entities.Veiculo.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["veiculos"] }),
  });

  const createMotoristaMutation = useMutation({
    mutationFn: (data) => base44.entities.Motorista.create({ ...data, owner: currentUser?.email }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["motoristas"] }); handleCloseMotoristaDialog(); },
  });

  const updateMotoristaMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Motorista.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["motoristas"] }); handleCloseMotoristaDialog(); },
  });

  const deleteMotoristaMutation = useMutation({
    mutationFn: (id) => base44.entities.Motorista.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["motoristas"] }),
  });

  // --- HANDLERS ---
  const handleCloseVeiculoDialog = () => {
    setShowVeiculoDialog(false);
    setEditingVeiculo(null);
    setVeiculoForm({ descricao: "", tipo: "carro", placa: "", capacidade: "", ativo: true });
  };

  const handleCloseMotoristaDialog = () => {
    setShowMotoristaDialog(false);
    setEditingMotorista(null);
    setMotoristaForm({ nome: "", email: "", telefone: "", cnh: "", ativo: true });
  };

  const handleSendInvite = async (motorista) => {
    if (!motorista.email) {
      toast.error("Motorista não possui email cadastrado");
      return;
    }
    setSendingInvite(motorista.id);
    try {
      console.log("Enviando convite para:", motorista.email, "com role: user");
      const result = await base44.users.inviteUser(motorista.email, "user");
      console.log("Resultado do convite:", result);
      await base44.entities.Motorista.update(motorista.id, { convite_enviado: true });
      queryClient.invalidateQueries({ queryKey: ["motoristas"] });
      toast.success(`Convite enviado para ${motorista.email}`);
    } catch (error) {
      console.error("Erro ao enviar convite:", error);
      toast.error("Erro ao enviar convite: " + (error.message || JSON.stringify(error)));
    }
    setSendingInvite(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="container mx-auto max-w-4xl">
        
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Configurações</h1>
              <p className="text-slate-500 text-sm">Gerencie dados da empresa, veículos e equipe.</p>
            </div>
          </div>
        </motion.div>

        <div className="space-y-6">
          
          {/* Nome da Empresa */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg flex items-center gap-2"><Settings className="w-4 h-4 text-purple-600" /> Nome da Empresa</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex gap-2">
                <Input value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} placeholder="Ex: Distribuidora Central" />
                <Button onClick={() => saveConfigMutation.mutate({ chave: "nome_empresa", valor: nomeEmpresa })} disabled={saveConfigMutation.isPending} className="bg-purple-600 hover:bg-purple-700">
                  {empresaSaved ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  {empresaSaved ? "Salvo" : "Salvar"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Endereço Matriz */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg flex items-center gap-2"><Home className="w-4 h-4 text-emerald-600" /> Endereço de Origem</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex gap-2">
                <Textarea value={enderecoMatriz} onChange={(e) => setEnderecoMatriz(e.target.value)} placeholder="Endereço completo da sede..." className="min-h-[80px]" />
                <Button onClick={() => saveConfigMutation.mutate({ chave: "endereco_matriz", valor: enderecoMatriz })} className="bg-emerald-600 hover:bg-emerald-700 h-auto">
                  {matrizSaved ? "Salvo" : "Salvar"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tempo de Parada por Entrega */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg flex items-center gap-2"><Settings className="w-4 h-4 text-orange-600" /> Tempo de Parada por Entrega</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-3">
              <div className="flex gap-2 items-center">
                <Input 
                  type="number" 
                  min="1" 
                  max="120"
                  value={tempoParadaEntrega} 
                  onChange={(e) => setTempoParadaEntrega(e.target.value)} 
                  placeholder="20"
                  className="w-24"
                />
                <span className="text-gray-600">minutos</span>
                <Button onClick={() => saveConfigMutation.mutate({ chave: "tempo_parada_entrega", valor: tempoParadaEntrega })} className="bg-orange-600 hover:bg-orange-700 ml-auto">
                  {tempoParadaSaved ? "Salvo" : "Salvar"}
                </Button>
              </div>
              <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded">Tempo médio que o motorista leva em cada parada para estacionar e fazer a entrega. Usado no cálculo das rotas.</p>
            </CardContent>
          </Card>

          {/* Margem de Trânsito */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg flex items-center gap-2"><Settings className="w-4 h-4 text-red-600" /> Margem de Trânsito</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-3">
              <div className="flex gap-2 items-center">
                <Input 
                  type="number" 
                  min="0" 
                  max="100"
                  value={margemTransito} 
                  onChange={(e) => setMargemTransito(e.target.value)} 
                  placeholder="10"
                  className="w-24"
                />
                <span className="text-gray-600">%</span>
                <Button onClick={() => saveConfigMutation.mutate({ chave: "margem_transito", valor: margemTransito })} className="bg-red-600 hover:bg-red-700 ml-auto">
                  {margemTransitoSaved ? "Salvo" : "Salvar"}
                </Button>
              </div>
              <p className="text-xs text-red-600 bg-red-50 p-2 rounded">Percentual de segurança adicionado ao tempo de viagem para compensar imprevistos no trânsito. Ex: 10% = tempo Mapbox + 10%.</p>
            </CardContent>
          </Card>

          {/* VEÍCULOS COM SCROLLAREA */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
              <CardTitle className="text-lg flex items-center gap-2"><Car className="w-4 h-4 text-slate-600" /> Veículos</CardTitle>
              <Button size="sm" onClick={() => setShowVeiculoDialog(true)} className="gap-2"><Plus size={16} /> Novo</Button>
            </CardHeader>
            <CardContent className="pt-6">
              <ScrollArea className="h-[320px] w-full rounded-md border p-4 bg-slate-50/50">
                <div className="space-y-3 pr-4">
                  <AnimatePresence>
                    {veiculos.map((veiculo) => (
                      <motion.div key={veiculo.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 bg-white border rounded-lg shadow-sm flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            {veiculo.tipo === "moto" ? <Bike size={16} className="text-slate-500" /> : <Car size={16} className="text-slate-500" />}
                            <span className="font-semibold">{veiculo.descricao}</span>
                            <Badge variant={veiculo.ativo ? "default" : "secondary"}>{veiculo.ativo ? "Ativo" : "Inativo"}</Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">Placa: {veiculo.placa || "-"} | Cap: {veiculo.capacidade || "-"}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setEditingVeiculo(veiculo); setVeiculoForm(veiculo); setShowVeiculoDialog(true); }}><Edit size={14} /></Button>
                          <Button variant="ghost" size="icon" className="text-red-500" onClick={() => deleteVeiculoMutation.mutate(veiculo.id)}><Trash2 size={14} /></Button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {veiculos.length === 0 && <p className="text-center text-slate-400 py-10 text-sm">Nenhum veículo cadastrado.</p>}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* MOTORISTAS COM SCROLLAREA */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
              <CardTitle className="text-lg flex items-center gap-2"><Truck className="w-4 h-4 text-slate-600" /> Motoristas</CardTitle>
              <Button size="sm" onClick={() => setShowMotoristaDialog(true)} className="gap-2"><Plus size={16} /> Novo</Button>
            </CardHeader>
            <CardContent className="pt-6">
              <ScrollArea className="h-[320px] w-full rounded-md border p-4 bg-slate-50/50">
                <div className="space-y-3 pr-4">
                  <AnimatePresence>
                    {motoristas.map((motorista) => (
                      <motion.div key={motorista.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 bg-white border rounded-lg shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">{motorista.nome}</span>
                              <Badge variant={motorista.ativo ? "outline" : "secondary"} className={motorista.ativo ? "text-emerald-600 border-emerald-200 bg-emerald-50" : ""}>{motorista.ativo ? "Ativo" : "Inativo"}</Badge>
                              {motorista.convite_enviado && (
                                <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                                  <UserCheck size={12} className="mr-1" /> Convidado
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              {motorista.email && <><Mail size={12} className="inline mr-1" />{motorista.email} | </>}
                              📱 {motorista.telefone || "N/A"} | CNH: {motorista.cnh || "N/A"}
                            </p>
                          </div>
                          <div className="flex gap-1 ml-2">
                            {motorista.email && !motorista.convite_enviado && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-blue-600"
                                onClick={() => handleSendInvite(motorista)}
                                disabled={sendingInvite === motorista.id}
                              >
                                {sendingInvite === motorista.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => { setEditingMotorista(motorista); setMotoristaForm(motorista); setShowMotoristaDialog(true); }}><Edit size={14} /></Button>
                            <Button variant="ghost" size="icon" className="text-red-500" onClick={() => deleteMotoristaMutation.mutate(motorista.id)}><Trash2 size={14} /></Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {motoristas.length === 0 && <p className="text-center text-slate-400 py-10 text-sm">Nenhum motorista cadastrado.</p>}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Botão Sair */}
          <div className="pt-6 border-t">
            <Button 
              variant="outline" 
              className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
              onClick={() => base44.auth.logout()}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair da Conta
            </Button>
          </div>

        </div>

        {/* DIALOGS (Modais) */}
        
        {/* Veículo Dialog */}
        <Dialog open={showVeiculoDialog} onOpenChange={setShowVeiculoDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingVeiculo ? "Editar Veículo" : "Novo Veículo"}</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={(e) => {
              e.preventDefault();
              editingVeiculo ? updateVeiculoMutation.mutate({ id: editingVeiculo.id, data: veiculoForm }) : createVeiculoMutation.mutate(veiculoForm);
            }}>
              <div className="space-y-2">
                <Label>Descrição *</Label>
                <Input required value={veiculoForm.descricao} onChange={e => setVeiculoForm({...veiculoForm, descricao: e.target.value})} placeholder="Ex: Van Sprinter" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <select className="w-full border rounded-md h-9 text-sm px-2" value={veiculoForm.tipo} onChange={e => setVeiculoForm({...veiculoForm, tipo: e.target.value})}>
                    <option value="carro">Carro</option>
                    <option value="moto">Moto</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Placa</Label>
                  <Input value={veiculoForm.placa} onChange={e => setVeiculoForm({...veiculoForm, placa: e.target.value})} placeholder="ABC-1234" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Capacidade</Label>
                <Input value={veiculoForm.capacidade} onChange={e => setVeiculoForm({...veiculoForm, capacidade: e.target.value})} placeholder="Ex: 500kg ou 20 caixas" />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseVeiculoDialog}>Cancelar</Button>
                <Button type="submit">Salvar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Motorista Dialog */}
        <Dialog open={showMotoristaDialog} onOpenChange={setShowMotoristaDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingMotorista ? "Editar Motorista" : "Novo Motorista"}</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={(e) => {
              e.preventDefault();
              editingMotorista ? updateMotoristaMutation.mutate({ id: editingMotorista.id, data: motoristaForm }) : createMotoristaMutation.mutate(motoristaForm);
            }}>
              <div className="space-y-2">
                <Label>Nome Completo *</Label>
                <Input required value={motoristaForm.nome} onChange={e => setMotoristaForm({...motoristaForm, nome: e.target.value})} placeholder="Nome do motorista..." />
              </div>
              <div className="space-y-2">
                <Label>Email (para acesso ao app)</Label>
                <Input 
                  type="email" 
                  value={motoristaForm.email || ""} 
                  onChange={e => setMotoristaForm({...motoristaForm, email: e.target.value})} 
                  placeholder="motorista@email.com" 
                />
                <p className="text-xs text-slate-500">Informe o email para enviar convite de acesso ao app do motorista.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={motoristaForm.telefone} onChange={e => setMotoristaForm({...motoristaForm, telefone: e.target.value})} placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-2">
                  <Label>CNH</Label>
                  <Input value={motoristaForm.cnh} onChange={e => setMotoristaForm({...motoristaForm, cnh: e.target.value})} placeholder="Número da CNH" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseMotoristaDialog}>Cancelar</Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">Salvar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}