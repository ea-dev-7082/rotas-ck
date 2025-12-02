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
  // coordinates: array de {longitude, latitude, nome, endereco}
  // O primeiro ponto é a origem (Matriz) e deve retornar a ela
  
  const coords = coordinates.map(c => `${c.longitude},${c.latitude}`).join(';');
  
  // source=first, destination=last, roundtrip=true para voltar à matriz
  const url = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coords}?access_token=${mapboxToken}&roundtrip=true&source=first&destination=last&geometries=geojson&overview=full&steps=true`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.code !== 'Ok') {
    throw new Error(`Erro na otimização: ${data.message || data.code}`);
  }
  
  return data;
}

// Obter direções entre pontos para desenhar a rota
export async function getDirections(coordinates, mapboxToken) {
  const coords = coordinates.map(c => `${c.longitude},${c.latitude}`).join(';');
  
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?access_token=${mapboxToken}&geometries=geojson&overview=full`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.code !== 'Ok') {
    throw new Error(`Erro nas direções: ${data.message || data.code}`);
  }
  
  return data;
}

// Processar resultado da otimização para o formato esperado pela aplicação
export function processOptimizationResult(optimizationData, originalPoints, startTime) {
  const trip = optimizationData.trips[0];
  const waypoints = optimizationData.waypoints;
  const legs = trip.legs || [];
  
  // Mapear waypoints otimizados para os pontos originais usando a posição no array
  // O Mapbox retorna waypoints na mesma ordem que foram enviados, 
  // mas cada um tem waypoint_index indicando a posição na rota otimizada
  const waypointsWithOriginal = waypoints.map((wp, index) => ({
    ...wp,
    originalPoint: originalPoints[index] // índice no array = ordem original de envio
  }));
  
  // Ordenar pela ordem otimizada (waypoint_index)
  const orderedPoints = waypointsWithOriginal
    .sort((a, b) => a.waypoint_index - b.waypoint_index)
    .map(wp => ({
      ...wp.originalPoint,
      waypoint_index: wp.waypoint_index
    }));
  
  // Calcular horários estimados usando os tempos reais do Mapbox
  // Os legs estão na ordem correta da rota otimizada
  let currentTime = parseTime(startTime);
  
  const optimizedRoute = orderedPoints.map((point, index) => {
    const isFirst = index === 0;
    const isLast = index === orderedPoints.length - 1;
    
    // Para o primeiro ponto (matriz), o horário é o de saída
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
    
    // Pegar o tempo de viagem do leg anterior (legs[0] = matriz -> primeiro destino)
    const legIndex = index - 1;
    const travelTimeMinutes = legs[legIndex] ? Math.round(legs[legIndex].duration / 60) : 0;
    
    // Adicionar tempo de viagem
    currentTime += travelTimeMinutes;
    
    const arrivalTime = formatTime(currentTime);
    
    // Adicionar tempo de entrega (15 min) exceto para matriz e último ponto
    if (!isLast) {
      currentTime += 20;
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
  
  // Adicionar retorno à matriz (último leg)
  const lastLegIndex = legs.length - 1;
  const returnTravelTime = legs[lastLegIndex] ? Math.round(legs[lastLegIndex].duration / 60) : 0;
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
  
  // Extrair geometria da rota para desenhar no mapa
  const routeGeometry = trip.geometry?.coordinates || [];
  
  return {
    optimized_route: [...optimizedRoute, matrizRetorno],
    route_geometry: routeGeometry,
    total_distance_km: (trip.distance || 0) / 1000,
    total_time_minutes: Math.round((trip.duration || 0) / 60),
    optimization_notes: `Rota otimizada pelo Mapbox com ${orderedPoints.length} paradas. Distância total: ${((trip.distance || 0) / 1000).toFixed(1)} km.`
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