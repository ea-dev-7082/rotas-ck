import { getDirections, MAPBOX_TOKEN } from "@/components/optimizer/mapboxService";

/**
 * Recalcula os ETAs das paradas restantes após uma entrega ser concluída.
 * Usa a API Directions do Mapbox para obter tempos reais de trânsito.
 * 
 * @param {Array} rotaCompleta - Array completo da rota (incluindo matriz início/fim)
 * @param {number} deliveredOrder - O `order` da parada que acabou de ser entregue
 * @param {number} serviceTime - Tempo de parada por entrega (minutos)
 * @param {number} trafficBuffer - Margem de trânsito (percentual, ex: 10)
 * @param {string} mapboxToken - Token do Mapbox (opcional, usa fallback)
 * @returns {Array} Rota atualizada com novos estimated_arrival para paradas futuras
 */
export async function recalculateRemainingETAs(rotaCompleta, deliveredOrder, serviceTime = 20, trafficBuffer = 10, mapboxToken = null) {
  if (!rotaCompleta || rotaCompleta.length < 2) return rotaCompleta;

  const BUFFER = 1 + (trafficBuffer / 100);

  // Encontra o índice da parada entregue
  const deliveredIdx = rotaCompleta.findIndex((p) => p.order === deliveredOrder);
  if (deliveredIdx < 0) return rotaCompleta;

  // Pega paradas restantes (após a entregue) que ainda não foram entregues
  const remainingStops = rotaCompleta.slice(deliveredIdx + 1);
  const pendingStops = remainingStops.filter(
    (p) => p.status !== "delivered" && p.status !== "problem"
  );

  // Se não há paradas pendentes, retorna sem mudanças
  if (pendingStops.length === 0) return rotaCompleta;

  // Monta coordenadas para Directions: ponto atual (entregue) + pendentes
  const deliveredStop = rotaCompleta[deliveredIdx];
  const coordsForDirections = [deliveredStop, ...pendingStops].filter(
    (p) => p.latitude && p.longitude
  );

  if (coordsForDirections.length < 2) return rotaCompleta;

  // Hora atual como base do recálculo
  const now = new Date();
  let currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

  // Adiciona o tempo de permanência na parada atual (motorista ainda está lá)
  // Não adicionamos service time aqui porque a entrega já foi feita

  // Chama Mapbox Directions API
  const token = mapboxToken || MAPBOX_TOKEN;
  const directionsResult = await getDirections(coordsForDirections, token);
  const route = directionsResult.routes?.[0];

  if (!route || !route.legs) return rotaCompleta;

  // Mapeia os novos ETAs
  const newETAs = new Map();

  route.legs.forEach((leg, idx) => {
    const travelMinutes = Math.round((leg.duration * BUFFER) / 60);
    currentTimeMinutes += travelMinutes;
    
    const targetStop = pendingStops[idx];
    if (targetStop) {
      const hours = Math.floor(currentTimeMinutes / 60) % 24;
      const minutes = Math.round(currentTimeMinutes % 60);
      const etaStr = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
      newETAs.set(targetStop.order, etaStr);
      
      // Adiciona service time para próxima parada (exceto se é a matriz de retorno = último item)
      if (idx < pendingStops.length - 1) {
        currentTimeMinutes += serviceTime;
      }
    }
  });

  // Atualiza a rota com novos ETAs
  return rotaCompleta.map((stop) => {
    if (newETAs.has(stop.order)) {
      return { ...stop, estimated_arrival: newETAs.get(stop.order) };
    }
    return stop;
  });
}