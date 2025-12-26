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
import { Printer, FileText, CheckCircle2 } from "lucide-react";

export default function PrintModal({ 
  open, 
  onClose, 
  route, 
  stats, 
  pontoPartida, 
  notasFiscais, 
  responsavelExpedicao, 
  veiculoData, 
  motoristaData, 
  onSaveRelatorio, 
  nomeEmpresa 
}) {
  const [expedidor, setExpedidor] = useState(responsavelExpedicao || "");
  const [isSaved, setIsSaved] = useState(false); // Estado para feedback visual
  const printRef = useRef();

  React.useEffect(() => {
    setExpedidor(responsavelExpedicao || "");
    setIsSaved(false); // Reseta o status de salvo ao abrir/mudar dados
  }, [responsavelExpedicao, open]);

  const calcularVolumeTotal = () => {
    if (!route || !notasFiscais) return 0;
    let total = 0;
    route.forEach(point => {
        const notas = notasFiscais[point.client_name] || [];
        notas.forEach(nota => {
            total += Number(nota.volume) || 0;
        });
    });
    return total;
  };

  const totalVolumesGeral = calcularVolumeTotal();
  const previsaoVolta = route && route.length > 0 ? route[route.length - 1].estimated_arrival : '-';

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    
    const tableRows = route?.filter((_, index) => index !== 0 && index !== route.length - 1).map((point, index) => {
        const clientNotas = notasFiscais?.[point.client_name] || [];
        const notasString = clientNotas.map(n => n.numero).join('<br/>');
        const datasString = clientNotas.map(n => 
            n.data ? new Date(n.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'
        ).join('<br/>');
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
            <td style="text-align: center;">${notasString || '-'}</td>
            <td style="text-align: center;">${datasString || '-'}</td>
          </tr>
        `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Romaneio de Transporte</title>
          <style>
            @page { size: A4; margin: 10mm; }
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #000; }
            .container { width: 100%; }
            .header-box { border: 1px solid #000; padding: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-start; }
            .company-info h1 { font-size: 16px; text-transform: uppercase; margin: 0; }
            .doc-title { font-size: 14px; font-weight: bold; border: 1px solid #000; padding: 5px 10px; background: #eee; }
            .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; border: 1px solid #000; padding: 10px; }
            .label { font-size: 9px; font-weight: bold; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #000; padding: 6px; }
            th { background: #eee; }
            .footer-stats { border: 1px solid #000; padding: 10px; display: flex; justify-content: space-around; font-weight: bold; }
            .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
            .sig-line { border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header-box">
              <div class="company-info">
                <h1>${nomeEmpresa || 'Empresa'}</h1>
                <p>Logística & Distribuição</p>
              </div>
              <div class="doc-info">
                <div class="doc-title">ROMANEIO DE CARGA</div>
                <p>Emissão: ${new Date().toLocaleString('pt-BR')}</p>
              </div>
            </div>
            <div class="info-grid">
               <div><span class="label">Motorista</span><br/>${motoristaData?.nome || '-'}</div>
               <div><span class="label">Veículo</span><br/>${veiculoData?.descricao || '-'}</div>
               <div><span class="label">Expedição</span><br/>${expedidor || '-'}</div>
               <div><span class="label">Saída</span><br/>${route?.[0]?.estimated_arrival || '-'}</div>
            </div>
            <table>
              <thead>
                <tr><th>#</th><th>Destinatário</th><th>Chegada</th><th>Vol.</th><th>NF</th><th>Data NF</th></tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
            <div class="footer-stats">
               <span>Distância: ${stats?.distance?.toFixed(1)} km</span>
               <span>Volta: ${previsaoVolta}</span>
               <span>TOTAL VOLUMES: ${totalVolumesGeral}</span>
            </div>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
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
          <div className="border border-gray-300 bg-white p-6 shadow-sm min-h-[400px]">
            <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
                <div>
                    <h1 className="text-lg font-bold uppercase leading-none">{nomeEmpresa || 'NOME DA EMPRESA'}</h1>
                    <p className="text-xs font-bold uppercase text-black">Logística & Distribuição</p>
                </div>
                <div className="text-right">
                    <div className="text-lg font-bold">ROMANEIO DE CARGA</div>
                    <div className="text-sm font-bold">{today}</div>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6 text-sm border p-4 bg-gray-50">
                <div><span className="block text-xs font-bold text-gray-400">Motorista</span>{motoristaData?.nome || '-'}</div>
                <div><span className="block text-xs font-bold text-gray-400">Veículo</span>{veiculoData?.descricao || '-'}</div>
                <div><span className="block text-xs font-bold text-gray-400">Vol. Total</span><span className="font-bold">{totalVolumesGeral}</span></div>
                <div><span className="block text-xs font-bold text-gray-400">Saída</span>{route?.[0]?.estimated_arrival || '-'}</div>
            </div>

            <div className="border border-gray-300">
                <div className="grid grid-cols-12 bg-gray-100 p-2 text-xs font-bold border-b">
                    <div className="col-span-1 text-center">#</div>
                    <div className="col-span-6">Cliente</div>
                    <div className="col-span-1 text-center">Vol.</div>
                    <div className="col-span-2 text-center">NF</div>
                    <div className="col-span-2 text-center">Chegada</div>
                </div>
                {route?.filter((_, index) => index !== 0 && index !== route.length - 1).map((point, index) => {
                    const clientNotas = notasFiscais?.[point.client_name] || [];
                    const volCliente = clientNotas.reduce((acc, n) => acc + (Number(n.volume) || 0), 0);
                    return (
                    <div key={index} className="grid grid-cols-12 border-b p-2 text-xs items-center">
                        <div className="col-span-1 text-center font-bold">{index + 1}</div>
                        <div className="col-span-6">
                            <div className="font-bold">{point.client_name}</div>
                            <div className="text-gray-500 text-[10px]">{point.address}</div>
                        </div>
                        <div className="col-span-1 text-center font-bold">{volCliente || '-'}</div>
                        <div className="col-span-2 text-center text-[10px]">{clientNotas.map(n => n.numero).join(', ') || '-'}</div>
                        <div className="col-span-2 text-center">{point.estimated_arrival}</div>
                    </div>
                )})}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
            
            <Button 
              variant="outline"
              onClick={() => {
                if (onSaveRelatorio) {
                  onSaveRelatorio({
                    data_impressao: new Date().toISOString(),
                    motorista_nome: motoristaData?.nome || null,
                    veiculo_descricao: veiculoData?.descricao || null,
                    veiculo_placa: veiculoData?.placa || null,
                    rota: route || [],
                    notas_fiscais: notasFiscais || {},
                    responsavel_expedicao: expedidor || null,
                  });
                  // Feedback visual
                  setIsSaved(true);
                  setTimeout(() => setIsSaved(false), 3000); 
                }
              }}
              className={`transition-all ${isSaved ? "bg-green-50 border-green-500 text-green-600" : "border-green-500 text-green-600 hover:bg-green-50"}`}
            >
              {isSaved ? (
                <><CheckCircle2 className="w-4 h-4 mr-2" /> Salvo!</>
              ) : (
                <><FileText className="w-4 h-4 mr-2" /> Salvar Relatório</>
              )}
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