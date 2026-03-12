import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, Loader2, CheckCircle2 } from "lucide-react";
import { sendWhatsAppMessage, buildClientNotificationMessage } from "./whatsappService";
import { toast } from "sonner";

export default function NotifyClientButton({ delivery, driverName, vehicleDescription, instanceName }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleNotify = async () => {
    if (!delivery.phone) {
      toast.error("Cliente sem telefone cadastrado");
      return;
    }
    if (!instanceName) {
      toast.error("WhatsApp não configurado. Vá em Configurações.");
      return;
    }

    setSending(true);
    const message = buildClientNotificationMessage({
      clientName: delivery.client_name,
      driverName,
      vehicleDescription,
      estimatedArrival: delivery.estimated_arrival
    });

    await sendWhatsAppMessage({ instanceName, phone: delivery.phone, message });
    setSending(false);
    setSent(true);
    toast.success(`Notificação enviada para ${delivery.client_name}`);
    setTimeout(() => setSent(false), 5000);
  };

  if (!delivery.phone) return null;

  return (
    <Button
      variant="outline"
      size="lg"
      onClick={handleNotify}
      disabled={sending || sent}
      className={`w-full h-12 text-sm ${sent ? "border-green-300 text-green-600" : "border-green-300 text-green-700 hover:bg-green-50"}`}
    >
      {sending ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : sent ? (
        <CheckCircle2 className="w-4 h-4 mr-2" />
      ) : (
        <MessageSquare className="w-4 h-4 mr-2" />
      )}
      {sending ? "Enviando..." : sent ? "Enviado!" : "Avisar Cliente"}
    </Button>
  );
}