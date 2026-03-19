// --- FUNÇÃO DE LIMPEZA DE ENDEREÇO ---
// Remove quebras de linha, caracteres especiais inúteis e espaços extras
function sanitizeAddress(address) {
  if (!address) return "";
  return address
    .toString()
    .replace(/[\n\r\t]/g, " ") // Remove quebras de linha
    .replace(/\s+/g, " ")      // Remove espaços duplos
    .trim();                   // Remove espaços nas pontas
}

// Geocodificar um endereço para obter coordenadas
export async function geocodeAddress(address, mapboxToken) {
  // 1. Limpa o endereço antes de enviar
  const cleanAddress = sanitizeAddress(address);
  
  // 2. Adiciona contexto (Rio de Janeiro, Brasil) para melhorar precisão
  const query = encodeURIComponent(cleanAddress + ", Rio de Janeiro, Brazil");
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${mapboxToken}&country=BR&limit=1`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Erro na API Mapbox");
    
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      return { latitude: Number(lat), longitude: Number(lng), place_name: data.features[0].place_name };
    }
    
    console.warn(`Geocodificação exata falhou para: ${cleanAddress}. Tentando busca genérica...`);
    
    const streetOnly = cleanAddress.split(",")[0]; 
    if (streetOnly && streetOnly !== cleanAddress) {
        const queryGeneric = encodeURIComponent(streetOnly + ", Rio de Janeiro, Brazil");
        const urlGeneric = `https://api.mapbox.com/geocoding/v5/mapbox.places/${queryGeneric}.json?access_token=${mapboxToken}&country=BR&limit=1`;
        
        const responseGen = await fetch(urlGeneric);
        const dataGen = await responseGen.json();
        
        if (dataGen.features && dataGen.features.length > 0) {
            const [lng, lat] = dataGen.features[0].center;
            return { latitude: Number(lat), longitude: Number(lng), place_name: dataGen.features[0].place_name };
        }
    }

  } catch (err) {
    console.error("Erro Mapbox Fetch:", err);
  }

  return null;
}

// Geocodificar múltiplos endereços
export async function geocodeMultiple(addresses, mapboxToken) {
  const results = await Promise.all(
    addresses.map(async (item) => {
      try {
        if (item.latitude && item.longitude && !isNaN(Number(item.latitude))) {
            return { 
                ...item, 
                latitude: Number(item.latitude), 
                longitude: Number(item.longitude) 
            };
        }

        const coords = await geocodeAddress(item.endereco, mapboxToken);
        
        if (!coords) {
            console.error(`❌ FALHA FATAL: Não foi possível localizar: ${item.nome}`);
            return { ...item, latitude: null, longitude: null };
        }

        return { ...item, ...coords };
      } catch (error) {
        console.error(`Erro ao processar ${item.nome}:`, error);
        return { ...item, latitude: null, longitude: null };
      }
    })
  );
  return results;
}

// Distância Haversine entre dois pontos (km)
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Ordena pontos pelo vizinho mais próximo (nearest-neighbor) a partir de um ponto inicial
function nearestNeighborSort(points, origin) {
  const sorted = [];
  const remaining = [...points];
  let current = origin;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineDistance(current.latitude, current.longitude, remaining[i].latitude, remaining[i].longitude);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    sorted.push(remaining[bestIdx]);
    current = remaining[bestIdx];
    remaining.splice(bestIdx, 1);
  }
  return sorted;
}

// Chamada única à Mapbox Optimization API (máx 12 coordenadas)
async function optimizeSingleBatch(coords, mapboxToken) {
  const coordsString = coords.map(c => `${c.longitude},${c.latitude}`).join(';');
  const url = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving-traffic/${coordsString}?access_token=${mapboxToken}&roundtrip=true&source=first&destination=last&geometries=geojson&overview=full&steps=true`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.code !== 'Ok' && data.code !== undefined) {
    throw new Error(`Erro Mapbox Optimization: ${data.message || data.code}`);
  }
  return data;
}

// Otimizar rota usando Mapbox Optimization API (Perfil Trânsito)
// Segmenta automaticamente em lotes de até 10 paradas + origem quando necessário
const MAX_WAYPOINTS_PER_BATCH = 10; // paradas por lote (+ origem = 11, dentro do limite de 12)

export async function optimizeRoute(coordinates, mapboxToken) {
  const validCoords = coordinates.filter(c => c.latitude && c.longitude);
  
  if (validCoords.length < 2) {
    return { trips: [], waypoints: [] };
  }

  const origin = validCoords[0];
  const destinations = validCoords.slice(1);

  // Se cabe em uma chamada só (até 11 pontos = origem + 10 paradas), faz direto
  if (destinations.length <= MAX_WAYPOINTS_PER_BATCH) {
    return await optimizeSingleBatch(validCoords, mapboxToken);
  }

  // --- SEGMENTAÇÃO para rotas grandes ---
  // 1. Pré-ordena todos os destinos por proximidade (nearest-neighbor desde a origem)
  const sortedDestinations = nearestNeighborSort(destinations, origin);

  // 2. Divide em lotes sequenciais de MAX_WAYPOINTS_PER_BATCH
  const batches = [];
  for (let i = 0; i < sortedDestinations.length; i += MAX_WAYPOINTS_PER_BATCH) {
    batches.push(sortedDestinations.slice(i, i + MAX_WAYPOINTS_PER_BATCH));
  }

  // 3. Otimiza cada lote individualmente, sempre partindo de um ponto de referência
  let allLegs = [];
  let allWaypoints = [];
  let fullGeometry = [];
  let totalDistance = 0;
  let totalDuration = 0;
  let waypointOffset = 0;

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    // Ponto de partida do lote: origem (primeiro lote) ou último ponto do lote anterior
    const batchOrigin = b === 0 ? origin : batches[b - 1][batches[b - 1].length - 1];
    const batchCoords = [batchOrigin, ...batch];

    const result = await optimizeSingleBatch(batchCoords, mapboxToken);
    const trip = result.trips?.[0];
    if (!trip) continue;

    const batchWaypoints = result.waypoints || [];
    const batchLegs = trip.legs || [];

    // Mapeia waypoints de volta para a ordem global
    // O primeiro waypoint do lote é a origem/ponto de conexão (pula no merge, exceto no lote 0)
    const sortedBatchWPs = [...batchWaypoints].sort((a, b2) => a.waypoint_index - b2.waypoint_index);

    const startWPIdx = b === 0 ? 0 : 1; // pula a origem duplicada nos lotes >0
    for (let w = startWPIdx; w < sortedBatchWPs.length; w++) {
      // Ajusta o waypoint_index para ser global
      allWaypoints.push({
        ...sortedBatchWPs[w],
        waypoint_index: waypointOffset,
        // Guarda referência ao ponto original
        _batchCoordIdx: w
      });
      waypointOffset++;
    }

    // Legs: pega todos os legs exceto o último (retorno à origem do lote)
    // No último lote, pega o último leg também (retorno à origem global)
    const legsToKeep = b < batches.length - 1
      ? batchLegs.slice(0, batchLegs.length - 1) // remove leg de retorno intermediário
      : batchLegs; // último lote: mantém retorno

    // No lote > 0, o primeiro leg é a conexão do ponto anterior ao primeiro do lote
    if (b > 0 && legsToKeep.length > 0) {
      allLegs.push(...legsToKeep);
    } else {
      allLegs.push(...legsToKeep);
    }

    // Geometria
    if (trip.geometry?.coordinates) {
      fullGeometry.push(...trip.geometry.coordinates);
    }

    // Distância e duração (sem o leg de retorno intermediário)
    const relevantLegs = b < batches.length - 1 ? batchLegs.slice(0, batchLegs.length - 1) : batchLegs;
    totalDistance += relevantLegs.reduce((s, l) => s + (l.distance || 0), 0);
    totalDuration += relevantLegs.reduce((s, l) => s + (l.duration || 0), 0);
  }

  // Monta o resultado unificado no formato que processOptimizationResult espera
  return {
    code: "Ok",
    trips: [{
      legs: allLegs,
      distance: totalDistance,
      duration: totalDuration,
      geometry: { type: "LineString", coordinates: fullGeometry }
    }],
    waypoints: allWaypoints
  };
}

// Obter direções entre pontos (respeita a ordem fornecida)
export async function getDirections(coordinates, mapboxToken) {
  const validCoords = coordinates.filter(c => c.latitude && c.longitude);
  
  if (validCoords.length < 2) {
    return { routes: [{ legs: [], distance: 0, duration: 0, geometry: { coordinates: [] } }] };
  }

  // Mapbox Directions API tem limite de 25 coordenadas por requisição
  const coordsString = validCoords.map(c => `${c.longitude},${c.latitude}`).join(';');
  
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordsString}?access_token=${mapboxToken}&geometries=geojson&overview=full&annotations=duration,distance`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.code !== 'Ok') {
    throw new Error(`Erro nas direções: ${data.message || data.code}`);
  }
  
  return data;
}

// --- CONSTANTES DE TEMPO (VALORES PADRÃO - USADOS COMO FALLBACK) ---
export const TIME_CONFIG = {
  TRAFFIC_BUFFER: 1.10,  // +10% tempo de segurança para trânsito (padrão)
  SERVICE_TIME: 20       // 20 min parado por entrega (padrão)
};

// --- PROCESSAMENTO FINAL (Com Buffers de Tempo Parametrizáveis) ---
// serviceTime = tempo de parada por entrega (minutos)
// trafficBuffer = margem de trânsito (percentual, ex: 10 para 10%)
export function processOptimizationResult(optimizationData, originalPoints, startTime, serviceTime = TIME_CONFIG.SERVICE_TIME, trafficBuffer = 10) {
  if (!optimizationData.trips || optimizationData.trips.length === 0) {
      console.warn("Mapbox não otimizou. Retornando ordem original.");
      return { 
          optimized_route: [], 
          route_geometry: [],
          total_distance_km: 0,
          total_time_minutes: 0,
          optimization_notes: "Erro: Não foi possível calcular rota para os endereços fornecidos."
      };
  }

  const trip = optimizationData.trips[0];
  const waypoints = optimizationData.waypoints;
  const legs = trip.legs || [];
  
  // Converte margem de % para multiplicador (ex: 10% -> 1.10)
  const TRAFFIC_BUFFER = 1 + (trafficBuffer / 100);
  const SERVICE_TIME = serviceTime;

  const validOriginalPoints = originalPoints.filter(p => p.latitude && p.longitude);

  // Mapeia waypoints aos pontos originais usando waypoint_index como ordem final
  const orderedPoints = waypoints
    .sort((a, b) => a.waypoint_index - b.waypoint_index)
    .map((wp, idx) => ({
      ...(validOriginalPoints[idx] || {}),
      waypoint_index: wp.waypoint_index
    }));
  
  let currentTime = parseTime(startTime);
  
  const optimizedRoute = orderedPoints.map((point, index) => {
    const isFirst = index === 0;
    
    if (isFirst) {
      return {
        order: index + 1,
        client_name: point.nome,
        address: point.endereco,
        latitude: point.latitude,
        longitude: point.longitude,
        estimated_arrival: formatTime(currentTime),
        travel_time_from_previous: 0,
        delivery_time: 0
      };
    }
    
    const legIndex = index - 1;
    let rawDuration = legs[legIndex] ? legs[legIndex].duration : 0;
    const travelTimeMinutes = Math.round((rawDuration * TRAFFIC_BUFFER) / 60);
    
    currentTime += travelTimeMinutes;
    const arrivalTime = formatTime(currentTime);
    currentTime += SERVICE_TIME;
    
    return {
      order: index + 1,
      client_name: point.nome,
      address: point.endereco,
      latitude: point.latitude,
      longitude: point.longitude,
      estimated_arrival: arrivalTime,
      travel_time_from_previous: travelTimeMinutes,
      delivery_time: SERVICE_TIME
    };
  });
  
  // Retorno à Matriz
  const lastLegIndex = legs.length - 1;
  let rawReturnDuration = legs[lastLegIndex] ? legs[lastLegIndex].duration : 0;
  const returnTravelTime = Math.round((rawReturnDuration * TRAFFIC_BUFFER) / 60);
  currentTime += returnTravelTime;
  
  const matrizOriginal = validOriginalPoints[0];

  const matrizRetorno = {
    order: optimizedRoute.length + 1,
    client_name: matrizOriginal.nome,
    address: matrizOriginal.endereco,
    latitude: matrizOriginal.latitude,
    longitude: matrizOriginal.longitude,
    estimated_arrival: formatTime(currentTime),
    travel_time_from_previous: returnTravelTime,
    delivery_time: 0
  };
  
  const routeGeometry = trip.geometry?.coordinates || [];
  
  const totalDrivingTime = Math.round(((trip.duration || 0) * TRAFFIC_BUFFER) / 60);
  const totalServiceTime = (orderedPoints.length - 1) * SERVICE_TIME;
  
  return {
    optimized_route: [...optimizedRoute, matrizRetorno],
    route_geometry: routeGeometry,
    total_distance_km: (trip.distance || 0) / 1000,
    total_time_minutes: totalDrivingTime + totalServiceTime,
    optimization_notes: `Rota otimizada com trânsito real (+${trafficBuffer}% margem). Inclui ${SERVICE_TIME} min de parada por entrega.`
  };
}

function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = Math.round(totalMinutes % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}