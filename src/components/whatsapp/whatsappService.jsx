const SEND_WEBHOOK_URL = "https://n8n.kaffspiel.cloud/webhook/rotasck-send";

export async function sendWhatsAppMessage({ instanceName, phone, message }) {
  if (!instanceName || !phone || !message) {
    throw new Error("instanceName, phone e message são obrigatórios");
  }

  // Normaliza telefone: remove tudo que não é número, garante código do país
  let cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.startsWith("0")) cleanPhone = cleanPhone.substring(1);
  if (!cleanPhone.startsWith("55")) cleanPhone = "55" + cleanPhone;

  const response = await fetch(SEND_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instance: instanceName,
      phone: cleanPhone,
      message
    })
  });

  return response.json();
}

export function buildClientNotificationMessage({ clientName, driverName, vehicleDescription, estimatedArrival }) {
  return `🚚 *Notificação de Entrega*\n\nOlá *${clientName}*,\n\nInformamos que nosso motorista *${driverName}* está a caminho e chegará em aproximadamente *${estimatedArrival || "5 minutos"}*.\n\n🚗 Veículo: ${vehicleDescription || "N/I"}\n\nPor favor, prepare-se para receber a entrega.\n\nObrigado! 📦`;
}

export function buildDriverRouteSummary({ driverName, date, vehicleDescription, vehiclePlate, totalDeliveries, totalDistance, totalTime, deliveries }) {
  let msg = `📋 *Resumo da Rota - ${date}*\n\nOlá *${driverName}*! Aqui está sua rota de hoje:\n\n🚗 Veículo: ${vehicleDescription} (${vehiclePlate})\n📦 Total de entregas: ${totalDeliveries}\n📍 Distância: ${totalDistance} km\n⏱️ Tempo estimado: ${totalTime}\n\n*Paradas:*\n`;

  deliveries.forEach((d, idx) => {
    const nfs = d.notas_fiscais?.map(n => n.numero).join(", ") || "-";
    msg += `\n${idx + 1}. *${d.client_name}*\n   📍 ${d.address}\n   🕐 Previsão: ${d.estimated_arrival || "-"}\n   📄 NF: ${nfs}\n`;
  });

  msg += `\nBoa rota! 🙌`;
  return msg;
}