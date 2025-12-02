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
import { Printer, FileText } from "lucide-react";

export default function PrintModal({ open, onClose, route, stats, pontoPartida, notasFiscais, responsavelExpedicao, veiculoData, motoristaData }) {
  const [expedidor, setExpedidor] = useState(responsavelExpedicao || "");
  const printRef = useRef();

  React.useEffect(() => {
    setExpedidor(responsavelExpedicao || "");
  }, [responsavelExpedicao]);

  // Função auxiliar para calcular volumes
  const calcularVolumeTotal = () => {
    if (!route || !notasFiscais) return 0;
    let total = 0;
    route.forEach(point => {
        const notas = notasFiscais[point.client_name] || [];
        notas.forEach(nota => {
            // Tenta converter para número, se for texto considera 0 ou ajusta conforme sua regra de negócio
            total += Number(nota.volume) || 0;
        });
    });
    return total;
  };

  const totalVolumesGeral = calcularVolumeTotal();

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    
    // Gerar linhas da tabela para a impressão
    const tableRows = route?.filter((_, index) => index !== 0 && index !== route.length - 1).map((point, index) => {
        const clientNotas = notasFiscais?.[point.client_name] || [];
        const notasString = clientNotas.map(n => `NF ${n.numero}`).join(', ');
        
        // Soma volumes deste cliente específico
        const volCliente = clientNotas.reduce((acc, n) => acc + (Number(n.volume) || 0), 0);
        
        return `
          <tr>
            <td style="text-align: center;">${index + 1}</td>
            <td>
                <div class="client-name">${point.client_name}</div>
                <div class="client-address">${point.address}</div>
            </td>
            <td style="text-align: center;">${point.estimated_arrival || '-'}</td>
            <td style="text-align: center; font-weight: bold;">${volCliente > 0 ? volCliente : '-'}</td>
            <td>${notasString || '<span style="color:#999">-</span>'}</td>
            <td style="width: 80px;"> </td>
          </tr>
        `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Romaneio de Transporte</title>
          <style>
            @page { size: A4; margin: 10mm; }
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #000; -webkit-print-color-adjust: exact; }
            
            /* Estrutura */
            .container { width: 100%; max-width: 100%; }
            .header-box { border: 1px solid #000; padding: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
            .company-info h1 { font-size: 18px; text-transform: uppercase; margin: 0 0 5px 0; letter-spacing: 1px; }
            .company-info p { margin: 0; font-size: 10px; color: #333; }
            .doc-info { text-align: right; }
            .doc-title { font-size: 14px; font-weight: bold; border: 1px solid #000; padding: 5px 10px; display: inline-block; background: #eee; }
            
            /* Grids de Informação */
            .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; border: 1px solid #000; padding: 10px; }
            .info-item { display: flex; flex-direction: column; }
            .label { font-size: 9px; text-transform: uppercase; color: #555; font-weight: bold; margin-bottom: 2px; }
            .value { font-size: 11px; font-weight: normal; border-bottom: 1px dotted #ccc; padding-bottom: 2px; }

            /* Tabela Principal */
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px; }
            th { border: 1px solid #000; background-color: #eee; padding: 6px; text-align: left; text-transform: uppercase; font-size: 9px; }
            td { border: 1px solid #000; padding: 6px; vertical-align: middle; }
            
            .client-name { font-weight: bold; font-size: 11px; }
            .client-address { font-size: 9px; color: #444; margin-top: 2px; }

            /* Rodapé e Assinaturas */
            .footer-stats { margin-bottom: 30px; border: 1px solid #000; background: #f9f9f9; padding: 10px; display: flex; justify-content: space-around; font-weight: bold; font-size: 12px; }
            
            .signatures { display: flex; justify-content: space-between; margin-top: 50px; }
            .sig-box { width: 40%; text-align: center; }
            .sig-line { border-top: 1px solid #000; padding-top: 5px; font-size: 10px; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <div class="container">
            
            <div class="header-box">
              <div class="company-info">
                <h1>Logística & Distribuição</h1>
                <p>Controle de Operações Logísticas</p>
              </div>
              <div class="doc-info">
                <div class="doc-title">ROMANEIO DE CARGA</div>
                <p style="margin-top: 5px;">Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}</p>
              </div>
            </div>

            <div class="info-grid">
              <div class="info-item">
                <span class="label">Motorista</span>
                <span class="value">${motoristaData?.nome || 'N/D'}</span>
              </div>
              <div class="info-item">
                <span class="label">Veículo</span>
                <span class="value">${veiculoData?.descricao || ''} ${veiculoData?.placa ? `(${veiculoData.placa})` : ''}</span>
              </div>
               <div class="info-item">
                <span class="label">Responsável Expedição</span>
                <span class="value">${expedidor || '____________'}</span>
              </div>
              <div class="info-item">
                <span class="label">Saída Prevista</span>
                <span class="value">${route?.[0]?.estimated_arrival || '-'}</span>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 30px; text-align: center;">#</th>
                  <th>Destinatário / Endereço</th>
                  <th style="width: 60px; text-align: center;">Chegada</th>
                  <th style="width: 40px; text-align: center;">Vol.</th>
                  <th>Documentos (NFs)</th>
                  <th style="width: 80px;">Confere</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>

            <div class="footer-stats">
               <span>Distância: ${stats?.distance?.toFixed(1) || 0} km</span>
               <span>Tempo Est.: ${stats?.time ? `${Math.floor(stats.time / 60)}h ${stats.time % 60}min` : '-'}</span>
               <span>TOTAL VOLUMES: ${totalVolumesGeral}</span>
            </div>

            <div class="signatures">
              <div class="sig-box">
                <div class="sig-line">Visto do Motorista</div>
                <div style="font-size: 8px; color: #666; margin-top: 2px;">Declaro ter recebido a carga conferida</div>
              </div>
              <div class="sig-box">
                <div class="sig-line">Conferência / Portaria</div>
                <div style="font-size: 8px; color: #666; margin-top: 2px;">Liberação de Saída</div>
              </div>
            </div>

          </div>
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
      <DialogContent className="sm:max-w-[850px] max-h-[90vh] overflow-y-auto z-[9999]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Visualizar Romaneio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <Label>Responsável pela Expedição</Label>
                <Input
                  value={expedidor}
                  onChange={(e) => setExpedidor(e.target.value)}
                  placeholder="Nome do responsável..."
                />
             </div>
          </div>

          {/* Preview Visual na Tela */}
          <div className="border border-gray-300 bg-white p-6 shadow-sm min-h-[400px]" ref={printRef}>
            
            {/* Cabeçalho Preview */}
            <div className="flex justify-between border-b-2 border-black pb-4 mb-6">
                <div>
                    <h1 className="text-xl font-bold uppercase tracking-wider">Romaneio de Carga</h1>
                    <p className="text-xs text-gray-500">Logística & Distribuição</p>
                </div>
                <div className="text-right">
                    <div className="text-sm font-bold">{today}</div>
                    <div className="text-xs text-gray-500">Emissão Digital</div>
                </div>
            </div>

            {/* Grid Preview */}
            <div className="grid grid-cols-4 gap-4 mb-6 text-sm border p-4 bg-gray-50">
                <div>
                    <span className="block text-xs font-bold text-gray-500 uppercase">Motorista</span>
                    <span className="font-semibold truncate block">{motoristaData?.nome || '-'}</span>
                </div>
                <div>
                    <span className="block text-xs font-bold text-gray-500 uppercase">Veículo</span>
                    <span className="font-semibold truncate block">{veiculoData?.descricao || '-'}</span>
                </div>
                <div>
                    <span className="block text-xs font-bold text-gray-500 uppercase">Volumes Total</span>
                    <span className="font-bold text-lg">{totalVolumesGeral}</span>
                </div>
                <div>
                    <span className="block text-xs font-bold text-gray-500 uppercase">Saída</span>
                    <span className="font-semibold">{route?.[0]?.estimated_arrival || '-'}</span>
                </div>
            </div>

            {/* Tabela Preview */}
            <div className="border border-gray-300">
                <div className="grid grid-cols-12 bg-gray-100 border-b border-gray-300 p-2 text-xs font-bold uppercase">
                    <div className="col-span-1 text-center">#</div>
                    <div className="col-span-5">Cliente</div>
                    <div className="col-span-2 text-center">Vol.</div>
                    <div className="col-span-2 text-center">Horário</div>
                    <div className="col-span-2">NFs</div>
                </div>
                {route?.filter((_, index) => index !== 0 && index !== route.length - 1).map((point, index) => {
                    const clientNotas = notasFiscais?.[point.client_name] || [];
                    const volCliente = clientNotas.reduce((acc, n) => acc + (Number(n.volume) || 0), 0);
                    
                    return (
                    <div key={index} className="grid grid-cols-12 border-b border-gray-200 p-2 text-xs items-center hover:bg-gray-50">
                        <div className="col-span-1 text-center font-bold">{index + 1}</div>
                        <div className="col-span-5 pr-2">
                            <div className="font-bold text-gray-800 truncate">{point.client_name}</div>
                            <div className="text-gray-500 text-[10px] truncate">{point.address}</div>
                        </div>
                        <div className="col-span-2 text-center font-bold bg-gray-50 rounded mx-2 py-1">
                            {volCliente > 0 ? volCliente : '-'}
                        </div>
                        <div className="col-span-2 text-center">{point.estimated_arrival}</div>
                        <div className="col-span-2 text-[10px] text-gray-600 truncate">
                             {clientNotas.length > 0 ? clientNotas.map(n => n.numero).join(', ') : '-'}
                        </div>
                    </div>
                )})}
            </div>

            {/* Footer Preview */}
            <div className="mt-8 p-4 border border-black bg-gray-50 flex justify-between text-xs font-bold items-center">
                 <div>Total Km: {stats?.distance?.toFixed(1)}</div>
                 <div className="text-sm border px-4 py-1 bg-white">TOTAL VOLUMES: {totalVolumesGeral}</div>
                 <div>Assinatura: ___________________</div>
            </div>

          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
            <Button onClick={handlePrint} className="bg-black hover:bg-gray-800 text-white">
              <Printer className="w-4 h-4 mr-2" />
              Imprimir Romaneio
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}