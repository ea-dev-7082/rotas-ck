// Token fixo do Mapbox — compartilhado por todos os usuários
export const MAPBOX_TOKEN = "pk.eyJ1Ijoicm90YXNtYXJjb3MiLCJhIjoiY205NjV3ZGtvMGJudzJscjF4bnIwOTQ5aCJ9.E8HMrtYLMMLzgBnxFKAfaA";

// --- FUNÇÃO DE LIMPEZA DE ENDEREÇO ---
// Remove quebras de linha, caracteres especiais inúteis e espaços extras
function sanitizeAddress(address) {
  if (!address) return "";
  return address
    .toString()
    .replace(/[\n\r\t]/g, " ") // Remove quebras de linha
    .replace(/[+]/g, "")       // Remove caractere +
    .replace(/\s+/g, " ")      // Remove espaços duplos
    .trim();                   // Remove espaços nas pontas
}

// Tenta uma busca no Mapbox e retorna coordenadas ou null
async function tryGeocode(searchText, mapboxToken) {
  const query = encodeURIComponent(searchText);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${mapboxToken}&country=BR&limit=1`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  if (data.features && data.features.length > 0) {
    const [lng, lat] = data.features[0].center;
    return { latitude: Number(lat), longitude: Number(lng), place_name: data.features[0].place_name };
  }
  return null;
}

// Geocodificar um endereço para obter coordenadas
// Tenta múltiplas estratégias quando a primeira falha
export async function geocodeAddress(address, mapboxToken, bairro, municipio) {
  const cleanAddress = sanitizeAddress(address);
  if (!cleanAddress) return null;

  // Estratégias de busca (da mais específica para a mais genérica)
  const attempts = [
    cleanAddress + ", Rio de Janeiro, Brazil",
    cleanAddress + ", RJ, Brazil",
  ];

  // Tenta com bairro/município se disponíveis
  if (bairro) {
    attempts.push(cleanAddress + ", " + bairro + ", Rio de Janeiro, Brazil");
  }
  if (municipio) {
    attempts.push(cleanAddress + ", " + municipio + ", RJ, Brazil");
  }

  // Tenta só a primeira parte (rua) se tiver vírgula
  const streetOnly = cleanAddress.split(",")[0]?.trim();
  if (streetOnly && streetOnly !== cleanAddress) {
    attempts.push(streetOnly + ", Rio de Janeiro, Brazil");
    if (bairro) attempts.push(streetOnly + ", " + bairro + ", RJ, Brazil");
    if (municipio) attempts.push(streetOnly + ", " + municipio + ", RJ, Brazil");
  }

  try {
    for (const attempt of attempts) {
      const result = await tryGeocode(attempt, mapboxToken);
      if (result) return result;
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

// Otimizar rota: ordena por nearest-neighbor (mais perto → mais longe) e usa Directions API para tempos reais
// Funciona com qualquer quantidade de paradas sem limite
export async function optimizeRoute(coordinates, mapboxToken) {
  const validCoords = coordinates.filter(c => c.latitude && c.longitude);
  
  if (validCoords.length < 2) {
    return { trips: [], waypoints: [] };
  }

  const origin = validCoords[0];
  const destinations = validCoords.slice(1);

  // 1. Ordena TODOS os destinos por nearest-neighbor a partir da origem
  const sorted = nearestNeighborSort(destinations, origin);

  // 2. Monta a rota completa: origem → entregas ordenadas → retorno à origem
  const fullRoute = [origin, ...sorted, origin];

  // 3. Usa Directions API (segmentada) para obter tempos, distâncias e geometria reais
  const directionsResult = await getDirections(fullRoute, mapboxToken);
  const route = directionsResult.routes?.[0];

  if (!route) {
    throw new Error("Não foi possível calcular direções para a rota.");
  }

  // 4. Monta waypoints na ordem correta (formato que processOptimizationResult espera)
  const allPoints = [origin, ...sorted];
  const waypoints = allPoints.map((p, idx) => ({
    waypoint_index: idx,
    location: [p.longitude, p.latitude]
  }));

  return {
    code: "Ok",
    trips: [{
      legs: route.legs || [],
      distance: route.distance || 0,
      duration: route.duration || 0,
      geometry: route.geometry || { type: "LineString", coordinates: [] }
    }],
    waypoints
  };
}

// Chamada única à Directions API (máx 25 coordenadas)
async function directionsSingleBatch(coords, mapboxToken) {
  const coordsString = coords.map(c => `${c.longitude},${c.latitude}`).join(';');
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordsString}?access_token=${mapboxToken}&geometries=geojson&overview=full&annotations=duration,distance`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.code !== 'Ok') {
    throw new Error(`Erro nas direções: ${data.message || data.code}`);
  }
  return data;
}

// Obter direções entre pontos (respeita a ordem fornecida)
// Segmenta automaticamente em lotes de 25 coordenadas
const MAX_DIRECTIONS_PER_BATCH = 25;

export async function getDirections(coordinates, mapboxToken) {
  const validCoords = coordinates.filter(c => c.latitude && c.longitude);
  
  if (validCoords.length < 2) {
    return { routes: [{ legs: [], distance: 0, duration: 0, geometry: { coordinates: [] } }] };
  }

  // Se cabe em uma chamada só
  if (validCoords.length <= MAX_DIRECTIONS_PER_BATCH) {
    return await directionsSingleBatch(validCoords, mapboxToken);
  }

  // Segmenta em lotes com sobreposição de 1 ponto (para continuidade)
  let allLegs = [];
  let fullGeometry = [];
  let totalDistance = 0;
  let totalDuration = 0;

  for (let i = 0; i < validCoords.length - 1; i += MAX_DIRECTIONS_PER_BATCH - 1) {
    const batch = validCoords.slice(i, i + MAX_DIRECTIONS_PER_BATCH);
    if (batch.length < 2) break;

    const result = await directionsSingleBatch(batch, mapboxToken);
    const route = result.routes?.[0];
    if (!route) continue;

    allLegs.push(...(route.legs || []));
    if (route.geometry?.coordinates) {
      fullGeometry.push(...route.geometry.coordinates);
    }
    totalDistance += route.distance || 0;
    totalDuration += route.duration || 0;
  }

  return {
    code: "Ok",
    routes: [{
      legs: allLegs,
      distance: totalDistance,
      duration: totalDuration,
      geometry: { type: "LineString", coordinates: fullGeometry }
    }]
  };
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
  
  const TRAFFIC_BUFFER = 1 + (trafficBuffer / 100);
  const SERVICE_TIME = serviceTime;

  const validOriginalPoints = originalPoints.filter(p => p.latitude && p.longitude);

  // Waypoints já vêm ordenados (nearest-neighbor) — mapeia aos pontos originais
  const orderedPoints = waypoints
    .sort((a, b) => a.waypoint_index - b.waypoint_index)
    .map((wp, idx) => ({
      ...(validOriginalPoints[idx] || {}),
      waypoint_index: wp.waypoint_index
    }));
  
  let currentTime = parseTime(startTime);
  
  // Monta rota: origem + entregas (legs 0..N-2 são entre paradas, leg N-1 é retorno)
  const deliveryLegs = legs.slice(0, orderedPoints.length - 1); // legs entre paradas
  const returnLeg = legs[orderedPoints.length - 1]; // último leg = retorno à matriz

  const optimizedRoute = orderedPoints.map((point, index) => {
    if (index === 0) {
      return {
        order: 1,
        client_name: point.nome,
        address: point.endereco,
        latitude: point.latitude,
        longitude: point.longitude,
        estimated_arrival: formatTime(currentTime),
        travel_time_from_previous: 0,
        delivery_time: 0
      };
    }
    
    const rawDuration = deliveryLegs[index - 1]?.duration || 0;
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
  const rawReturnDuration = returnLeg?.duration || 0;
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