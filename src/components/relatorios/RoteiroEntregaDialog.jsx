import React, { useRef, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Printer, Download, Loader2 } from "lucide-react";
import moment from "moment";
import RoteiroEntregaGrid from "./RoteiroEntregaGrid";

function getNotasText(item) {
  const notas = item.notas_fiscais || [];
  if (notas.length === 0) return "";
  return notas.map(n => n.numero || "").filter(Boolean).join(" / ");
}

function exportToExcel(rotas, dateLabel) {
  const rows = [];
  rotas.forEach(rota => {
    const veiculo = rota.veiculo_descricao || "Veículo";
    const placa = rota.veiculo_placa || "";
    const motorista = rota.motorista_nome || "S/ Motorista";
    const entregas = (rota.rota || []).slice(1, -1);

    entregas.forEach((item, idx) => {
      rows.push({
        Veiculo: `${veiculo} ${placa}`.trim(),
        Motorista: motorista,
        Ordem: idx + 1,
        Cliente: item.client_name || "",
        NF: getNotasText(item),
        Endereco: item.address || "",
        Volumes: (item.notas_fiscais || []).reduce((acc, n) => acc + (Number(n.volume) || 0), 0)
      });
    });
  });

  if (rows.length === 0) return;

  // Build CSV (Excel compatible with UTF-8 BOM)
  const headers = ["Veiculo", "Motorista", "Ordem", "Cliente", "NF", "Endereco", "Volumes"];
  const csvContent = "\uFEFF" + [
    headers.join(";"),
    ...rows.map(r => headers.map(h => `"${String(r[h] || "").replace(/"/g, '""')}"`).join(";"))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `roteiro_entrega_${dateLabel}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function RoteiroEntregaDialog({ open, onClose, userEmail }) {
  const [selectedDate, setSelectedDate] = useState(moment().format("YYYY-MM-DD"));
  const printRef = useRef(null);

  const { data: rotasAgendadas, isLoading } = useQuery({
    queryKey: ["roteiro-dia", userEmail, selectedDate],
    queryFn: async () => {
      if (!userEmail) return [];
      const all = await base44.entities.RotaAgendada.filter(
        { owner: userEmail },
        "-created_date"
      );
      // Filter by selected date
      return all.filter(r => {
        const dataRota = moment(r.data_agendamento).format("YYYY-MM-DD");
        return dataRota === selectedDate;
      });
    },
    enabled: !!userEmail && open,
    initialData: []
  });

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Roteiro de Entrega - ${moment(selectedDate).format("DD/MM/YYYY")}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 16px; background: white; }
          .roteiro-title {
            background: #FFE600;
            font-size: 28px;
            font-weight: bold;
            padding: 8px 20px;
            display: inline-block;
            margin-bottom: 4px;
          }
          .roteiro-date {
            font-size: 14px;
            margin-bottom: 16px;
            color: #333;
          }
          .grid-container {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
          }
          .route-card {
            border: 2px solid #000;
            min-width: 280px;
            flex: 1 1 30%;
            max-width: 33%;
            page-break-inside: avoid;
          }
          .route-header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding: 4px 8px;
            font-weight: bold;
            font-size: 13px;
            text-transform: uppercase;
          }
          .driver-row {
            display: flex;
            border-bottom: 1px solid #000;
            font-size: 12px;
            font-weight: bold;
          }
          .driver-row span { padding: 3px 8px; }
          .driver-row span:first-child { border-right: 1px solid #000; width: 50%; }
          .driver-row span:last-child { width: 50%; text-align: right; }
          .table-header {
            display: flex;
            border-bottom: 1px solid #000;
            font-size: 11px;
            font-weight: bold;
            text-decoration: underline;
          }
          .table-header span { padding: 2px 8px; }
          .table-header span:first-child { width: 55%; text-align: center; }
          .table-header span:last-child { width: 45%; text-align: center; }
          .table-row {
            display: flex;
            font-size: 11px;
            border-bottom: 1px solid #eee;
          }
          .table-row span { padding: 2px 8px; }
          .table-row span:first-child { width: 55%; text-align: center; }
          .table-row span:last-child { width: 45%; text-align: center; }
          @media print {
            body { padding: 8px; }
            .route-card { max-width: 32%; }
          }
        </style>
      </head>
      <body>
        ${content.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Roteiro de Entrega</DialogTitle>
        </DialogHeader>

        {/* Seletor de data */}
        <div className="flex items-center gap-3 mb-2">
          <label className="text-sm font-medium text-gray-700">Data:</label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-[180px] h-9"
          />
          <span className="text-sm text-gray-500">
            {moment(selectedDate).format("dddd, DD/MM/YYYY")}
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Carregando rotas...</span>
          </div>
        ) : (
          <div ref={printRef}>
            <RoteiroEntregaGrid rotas={rotasAgendadas} dateLabel={moment(selectedDate).format("DD/MM/YYYY")} />
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button
            onClick={() => exportToExcel(rotasAgendadas || [], moment(selectedDate).format("DD-MM-YYYY"))}
            disabled={!rotasAgendadas || rotasAgendadas.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
          <Button
            onClick={handlePrint}
            disabled={!rotasAgendadas || rotasAgendadas.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}