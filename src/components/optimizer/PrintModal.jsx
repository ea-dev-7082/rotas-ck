import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Printer } from "lucide-react";

export default function PrintModal({ open, onClose, route, stats, pontoPartida, notasFiscais, responsavelExpedicao, veiculoData, motoristaData }) {
  const [expedidor, setExpedidor] = useState(responsavelExpedicao || "");
  const printRef = useRef();

  // Atualizar expedidor quando prop mudar
  React.useEffect(() => {
    setExpedidor(responsavelExpedicao || "");
  }, [responsavelExpedicao]);

  const handlePrint = () => {
    const printContent = printRef.current;
    const printWindow = window.open("", "_blank");
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Rota de Entregas</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            @page { size: A4; margin: 8mm; }
            body { font-family: Arial, sans-serif; padding: 5px; font-size: 10px; }
            .header { text-align: center; margin-bottom: 8px; border-bottom: 1px solid #333; padding-bottom: 5px; }
            .header h1 { font-size: 16px; margin-bottom: 2px; }
            .header p { color: #666; font-size: 10px; }
            .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; padding: 5px; background: #f5f5f5; border-radius: 3px; }
            .info-item { text-align: center; }
            .info-label { font-size: 8px; color: #666; }
            .info-value { font-size: 12px; font-weight: bold; }
            .motorista-section { margin-bottom: 8px; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 9px; }
            .motorista-title { font-weight: bold; margin-bottom: 3px; font-size: 10px; }
            .route-list { margin-top: 8px; }
            .route-item { display: flex; padding: 4px 0; border-bottom: 1px solid #eee; align-items: flex-start; }
            .route-item:last-child { border-bottom: none; }
            .route-number { width: 20px; height: 20px; background: #3b82f6; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 8px; flex-shrink: 0; font-size: 9px; }
            .route-details { flex: 1; }
            .route-name { font-weight: bold; font-size: 10px; }
            .route-address { color: #666; font-size: 9px; }
            .route-time { color: #888; font-size: 8px; }
            .route-notas { margin-top: 2px; padding: 3px; background: #f9f9f9; border-radius: 2px; font-size: 8px; }
            .route-notas-title { font-weight: bold; margin-bottom: 1px; }
            .nota-item { display: flex; gap: 6px; }
            .expedidor-section { margin-top: 8px; padding: 5px; background: #e8f4fd; border-radius: 3px; font-size: 9px; }
            .veiculo-section { margin-bottom: 8px; padding: 5px; background: #f0fdf4; border-radius: 3px; font-size: 9px; }
            .saida-section { margin-top: 8px; padding: 5px; background: #fff3cd; border-radius: 3px; font-size: 9px; }
            .signature-section { margin-top: 15px; display: flex; justify-content: space-between; }
            .signature-box { width: 45%; text-align: center; font-size: 9px; }
            .signature-line { border-top: 1px solid #333; margin-top: 30px; padding-top: 3px; }
            @media print { body { padding: 0; } }
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
            <Label>Responsável pela Expedição</Label>
            <Input
              value={expedidor}
              onChange={(e) => setExpedidor(e.target.value)}
              placeholder="Nome do responsável..."
            />
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

            {veiculoData && (
              <div className="veiculo-section">
                <div className="motorista-title">🚗 Veículo</div>
                <div><strong>Descrição:</strong> {veiculoData.descricao}</div>
                {veiculoData.placa && (
                  <div><strong>Placa:</strong> {veiculoData.placa}</div>
                )}
                <div><strong>Tipo:</strong> {veiculoData.tipo === 'moto' ? 'Moto' : 'Carro'}</div>
              </div>
            )}

            {motoristaData && (
              <div className="motorista-section">
                <div className="motorista-title">👤 Motorista</div>
                <div><strong>Nome:</strong> {motoristaData.nome}</div>
                {motoristaData.telefone && (
                  <div><strong>Telefone:</strong> {motoristaData.telefone}</div>
                )}
              </div>
            )}

            {expedidor && (
              <div className="expedidor-section">
                <div><strong>📦 Responsável pela Expedição:</strong> {expedidor}</div>
              </div>
            )}

            {route?.[0]?.estimated_arrival && (
              <div className="saida-section" style={{marginTop: '15px', padding: '10px', background: '#fff3cd', borderRadius: '5px'}}>
                <div><strong>🚀 Hora de Saída:</strong> {route[0].estimated_arrival}</div>
              </div>
            )}

            <div className="route-list">
              {route?.filter((_, index) => index !== 0 && index !== route.length - 1).map((point, index) => {
                const clientNotas = notasFiscais?.[point.client_name] || [];
                return (
                  <div key={index} className="route-item">
                    <div className="route-number">
                      {index + 1}
                    </div>
                    <div className="route-details">
                      <div className="route-name">
                        {point.client_name}
                      </div>
                      <div className="route-address">📍 {point.address}</div>
                      {point.estimated_arrival && (
                        <div className="route-time">⏰ Chegada: {point.estimated_arrival}</div>
                      )}
                      {clientNotas.length > 0 && (
                        <div className="route-notas">
                          <div className="route-notas-title">📄 Notas Fiscais:</div>
                          {clientNotas.map((nota, nIdx) => (
                            <div key={nIdx} className="nota-item">
                              <span><strong>NF {nota.numero}</strong></span>
                              {nota.data && <span>Data: {new Date(nota.data).toLocaleDateString('pt-BR')}</span>}
                              {nota.volume && <span>Vol: {nota.volume}</span>}
                            </div>
                          ))}
                        </div>
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