import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Car, User, Truck } from "lucide-react";

export default function FleetSelector({
  veiculos,
  motoristas,
  selectedFleet,
  onFleetChange,
}) {
  // "veiculo" ou "motorista"
  const [mode, setMode] = useState("veiculo");

  // --- Modo Veículo ---
  const handleToggleVehicle = (veiculoId) => {
    const exists = selectedFleet.find((f) => f.veiculoId === veiculoId);
    if (exists) {
      onFleetChange(selectedFleet.filter((f) => f.veiculoId !== veiculoId));
    } else {
      onFleetChange([...selectedFleet, { veiculoId, motoristaId: "" }]);
    }
  };

  const handleMotoristaForVehicle = (veiculoId, motoristaId) => {
    onFleetChange(
      selectedFleet.map((f) =>
        f.veiculoId === veiculoId ? { ...f, motoristaId } : f
      )
    );
  };

  // --- Modo Motorista ---
  const handleToggleMotorista = (motoristaId) => {
    const exists = selectedFleet.find((f) => f.motoristaId === motoristaId);
    if (exists) {
      onFleetChange(selectedFleet.filter((f) => f.motoristaId !== motoristaId));
    } else {
      onFleetChange([...selectedFleet, { veiculoId: "", motoristaId }]);
    }
  };

  const handleVeiculoForMotorista = (motoristaId, veiculoId) => {
    onFleetChange(
      selectedFleet.map((f) =>
        f.motoristaId === motoristaId ? { ...f, veiculoId } : f
      )
    );
  };

  // --- Limpar ao trocar modo ---
  const handleModeChange = (newMode) => {
    if (newMode !== mode) {
      onFleetChange([]);
      setMode(newMode);
    }
  };

  return (
    <Card className="bg-white shadow-lg mb-6">
      <CardHeader className="border-b border-gray-100 py-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Truck className="w-5 h-5 text-indigo-600" />
          Frota Disponível
          <Badge variant="outline" className="ml-2">
            {selectedFleet.length} selecionado(s)
          </Badge>
        </CardTitle>

        {/* Abas de modo */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => handleModeChange("veiculo")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === "veiculo"
                ? "bg-indigo-600 text-white shadow"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Car className="w-4 h-4" />
            Selecionar por Veículo
          </button>
          <button
            onClick={() => handleModeChange("motorista")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === "motorista"
                ? "bg-indigo-600 text-white shadow"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <User className="w-4 h-4" />
            Selecionar por Motorista
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Botão Selecionar Todos */}
          {mode === "veiculo" && veiculos.length > 0 && (
            <button
              onClick={() => {
                if (selectedFleet.length === veiculos.length) {
                  onFleetChange([]);
                } else {
                  onFleetChange(veiculos.map((v) => ({ veiculoId: v.id, motoristaId: "" })));
                }
              }}
              className="w-full text-sm font-medium text-indigo-600 hover:text-indigo-800 py-2 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              {selectedFleet.length === veiculos.length ? "Desmarcar Todos" : "Selecionar Todos"}
            </button>
          )}
          {mode === "motorista" && motoristas.length > 0 && (
            <button
              onClick={() => {
                if (selectedFleet.length === motoristas.length) {
                  onFleetChange([]);
                } else {
                  onFleetChange(motoristas.map((m) => ({ veiculoId: "", motoristaId: m.id })));
                }
              }}
              className="w-full text-sm font-medium text-indigo-600 hover:text-indigo-800 py-2 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              {selectedFleet.length === motoristas.length ? "Desmarcar Todos" : "Selecionar Todos"}
            </button>
          )}

          {mode === "veiculo" ? (
            /* =========== MODO VEÍCULO =========== */
            veiculos.length === 0 ? (
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
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-100">
                        <Car className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">
                          {veiculo.descricao}
                        </p>
                        <p className="text-sm text-gray-500">
                          {veiculo.placa || "Sem placa"}
                          {veiculo.capacidade &&
                            ` • Cap: ${veiculo.capacidade}`}
                        </p>
                      </div>
                    </div>

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
                            handleMotoristaForVehicle(
                              veiculo.id,
                              e.target.value
                            )
                          }
                          className="w-full h-9 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Sem motorista</option>
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
            )
          ) : (
            /* =========== MODO MOTORISTA =========== */
            motoristas.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                Nenhum motorista ativo cadastrado
              </p>
            ) : (
              motoristas.map((motorista) => {
                const isSelected = selectedFleet.some(
                  (f) => f.motoristaId === motorista.id
                );
                const fleetEntry = selectedFleet.find(
                  (f) => f.motoristaId === motorista.id
                );

                return (
                  <div
                    key={motorista.id}
                    className={`p-4 border-2 rounded-lg transition-all cursor-pointer ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 hover:border-indigo-300"
                    }`}
                    onClick={() => handleToggleMotorista(motorista.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() =>
                          handleToggleMotorista(motorista.id)
                        }
                      />
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-purple-100">
                        <User className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">
                          {motorista.nome}
                        </p>
                        <p className="text-sm text-gray-500">
                          {motorista.telefone || motorista.email || ""}
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <div
                        className="mt-3 pt-3 border-t border-indigo-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <label className="text-xs font-medium text-gray-600 flex items-center gap-1 mb-2">
                          <Car className="w-3 h-3" />
                          Veículo
                        </label>
                        <select
                          value={fleetEntry?.veiculoId || ""}
                          onChange={(e) =>
                            handleVeiculoForMotorista(
                              motorista.id,
                              e.target.value
                            )
                          }
                          className="w-full h-9 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Sem veículo</option>
                          {veiculos.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.descricao} {v.placa ? `(${v.placa})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}