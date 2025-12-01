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
  
  // Ordenar pontos pela ordem otimizada
  const orderedPoints = waypoints
    .sort((a, b) => a.waypoint_index - b.waypoint_index)
    .map((wp, index) => {
      const originalPoint = originalPoints[wp.original_index || index];
      return {
        ...originalPoint,
        waypoint_index: wp.waypoint_index
      };
    });
  
  // Calcular horários estimados
  let currentTime = parseTime(startTime);
  const legs = trip.legs || [];
  
  const optimizedRoute = orderedPoints.map((point, index) => {
    const isFirst = index === 0;
    const isLast = index === orderedPoints.length - 1;
    
    // Adicionar tempo de viagem do trecho anterior
    if (index > 0 && legs[index - 1]) {
      currentTime += legs[index - 1].duration / 60; // converter segundos para minutos
    }
    
    const arrivalTime = formatTime(currentTime);
    
    // Adicionar tempo de entrega (15 min) exceto para matriz
    if (!isFirst && !isLast) {
      currentTime += 15;
    }
    
    return {
      order: index + 1,
      client_name: point.nome,
      address: point.endereco,
      latitude: point.latitude,
      longitude: point.longitude,
      estimated_arrival: arrivalTime,
      travel_time_from_previous: index > 0 && legs[index - 1] ? Math.round(legs[index - 1].duration / 60) : 0,
      delivery_time: (!isFirst && !isLast) ? 15 : 0
    };
  });
  
  // Adicionar retorno à matriz
  const matrizRetorno = {
    order: optimizedRoute.length + 1,
    client_name: originalPoints[0].nome,
    address: originalPoints[0].endereco,
    latitude: originalPoints[0].latitude,
    longitude: originalPoints[0].longitude,
    estimated_arrival: formatTime(currentTime + (legs[legs.length - 1]?.duration / 60 || 0)),
    travel_time_from_previous: legs[legs.length - 1] ? Math.round(legs[legs.length - 1].duration / 60) : 0,
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