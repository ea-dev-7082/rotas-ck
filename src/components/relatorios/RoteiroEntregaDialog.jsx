import React, { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import RoteiroEntregaGrid from "./RoteiroEntregaGrid";

export default function RoteiroEntregaDialog({ open, onClose, relatorios }) {
  const printRef = useRef(null);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Roteiro de Entrega</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 16px; background: white; }
          .roteiro-title {
            background: #FFE600;
            font-size: 28px;
            font-weight: bold;
            padding: 8px 20px;
            display: inline-block;
            margin-bottom: 16px;
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
          .driver-row span {
            padding: 3px 8px;
          }
          .driver-row span:first-child {
            border-right: 1px solid #000;
            width: 50%;
          }
          .driver-row span:last-child {
            width: 50%;
            text-align: right;
          }
          .table-header {
            display: flex;
            border-bottom: 1px solid #000;
            font-size: 11px;
            font-weight: bold;
            text-decoration: underline;
          }
          .table-header span {
            padding: 2px 8px;
          }
          .table-header span:first-child {
            width: 55%;
            text-align: center;
          }
          .table-header span:last-child {
            width: 45%;
            text-align: center;
          }
          .table-row {
            display: flex;
            font-size: 11px;
            border-bottom: 1px solid #eee;
          }
          .table-row span {
            padding: 2px 8px;
          }
          .table-row span:first-child {
            width: 55%;
            text-align: center;
          }
          .table-row span:last-child {
            width: 45%;
            text-align: center;
          }
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

        <div ref={printRef}>
          <RoteiroEntregaGrid relatorios={relatorios} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={handlePrint} className="bg-green-600 hover:bg-green-700 text-white">
            <Printer className="w-4 h-4 mr-2" />
            Imprimir Roteiro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}