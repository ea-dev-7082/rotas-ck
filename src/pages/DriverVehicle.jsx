import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Car, Gauge, CheckCircle2, Fuel, Play, Square, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import BottomNav from "../components/driver/BottomNav";

export default function DriverVehicle() {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedVeiculo, setSelectedVeiculo] = useState(null);
  const [kmInicial, setKmInicial] = useState("");
  const [kmFinal, setKmFinal] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [abastecimento, setAbastecimento] = useState({ litros: "", valor: "", posto: "", observacoes: "" });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  const today = format(new Date(), "yyyy-MM-dd");

  // Busca veículos cadastrados pelo admin/empresa
  const { data: veiculos = [] } = useQuery({
    queryKey: ["veiculos-driver"],
    queryFn: async () => {
      if (!currentUser) return [];
      const rotas = await base44.entities.RotaAgendada.list("-created_date", 10);
      const owners = [...new Set(rotas.map(r => r.created_by).filter(Boolean))];
      if (owners.length === 0) return [];
      const allVeiculos = await base44.entities.Veiculo.list();
      return allVeiculos.filter(v => owners.includes(v.created_by));
    },
    enabled: !!currentUser,
    initialData: [],
  });

  // Busca registro diário do veículo selecionado (hoje)
  const { data: registroDia, refetch: refetchRegistro } = useQuery({
    queryKey: ["registro-dia", selectedVeiculo?.id, today],
    queryFn: async () => {
      if (!selectedVeiculo || !currentUser) return null;
      const registros = await base44.entities.RegistroDiarioVeiculo.filter({
        veiculo_id: selectedVeiculo.id,
        data: today,
        motorista_email: currentUser.email,
      }, "-created_date", 1);
      return registros[0] || null;
    },
    enabled: !!selectedVeiculo && !!currentUser,
  });

  // Carrega dados salvos do registro
  useEffect(() => {
    if (registroDia) {
      setKmInicial(registroDia.km_inicial || "");
      setKmFinal(registroDia.km_final || "");
      setObservacoes(registroDia.observacoes || "");
      setAbastecimento(registroDia.abastecimento || { litros: "", valor: "", posto: "", observacoes: "" });
    } else {
      setKmInicial("");
      setKmFinal("");
      setObservacoes("");
      setAbastecimento({ litros: "", valor: "", posto: "", observacoes: "" });
    }
  }, [registroDia?.id, selectedVeiculo?.id]);

  const handleIniciarDia = async () => {
    if (!selectedVeiculo || !kmInicial || !currentUser) return;
    setIsSaving(true);
    
    await base44.entities.RegistroDiarioVeiculo.create({
      veiculo_id: selectedVeiculo.id,
      veiculo_descricao: selectedVeiculo.descricao,
      veiculo_placa: selectedVeiculo.placa,
      data: today,
      motorista_email: currentUser.email,
      motorista_nome: currentUser.full_name,
      km_inicial: kmInicial,
      hora_inicio: new Date().toISOString(),
      status: "aberto",
    });
    
    toast.success("Dia iniciado com sucesso!");
    refetchRegistro();
    setIsSaving(false);
  };

  const handleFecharDia = async () => {
    if (!registroDia || !kmFinal) return;
    setIsSaving(true);
    
    const updateData = {
      km_final: kmFinal,
      hora_fim: new Date().toISOString(),
      observacoes: observacoes,
      status: "fechado",
    };

    // Adiciona abastecimento se preenchido
    if (abastecimento.litros || abastecimento.valor) {
      updateData.abastecimento = {
        litros: abastecimento.litros ? Number(abastecimento.litros) : null,
        valor: abastecimento.valor ? Number(abastecimento.valor) : null,
        posto: abastecimento.posto,
        observacoes: abastecimento.observacoes,
      };
    }
    
    await base44.entities.RegistroDiarioVeiculo.update(registroDia.id, updateData);
    
    toast.success("Dia encerrado com sucesso!");
    refetchRegistro();
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-40">
        <div className="max-w-md mx-auto">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Car className="w-5 h-5" />
            Veículo
          </h1>
          <p className="text-sm text-gray-500">
            Registro diário de quilometragem
          </p>
        </div>
      </header>

      {/* Content */}
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
              <p className="text-sm text-gray-500 text-center py-4">
                Nenhum veículo disponível
              </p>
            )}
          </CardContent>
        </Card>

        {/* Registro do Dia */}
        {selectedVeiculo && (
          <>
            {/* Status do Dia */}
            {registroDia && (
              <Card className={registroDia.status === "fechado" ? "border-green-200 bg-green-50" : "border-blue-200 bg-blue-50"}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {registroDia.status === "fechado" ? "Dia Encerrado" : "Dia em Andamento"}
                      </p>
                      <p className="text-sm text-gray-600">
                        Iniciado às {registroDia.hora_inicio 
                          ? format(new Date(registroDia.hora_inicio), "HH:mm", { locale: ptBR })
                          : "--:--"}
                      </p>
                    </div>
                    <CheckCircle2 className={`w-6 h-6 ${
                      registroDia.status === "fechado" ? "text-green-600" : "text-blue-600"
                    }`} />
                  </div>
                  {registroDia.status === "fechado" && registroDia.km_inicial && registroDia.km_final && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-sm text-gray-600">
                        Km percorrido: <strong>{Number(registroDia.km_final) - Number(registroDia.km_inicial)} km</strong>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Iniciar Dia */}
            {!registroDia && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Play className="w-4 h-4 text-green-600" />
                    Iniciar Dia
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="km-inicial">Quilometragem Inicial</Label>
                    <Input
                      id="km-inicial"
                      type="number"
                      placeholder="Ex: 45230"
                      value={kmInicial}
                      onChange={(e) => setKmInicial(e.target.value)}
                      className="h-12 text-lg"
                    />
                  </div>
                  <Button
                    onClick={handleIniciarDia}
                    disabled={!kmInicial || isSaving}
                    className="w-full h-12 bg-green-600 hover:bg-green-700"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Iniciar Dia
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Encerrar Dia */}
            {registroDia && registroDia.status === "aberto" && (
              <>
                {/* Km Registrado */}
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-2 text-green-600 text-sm">
                      <Gauge className="w-4 h-4" />
                      <span>
                        Km inicial: <strong>{registroDia.km_inicial} km</strong> às{" "}
                        {registroDia.hora_inicio 
                          ? format(new Date(registroDia.hora_inicio), "HH:mm", { locale: ptBR })
                          : "--:--"}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Abastecimento */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Fuel className="w-4 h-4 text-amber-600" />
                      Abastecimento (opcional)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="litros">Litros</Label>
                        <Input
                          id="litros"
                          type="number"
                          step="0.01"
                          placeholder="Ex: 45.5"
                          value={abastecimento.litros}
                          onChange={(e) => setAbastecimento({ ...abastecimento, litros: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="valor">Valor (R$)</Label>
                        <Input
                          id="valor"
                          type="number"
                          step="0.01"
                          placeholder="Ex: 250.00"
                          value={abastecimento.valor}
                          onChange={(e) => setAbastecimento({ ...abastecimento, valor: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="posto">Posto</Label>
                      <Input
                        id="posto"
                        placeholder="Nome do posto"
                        value={abastecimento.posto}
                        onChange={(e) => setAbastecimento({ ...abastecimento, posto: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="obs-abastecimento">Observações do Abastecimento</Label>
                      <Textarea
                        id="obs-abastecimento"
                        placeholder="Notas sobre o abastecimento"
                        value={abastecimento.observacoes}
                        onChange={(e) => setAbastecimento({ ...abastecimento, observacoes: e.target.value })}
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Encerrar Dia */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Square className="w-4 h-4 text-red-600" />
                      Encerrar Dia
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="km-final">Quilometragem Final</Label>
                      <Input
                        id="km-final"
                        type="number"
                        placeholder="Ex: 45320"
                        value={kmFinal}
                        onChange={(e) => setKmFinal(e.target.value)}
                        className="h-12 text-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="observacoes">Observações Gerais (opcional)</Label>
                      <Textarea
                        id="observacoes"
                        placeholder="Problemas no veículo, ocorrências, etc."
                        value={observacoes}
                        onChange={(e) => setObservacoes(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <Button
                      onClick={handleFecharDia}
                      disabled={!kmFinal || isSaving}
                      className="w-full h-12 bg-red-600 hover:bg-red-700"
                    >
                      <Square className="w-4 h-4 mr-2" />
                      Encerrar Dia
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Dia já encerrado - mostra resumo */}
            {registroDia && registroDia.status === "fechado" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Resumo do Dia</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Km Inicial</p>
                      <p className="font-medium">{registroDia.km_inicial} km</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Km Final</p>
                      <p className="font-medium">{registroDia.km_final} km</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Início</p>
                      <p className="font-medium">
                        {registroDia.hora_inicio 
                          ? format(new Date(registroDia.hora_inicio), "HH:mm", { locale: ptBR })
                          : "--:--"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Fim</p>
                      <p className="font-medium">
                        {registroDia.hora_fim 
                          ? format(new Date(registroDia.hora_fim), "HH:mm", { locale: ptBR })
                          : "--:--"}
                      </p>
                    </div>
                  </div>
                  
                  {registroDia.abastecimento && (registroDia.abastecimento.litros || registroDia.abastecimento.valor) && (
                    <div className="pt-3 border-t">
                      <p className="font-medium text-amber-700 flex items-center gap-1 mb-2">
                        <Fuel className="w-4 h-4" /> Abastecimento
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {registroDia.abastecimento.litros && (
                          <p>Litros: <strong>{registroDia.abastecimento.litros}L</strong></p>
                        )}
                        {registroDia.abastecimento.valor && (
                          <p>Valor: <strong>R$ {registroDia.abastecimento.valor}</strong></p>
                        )}
                        {registroDia.abastecimento.posto && (
                          <p className="col-span-2">Posto: {registroDia.abastecimento.posto}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {registroDia.observacoes && (
                    <div className="pt-3 border-t">
                      <p className="text-gray-500 text-sm">Observações:</p>
                      <p className="text-sm">{registroDia.observacoes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}