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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Configuracoes() {
  const [mapboxToken, setMapboxToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [tokenSaved, setTokenSaved] = useState(false);
  const [enderecoMatriz, setEnderecoMatriz] = useState("");
  const [matrizSaved, setMatrizSaved] = useState(false);
  const [showMotoristaDialog, setShowMotoristaDialog] = useState(false);
  const [editingMotorista, setEditingMotorista] = useState(null);
  const [motoristaForm, setMotoristaForm] = useState({
    nome: "",
    telefone: "",
    cnh: "",
    ativo: true,
  });
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

  // Buscar configurações salvas
  const { data: configs } = useQuery({
    queryKey: ["configuracoes", currentUser?.email],
    queryFn: () => currentUser ? base44.entities.Configuracao.filter({ owner: currentUser.email }) : [],
    enabled: !!currentUser,
    initialData: [],
  });

  // Buscar motoristas
  const { data: motoristas, isLoading: loadingMotoristas } = useQuery({
    queryKey: ["motoristas", currentUser?.email],
    queryFn: () => currentUser ? base44.entities.Motorista.filter({ owner: currentUser.email }, "nome") : [],
    enabled: !!currentUser,
    initialData: [],
  });

  // Buscar veículos
  const { data: veiculos, isLoading: loadingVeiculos } = useQuery({
    queryKey: ["veiculos", currentUser?.email],
    queryFn: () => currentUser ? base44.entities.Veiculo.filter({ owner: currentUser.email }, "descricao") : [],
    enabled: !!currentUser,
    initialData: [],
  });

  // Carregar configurações salvas
  useEffect(() => {
    const tokenConfig = configs.find((c) => c.chave === "mapbox_token");
    if (tokenConfig) {
      setMapboxToken(tokenConfig.valor);
    }
    const matrizConfig = configs.find((c) => c.chave === "endereco_matriz");
    if (matrizConfig) {
      setEnderecoMatriz(matrizConfig.valor);
    }
  }, [configs]);

  // Mutations
  const saveConfigMutation = useMutation({
    mutationFn: async ({ chave, valor, onSuccess }) => {
      const existing = configs.find((c) => c.chave === chave);
      if (existing) {
        return base44.entities.Configuracao.update(existing.id, { chave, valor, owner: currentUser?.email });
      }
      return base44.entities.Configuracao.create({ chave, valor, owner: currentUser?.email });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["configuracoes"] });
      if (variables.chave === "mapbox_token") {
        setTokenSaved(true);
        setTimeout(() => setTokenSaved(false), 3000);
      } else if (variables.chave === "endereco_matriz") {
        setMatrizSaved(true);
        setTimeout(() => setMatrizSaved(false), 3000);
      }
    },
  });

  const createMotoristaMutation = useMutation({
    mutationFn: (data) => base44.entities.Motorista.create({ ...data, owner: currentUser?.email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["motoristas"] });
      handleCloseMotoristaDialog();
    },
  });

  const updateMotoristaMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Motorista.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["motoristas"] });
      handleCloseMotoristaDialog();
    },
  });

  const deleteMotoristaMutation = useMutation({
    mutationFn: (id) => base44.entities.Motorista.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["motoristas"] });
    },
  });

  const createVeiculoMutation = useMutation({
    mutationFn: (data) => base44.entities.Veiculo.create({ ...data, owner: currentUser?.email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["veiculos"] });
      handleCloseVeiculoDialog();
    },
  });

  const updateVeiculoMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Veiculo.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["veiculos"] });
      handleCloseVeiculoDialog();
    },
  });

  const deleteVeiculoMutation = useMutation({
    mutationFn: (id) => base44.entities.Veiculo.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["veiculos"] });
    },
  });

  const handleSaveToken = () => {
    saveConfigMutation.mutate({ chave: "mapbox_token", valor: mapboxToken });
  };

  const handleSaveMatriz = () => {
    saveConfigMutation.mutate({ chave: "endereco_matriz", valor: enderecoMatriz });
  };

  const handleEditMotorista = (motorista) => {
    setEditingMotorista(motorista);
    setMotoristaForm({
      nome: motorista.nome,
      telefone: motorista.telefone || "",
      cnh: motorista.cnh || "",
      ativo: motorista.ativo ?? true,
    });
    setShowMotoristaDialog(true);
  };

  const handleCloseMotoristaDialog = () => {
    setShowMotoristaDialog(false);
    setEditingMotorista(null);
    setMotoristaForm({
      nome: "",
      telefone: "",
      cnh: "",
      ativo: true,
    });
  };

  const handleEditVeiculo = (veiculo) => {
    setEditingVeiculo(veiculo);
    setVeiculoForm({
      descricao: veiculo.descricao,
      tipo: veiculo.tipo || "carro",
      placa: veiculo.placa || "",
      capacidade: veiculo.capacidade || "",
      ativo: veiculo.ativo ?? true,
    });
    setShowVeiculoDialog(true);
  };

  const handleCloseVeiculoDialog = () => {
    setShowVeiculoDialog(false);
    setEditingVeiculo(null);
    setVeiculoForm({
      descricao: "",
      tipo: "carro",
      placa: "",
      capacidade: "",
      ativo: true,
    });
  };

  const handleSubmitVeiculo = (e) => {
    e.preventDefault();
    if (editingVeiculo) {
      updateVeiculoMutation.mutate({ id: editingVeiculo.id, data: veiculoForm });
    } else {
      createVeiculoMutation.mutate(veiculoForm);
    }
  };

  const handleSubmitMotorista = (e) => {
    e.preventDefault();
    if (editingMotorista) {
      updateMotoristaMutation.mutate({ id: editingMotorista.id, data: motoristaForm });
    } else {
      createMotoristaMutation.mutate(motoristaForm);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100 p-6">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl flex items-center justify-center shadow-lg">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Configurações</h1>
              <p className="text-gray-600">Gerencie as configurações do sistema</p>
            </div>
          </div>
        </motion.div>

        <div className="space-y-6">
          {/* Mapbox Token */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-white shadow-xl">
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Key className="w-5 h-5 text-blue-600" />
                  Chave da API Mapbox
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="mapbox-token">Token de Acesso</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="mapbox-token"
                          type={showToken ? "text" : "password"}
                          value={mapboxToken}
                          onChange={(e) => setMapboxToken(e.target.value)}
                          placeholder="pk.eyJ1Ijoi..."
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowToken(!showToken)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <Button
                        onClick={handleSaveToken}
                        disabled={saveConfigMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {tokenSaved ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Salvo!
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Salvar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p>
                      O token Mapbox é necessário para geocodificação e otimização de rotas.
                      Obtenha em{" "}
                      <a
                        href="https://account.mapbox.com/access-tokens/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline font-medium"
                      >
                        mapbox.com
                      </a>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Endereço da Matriz */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="bg-white shadow-xl">
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Home className="w-5 h-5 text-green-600" />
                  Endereço da Matriz (Ponto de Partida)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="endereco-matriz">Endereço Completo</Label>
                    <div className="flex gap-2">
                      <Textarea
                        id="endereco-matriz"
                        value={enderecoMatriz}
                        onChange={(e) => setEnderecoMatriz(e.target.value)}
                        placeholder="Ex: Rua Augusta, 1234 - Consolação, São Paulo - SP, CEP: 01305-100"
                        className="flex-1 min-h-[80px]"
                      />
                      <Button
                        onClick={handleSaveMatriz}
                        disabled={saveConfigMutation.isPending}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {matrizSaved ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Salvo!
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Salvar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-green-50 rounded-lg text-sm text-green-700">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p>
                      Este é o endereço de onde as entregas partem e retornam. Informe o endereço completo com CEP para melhor precisão.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Veículos */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white shadow-xl">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Car className="w-5 h-5 text-blue-600" />
                    Cadastro de Veículos
                  </CardTitle>
                  <Button
                    onClick={() => setShowVeiculoDialog(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Veículo
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-3">
                    <AnimatePresence>
                      {veiculos.map((veiculo) => (
                        <motion.div
                          key={veiculo.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="p-4 border-2 rounded-xl hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {veiculo.tipo === "moto" ? (
                                  <Bike className="w-5 h-5 text-blue-600" />
                                ) : (
                                  <Car className="w-5 h-5 text-blue-600" />
                                )}
                                <h3 className="font-bold text-lg">{veiculo.descricao}</h3>
                                <Badge
                                  className={
                                    veiculo.ativo
                                      ? "bg-green-100 text-green-700"
                                      : "bg-gray-100 text-gray-600"
                                  }
                                >
                                  {veiculo.ativo ? "Ativo" : "Inativo"}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                                {veiculo.placa && (
                                  <div>🔢 Placa: {veiculo.placa}</div>
                                )}
                                {veiculo.capacidade && (
                                  <div>📦 Capacidade: {veiculo.capacidade}</div>
                                )}
                                <div>🚗 Tipo: {veiculo.tipo === "moto" ? "Moto" : "Carro"}</div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditVeiculo(veiculo)}
                                className="hover:bg-blue-50 hover:text-blue-600"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteVeiculoMutation.mutate(veiculo.id)}
                                className="hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {veiculos.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <Car className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Nenhum veículo cadastrado</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>

          {/* Motoristas */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="bg-white shadow-xl">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Truck className="w-5 h-5 text-green-600" />
                    Cadastro de Motoristas
                  </CardTitle>
                  <Button
                    onClick={() => setShowMotoristaDialog(true)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Motorista
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-3">
                    <AnimatePresence>
                      {motoristas.map((motorista) => (
                        <motion.div
                          key={motorista.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="p-4 border-2 rounded-xl hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-bold text-lg">{motorista.nome}</h3>
                                <Badge
                                  className={
                                    motorista.ativo
                                      ? "bg-green-100 text-green-700"
                                      : "bg-gray-100 text-gray-600"
                                  }
                                >
                                  {motorista.ativo ? "Ativo" : "Inativo"}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                                {motorista.telefone && (
                                  <div>📱 {motorista.telefone}</div>
                                )}
                                {motorista.cnh && (
                                  <div>🪪 CNH: {motorista.cnh}</div>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditMotorista(motorista)}
                                className="hover:bg-blue-50 hover:text-blue-600"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteMotoristaMutation.mutate(motorista.id)}
                                className="hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {motoristas.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Nenhum motorista cadastrado</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Dialog Veículo */}
        <Dialog open={showVeiculoDialog} onOpenChange={setShowVeiculoDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingVeiculo ? "Editar Veículo" : "Novo Veículo"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmitVeiculo} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição *</Label>
                <Input
                  id="descricao"
                  value={veiculoForm.descricao}
                  onChange={(e) =>
                    setVeiculoForm({ ...veiculoForm, descricao: e.target.value })
                  }
                  placeholder="Ex: Fiorino Branca 2020"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <select
                    id="tipo"
                    value={veiculoForm.tipo}
                    onChange={(e) =>
                      setVeiculoForm({ ...veiculoForm, tipo: e.target.value })
                    }
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  >
                    <option value="carro">Carro</option>
                    <option value="moto">Moto</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="placa-veiculo">Placa</Label>
                  <Input
                    id="placa-veiculo"
                    value={veiculoForm.placa}
                    onChange={(e) =>
                      setVeiculoForm({ ...veiculoForm, placa: e.target.value })
                    }
                    placeholder="ABC-1234"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacidade">Capacidade</Label>
                <Input
                  id="capacidade"
                  value={veiculoForm.capacidade}
                  onChange={(e) =>
                    setVeiculoForm({ ...veiculoForm, capacidade: e.target.value })
                  }
                  placeholder="Ex: 500kg ou 20 caixas"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseVeiculoDialog}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  {editingVeiculo ? "Salvar" : "Cadastrar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog Motorista */}
        <Dialog open={showMotoristaDialog} onOpenChange={setShowMotoristaDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingMotorista ? "Editar Motorista" : "Novo Motorista"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmitMotorista} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo *</Label>
                <Input
                  id="nome"
                  value={motoristaForm.nome}
                  onChange={(e) =>
                    setMotoristaForm({ ...motoristaForm, nome: e.target.value })
                  }
                  placeholder="Ex: João da Silva"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={motoristaForm.telefone}
                    onChange={(e) =>
                      setMotoristaForm({ ...motoristaForm, telefone: e.target.value })
                    }
                    placeholder="(21) 99999-9999"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnh">CNH</Label>
                  <Input
                    id="cnh"
                    value={motoristaForm.cnh}
                    onChange={(e) =>
                      setMotoristaForm({ ...motoristaForm, cnh: e.target.value })
                    }
                    placeholder="00000000000"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseMotoristaDialog}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700">
                  {editingMotorista ? "Salvar" : "Cadastrar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}