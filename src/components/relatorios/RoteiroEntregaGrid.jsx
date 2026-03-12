import React from "react";

function getNotasText(item) {
  const notas = item.notas_fiscais || [];
  if (notas.length === 0) return "-";
  return notas.map(n => n.numero || "").filter(Boolean).join(" / ") || "-";
}

function RouteCard({ relatorio }) {
  const veiculo = relatorio.veiculo_descricao || "Veículo";
  const placa = relatorio.veiculo_placa || "";
  const motorista = relatorio.motorista_nome || "S/ Motorista";
  const entregas = (relatorio.rota || []).slice(1, -1);

  const headerLabel = placa ? `${veiculo} ${placa}`.toUpperCase() : veiculo.toUpperCase();

  return (
    <div className="border-2 border-black min-w-[260px] flex-1 break-inside-avoid">
      {/* Cabeçalho com veículo */}
      <div className="text-center border-b-2 border-black px-2 py-1 font-bold text-sm uppercase bg-white">
        {headerLabel}
      </div>

      {/* Motorista */}
      <div className="flex border-b border-black text-xs font-bold">
        <span className="border-r border-black w-1/2 px-2 py-1">MOTORISTA</span>
        <span className="w-1/2 px-2 py-1 text-right">{motorista.toUpperCase()}</span>
      </div>

      {/* Header tabela */}
      <div className="flex border-b border-black text-[11px] font-bold underline">
        <span className="w-[55%] px-2 py-0.5 text-center">CLIENTE</span>
        <span className="w-[45%] px-2 py-0.5 text-center">NF</span>
      </div>

      {/* Linhas de clientes */}
      {entregas.length === 0 ? (
        <div className="text-center text-xs text-gray-400 py-4">Sem entregas</div>
      ) : (
        entregas.map((item, idx) => (
          <div key={idx} className="flex text-[11px] border-b border-gray-200 last:border-b-0">
            <span className="w-[55%] px-2 py-0.5 text-center truncate">{item.client_name}</span>
            <span className="w-[45%] px-2 py-0.5 text-center truncate">{getNotasText(item)}</span>
          </div>
        ))
      )}
    </div>
  );
}

export default function RoteiroEntregaGrid({ relatorios }) {
  if (!relatorios || relatorios.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        Nenhum relatório para exibir no roteiro.
      </div>
    );
  }

  return (
    <div>
      <div className="roteiro-title bg-yellow-400 inline-block font-bold text-2xl px-5 py-2 mb-4">
        ROTEIRO DE ENTREGA
      </div>
      <div className="flex flex-wrap gap-4">
        {relatorios.map((relatorio) => (
          <RouteCard key={relatorio.id} relatorio={relatorio} />
        ))}
      </div>
    </div>
  );
}