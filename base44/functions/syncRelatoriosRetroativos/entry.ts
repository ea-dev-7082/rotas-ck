import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/* global Deno */

const BATCH_SIZE = 50;

/**
 * Busca TODOS os registros paginando em batches.
 */
async function fetchAll(entity, sortField = "-created_date") {
  let allData = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const batch = await entity.list(sortField, BATCH_SIZE, offset);
    if (batch && batch.length > 0) {
      allData = [...allData, ...batch];
      offset += batch.length;
      hasMore = batch.length === BATCH_SIZE;
    } else {
      hasMore = false;
    }
  }

  return allData;
}

/**
 * Busca TODOS os registros com filtro, paginando em batches.
 */
async function fetchAllFiltered(entity, filter, sortField = "-created_date") {
  let allData = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const batch = await entity.filter(filter, sortField, BATCH_SIZE, offset);
    if (batch && batch.length > 0) {
      allData = [...allData, ...batch];
      offset += batch.length;
      hasMore = batch.length === BATCH_SIZE;
    } else {
      hasMore = false;
    }
  }

  return allData;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ========== BUSCA COMPLETA COM PAGINAÇÃO ==========
    const [relatorios, rotas] = await Promise.all([
      fetchAll(base44.entities.Relatorio, "-created_date"),
      fetchAll(base44.entities.RotaAgendada, "-created_date"),
    ]);

    const rotaPorId = new Map(rotas.map((rota) => [rota.id, rota]));
    let atualizados = 0;
    let erros = 0;

    for (const relatorio of relatorios) {
      const rotaAgendadaId = relatorio.rota_agendada_id;
      if (!rotaAgendadaId) continue;

      const rota = rotaPorId.get(rotaAgendadaId);
      if (!rota || !Array.isArray(rota.rota) || !Array.isArray(relatorio.rota))
        continue;

      // Sincroniza por index (mantém lógica original)
      const rotaSincronizada = relatorio.rota.map((paradaRelatorio, index) => {
        const paradaRota = rota.rota[index];
        if (!paradaRota) return paradaRelatorio;

        return {
          ...paradaRelatorio,
          status: paradaRota.status ?? paradaRelatorio.status ?? null,
          deliveredAt: paradaRota.deliveredAt ?? paradaRelatorio.deliveredAt ?? null,
          receivedBy: paradaRota.receivedBy ?? paradaRelatorio.receivedBy ?? null,
          notes: paradaRota.notes ?? paradaRelatorio.notes ?? null,
          occurrenceType: paradaRota.occurrenceType ?? paradaRelatorio.occurrenceType ?? null,
          occurrenceDescription: paradaRota.occurrenceDescription ?? paradaRelatorio.occurrenceDescription ?? null,
          photoUrl: paradaRota.photoUrl ?? paradaRelatorio.photoUrl ?? null,
        };
      });

      const houveMudanca =
        JSON.stringify(rotaSincronizada) !== JSON.stringify(relatorio.rota) ||
        (rota.hora_retorno && rota.hora_retorno !== relatorio.hora_retorno);

      if (!houveMudanca) continue;

      try {
        await base44.entities.Relatorio.update(relatorio.id, {
          rota: rotaSincronizada,
          hora_retorno: rota.hora_retorno ?? relatorio.hora_retorno ?? null,
        });
        atualizados += 1;
      } catch (updateError) {
        console.error(
          `Erro ao atualizar relatório ${relatorio.id}:`,
          updateError.message
        );
        erros += 1;
      }
    }

    return Response.json({
      success: true,
      total_relatorios: relatorios.length,
      total_rotas: rotas.length,
      atualizados,
      erros,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
