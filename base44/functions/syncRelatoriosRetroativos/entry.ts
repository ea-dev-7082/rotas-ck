import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/* global Deno */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const relatorios = await base44.entities.Relatorio.list('-created_date', 200);
    const rotas = await base44.entities.RotaAgendada.list('-created_date', 200);

    const rotaPorId = new Map(rotas.map((rota) => [rota.id, rota]));
    let atualizados = 0;

    for (const relatorio of relatorios) {
      const rotaAgendadaId = relatorio.rota_agendada_id;
      if (!rotaAgendadaId) continue;

      const rota = rotaPorId.get(rotaAgendadaId);
      if (!rota || !Array.isArray(rota.rota) || !Array.isArray(relatorio.rota)) continue;

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
        };
      });

      const houveMudanca = JSON.stringify(rotaSincronizada) !== JSON.stringify(relatorio.rota)
        || (rota.hora_retorno && rota.hora_retorno !== relatorio.hora_retorno);

      if (!houveMudanca) continue;

      await base44.entities.Relatorio.update(relatorio.id, {
        rota: rotaSincronizada,
        hora_retorno: rota.hora_retorno ?? relatorio.hora_retorno ?? null,
      });

      atualizados += 1;
    }

    return Response.json({ success: true, atualizados });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});