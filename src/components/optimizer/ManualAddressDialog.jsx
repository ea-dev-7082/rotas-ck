import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MapPin } from "lucide-react";

export default function ManualAddressDialog({ open, onClose, onSave }) {
  const [form, setForm] = useState({
    nome: "",
    endereco: "",
    telefone: "",
    observacoes: "",
  });

  useEffect(() => {
    if (open) {
      setForm({ nome: "", endereco: "", telefone: "", observacoes: "" });
    }
  }, [open]);

  const handleSave = () => {
    if (!form.endereco.trim()) return;
    const nomeFinal = form.nome.trim() ? `${form.nome.trim()} (consumidor)` : "Consumidor";
    onSave({
      id: `manual-${Date.now()}`,
      nome: nomeFinal,
      endereco: form.endereco.trim(),
      telefone: form.telefone.trim(),
      observacoes: form.observacoes.trim(),
      isManual: true,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            Adicionar Endereço Manual
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: João Silva"
            />
            <p className="text-xs text-gray-500">Será exibido como: nome + (consumidor)</p>
          </div>

          <div className="space-y-2">
            <Label>Endereço completo</Label>
            <Input
              value={form.endereco}
              onChange={(e) => setForm({ ...form, endereco: e.target.value })}
              placeholder="Rua, número, bairro, cidade"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                placeholder="Opcional"
                className="min-h-[80px]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.endereco.trim()}>
              Adicionar parada
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}