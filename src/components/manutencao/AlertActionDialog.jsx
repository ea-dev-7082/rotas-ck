import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BellRing, CheckCircle2, Save } from "lucide-react";

const FIELD_MAP = {
  troca_oleo: { km: "troca_oleo_km", dias: "troca_oleo_dias" },
  revisao_preventiva: { km: "revisao_preventiva_km", dias: "revisao_preventiva_dias" },
  pneu: { km: "pneu_km", dias: null },
};

export default function AlertActionDialog({ open, onClose, alerta, currentUser, onDismiss }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ intervalo_km: 0, intervalo_dias: 0 });

  const fields = alerta?.alert_key ? FIELD_MAP[alerta.alert_key] : null;
  const canReprogram = Boolean(alerta?.veiculo_id && fields);

  const { data: configData } = useQuery({
    queryKey: ["config-alerta-veiculo", alerta?.veiculo_id],
    queryFn: async () => {
      const all = await base44.entities.ConfigAlertaVeiculo.filter({ veiculo_id: alerta.veiculo_id });
      return all[0] || null;
    },
    enabled: open && canReprogram,
  });

  useEffect(() => {
    if (!alerta) return;
    setForm({
      intervalo_km: Number(configData?.[fields?.km] ?? alerta.intervalo_km_base ?? 0),
      intervalo_dias: Number(fields?.dias ? (configData?.[fields.dias] ?? alerta.intervalo_dias_base ?? 0) : 0),
    });
  }, [alerta, configData, fields]);

  const handleSave = async () => {
    if (!canReprogram) return;
    setSaving(true);
    const payload = {
      ...(configData || {}),
      veiculo_id: alerta.veiculo_id,
      owner: currentUser?.email || "",
      [fields.km]: Number(form.intervalo_km) || 0,
      ...(fields.dias ? { [fields.dias]: Number(form.intervalo_dias) || 0 } : {}),
    };

    if (configData?.id) {
      await base44.entities.ConfigAlertaVeiculo.update(configData.id, payload);
    } else {
      await base44.entities.ConfigAlertaVeiculo.create(payload);
    }

    queryClient.invalidateQueries({ queryKey: ["config-alerta-veiculo", alerta.veiculo_id] });
    queryClient.invalidateQueries({ queryKey: ["configs-alerta-veiculos"] });
    setSaving(false);
    onClose();
  };

  const handleDismiss = () => {
    onDismiss?.(alerta?.id);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="w-4 h-4 text-amber-600" />
            Tratar alerta
          </DialogTitle>
        </DialogHeader>

        {alerta && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-slate-50 p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-slate-900">{alerta.label}</span>
                <Badge variant="outline">{alerta.veiculo_descricao}</Badge>
              </div>
              <p className="text-sm text-slate-600 mt-1">{alerta.mensagem}</p>
            </div>

            {canReprogram && (
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-medium text-slate-900">Reprogramar alerta</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Novo intervalo em km</p>
                    <Input
                      type="number"
                      value={form.intervalo_km}
                      onChange={(e) => setForm((prev) => ({ ...prev, intervalo_km: e.target.value }))}
                    />
                  </div>
                  {fields?.dias && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Novo intervalo em dias</p>
                      <Input
                        type="number"
                        value={form.intervalo_dias}
                        onChange={(e) => setForm((prev) => ({ ...prev, intervalo_dias: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Salvando..." : "Salvar reprogramação"}
                </Button>
              </div>
            )}

            <Button onClick={handleDismiss} variant="outline" className="w-full">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Marcar como tratado
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}