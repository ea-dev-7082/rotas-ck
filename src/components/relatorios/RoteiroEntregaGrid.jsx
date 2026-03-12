import React from "react";

function getNotasText(item) {
  const notas = item.notas_fiscais || [];
  if (notas.length === 0) return "-";
  return notas.map(n => n.numero || "").filter(Boolean).join(" / ") || "-";
}

function RouteCard({ rota }) {
  const veiculo = rota.veiculo_descricao || "Veículo";
  const placa = rota.veiculo_placa || "";
  const motorista = rota.motorista_nome || "S/ Motorista";
  const entregas = (rota.rota || []).slice(1, -1);

  const headerLabel = placa ? `${veiculo} ${placa}`.toUpperCase() : veiculo.toUpperCase();

  return (
    <div className="border-2 border-black min-w-[260px] flex-1 break-inside-avoid" style={{maxWidth: "33%"}}>
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

export default function RoteiroEntregaGrid({ rotas, dateLabel }) {
  if (!rotas || rotas.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        Nenhuma rota agendada para este dia.
      </div>
    );
  }

  return (
    <div>
      <div className="roteiro-title bg-yellow-400 inline-block font-bold text-2xl px-5 py-2 mb-1">
        ROTEIRO DE ENTREGA
      </div>
      {dateLabel && (
        <div className="roteiro-date text-sm text-gray-600 mb-4">{dateLabel}</div>
      )}
      <div className="flex flex-wrap gap-4">
        {rotas.map((rota) => (
          <RouteCard key={rota.id} rota={rota} />
        ))}
      </div>
    </div>
  );
}