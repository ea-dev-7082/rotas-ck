import React, { useState, useEffect } from "react";
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
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setExpedidor(responsavelExpedicao || "");
    setIsSaved(false);
  }, [responsavelExpedicao, open]);

  // --- FUNÇÕES DE APOIO ---
  
  const formatDuration = (minutes) => {
    if (!minutes) return "0min";
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  };

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
  const tempoTotal = formatDuration(stats?.duration);
  const distanciaTotal = stats?.distance?.toFixed(1) || "0.0";

  // --- FUNÇÃO DE IMPRESSÃO ---

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
                <div style="font-weight: bold;">${point.client_name}</div>
                <div style="font-size: 9px; color: #444;">${point.address}</div>
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
          <title>Romaneio de Carga</title>
          <style>
            @page { size: A4; margin: 10mm; }
            body { font-family: sans-serif; font-size: 11px; color: #000; margin: 0; padding: 0; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
            .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; border: 1px solid #ccc; padding: 10px; background: #f9f9f9; margin-bottom: 15px; }
            .label-small { font-size: 8px; font-weight: bold; color: #666; text-transform: uppercase; display: block; }
            
            /* BARRA DE RESUMO IGUAL A IMAGEM */
            .summary-bar { 
              display: flex; 
              justify-content: space-between; 
              align-items: center; 
              background-color: #f8f9fa; 
              border: 1px solid #ddd; 
              padding: 12px 20px; 
              margin-bottom: 15px;
            }
            .summary-left { display: flex; align-items: center; font-size: 13px; font-weight: bold; }
            .sep { margin: 0 15px; color: #ccc; font-weight: normal; }
            .volta-text { color: #000080; }
            .total-box { background: white; border: 1px solid #eee; padding: 6px 15px; font-weight: bold; font-size: 13px; }

            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #000; padding: 6px; text-align: left; }
            th { background: #f0f0f0; font-size: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 style="margin:0; font-size: 18px;">${nomeEmpresa || 'EMPRESA'}</h1>
              <span style="font-size: 10px; font-weight: bold;">LOGÍSTICA & DISTRIBUIÇÃO</span>
            </div>
            <div style="text-align: right;">
              <h2 style="margin:0; font-size: 16px;">ROMANEIO DE CARGA</h2>
              <span>Emissão: ${new Date().toLocaleDateString('pt-BR')}</span>
            </div>
          </div>

          <div class="info-grid">
            <div><span class="label-small">Motorista</span>${motoristaData?.nome || '-'}</div>
            <div><span class="label-small">Veículo</span>${veiculoData?.descricao || '-'}</div>
            <div><span class="label-small">Expedição</span>${expedidor || '-'}</div>
            <div><span class="label-small">Saída</span>${route?.[0]?.estimated_arrival || '-'}</div>
          </div>

          <div class="summary-bar">
            <div class="summary-left">
              <span>Distância: ${distanciaTotal} km</span>
              <span class="sep">|</span>
              <span>Tempo: ${tempoTotal}</span>
              <span class="sep">|</span>
              <span class="volta-text">Volta: ${previsaoVolta}</span>
            </div>
            <div class="total-box">
              TOTAL VOLUMES: ${totalVolumesGeral}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th>Destinatário</th>
                <th style="width: 60px; text-align: center;">Chegada</th>
                <th style="width: 40px; text-align: center;">Vol.</th>
                <th style="width: 80px; text-align: center;">NF</th>
                <th style="width: 80px; text-align: center;">Data NF</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

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

          {/* --- PREVIEW VISUAL NA TELA (ESTILO IMAGEM) --- */}
          <div className="border border-gray-300 bg-white p-6 shadow-sm">
            <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
                <div>
                    <h1 className="text-lg font-bold uppercase leading-none">{nomeEmpresa || 'NOME DA EMPRESA'}</h1>
                    <p className="text-[10px] font-bold uppercase text-gray-600">Logística & Distribuição</p>
                </div>
                <div className="text-right">
                    <div className="text-lg font-bold">ROMANEIO DE CARGA</div>
                    <div className="text-sm">{new Date().toLocaleDateString('pt-BR')}</div>
                </div>
            </div>

            {/* Barra de Resumo Idêntica à Foto */}
            <div className="flex items-center justify-between border border-gray-200 bg-[#f8f9fa] p-3 rounded-sm mb-4">
              <div className="flex items-center gap-4 text-sm font-bold text-gray-800">
                <span>Distância: {distanciaTotal} km</span>
                <span className="text-gray-300 font-light text-lg">|</span>
                <span>Tempo: {tempoTotal}</span>
                <span className="text-gray-300 font-light text-lg">|</span>
                <span className="text-[#000080]">Volta: {previsaoVolta}</span>
              </div>
              <div className="bg-white border border-gray-100 px-4 py-1.5 shadow-sm">
                <span className="text-sm font-bold text-black">
                  TOTAL VOLUMES: {totalVolumesGeral}
                </span>
              </div>
            </div>

            {/* Tabela de Destinos */}
            <div className="border border-gray-300">
                <div className="grid grid-cols-12 bg-gray-100 p-2 text-[10px] font-bold border-b uppercase">
                    <div className="col-span-1 text-center">#</div>
                    <div className="col-span-6">Destinatário</div>
                    <div className="col-span-1 text-center">Vol.</div>
                    <div className="col-span-2 text-center">NF</div>
                    <div className="col-span-2 text-center">Chegada</div>
                </div>
                {route?.filter((_, index) => index !== 0 && index !== route.length - 1).map((point, index) => {
                    const clientNotas = notasFiscais?.[point.client_name] || [];
                    const volCliente = clientNotas.reduce((acc, n) => acc + (Number(n.volume) || 0), 0);
                    return (
                    <div key={index} className="grid grid-cols-12 border-b p-2 text-xs items-center hover:bg-gray-50">
                        <div className="col-span-1 text-center font-bold text-gray-400">{index + 1}</div>
                        <div className="col-span-6">
                            <div className="font-bold text-gray-900">{point.client_name}</div>
                            <div className="text-gray-500 text-[9px] line-clamp-1">{point.address}</div>
                        </div>
                        <div className="col-span-1 text-center font-bold">{volCliente || '-'}</div>
                        <div className="col-span-2 text-center text-[10px] text-gray-600">
                          {clientNotas.map(n => n.numero).join(', ') || '-'}
                        </div>
                        <div className="col-span-2 text-center font-medium">{point.estimated_arrival}</div>
                    </div>
                )})}
            </div>
          </div>

          {/* BOTÕES DE AÇÃO */}
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
                    resumo: {
                      distancia: distanciaTotal,
                      tempo: tempoTotal,
                      volta: previsaoVolta,
                      volumes: totalVolumesGeral
                    }
                  });
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