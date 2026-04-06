import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Car, Bike, User } from "lucide-react";

export default function VehicleDriverSelector({
  veiculos,
  motoristas,
  selectedVeiculo,
  selectedMotorista,
  onVeiculoChange,
  onMotoristaChange,
}) {
  return (
    <Card className="bg-white shadow-lg mb-6">
      <CardHeader className="border-b border-gray-100 py-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Car className="w-5 h-5 text-blue-600" />
          Veículo e Motorista
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Veículo */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Car className="w-4 h-4 text-gray-500" />
              Veículo
            </Label>
            <Select value={selectedVeiculo} onValueChange={onVeiculoChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o veículo..." />
              </SelectTrigger>
              <SelectContent>
                {veiculos.slice(0, 30).map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    <div className="flex items-center gap-2">
                      {v.tipo === "moto" ? (
                        <Bike className="w-4 h-4" />
                      ) : (
                        <Car className="w-4 h-4" />
                      )}
                      {v.descricao} {v.placa && `- ${v.placa}`}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Motorista */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-500" />
              Motorista
            </Label>
            <Select value={selectedMotorista} onValueChange={onMotoristaChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motorista..." />
              </SelectTrigger>
              <SelectContent>
                {motoristas.slice(0, 30).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}