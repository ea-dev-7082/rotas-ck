// Token padrão do Mapbox (fallback)
export const MAPBOX_TOKEN = "pk.eyJ1Ijoicm90YXNtYXJjb3MiLCJhIjoiY205NjV3ZGtvMGJudzJscjF4bnIwOTQ5aCJ9.E8HMrtYLMMLzgBnxFKAfaA";

// --- FUNÇÃO DE LIMPEZA DE ENDEREÇO ---
function sanitizeAddress(address) {
  if (!address) return "";
  return address
    .toString()
    .replace(/[\n\r\t]/g, " ")
    .replace(/[+]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
export async function geocodeAddress(address, mapboxToken, bairro, municipio) {
  const cleanAddress = sanitizeAddress(address);
  if (!cleanAddress) return null;

  const attempts = [
    cleanAddress + ", Rio de Janeiro, Brazil",
    cleanAddress + ", RJ, Brazil",
  ];

  if (bairro) {
    attempts.push(cleanAddress + ", " + bairro + ", Rio de Janeiro, Brazil");
  }
  if (municipio) {
    attempts.push(cleanAddress + ", " + municipio + ", RJ, Brazil");
  }

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

        const coords = await geocodeAddress(item.endereco, mapboxToken, item.bairro, item.municipio);
        
        if (!coords) {
          console.warn(`⚠️ Geocodificação falhou para: ${item.nome} (${item.endereco}). Será ignorado na rota.`);
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

// ============================================================
// DISTÂNCIA HAVERSINE
// ============================================================
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================
// NEAREST NEIGHBOR + 2-OPT IMPROVEMENT
// ============================================================
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

// Calcula custo total de uma sequência (origem → pontos → origem)
function routeCost(origin, points) {
  let cost = 0;
  let prev = origin;
  for (const p of points) {
    cost += haversineDistance(prev.latitude, prev.longitude, p.latitude, p.longitude);
    prev = p;
  }
  // Retorno à origem
  cost += haversineDistance(prev.latitude, prev.longitude, origin.latitude, origin.longitude);
  return cost;
}

// 2-opt melhora a rota trocando pares de arestas
function twoOptImprove(origin, points) {
  const route = [...points];
  let improved = true;
  let iterations = 0;
  const maxIterations = 500;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;
    for (let i = 0; i < route.length - 1; i++) {
      for (let j = i + 1; j < route.length; j++) {
        const newRoute = [...route];
        // Reverse segment between i and j
        const segment = newRoute.splice(i, j - i + 1);
        segment.reverse();
        newRoute.splice(i, 0, ...segment);

        if (routeCost(origin, newRoute) < routeCost(origin, route)) {
          route.splice(0, route.length, ...newRoute);
          improved = true;
        }
      }
    }
  }
  return route;
}

// ============================================================
// MAPBOX OPTIMIZATION API (TSP real, até 12 pontos)
// ============================================================
async function mapboxOptimize(coordinates, mapboxToken) {
  // coordinates[0] = origem (roundtrip)
  const coordsString = coordinates.map(c => `${c.longitude},${c.latitude}`).join(';');
  const url = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordsString}?access_token=${mapboxToken}&source=first&destination=last&roundtrip=true&geometries=geojson&overview=full`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.code !== 'Ok' || !data.trips || data.trips.length === 0) {
    return null;
  }

  return data;
}

// ============================================================
// OTIMIZAR ROTA PRINCIPAL
// ============================================================
export async function optimizeRoute(coordinates, mapboxToken) {
  const validCoords = coordinates.filter(c => c.latitude && c.longitude);

  if (validCoords.length < 2) {
    return { trips: [], waypoints: [] };
  }

  const origin = validCoords[0];
  const destinations = validCoords.slice(1);

  // Para até 11 destinos (12 pontos total), usa a Optimization API real do Mapbox
  if (validCoords.length <= 12) {
    const optResult = await mapboxOptimize(validCoords, mapboxToken);
    if (optResult) {
      // A Optimization API retorna waypoints com waypoint_index indicando a ordem ótima
      // Precisamos reordenar os pontos conforme a ordem ótima retornada
      const trip = optResult.trips[0];
      const waypoints = optResult.waypoints;

      // Monta a sequência na ordem retornada pela API
      const orderedIndices = waypoints.map(wp => wp.waypoint_index);
      // waypoints[i].waypoint_index = posição do ponto i na trip otimizada
      
      // Cria array de pontos na ordem ótima (excluindo origem que é fixo no início)
      const sortedByTripOrder = waypoints
        .map((wp, originalIdx) => ({ originalIdx, tripOrder: wp.waypoint_index }))
        .sort((a, b) => a.tripOrder - b.tripOrder);

      // O primeiro da trip é sempre a origem (index 0)
      const orderedPoints = sortedByTripOrder.map(item => validCoords[item.originalIdx]);

      // Agora preciso obter legs individuais na ordem correta
      // A trip já vem com legs na ordem otimizada
      const fullRoute = [...orderedPoints, orderedPoints[0]]; // adiciona retorno
      
      // Usa Directions API para obter legs individuais na ordem otimizada
      const directionsResult = await getDirections(fullRoute, mapboxToken);
      const route = directionsResult.routes?.[0];

      if (route) {
        const wpMapped = orderedPoints.map((p, idx) => ({
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
          waypoints: wpMapped,
          _orderedPoints: orderedPoints
        };
      }
    }
    // Se falhar, cai pro nearest neighbor + 2-opt abaixo
  }

  // Para mais de 12 pontos: nearest neighbor + 2-opt
  const nnSorted = nearestNeighborSort(destinations, origin);
  const optimized = twoOptImprove(origin, nnSorted);

  const fullRoute = [origin, ...optimized, origin];
  const directionsResult = await getDirections(fullRoute, mapboxToken);
  const route = directionsResult.routes?.[0];

  if (!route) {
    throw new Error("Não foi possível calcular direções para a rota.");
  }

  const allPoints = [origin, ...optimized];
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
    waypoints,
    _orderedPoints: allPoints
  };
}

// ============================================================
// DIRECTIONS API (segmentada em lotes de 25)
// ============================================================
const MAX_DIRECTIONS_PER_BATCH = 25;

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

export async function getDirections(coordinates, mapboxToken) {
  const validCoords = coordinates.filter(c => c.latitude && c.longitude);

  if (validCoords.length < 2) {
    return { routes: [{ legs: [], distance: 0, duration: 0, geometry: { coordinates: [] } }] };
  }

  if (validCoords.length <= MAX_DIRECTIONS_PER_BATCH) {
    return await directionsSingleBatch(validCoords, mapboxToken);
  }

  // Segmenta em lotes com sobreposição de 1 ponto
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

// ============================================================
// CONSTANTES DE TEMPO (VALORES PADRÃO)
// ============================================================
export const TIME_CONFIG = {
  TRAFFIC_BUFFER: 1.10,
  SERVICE_TIME: 20
};

// ============================================================
// PROCESSAMENTO FINAL (Calcula ETAs a partir dos legs)
// ============================================================
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
  const legs = trip.legs || [];

  const TRAFFIC_BUFFER = 1 + (trafficBuffer / 100);
  const SERVICE_TIME = serviceTime;

  console.log(`[processOptimizationResult] serviceTime=${SERVICE_TIME}min, trafficBuffer=${trafficBuffer}% (multiplier=${TRAFFIC_BUFFER}), startTime=${startTime}, legs=${legs.length}, points=${originalPoints.length}`);

  // Se temos _orderedPoints, usamos diretamente (já está na ordem ótima)
  const orderedPoints = optimizationData._orderedPoints ||
    optimizationData.waypoints
      .sort((a, b) => a.waypoint_index - b.waypoint_index)
      .map((wp, idx) => (originalPoints.filter(p => p.latitude && p.longitude)[idx] || {}));

  let currentTime = parseTime(startTime);

  // Legs: 0..N-2 = entre paradas, N-1 = retorno à origem
  const deliveryLegs = legs.slice(0, orderedPoints.length - 1);
  const returnLeg = legs[orderedPoints.length - 1];

  // Calcula distância e tempo apenas das entregas (sem retorno)
  let totalDeliveryDrivingSeconds = 0;
  let totalDeliveryDistanceMeters = 0;

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

    const leg = deliveryLegs[index - 1];
    const rawDuration = leg?.duration || 0;
    const rawDistance = leg?.distance || 0;
    const travelTimeMinutes = Math.round((rawDuration * TRAFFIC_BUFFER) / 60);

    totalDeliveryDrivingSeconds += rawDuration;
    totalDeliveryDistanceMeters += rawDistance;

    currentTime += travelTimeMinutes;
    const arrivalTime = formatTime(currentTime);
    
    console.log(`[ETA] Parada ${index}: ${point.nome} | deslocamento=${travelTimeMinutes}min (raw=${Math.round(rawDuration/60)}min) | chegada=${arrivalTime} | +parada=${SERVICE_TIME}min`);
    
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
  const rawReturnDistance = returnLeg?.distance || 0;
  const returnTravelTime = Math.round((rawReturnDuration * TRAFFIC_BUFFER) / 60);
  currentTime += returnTravelTime;

  const matrizOriginal = orderedPoints[0];
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

  // Tempo total = deslocamento total (com buffer) + tempo de serviço
  const totalDrivingMinutes = Math.round(((totalDeliveryDrivingSeconds + rawReturnDuration) * TRAFFIC_BUFFER) / 60);
  const totalServiceTime = (orderedPoints.length - 1) * SERVICE_TIME;

  // Distância total = entregas + retorno
  const totalDistanceKm = (totalDeliveryDistanceMeters + rawReturnDistance) / 1000;

  return {
    optimized_route: [...optimizedRoute, matrizRetorno],
    route_geometry: routeGeometry,
    total_distance_km: totalDistanceKm,
    total_time_minutes: totalDrivingMinutes + totalServiceTime,
    optimization_notes: `Rota otimizada${orderedPoints.length <= 12 ? ' (TSP Mapbox)' : ' (nearest-neighbor + 2-opt)'} com trânsito real (+${trafficBuffer}% margem). Inclui ${SERVICE_TIME} min de parada por entrega.`
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