import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Car, Fuel, Gauge, Calendar, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import BottomNav from "../components/driver/BottomNav";

export default function DriverVehicle() {
  const [currentUser, setCurrentUser] = useState(null);
  const [kmInicial, setKmInicial] = useState("");
  const [kmFinal, setKmFinal] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  // Busca rota atual em andamento
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: rotaAtual, refetch } = useQuery({
    queryKey: ["rota-veiculo", currentUser?.email, today],
    queryFn: async () => {
      if (!currentUser) return null;
      const rotas = await base44.entities.RotaAgendada.filter({
        owner: currentUser.email,
        status: "em_andamento",
      }, "-data_prevista", 1);
      return rotas[0] || null;
    },
    enabled: !!currentUser,
  });

  // Carrega dados salvos da rota
  useEffect(() => {
    if (rotaAtual) {
      setKmInicial(rotaAtual.km_inicial || "");
      setKmFinal(rotaAtual.km_final || "");
      setObservacoes(rotaAtual.observacoes_veiculo || "");
    }
  }, [rotaAtual?.id]);

  const handleSaveKmInicial = async () => {
    if (!rotaAtual || !kmInicial) return;
    setIsSaving(true);
    try {
      await base44.entities.RotaAgendada.update(rotaAtual.id, {
        km_inicial: kmInicial,
        hora_saida: new Date().toISOString(),
      });
      toast.success("Km inicial registrado!");
      refetch();
    } catch (error) {
      toast.error("Erro ao salvar");
    }
    setIsSaving(false);
  };

  const handleSaveKmFinal = async () => {
    if (!rotaAtual || !kmFinal) return;
    setIsSaving(true);
    try {
      await base44.entities.RotaAgendada.update(rotaAtual.id, {
        km_final: kmFinal,
        hora_retorno: new Date().toISOString(),
        observacoes_veiculo: observacoes,
      });
      toast.success("Km final registrado!");
      refetch();
    } catch (error) {
      toast.error("Erro ao salvar");
    }
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
            Registro de quilometragem
          </p>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        {rotaAtual ? (
          <>
            {/* Info Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Rota em Andamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Veículo:</span>
                  <span className="font-medium">
                    {rotaAtual.veiculo_descricao} - {rotaAtual.veiculo_placa}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Data:</span>
                  <span className="font-medium">{rotaAtual.data_prevista}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Entregas:</span>
                  <span className="font-medium">{rotaAtual.total_entregas}</span>
                </div>
              </CardContent>
            </Card>

            {/* Km Inicial */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-green-600" />
                  Km Inicial (Saída)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="km-inicial">Quilometragem atual</Label>
                  <Input
                    id="km-inicial"
                    type="number"
                    placeholder="Ex: 45230"
                    value={kmInicial}
                    onChange={(e) => setKmInicial(e.target.value)}
                    className="h-12 text-lg"
                    disabled={!!rotaAtual.km_inicial}
                  />
                </div>
                {rotaAtual.km_inicial ? (
                  <div className="flex items-center gap-2 text-green-600 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      Registrado: {rotaAtual.km_inicial} km às{" "}
                      {rotaAtual.hora_saida 
                        ? format(new Date(rotaAtual.hora_saida), "HH:mm", { locale: ptBR })
                        : "--:--"}
                    </span>
                  </div>
                ) : (
                  <Button
                    onClick={handleSaveKmInicial}
                    disabled={!kmInicial || isSaving}
                    className="w-full h-12 bg-green-600 hover:bg-green-700"
                  >
                    Registrar Saída
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Km Final */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-red-600" />
                  Km Final (Retorno)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="km-final">Quilometragem final</Label>
                  <Input
                    id="km-final"
                    type="number"
                    placeholder="Ex: 45320"
                    value={kmFinal}
                    onChange={(e) => setKmFinal(e.target.value)}
                    className="h-12 text-lg"
                    disabled={!!rotaAtual.km_final}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações (opcional)</Label>
                  <Textarea
                    id="observacoes"
                    placeholder="Problemas no veículo, abastecimento, etc."
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    rows={3}
                    disabled={!!rotaAtual.km_final}
                  />
                </div>
                {rotaAtual.km_final ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-green-600 text-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        Registrado: {rotaAtual.km_final} km às{" "}
                        {rotaAtual.hora_retorno
                          ? format(new Date(rotaAtual.hora_retorno), "HH:mm", { locale: ptBR })
                          : "--:--"}
                      </span>
                    </div>
                    {rotaAtual.km_inicial && rotaAtual.km_final && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-800 font-medium">
                          Distância percorrida: {Number(rotaAtual.km_final) - Number(rotaAtual.km_inicial)} km
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <Button
                    onClick={handleSaveKmFinal}
                    disabled={!kmFinal || !rotaAtual.km_inicial || isSaving}
                    className="w-full h-12 bg-red-600 hover:bg-red-700"
                  >
                    Registrar Retorno
                  </Button>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Car className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nenhuma rota em andamento
            </h3>
            <p className="text-sm text-gray-500 max-w-xs mx-auto">
              Inicie uma rota para registrar a quilometragem do veículo
            </p>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}