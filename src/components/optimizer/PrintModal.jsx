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

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    
    // Gerar linhas da tabela para a impressão
    const tableRows = route?.filter((_, index) => index !== 0 && index !== route.length - 1).map((point, index) => {
        const clientNotas = notasFiscais?.[point.client_name] || [];
        
        // Formata os números das NFs com quebra de linha se houver muitas
        const notasString = clientNotas.map(n => n.numero).join('<br/>');
        
        // Formata as datas das NFs
        const datasString = clientNotas.map(n => 
            n.data ? new Date(n.data).toLocaleDateString('pt-BR') : '-'
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
            th { border: 1px solid #000; background-color: #eee; padding: 6px; text-align: center; text-transform: uppercase; font-size: 9px; }
            /* Alinhamento específico para a coluna de cliente */
            th:nth-child(2) { text-align: left; } 
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
                  <th style="width: 30px;">#</th>
                  <th>Destinatário / Endereço</th>
                  <th style="width: 60px;">Chegada</th>
                  <th style="width: 40px;">Vol.</th>
                  <th style="width: 80px;">Nº Nota Fiscal</th>
                  <th style="width: 80px;">Data Nota</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>

            <div class="footer-stats">
               <span>Distância Total: ${stats?.distance?.toFixed(1) || 0} km</span>
               <span>Tempo Est.: ${stats?.time ? `${Math.floor(stats.time / 60)}h ${stats.time % 60}min` : '-'}</span>
               <span>TOTAL VOLUMES: ${totalVolumesG