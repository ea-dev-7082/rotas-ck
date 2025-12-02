// Geocodificar um endereço para obter coordenadas
export async function geocodeAddress(address, mapboxToken) {
  const query = encodeURIComponent(address + ", Rio de Janeiro, Brazil");
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${mapboxToken}&country=BR&limit=1`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.features && data.features.length > 0) {
    const [lng, lat] = data.features[0].center;
    return { latitude: lat, longitude: lng, place_name: data.features[0].place_name };
  }
  throw new Error(`Não foi possível geocodificar: ${address}`);
}

// Geocodificar múltiplos endereços
export async function geocodeMultiple(addresses, mapboxToken) {
  const results = await Promise.all(
    addresses.map(async (item) => {
      try {
        const coords = await geocodeAddress(item.endereco, mapboxToken);
        return { ...item, ...coords };
      } catch (error) {
        console.error(`Erro ao geocodificar ${item.nome}:`, error);
        return null;
      }
    })
  );
  return results.filter(Boolean);
}

// Otimizar rota usando Mapbox Optimization API (Perfil Trânsito)
export async function optimizeRoute(coordinates, mapboxToken) {
  const coords = coordinates.map(c => `${c.longitude},${c.latitude}`).join(';');
  
  // Usamos driving-traffic para considerar congestionamentos
  const url = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving-traffic/${coords}?access_token=${mapboxToken}&roundtrip=true&source=first&destination=last&geometries=geojson&overview=full&steps=true`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.code !== 'Ok') {
    throw new Error(`Erro na otimização: ${data.message || data.code}`);
  }
  
  return data;
}

// Obter direções entre pontos
export async function getDirections(coordinates, mapboxToken) {
  const coords = coordinates.map(c => `${c.longitude},${c.latitude}`).join(';');
  
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?access_token=${mapboxToken}&geometries=geojson&overview=full`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.code !== 'Ok') {
    throw new Error(`Erro nas direções: ${data.message || data.code}`);
  }
  
  return data;
}

// --- LÓGICA DE CÁLCULO DE TEMPO (AQUI ESTÁ A MUDANÇA) ---
export function processOptimizationResult(optimizationData, originalPoints, startTime) {
  const trip = optimizationData.trips[0];
  const waypoints = optimizationData.waypoints;
  const legs = trip.legs || [];
  
  // 1. Configurações de Tempo
  const TRAFFIC_BUFFER = 1.25; // Adiciona 25% de margem no tempo de estrada (segurança)
  const SERVICE_TIME = 15;     // 15 minutos de permanência em cada parada

  // Mapear e ordenar pontos
  const waypointsWithOriginal = waypoints.map((wp, index) => ({
    ...wp,
    originalPoint: originalPoints[index]
  }));
  
  const orderedPoints = waypointsWithOriginal
    .sort((a, b) => a.waypoint_index - b.waypoint_index)
    .map(wp => ({
      ...wp.originalPoint,
      waypoint_index: wp.waypoint_index
    }));
  
  let currentTime = parseTime(startTime);
  
  const optimizedRoute = orderedPoints.map((point, index) => {
    const isFirst = index === 0;
    
    // Se for o primeiro ponto (Matriz - Saída)
    if (isFirst) {
      return {
        order: index + 1,
        client_name: point.nome,
        address: point.endereco,
        latitude: point.latitude,
        longitude: point.longitude,
        estimated_arrival: formatTime(currentTime), // Hora de saída
        travel_time_from_previous: 0,
        delivery_time: 0
      };
    }
    
    // --- CÁLCULO DO DESLOCAMENTO ---
    const legIndex = index - 1;
    let rawDuration = legs[legIndex] ? legs[legIndex].duration : 0;
    
    // Aplica margem de segurança no trânsito
    const travelTimeMinutes = Math.round((rawDuration * TRAFFIC_BUFFER) / 60);
    
    // Adiciona tempo de viagem ao relógio
    currentTime += travelTimeMinutes;
    
    // Registra a HORA DE CHEGADA neste cliente
    const arrivalTime = formatTime(currentTime);
    
    // --- CÁLCULO DA PERMANÊNCIA (SERVICE TIME) ---
    // Adiciona 15 min ao relógio para que a PRÓXIMA viagem comece depois da descarga
    currentTime += SERVICE_TIME;
    
    return {
      order: index + 1,
      client_name: point.nome,
      address: point.endereco,
      latitude: point.latitude,
      longitude: point.longitude,
      estimated_arrival: arrivalTime,
      travel_time_from_previous: travelTimeMinutes,
      delivery_time: SERVICE_TIME // Registra que parou 15 min
    };
  });
  
  // --- CÁLCULO DO RETORNO À MATRIZ ---
  const lastLegIndex = legs.length - 1;
  let rawReturnDuration = legs[lastLegIndex] ? legs[lastLegIndex].duration : 0;
  
  // Tempo de volta também com margem de segurança
  const returnTravelTime = Math.round((rawReturnDuration * TRAFFIC_BUFFER) / 60);
  
  // Soma ao relógio (que já inclui os 15 min da última entrega)
  currentTime += returnTravelTime;
  
  const matrizRetorno = {
    order: optimizedRoute.length + 1,
    client_name: originalPoints[0].nome,
    address: originalPoints[0].endereco,
    latitude: originalPoints[0].latitude,
    longitude: originalPoints[0].longitude,
    estimated_arrival: formatTime(currentTime),
    travel_time_from_previous: returnTravelTime,
    delivery_time: 0
  };
  
  const routeGeometry = trip.geometry?.coordinates || [];
  
  // Recalcula tempo total considerando as paradas
  // Tempo Total = (Tempo Dirigindo * Buffer) + (Número de Entregas * 15 min)
  const totalDrivingTime = Math.round(((trip.duration || 0) * TRAFFIC_BUFFER) / 60);
  const totalServiceTime = (orderedPoints.length - 1) * SERVICE_TIME; // -1 pois não conta a saída da matriz
  
  return {
    optimized_route: [...optimizedRoute, matrizRetorno],
    route_geometry: routeGeometry,
    total_distance_km: (trip.distance || 0) / 1000,
    total_time_minutes: totalDrivingTime + totalServiceTime,
    optimization_notes: `Rota calculada com trânsito real (+25% margem). Inclui ${SERVICE_TIME} min de permanência em cada entrega.`
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