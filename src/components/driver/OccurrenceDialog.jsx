import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";

const occurrenceTypes = [
  { value: "cliente_ausente", label: "Cliente Ausente" },
  { value: "endereco_incorreto", label: "Endereço Incorreto" },
  { value: "recusa_recebimento", label: "Recusa de Recebimento" },
  { value: "local_inacessivel", label: "Local Inacessível" },
  { value: "avaria_produto", label: "Avaria no Produto" },
  { value: "outros", label: "Outros" },
];

export default function OccurrenceDialog({
  open,
  onOpenChange,
  onConfirm,
  delivery,
}) {
  const [occurrenceType, setOccurrenceType] = useState("cliente_ausente");
  const [description, setDescription] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    const selectedOccurrence = occurrenceTypes.find((p) => p.value === occurrenceType);
    await onConfirm(selectedOccurrence?.label || occurrenceType, description);
    setOccurrenceType("cliente_ausente");
    setDescription("");
    setIsConfirming(false);
  };

  const handleCancel = () => {
    setOccurrenceType("cliente_ausente");
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Registrar Ocorrência</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {delivery && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">Entrega #{delivery.order}</p>
              <p className="font-semibold">{delivery.client_name}</p>
              <p className="text-sm text-gray-500 mt-1">{delivery.address}</p>
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-base font-medium">Tipo de Ocorrência</Label>
            <RadioGroup value={occurrenceType} onValueChange={setOccurrenceType}>
              {occurrenceTypes.map((type) => (
                <div
                  key={type.value}
                  className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  <RadioGroupItem value={type.value} id={type.value} />
                  <Label
                    htmlFor={type.value}
                    className="font-normal cursor-pointer flex-1"
                  >
                    {type.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="occurrence-description">Descrição</Label>
            <Textarea
              id="occurrence-description"
              placeholder="Descreva a ocorrência em detalhes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2">
          <Button
            onClick={handleConfirm}
            variant="destructive"
            className="w-full h-12"
            disabled={!description.trim() || isConfirming}
          >
            {isConfirming ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Registrando...</>
            ) : (
              "Confirmar Ocorrência"
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleCancel}
            className="w-full h-12"
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}