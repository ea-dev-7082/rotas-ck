import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Save, Upload, Loader2 } from "lucide-react";
import moment from "moment";

const TIPOS = [
  { value: "abastecimento", label: "Abastecimento" },
  { value: "troca_oleo", label: "Troca de Óleo" },
  { value: "manutencao_preventiva", label: "Manutenção Preventiva" },
  { value: "manutencao_corretiva", label: "Manutenção Corretiva" },
  { value: "pneu", label: "Pneu" },
  { value: "outros", label: "Outros" }
];

export default function ManutencaoForm({ open, onClose, veiculos, onSaved, editItem, currentUser }) {
  const [form, setForm] = useState(editItem || {
    veiculo_id: "",
    tipo: "abastecimento",
    data: moment().format("YYYY-MM-DD"),
    km_atual: "",
    valor: "",
    tipo_combustivel: "gasolina",
    litros: "",
    metros_cubicos: "",
    preco_litro: "",
    preco_m3: "",
    posto: "",
    descricao: "",
    foto_comprovante: ""
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  React.useEffect(() => {
    if (editItem) {
      setForm(editItem);
    } else {
      setForm({
        veiculo_id: "",
        tipo: "abastecimento",
        data: moment().format("YYYY-MM-DD"),
        km_atual: "",
        valor: "",
        tipo_combustivel: "gasolina",
        litros: "",
        metros_cubicos: "",
        preco_litro: "",
        preco_m3: "",
        posto: "",
        descricao: "",
        foto_comprovante: ""
      });
    }
  }, [editItem, open]);

  const selectedVeiculo = veiculos.find(v => v.id === form.veiculo_id);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(prev => ({ ...prev, foto_comprovante: file_url }));
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.veiculo_id || !form.tipo || !form.data || !form.valor) return;
    setSaving(true);

    const payload = {
      ...form,
      km_atual: form.km_atual ? Number(form.km_atual) : null,
      valor: Number(form.valor),
      litros: form.litros ? Number(form.litros) : null,
      metros_cubicos: form.metros_cubicos ? Number(form.metros_cubicos) : null,
      preco_litro: form.preco_litro ? Number(form.preco_litro) : null,
      preco_m3: form.preco_m3 ? Number(form.preco_m3) : null,
      veiculo_descricao: selectedVeiculo?.descricao || "",
      veiculo_placa: selectedVeiculo?.placa || "",
      owner: currentUser?.email || ""
    };

    if (editItem?.id) {
      await base44.entities.ManutencaoVeiculo.update(editItem.id, payload);
    } else {
      await base44.entities.ManutencaoVeiculo.create(payload);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  const isAbastecimento = form.tipo === "abastecimento";
  const isGNV = form.tipo_combustivel === "gnv";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? "Editar Registro" : "Novo Registro"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Veículo */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Veículo *</label>
            <Select value={form.veiculo_id} onValueChange={v => setForm(f => ({ ...f, veiculo_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione o veículo" /></SelectTrigger>
              <SelectContent>
                {veiculos.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.descricao} - {v.placa}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Tipo *</label>
            <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Data *</label>
              <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Km Atual</label>
              <Input type="number" placeholder="Ex: 45000" value={form.km_atual} onChange={e => setForm(f => ({ ...f, km_atual: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Valor (R$) *</label>
              <Input type="number" step="0.01" placeholder="0,00" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Posto / Oficina</label>
              <Input placeholder="Nome do local" value={form.posto} onChange={e => setForm(f => ({ ...f, posto: e.target.value }))} />
            </div>
          </div>

          {/* Campos de abastecimento */}
          {isAbastecimento && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 space-y-3">
              <div>
                <label className="text-sm font-medium text-blue-700 block mb-1">Tipo de Combustível</label>
                <Select value={form.tipo_combustivel} onValueChange={v => setForm(f => ({ ...f, tipo_combustivel: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gasolina">Gasolina</SelectItem>
                    <SelectItem value="alcool">Álcool/Etanol</SelectItem>
                    <SelectItem value="gnv">GNV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {isGNV ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-blue-700 block mb-1">Metros Cúbicos (m³)</label>
                    <Input type="number" step="0.01" placeholder="Ex: 15" value={form.metros_cubicos} onChange={e => setForm(f => ({ ...f, metros_cubicos: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-blue-700 block mb-1">Preço/m³ (R$)</label>
                    <Input type="number" step="0.01" placeholder="Ex: 4.50" value={form.preco_m3} onChange={e => setForm(f => ({ ...f, preco_m3: e.target.value }))} />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-blue-700 block mb-1">Litros</label>
                    <Input type="number" step="0.01" placeholder="Ex: 40" value={form.litros} onChange={e => setForm(f => ({ ...f, litros: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-blue-700 block mb-1">Preço/Litro (R$)</label>
                    <Input type="number" step="0.01" placeholder="Ex: 5.89" value={form.preco_litro} onChange={e => setForm(f => ({ ...f, preco_litro: e.target.value }))} />
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Descrição / Observações</label>
            <Textarea placeholder="Detalhes do serviço..." value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} className="min-h-[60px]" />
          </div>

          {/* Upload comprovante */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Comprovante</label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-gray-50 text-sm">
                <Upload className="w-4 h-4" />
                {uploading ? "Enviando..." : "Anexar foto"}
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              </label>
              {form.foto_comprovante && (
                <img src={form.foto_comprovante} alt="Comprovante" className="h-10 w-10 object-cover rounded border" />
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form.veiculo_id || !form.valor} className="bg-green-600 hover:bg-green-700 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}