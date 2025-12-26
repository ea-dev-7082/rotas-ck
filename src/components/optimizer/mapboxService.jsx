// --- CONFIGURAÇÕES E CONSTANTES ---
export const TIME_CONFIG = {
  TRAFFIC_BUFFER: 1.20,  // Reduzido para 20% (mais realista com driving-traffic ativado)
  SERVICE_TIME: 20,      // Minutos por parada
  MAPBOX_PROFILE: "mapbox/driving-traffic" 
};

// --- LIMPEZA DE ENDEREÇO ---
function sanitizeAddress(address) {
  if (!address) return "";
  return address.toString().replace(/[\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
}

// --- GEOCODIFICAÇÃO AVANÇADA ---
export async function geocodeAddress(address, mapboxToken, proximityCoords = null) {
  const cleanAddress = sanitizeAddress(address);
  
  // Adicionamos 'types=address' para evitar que retorne bairros ou cidades
  // Adicionamos 'proximity' para priorizar resultados perto da base (Matriz)
  let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(cleanAddress + ", Rio de Janeiro, RJ")}.json?access_token=${mapboxToken}&country=BR&types=address&limit=1`;
  
  if (proximityCoords) {
    url += `&proximity=${proximityCoords.longitude},${proximityCoords.latitude}`;
  }

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      return { 
        latitude: Number(lat), 
        longitude: Number(lng), 
        place_name: data.features[0].place_name,
        relevance: data.features[0].relevance // Indica a confiança do resultado
      };
    }
  } catch (err) {
    console.error("Erro Geocoding:", err);
  }
  return null;
}

// --- OTIMIZAÇÃO DE ROTA COM PRECISÃO DE MEIO-FIO ---
export async function optimizeRoute(coordinates, mapboxToken) {
  const validCoords = coordinates.filter(c => c.latitude && c.longitude);
  if (validCoords.length < 2) return { trips: [], waypoints: [] };

  const coordsString = validCoords.map(c => `${c.longitude},${c.latitude}`).join(';');
  
  // 'approaches=curb': Força o Mapbox a chegar pelo lado da calçada onde o endereço está.
  // Isso evita que o motorista tenha que "atravessar a rua" em vias duplicadas.
  const approaches = validCoords.map(() => "curb").join(';');
  
  const url = `https://api.mapbox.com/optimized-trips/v1/${TIME_CONFIG.MAPBOX_PROFILE}/${coordsString}?access_token=${mapboxToken}&roundtrip=true&source=first&destination=last&geometries=geojson&overview=full&steps=true&approaches=${approaches}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.code !== 'Ok') throw new Error(`Erro Mapbox: ${data.message}`);
  return data;
}

// --- PROCESSAMENTO COM LÓGICA DE CHEGADA/SAÍDA ---
export function processOptimizationResult(optimizationData, originalPoints, startTime) {
  if (!optimizationData.trips?.length) return { error: "Sem dados de rota" };

  const trip = optimizationData.trips[0];
  const waypoints = optimizationData.waypoints;
  const legs = trip.legs || [];
  const { TRAFFIC_BUFFER, SERVICE_TIME } = TIME_CONFIG;

  // Mapear waypoints para os dados originais
  const orderedPoints = waypoints
    .sort((a, b) => a.waypoint_index - b.waypoint_index)
    .map(wp => ({
      ...originalPoints[wp.location_index], // Usa location_index para mapear corretamente ao input
      waypoint_index: wp.waypoint_index
    }));

  let currentTime = parseTime(startTime);
  const routeWithTimes = [];

  orderedPoints.forEach((point, index) => {
    const isFirst = index === 0;
    const isLast = index === orderedPoints.length - 1;
    
    let travelTime = 0;
    if (!isFirst) {
      const legDuration = legs[index - 1]?.duration || 0;
      travelTime = Math.round((legDuration * TRAFFIC_BUFFER) / 60);
      currentTime += travelTime;
    }

    const arrivalTime = formatTime(currentTime);
    
    // Se não for o ponto de retorno (Matriz final), adiciona tempo de serviço
    if (!isLast || (isLast && index === 0)) {
        // Registra o ponto
        routeWithTimes.push({
          order: index + 1,
          client_name: point.nome,
          address: point.endereco,
          arrival: arrivalTime,
          travel_min: travelTime,
          service_min: isFirst ? 0 : SERVICE_TIME
        });
        if (!isFirst) currentTime += SERVICE_TIME;
    } else {
        // É o retorno à matriz
        routeWithTimes.push({
          order: index + 1,
          client_name: "RETORNO: " + point.nome,
          address: point.endereco,
          arrival: arrivalTime,
          travel_min: travelTime,
          service_min: 0
        });
    }
  });

  return {
    optimized_route: routeWithTimes,
    total_distance_km: (trip.distance / 1000).toFixed(2),
    total_time_total: Math.round(currentTime - parseTime(startTime)),
    geometry: trip.geometry
  };
}

// Funções auxiliares mantidas para consistência
function parseTime(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function formatTime(t) { 
  const h = Math.floor(t / 60) % 24; 
  const m = Math.round(t % 60); 
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`; 
}