import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, Loader2, CheckCircle2 } from "lucide-react";
import { sendWhatsAppMessage, buildDriverRouteSummary } from "./whatsappService";
import { toast } from "sonner";
import moment from "moment";

export default function SendRouteSummaryButton({ rota, motoristas, instanceName }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    // Encontra o telefone do motorista
    const motorista = motoristas?.find(m => m.nome === rota.motorista_nome || m.email === rota.motorista_email);
    const phone = motorista?.telefone;

    if (!phone) {
      toast.error("Motorista sem telefone cadastrado");
      return;
    }
    if (!instanceName) {
      toast.error("WhatsApp não configurado. Vá em Configurações.");
      return;
    }

    setSending(true);
    const entregas = rota.rota?.slice(1, -1) || [];
    const totalMinutos = rota.tempo_minutos || 0;

    const message = buildDriverRouteSummary({
      driverName: rota.motorista_nome || "Motorista",
      date: moment(rota.data_prevista || rota.data_agendamento).format("DD/MM/YYYY"),
      vehicleDescription: rota.veiculo_descricao || "",
      vehiclePlate: rota.veiculo_placa || "",
      totalDeliveries: entregas.length,
      totalDistance: (rota.distancia_km || 0).toFixed(1),
      totalTime: `${Math.floor(totalMinutos / 60)}h ${totalMinutos % 60}m`,
      deliveries: entregas
    });

    await sendWhatsAppMessage({ instanceName, phone, message });
    setSending(false);
    setSent(true);
    toast.success(`Resumo enviado para ${rota.motorista_nome}`);
    setTimeout(() => setSent(false), 5000);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSend}
      disabled={sending || sent}
      className={sent ? "text-green-600 border-green-300" : "text-green-700 border-green-300 hover:bg-green-50"}
    >
      {sending ? (
        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
      ) : sent ? (
        <CheckCircle2 className="w-4 h-4 mr-1" />
      ) : (
        <MessageSquare className="w-4 h-4 mr-1" />
      )}
      {sending ? "Enviando..." : sent ? "Enviado!" : "Enviar Rota"}
    </Button>
  );
}