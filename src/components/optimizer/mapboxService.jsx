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

// Otimizar rota usando Mapbox Optimization API
export async function optimizeRoute(coordinates, mapboxToken) {
  const coords = coordinates.map(c => `${c.longitude},${c.latitude}`).join(';');
  
  // --- ALTERAÇÃO 1: MUDANÇA DE PERFIL ---
  // Mudamos de 'driving' para 'driving-traffic' para considerar o trânsito real
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
  
  // Aqui também mudamos para driving-traffic
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?access_token=${mapboxToken}&geometries=geojson&overview=full`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.code !== 'Ok') {
    throw new Error(`Erro nas direções: ${data.message || data.code}`);
  }
  
  return data;
}

// Processar resultado da otimização
export function processOptimizationResult(optimizationData, originalPoints, startTime) {
  const trip = optimizationData.trips[0];
  const waypoints = optimizationData.waypoints;
  const legs = trip.legs || [];
  
  // Mapeamento original
  const waypointsWithOriginal = waypoints.map((wp, index) => ({
    ...wp,
    originalPoint: originalPoints[index]
  }));
  
  // Ordenação
  const orderedPoints = waypointsWithOriginal
    .sort((a, b) => a.waypoint_index - b.waypoint_index)
    .map(wp => ({
      ...wp.originalPoint,
      waypoint_index: wp.waypoint_index
    }));
  
  let currentTime = parseTime(startTime);
  
  // --- ALTERAÇÃO 2: FATOR DE SEGURANÇA (TRAFFIC BUFFER) ---
  // Multiplicamos o tempo de estrada por 1.25 (25% a mais)
  // Isso compensa estacionamento, semáforos longos e velocidade menor de vans
  const TRAFFIC_BUFFER = 1.25; 

  const optimizedRoute = orderedPoints.map((point, index) => {
    const isFirst = index === 0;
    const isLast = index === orderedPoints.length - 1;
    
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
    
    // Pegar o tempo de viagem do leg anterior
    const legIndex = index - 1;
    let rawDuration = legs[legIndex] ? legs[legIndex].duration : 0;
    
    // Aplica o Buffer de segurança no tempo de viagem
    const bufferedDuration = rawDuration * TRAFFIC_BUFFER;
    const travelTimeMinutes = Math.round(bufferedDuration / 60);
    
    // Adicionar tempo de viagem bufferizado
    currentTime += travelTimeMinutes;
    
    const arrivalTime = formatTime(currentTime);
    
    // Tempo de descarga (15 min)
    if (!isLast) {
      currentTime += 15;
    }
    
    return {
      order: index + 1,
      client_name: point.nome,
      address: point.endereco,
      latitude: point.latitude,
      longitude: point.longitude,
      estimated_arrival: arrivalTime,
      travel_time_from_previous: travelTimeMinutes,
      delivery_time: (!isLast) ? 15 : 0
    };
  });
  
  // Retorno à matriz (último leg)
  const lastLegIndex = legs.length - 1;
  let rawReturnDuration = legs[lastLegIndex] ? legs[lastLegIndex].duration : 0;
  
  // Aplica buffer na volta também
  const returnTravelTime = Math.round((rawReturnDuration * TRAFFIC_BUFFER) / 60);
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
  
  return {
    optimized_route: [...optimizedRoute, matrizRetorno],
    route_geometry: routeGeometry,
    total_distance_km: (trip.distance || 0) / 1000,
    // Ajusta o tempo total nas estatísticas também
    total_time_minutes: Math.round(((trip.duration || 0) * TRAFFIC_BUFFER) / 60),
    optimization_notes: `Rota otimizada (perfil tráfego real + margem de segurança) com ${orderedPoints.length} paradas. Distância: ${((trip.distance || 0) / 1000).toFixed(1)} km.`
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