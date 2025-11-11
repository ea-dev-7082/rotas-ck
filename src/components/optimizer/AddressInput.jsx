import React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MapPin } from "lucide-react";

export default function AddressInput({ value, onChange, disabled }) {
  return (
    <div className="space-y-3">
      <Label htmlFor="addresses" className="text-sm font-medium text-gray-700">
        Cole ou digite os endereços (um por linha)
      </Label>
      <Textarea
        id="addresses"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Exemplo:&#10;Rua Augusta, 123 - São Paulo, SP&#10;Av. Paulista, 1000 - São Paulo, SP&#10;Rua Oscar Freire, 500 - São Paulo, SP"
        className="min-h-[300px] font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
      />
      <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <MapPin className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700 leading-relaxed">
          <strong>Dica:</strong> Inclua endereços completos com cidade e estado
          para melhores resultados. Você pode colar diretamente de uma
          planilha.
        </p>
      </div>
    </div>
  );
}