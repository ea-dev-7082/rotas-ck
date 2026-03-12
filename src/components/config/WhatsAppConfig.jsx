import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Loader2, CheckCircle2, RefreshCw, Wifi, WifiOff } from "lucide-react";

export default function WhatsAppConfig({ configs, saveConfig }) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [qrBase64, setQrBase64] = useState("");
  const [connectionState, setConnectionState] = useState("");
  const [loading, setLoading] = useState(false);
  const [urlSaved, setUrlSaved] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  useEffect(() => {
    if (configs.length > 0) {
      setWebhookUrl(configs.find(c => c.chave === "whatsapp_webhook_url")?.valor || "");
      setInstanceName(configs.find(c => c.chave === "whatsapp_instance_name")?.valor || "");
    }
  }, [configs]);

  const handleSaveUrl = () => {
    saveConfig({ chave: "whatsapp_webhook_url", valor: webhookUrl });
    setUrlSaved(true);
    setTimeout(() => setUrlSaved(false), 3000);
  };

  const handleSaveName = () => {
    saveConfig({ chave: "whatsapp_instance_name", valor: instanceName });
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 3000);
  };

  const handleConnect = async () => {
    if (!webhookUrl || !instanceName) return;
    setLoading(true);
    setQrBase64("");
    setConnectionState("");

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "connect", instance: instanceName })
    });

    const data = await response.json();

    if (data.base64) {
      setQrBase64(data.base64);
    }
    if (data.state) {
      setConnectionState(data.state);
    }
    setLoading(false);
  };

  const isConnected = connectionState === "open";

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-green-600" />
          WhatsApp (Evolution API)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <p className="text-xs text-gray-500">
          Configure a conexão com o WhatsApp via Evolution API integrado ao seu n8n.
        </p>

        {/* Webhook URL */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">URL do Webhook (n8n)</label>
          <div className="flex gap-2">
            <Input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://n8n.seudominio.com/webhook/rotasck-connect"
            />
            <Button onClick={handleSaveUrl} size="sm" className="bg-green-600 hover:bg-green-700 shrink-0">
              {urlSaved ? <CheckCircle2 className="w-4 h-4" /> : "Salvar"}
            </Button>
          </div>
        </div>

        {/* Nome da Instância */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Nome da Instância</label>
          <div className="flex gap-2">
            <Input
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
              placeholder="Ex: minha-empresa-whatsapp"
            />
            <Button onClick={handleSaveName} size="sm" className="bg-green-600 hover:bg-green-700 shrink-0">
              {nameSaved ? <CheckCircle2 className="w-4 h-4" /> : "Salvar"}
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Identificador único da instância na Evolution API.</p>
        </div>

        {/* Botão conectar */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={handleConnect}
            disabled={loading || !webhookUrl || !instanceName}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {loading ? "Conectando..." : "Conectar / Gerar QR Code"}
          </Button>

          {connectionState && (
            <Badge className={isConnected ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
              {isConnected ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
              {isConnected ? "Conectado" : connectionState}
            </Badge>
          )}
        </div>

        {/* QR Code */}
        {qrBase64 && !isConnected && (
          <div className="mt-4 p-4 bg-white border-2 border-green-200 rounded-xl text-center">
            <p className="text-sm font-medium text-gray-700 mb-3">
              Escaneie o QR Code no WhatsApp:
            </p>
            <img
              src={qrBase64.startsWith("data:") ? qrBase64 : `data:image/png;base64,${qrBase64}`}
              alt="QR Code WhatsApp"
              className="mx-auto max-w-[280px] rounded-lg shadow-md"
            />
            <p className="text-xs text-gray-400 mt-3">
              Abra o WhatsApp → Dispositivos conectados → Conectar dispositivo
            </p>
          </div>
        )}

        {isConnected && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center">
            <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="font-semibold text-green-700">WhatsApp conectado com sucesso!</p>
            <p className="text-xs text-green-600 mt-1">Instância: {instanceName}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}