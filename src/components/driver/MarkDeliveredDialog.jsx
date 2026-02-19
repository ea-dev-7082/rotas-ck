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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function MarkDeliveredDialog({
  open,
  onOpenChange,
  onConfirm,
  delivery,
}) {
  const [notes, setNotes] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotoUrl(file_url);
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
    }
    setIsUploading(false);
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    await onConfirm({ notes, receivedBy, photoUrl });
    setNotes("");
    setReceivedBy("");
    setPhotoUrl("");
    setIsConfirming(false);
  };

  const handleCancel = () => {
    setNotes("");
    setReceivedBy("");
    setPhotoUrl("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Confirmar Entrega</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {delivery && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">Entrega #{delivery.order}</p>
              <p className="font-semibold">{delivery.client_name}</p>
              <p className="text-sm text-gray-500 mt-1">{delivery.address}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="received-by">Quem recebeu?</Label>
            <Input
              id="received-by"
              placeholder="Nome de quem recebeu"
              value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)}
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery-notes">Observações (opcional)</Label>
            <Textarea
              id="delivery-notes"
              placeholder="Ex: Entregue na portaria, Recebido pelo porteiro, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Foto do Comprovante (opcional)</Label>
            <div className="flex flex-col gap-2">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                className="hidden"
                id="photo-upload"
              />
              <label htmlFor="photo-upload">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 cursor-pointer"
                  asChild
                  disabled={isUploading}
                >
                  <span>
                    {isUploading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</>
                    ) : (
                      <><Camera className="w-4 h-4 mr-2" />Tirar Foto</>
                    )}
                  </span>
                </Button>
              </label>
              {photoUrl && (
                <div className="relative">
                  <img 
                    src={photoUrl} 
                    alt="Comprovante" 
                    className="w-full h-32 object-cover rounded-lg border"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2 h-7 px-2"
                    onClick={() => setPhotoUrl("")}
                  >
                    Remover
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2">
          <Button
            onClick={handleConfirm}
            className="w-full h-12 bg-green-600 hover:bg-green-700 text-white"
            disabled={isConfirming}
          >
            {isConfirming ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Confirmando...</>
            ) : (
              "Confirmar Entrega"
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