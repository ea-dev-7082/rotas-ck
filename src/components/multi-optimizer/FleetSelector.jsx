import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Car, Bike, User, Truck } from "lucide-react";

export default function FleetSelector({
  veiculos,
  motoristas,
  selectedFleet,
  onFleetChange,
}) {
  // selectedFleet = [{ veiculoId, motoristaId }]

  const handleToggleVehicle = (veiculoId) => {
    const exists = selectedFleet.find((f) => f.veiculoId === veiculoId);
    if (exists) {
      onFleetChange(selectedFleet.filter((f) => f.veiculoId !== veiculoId));
    } else {
      onFleetChange([...selectedFleet, { veiculoId, motoristaId: "" }]);
    }
  };

  const handleMotoristaChange = (veiculoId, motoristaId) => {
    onFleetChange(
      selectedFleet.map((f) =>
        f.veiculoId === veiculoId ? { ...f, motoristaId } : f
      )
    );
  };

  return (
    <Card className="bg-white shadow-lg mb-6">
      <CardHeader className="border-b border-gray-100 py-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Truck className="w-5 h-5 text-indigo-600" />
          Frota Disponível
          <Badge variant="outline" className="ml-2">
            {selectedFleet.length} veículo(s)
          </Badge>
        </CardTitle>
        <p className="text-sm text-gray-500 mt-1">
          Selecione os veículos e seus motoristas para a otimização
        </p>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-3">
          {veiculos.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              Nenhum veículo ativo cadastrado
            </p>
          ) : (
            veiculos.map((veiculo) => {
              const isSelected = selectedFleet.some(
                (f) => f.veiculoId === veiculo.id
              );
              const fleetEntry = selectedFleet.find(
                (f) => f.veiculoId === veiculo.id
              );

              return (
                <div
                  key={veiculo.id}
                  className={`p-4 border-2 rounded-lg transition-all cursor-pointer ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-gray-200 hover:border-indigo-300"
                  }`}
                  onClick={() => handleToggleVehicle(veiculo.id)}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggleVehicle(veiculo.id)}
                    />
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        veiculo.tipo === "moto"
                          ? "bg-orange-100"
                          : "bg-blue-100"
                      }`}
                    >
                      {veiculo.tipo === "moto" ? (
                        <Bike className="w-5 h-5 text-orange-600" />
                      ) : (
                        <Car className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">
                        {veiculo.descricao}
                      </p>
                      <p className="text-sm text-gray-500">
                        {veiculo.placa || "Sem placa"}
                        {veiculo.capacidade && ` • Cap: ${veiculo.capacidade}`}
                      </p>
                    </div>
                  </div>

                  {/* Seletor de motorista (aparece quando veículo selecionado) */}
                  {isSelected && (
                    <div
                      className="mt-3 pt-3 border-t border-indigo-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label className="text-xs font-medium text-gray-600 flex items-center gap-1 mb-2">
                        <User className="w-3 h-3" />
                        Motorista
                      </label>
                      <select
                        value={fleetEntry?.motoristaId || ""}
                        onChange={(e) =>
                          handleMotoristaChange(veiculo.id, e.target.value)
                        }
                        className="w-full h-9 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Distribuição automática</option>
                        {motoristas.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}