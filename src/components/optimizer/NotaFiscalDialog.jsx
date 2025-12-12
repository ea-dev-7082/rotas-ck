import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, FileText } from "lucide-react";

export default function NotaFiscalDialog({
  open,
  onClose,
  clientName,
  notasFiscais,
  onSave,
}) {
  const [notas, setNotas] = useState([]);
  const [newNota, setNewNota] = useState({ numero: "", data: "", volume: "" });

  // Atualizar notas quando o dialog abrir ou o cliente mudar
  useEffect(() => {
    if (open) {
      setNotas(notasFiscais || []);
      setNewNota({ numero: "", data: "", volume: "" });
    }
  }, [open, clientName, notasFiscais]);

  const handleAddNota = () => {
    if (newNota.numero) {
      setNotas([...notas, { ...newNota, id: Date.now() }]);
      setNewNota({ numero: "", data: "", volume: "" });
    }
  };

  const handleRemoveNota = (id) => {
    setNotas(notas.filter((n) => n.id !== id));
  };

  const handleSave = () => {
    onSave(notas);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Notas Fiscais - {clientName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Formulário para adicionar nova nota */}
          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            <h4 className="font-medium text-sm text-gray-700">Adicionar Nota</h4>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Número</Label>
                <Input
                  value={newNota.numero}
                  onChange={(e) => setNewNota({ ...newNota, numero: e.target.value })}
                  placeholder="123456"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data</Label>
                <Input
                  type="date"
                  value={newNota.data}
                  onChange={(e) => setNewNota({ ...newNota, data: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Volume</Label>
                <Input
                  value={newNota.volume}
                  onChange={(e) => setNewNota({ ...newNota, volume: e.target.value })}
                  placeholder="2 caixas"
                />
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleAddNota}
              disabled={!newNota.numero}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Nota
            </Button>
          </div>

          {/* Lista de notas adicionadas */}
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {notas.length === 0 ? (
              <p className="text-center text-gray-500 py-4 text-sm">
                Nenhuma nota fiscal adicionada
              </p>
            ) : (
              notas.map((nota) => (
                <div
                  key={nota.id}
                  className="flex items-center justify-between p-3 bg-white border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono">
                      NF {nota.numero}
                    </Badge>
                    {nota.data && (
                      <span className="text-sm text-gray-600">
                        {/* CORREÇÃO APLICADA AQUI ABAIXO: */}
                        {new Date(nota.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                      </span>
                    )}
                    {nota.volume && (
                      <span className="text-sm text-gray-500">
                        Vol: {nota.volume}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveNota(nota.id)}
                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
}