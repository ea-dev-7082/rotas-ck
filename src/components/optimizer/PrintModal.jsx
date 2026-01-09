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
import { Printer, FileText, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

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
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    setExpedidor(responsavelExpedicao || "");
    setIsSaved(false);
    setIsSaving(false);
    setSaveError(null);
  }, [responsavelExpedicao, open]);

  // --- FUNÇÕES DE APOIO E CÁLCULOS ---
  
  const formatDuration = (minutes) => {
    if (!minutes) return "0min";
    const val = Number(minutes);
    const h = Math.floor(val / 60);
    const m = Math.round(val % 60);
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
  const distanciaTotal = stats?.distance ? Number(stats.distance).toFixed(1) : "0.0";
  const saida = route?.[0]?.estimated_arrival || '-';
  const today = new Date().toLocaleDateString('pt-BR');

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
            
            /* Layout Principal */
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
            .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; border: 1px solid #ccc; padding: 10px; background: #f9f9f9; margin-bottom: 15px; }
            
            /* Fontes */
            .label-small { font-size: 8px; font-weight: bold; color: #666; text-transform: uppercase; display: block; }
            .label-large { font-size: 12px; font-weight: bold; }
            
            /* Tabela e Conteúdo Central */
            /* AQUI ESTÁ O TRUQUE: min-height 50vh (metade da página) */
            .content-wrapper {
                min-height: 50vh; 
                display: flex;
                flex-direction: column;
            }
            
            table { width: 100%; border-collapse: collapse; flex-grow: 1; }
            th, td { border: 1px solid #000; padding: 6px; text-align: left; }
            th { background: #f0f0f0; font-size: 10px; }
            
            /* Barra de Resumo */
            .summary-bar-bottom { 
              display: flex; 
              justify-content: space-between; 
              align-items: center; 
              background-color: #f8f9fa; 
              border: 1px solid #000;
              padding: 8px 15px; 
              margin-top: 15px;
              font-size: 11px;
              font-weight: bold;
            }
            .summary-left { display: flex; align-items: center; }
            .sep { margin: 0 10px; color: #999; font-weight: normal; }
            .volta-text { color: #000080; }
            .total-box-bottom { 
              background: white; 
              border: 1px solid #ccc; 
              padding: 5px 10px; 
              font-weight: bold; 
              text-transform: uppercase;
            }

            /* Assinaturas */
            .signatures-container {
                display: flex;
                justify-content: space-between;
                margin-top: 50px; /* Mais espaço antes da assinatura */
                padding: 0 20px;
                break-inside: avoid; /* Evita quebra de página no meio da assinatura */
            }
            .signature-box { width: 40%; text-align: center; }
            .signature-line { border-top: 1px solid #000; margin-bottom: 5px; }
            .signature-text { font-size: 10px; font-weight: bold; text-transform: uppercase; }
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
              <span>Emissão: ${today}</span>
            </div>
          </div>

          <div class="info-grid">
            <div><span class="label-small">Motorista</span><span class="label-large">${motoristaData?.nome || '-'}</span></div>
            <div><span class="label-small">Veículo</span><span class="label-large">${veiculoData?.descricao || '-'}</span></div>
            <div><span class="label-small">Vol. Total</span><span class="label-large">${totalVolumesGeral}</span></div>
            <div><span class="label-small">Saída</span><span class="label-large">${saida}</span></div>
          </div>

          <div class="content-wrapper">
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
          </div>

          <div class="summary-bar-bottom">
            <div class="summary-left">
              <span>Distância: ${distanciaTotal} km</span>
              <span class="sep">|</span>
              <span>Tempo: ${tempoTotal}</span>
              <span class="sep">|</span>
              <span class="volta-text">Volta: ${previsaoVolta}</span>
            </div>
            <div class="total-box-bottom">
              TOTAL VOLUMES: ${totalVolumesGeral}
            </div>
          </div>

          <div class="signatures-container">
            <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-text">ASSINATURA MOTORISTA</div>
            </div>
            <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-text">CONFERÊNCIA EXPEDIÇÃO</div>
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

          {/* --- PREVIEW VISUAL NA TELA --- */}
          <div className="border border-gray-300 bg-white p-6 shadow-sm">
            {/* ... Cabeçalho do Preview ... */}
            <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
                <div>
                    <h1 className="text-lg font-bold uppercase leading-none">{nomeEmpresa || 'NOME DA EMPRESA'}</h1>
                    <p className="text-[10px] font-bold uppercase text-gray-600">Logística & Distribuição</p>
                </div>
                <div className="text-right">
                    <div className="text-lg font-bold">ROMANEIO DE CARGA</div>
                    <div className="text-sm">{today}</div>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6 text-sm border border-gray-200 p-4 bg-gray-50">
                <div><span className="block text-[10px] font-bold text-gray-500 uppercase">Motorista</span><span className="text-base font-bold">{motoristaData?.nome || '-'}</span></div>
                <div><span className="block text-[10px] font-bold text-gray-500 uppercase">Veículo</span><span className="text-base font-bold">{veiculoData?.descricao || '-'}</span></div>
                <div><span className="block text-[10px] font-bold text-gray-500 uppercase">Vol. Total</span><span className="text-base font-bold">{totalVolumesGeral}</span></div>
                <div><span className="block text-[10px] font-bold text-gray-500 uppercase">Saída</span><span className="text-base font-bold">{saida}</span></div>
            </div>

            {/* Container com altura mínima também no preview */}
            <div className="border border-gray-300 mb-4 min-h-[300px] flex flex-col">
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

            <div className="flex items-center justify-between border border-gray-200 bg-[#f8f9fa] p-3 rounded-sm">
              <div className="flex items-center gap-4 text-xs font-bold text-gray-800">
                <span>Distância: {distanciaTotal} km</span>
                <span className="text-gray-300 font-light text-sm">|</span>
                <span>Tempo: {tempoTotal}</span>
                <span className="text-gray-300 font-light text-sm">|</span>
                <span className="text-[#000080]">Volta: {previsaoVolta}</span>
              </div>
              <div className="bg-white border border-gray-100 px-4 py-1.5 shadow-sm">
                <span className="text-xs font-bold text-black uppercase">
                  TOTAL VOLUMES: {totalVolumesGeral}
                </span>
              </div>
            </div>

            <div className="flex justify-between mt-12 px-4 gap-8">
                <div className="flex-1 flex flex-col items-center">
                    <div className="w-full border-t border-black mb-2"></div>
                    <span className="text-[10px] font-bold uppercase text-black">ASSINATURA MOTORISTA</span>
                </div>
                <div className="flex-1 flex flex-col items-center">
                    <div className="w-full border-t border-black mb-2"></div>
                    <span className="text-[10px] font-bold uppercase text-black">CONFERÊNCIA EXPEDIÇÃO</span>
                </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
            
            <Button 
              variant="outline"
              disabled={isSaving}
              onClick={async () => {
                if (onSaveRelatorio) {
                  setIsSaving(true);
                  setSaveError(null);
                  
                  const durationValue = stats?.duration ? Number(stats.duration) : 0;
                  const distanceValue = stats?.distance ? Number(stats.distance) : 0;
                  
                  const dadosCompletos = {
                    data_impressao: new Date().toISOString(),
                    motorista_nome: motoristaData?.nome || "Não informado",
                    veiculo_descricao: veiculoData?.descricao || "Não informado",
                    veiculo_placa: veiculoData?.placa || "", 
                    total_entregas: route ? route.length - 2 : 0, 
                    distancia_km: distanceValue,
                    tempo_minutos: durationValue, 
                    responsavel_expedicao: expedidor,
                    endereco_matriz: route?.[0]?.address || "Matriz",
                    rota: route,
                    total_volumes: totalVolumesGeral
                  };

                  try {
                    await onSaveRelatorio(dadosCompletos);
                    setIsSaved(true);
                    setTimeout(() => setIsSaved(false), 3000);
                  } catch (error) {
                    console.error("Erro ao salvar relatório:", error);
                    setSaveError("Falha ao salvar. Tente novamente.");
                    setTimeout(() => setSaveError(null), 5000);
                  } finally {
                    setIsSaving(false);
                  }
                }
              }}
              className={`transition-all ${
                saveError ? "bg-red-50 border-red-500 text-red-600" :
                isSaved ? "bg-green-50 border-green-500 text-green-600" : 
                "border-green-500 text-green-600 hover:bg-green-50"
              }`}
            >
              {isSaving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
              ) : saveError ? (
                <><AlertCircle className="w-4 h-4 mr-2" /> {saveError}</>
              ) : isSaved ? (
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