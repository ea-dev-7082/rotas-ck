import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Printer, Route, MapPin, Clock, User, Truck, Home } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

export default function PrintModal({ open, onClose, route, stats, pontoPartida }) {
  const [selectedMotorista, setSelectedMotorista] = useState("");
  const printRef = useRef();

  const { data: motoristas } = useQuery({
    queryKey: ["motoristas"],
    queryFn: () => base44.entities.Motorista.filter({ ativo: true }, "nome"),
    initialData: [],
  });

  const handlePrint = () => {
    const printContent = printRef.current;
    const printWindow = window.open("", "_blank");
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Rota de Entregas</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px; }
            .header h1 { font-size: 24px; margin-bottom: 5px; }
            .header p { color: #666; font-size: 14px; }
            .info-row { display: flex; justify-content: space-between; margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 5px; }
            .info-item { text-align: center; }
            .info-label { font-size: 12px; color: #666; }
            .info-value { font-size: 18px; font-weight: bold; }
            .motorista-section { margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
            .motorista-title { font-weight: bold; margin-bottom: 10px; }
            .route-list { margin-top: 20px; }
            .route-item { display: flex; padding: 12px; border-bottom: 1px solid #eee; }
            .route-item:last-child { border-bottom: none; }
            .route-number { width: 40px; height: 40px; background: #3b82f6; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; flex-shrink: 0; }
            .route-number.matriz { background: #10b981; }
            .route-details { flex: 1; }
            .route-name { font-weight: bold; font-size: 14px; }
            .route-address { color: #666; font-size: 12px; margin-top: 3px; }
            .route-time { color: #888; font-size: 11px; margin-top: 3px; }
            .signature-section { margin-top: 40px; display: flex; justify-content: space-between; }
            .signature-box { width: 45%; text-align: center; }
            .signature-line { border-top: 1px solid #333; margin-top: 60px; padding-top: 5px; }
            @media print { body { padding: 10px; } }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const selectedMotoristaData = motoristas.find(m => m.id === selectedMotorista);
  const today = new Date().toLocaleDateString('pt-BR');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto z-[9999]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Imprimir Rota de Entregas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Selecionar Motorista</Label>
            <Select value={selectedMotorista} onValueChange={setSelectedMotorista}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha o motorista..." />
              </SelectTrigger>
              <SelectContent>
                {motoristas.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome} {m.placa && `- ${m.placa}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          <div className="border rounded-lg p-4 bg-white" ref={printRef}>
            <div className="header">
              <h1>🚚 Rota de Entregas</h1>
              <p>Data: {today}</p>
            </div>

            <div className="info-row">
              <div className="info-item">
                <div className="info-label">Entregas</div>
                <div className="info-value">{route ? route.length - 2 : 0}</div>
              </div>
              <div className="info-item">
                <div className="info-label">Distância</div>
                <div className="info-value">{stats?.distance?.toFixed(1) || 0} km</div>
              </div>
              <div className="info-item">
                <div className="info-label">Tempo Est.</div>
                <div className="info-value">
                  {stats?.time ? `${Math.floor(stats.time / 60)}h ${stats.time % 60}min` : '-'}
                </div>
              </div>
            </div>

            {selectedMotoristaData && (
              <div className="motorista-section">
                <div className="motorista-title">👤 Motorista</div>
                <div><strong>Nome:</strong> {selectedMotoristaData.nome}</div>
                {selectedMotoristaData.telefone && (
                  <div><strong>Telefone:</strong> {selectedMotoristaData.telefone}</div>
                )}
                {selectedMotoristaData.veiculo && (
                  <div><strong>Veículo:</strong> {selectedMotoristaData.veiculo}</div>
                )}
                {selectedMotoristaData.placa && (
                  <div><strong>Placa:</strong> {selectedMotoristaData.placa}</div>
                )}
              </div>
            )}

            <div className="route-list">
              {route?.map((point, index) => {
                const isMatriz = index === 0 || index === route.length - 1;
                return (
                  <div key={index} className="route-item">
                    <div className={`route-number ${isMatriz ? 'matriz' : ''}`}>
                      {isMatriz ? '🏠' : index}
                    </div>
                    <div className="route-details">
                      <div className="route-name">
                        {isMatriz ? (index === 0 ? 'SAÍDA - ' : 'RETORNO - ') : ''}
                        {point.client_name}
                      </div>
                      <div className="route-address">📍 {point.address}</div>
                      {point.estimated_arrival && (
                        <div className="route-time">⏰ Chegada: {point.estimated_arrival}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="signature-section">
              <div className="signature-box">
                <div className="signature-line">Assinatura do Motorista</div>
              </div>
              <div className="signature-box">
                <div className="signature-line">Assinatura do Responsável</div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}