import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, MapPin, Phone, Edit, Trash2, Users, Warehouse, Upload, Loader2, Search } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Clientes() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  
  // Estado para a busca
  const [searchTerm, setSearchTerm] = useState("");
  
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    nome: "",
    endereco: "",
    endereco_entrega: "",
    usar_endereco_entrega: false,
    telefone: "",
    observacoes: "",
  });

  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  const { data: clientes, isLoading } = useQuery({
    queryKey: ["clientes", currentUser?.email],
    queryFn: () => currentUser ? base44.entities.Cliente.filter({ owner: currentUser.email }, "nome") : [],
    enabled: !!currentUser,
    initialData: [],
  });

  // Lógica de filtragem
  const filteredClientes = clientes.filter((cliente) => {
    const term = searchTerm.toLowerCase();
    return (
      cliente.nome.toLowerCase().includes(term) ||
      (cliente.telefone && cliente.telefone.includes(term)) ||
      (cliente.endereco && cliente.endereco.toLowerCase().includes(term))
    );
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Cliente.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      handleCloseDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Cliente.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      handleCloseDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Cliente.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
  });

  // --- Parser Manual Inteligente (Lê seu arquivo CSV complexo) ---
  const parseComplexCSV = (text) => {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let insideQuotes = false;

    // Itera caractere por caractere para lidar corretamente com aspas e vírgulas
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          // Aspas duplas dentro de um campo (ex: "O ""Grande"" Hotel")
          currentField += '"';
          i++; 
        } else {
          // Entrando ou saindo de um campo com aspas
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        // Vírgula separadora de campo (só se não estiver dentro de aspas)
        currentRow.push(currentField.trim());
        currentField = '';
      } else if ((char === '\n' || char === '\r') && !insideQuotes) {
        // Quebra de linha separadora de registro
        if (char === '\r' && nextChar === '\n') i++; // Trata quebra Windows \r\n
        
        currentRow.push(currentField.trim());
        if (currentRow.length > 0 && (currentRow.length > 1 || currentRow[0] !== '')) {
            rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        // Caractere normal
        currentField += char;
      }
    }
    // Adiciona a última linha se houver
    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      rows.push(currentRow);
    }
    return rows;
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !currentUser) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        
        // 1. Usa o parser manual robusto
        const rows = parseComplexCSV(text);
        
        if (rows.length < 2) {
            alert("O arquivo parece vazio ou inválido.");
            setIsImporting(false);
            return;
        }

        // 2. Identifica os cabeçalhos (primeira linha)
        // Remove espaços e converte para minúsculo para facilitar (COD_CLI -> cod_cli)
        const headers = rows[0].map(h => h.toLowerCase().trim()); 
        
        // 3. Mapeia os dados
        const promises = rows.slice(1).map(row => {
            // Cria um objeto temporário mapendo header -> valor
            const obj = {};
            headers.forEach((h, index) => {
                obj[h] = row[index] || "";
            });

            // Procura os campos nas colunas do seu arquivo
            // Seu arquivo tem: COD_CLI, CLIENTE, ENDERECO
            const nome = obj['cliente'] || obj['nome'];
            
            if (!nome) return null; // Pula linhas vazias

            const endereco = obj['endereco'] || obj['endereço'] || "";
            const cod = obj['cod_cli'] || obj['codigo'] || "";
            
            // Coloca o código antigo na observação para não perder essa informação
            const obs = cod ? `Cód. Antigo: ${cod}` : "";

            return base44.entities.Cliente.create({
                nome: nome,
                endereco: endereco,
                telefone: "", // Seu arquivo não tem coluna telefone, deixa vazio
                observacoes: obs,
                endereco_entrega: "",
                usar_endereco_entrega: false,
                owner: currentUser.email
            });
        }).filter(p => p !== null);

        if (promises.length === 0) {
            alert("Nenhum cliente válido encontrado. Verifique se o arquivo tem a coluna 'CLIENTE'.");
            return;
        }

        await Promise.all(promises);
        
        queryClient.invalidateQueries({ queryKey: ["clientes"] });
        alert(`${promises.length} clientes importados com sucesso!`);
      } catch (error) {
        console.error("Erro ao importar:", error);
        alert("Erro ao processar o arquivo.");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    };

    // Importante: Lê como Latin1 (ISO-8859-1) para corrigir acentos do Excel brasileiro
    reader.readAsText(file, "ISO-8859-1");
  };
  // --- Fim Lógica de Importação ---

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingCliente) {
      updateMutation.mutate({ id: editingCliente.id, data: formData });
    } else {
      createMutation.mutate({ ...formData, owner: currentUser?.email });
    }
  };

  const handleEdit = (cliente) => {
    setEditingCliente(cliente);
    setFormData({
      nome: cliente.nome,
      endereco: cliente.endereco,
      endereco_entrega: cliente.endereco_entrega || "",
      usar_endereco_entrega: cliente.usar_endereco_entrega || false,
      telefone: cliente.telefone || "",
      observacoes: cliente.observacoes || "",
    });
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingCliente(null);
    setFormData({
      nome: "",
      endereco: "",
      endereco_entrega: "",
      usar_endereco_entrega: false,
      telefone: "",
      observacoes: "",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-4xl font-bold text-gray-900">
                  Cadastro de Clientes
                </h1>
              </div>
              <p className="text-gray-600 text-lg">
                Gerencie os clientes para otimização de rotas
              </p>
            </div>
            
            <div className="flex gap-3">
              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="h-12 border-purple-200 text-purple-700 hover:bg-purple-50 shadow-sm"
              >
                {isImporting ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-5 h-5 mr-2" />
                )}
                {isImporting ? "Importando..." : "Importar CSV"}
              </Button>

              <Button
                onClick={() => setShowDialog(true)}
                className="h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg"
              >
                <Plus className="w-5 h-5 mr-2" />
                Novo Cliente
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Card className="bg-white shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Total de Clientes</p>
                  <p className="text-3xl font-bold text-purple-600">
                    {clientes.length}
                  </p>
                </div>
                <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center">
                  <Users className="w-8 h-8 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Client List */}
        <Card className="bg-white shadow-xl">
          <CardHeader className="border-b border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-xl">Lista de Clientes</CardTitle>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nome, endereço ou tel..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <ScrollArea className="h-[600px] pr-4">
              {filteredClientes.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                   {searchTerm ? "Nenhum cliente encontrado para sua busca." : "Nenhum cliente cadastrado ainda."}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AnimatePresence>
                    {filteredClientes.map((cliente) => (
                      <motion.div
                        key={cliente.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                      >
                        <Card className="hover:shadow-lg transition-shadow border-2 border-gray-200 hover:border-purple-300">
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between mb-3">
                              <h3 className="font-bold text-lg text-gray-900">
                                {cliente.nome}
                              </h3>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(cliente)}
                                  className="hover:bg-blue-50 hover:text-blue-600"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteMutation.mutate(cliente.id)}
                                  className="hover:bg-red-50 hover:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-start gap-2 text-sm text-gray-600">
                                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-purple-500" />
                                <p className="leading-relaxed">{cliente.endereco}</p>
                              </div>
                              {cliente.endereco_entrega && (
                                <div className="flex items-start gap-2 text-sm text-gray-600">
                                  <Warehouse className="w-4 h-4 mt-0.5 flex-shrink-0 text-orange-500" />
                                  <div>
                                    <p className="leading-relaxed">{cliente.endereco_entrega}</p>
                                    {cliente.usar_endereco_entrega && (
                                      <Badge className="mt-1 bg-orange-100 text-orange-700 text-xs">
                                        Usar para entregas
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              )}
                              {cliente.telefone && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Phone className="w-4 h-4 text-purple-500" />
                                  <span>{cliente.telefone}</span>
                                </div>
                              )}
                              {cliente.observacoes && (
                                <div className="mt-3 pt-3 border-t border-gray-100">
                                  <Badge variant="outline" className="mb-2">
                                    Observação
                                  </Badge>
                                  <p className="text-xs text-gray-600 italic">
                                    {cliente.observacoes}
                                  </p>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Dialog Form */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingCliente ? "Editar Cliente" : "Novo Cliente"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Cliente *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) =>
                    setFormData({ ...formData, nome: e.target.value })
                  }
                  placeholder="Ex: Padaria São João"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endereco">Endereço da Loja *</Label>
                <Textarea
                  id="endereco"
                  value={formData.endereco}
                  onChange={(e) =>
                    setFormData({ ...formData, endereco: e.target.value })
                  }
                  placeholder="Ex: Rua Augusta, 1234 - Consolação, São Paulo - SP"
                  className="min-h-[80px]"
                  required
                />
              </div>

              <div className="space-y-2 p-4 border-2 border-dashed border-orange-200 rounded-lg bg-orange-50">
                <div className="flex items-center gap-2 mb-2">
                  <Warehouse className="w-4 h-4 text-orange-600" />
                  <Label htmlFor="endereco_entrega" className="text-orange-800">Endereço de Entrega Alternativo (Galpão/Depósito)</Label>
                </div>
                <Textarea
                  id="endereco_entrega"
                  value={formData.endereco_entrega}
                  onChange={(e) =>
                    setFormData({ ...formData, endereco_entrega: e.target.value })
                  }
                  placeholder="Ex: Av. Industrial, 500 - Galpão 3, Zona Industrial"
                  className="min-h-[60px]"
                />
                {formData.endereco_entrega && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-orange-200">
                    <Label htmlFor="usar_endereco_entrega" className="text-sm text-orange-700">
                      Usar este endereço para entregas
                    </Label>
                    <Switch
                      id="usar_endereco_entrega"
                      checked={formData.usar_endereco_entrega}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, usar_endereco_entrega: checked })
                      }
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) =>
                    setFormData({ ...formData, telefone: e.target.value })
                  }
                  placeholder="Ex: (11) 3456-7890"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) =>
                    setFormData({ ...formData, observacoes: e.target.value })
                  }
                  placeholder="Ex: Preferência de entrega pela manhã"
                  className="min-h-[80px]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  {editingCliente ? "Salvar Alterações" : "Criar Cliente"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}