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
      // Retorna números garantidos
      return { latitude: Number(lat), longitude: Number(lng), place_name: data.features[0].place_name };
    }
    
    // Se falhar com endereço completo, TENTATIVA DE RESGATE:
    // Tenta geocodificar removendo números ou complementos (ex: "Rua A, 100 - Apt 20" -> "Rua A, Rio de Janeiro")
    // Isso garante que o pino apareça pelo menos na rua certa, mesmo que não no número exato.
    console.warn(`Geocodificação exata falhou para: ${cleanAddress}. Tentando busca genérica...`);
    
    // Pega só a primeira parte do endereço (geralmente a rua)
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

  // Se falhar tudo, retorna null (será tratado no Optimizer)
  return null;
}

// Geocodificar múltiplos endereços
export async function geocodeMultiple(addresses, mapboxToken) {
  const results = await Promise.all(
    addresses.map(async (item) => {
      try {
        // Se o item já tem latitude/longitude VÁLIDAS do banco, usa elas e economiza API
        if (item.latitude && item.longitude && !isNaN(Number(item.latitude))) {
            return { 
                ...item, 
                latitude: Number(item.latitude), 
                longitude: Number(item.longitude) 
            };
        }

        const coords = await geocodeAddress(item.endereco, mapboxToken);
        
        // Se a geocodificação falhou completamente (retornou null)
        if (!coords) {
            console.error(`❌ FALHA FATAL: Não foi possível localizar: ${item.nome}`);
            // Retorna o item sem coordenadas (o Optimizer vai filtrar ou usar backup)
            return { ...item, latitude: null, longitude: null };
        }

        return { ...item, ...coords };
      } catch (error) {
        console.error(`Erro ao processar ${item.nome}:`, error);
        return { ...item, latitude: null, longitude: null };
      }
    })
  );
  return results; // Retorna todos, inclusive os falhos (null)
}

// Otimizar rota usando Mapbox Optimization API (Perfil Trânsito)
export async function optimizeRoute(coordinates, mapboxToken) {
  // Filtra apenas coordenadas válidas para não quebrar a API de Otimização
  const validCoords = coordinates.filter(c => c.latitude && c.longitude);
  
  if (validCoords.length < 2) {
      // Retorna estrutura vazia para não quebrar o front
      return { trips: [], waypoints: [] }; 
  }

  const coordsString = validCoords.map(c => `${c.longitude},${c.latitude}`).join(';');
  
  const url = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving-traffic/${coordsString}?access_token=${mapboxToken}&roundtrip=true&source=first&destination=last&geometries=geojson&overview=full&steps=true`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.code !== 'Ok' && data.code !== undefined) {
    // Se der erro (ex: rota impossível), lança exceção
    throw new Error(`Erro Mapbox Optimization: ${data.message || data.code}`);
  }
  
  return data;
}

// Obter direções entre pontos
export async function getDirections(coordinates, mapboxToken) {
  const validCoords = coordinates.filter(c => c.latitude && c.longitude);
  const coordsString = validCoords.map(c => `${c.longitude},${c.latitude}`).join(';');
  
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordsString}?access_token=${mapboxToken}&geometries=geojson&overview=full`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.code !== 'Ok') {
    throw new Error(`Erro nas direções: ${data.message || data.code}`);
  }
  
  return data;
}

// --- PROCESSAMENTO FINAL (Com Buffers de Tempo) ---
export function processOptimizationResult(optimizationData, originalPoints, startTime) {
  // Se a otimização falhou ou não retornou trips, tenta montar rota sequencial simples
  if (!optimizationData.trips || optimizationData.trips.length === 0) {
      console.warn("Mapbox não otimizou. Retornando ordem original.");
      // Fallback simples aqui se necessário, ou retorna vazio
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
  
  // Configurações
  const TRAFFIC_BUFFER = 1.45; // +45% tempo segurança
  const SERVICE_TIME = 20;     // 20 min parado

  // Filtra apenas os pontos originais que foram enviados para otimização (com coordenadas válidas)
  // Isso é crucial: se um ponto falhou na geocodificação, ele não está no result do Mapbox
  const validOriginalPoints = originalPoints.filter(p => p.latitude && p.longitude);

  // Mapeia resposta do Mapbox de volta para os nossos dados
  const waypointsWithOriginal = waypoints.map((wp, index) => {
      // O Mapbox retorna na ordem que enviamos os VALID_COORDS
      // Precisamos garantir que estamos pegando o cliente certo da lista de válidos
      const original = validOriginalPoints[wp.waypoint_index]; 
      // Nota: waypoint_index é a ordem na rota OTIMIZADA? Não, é o índice do input original.
      // O array 'waypoints' vem ordenado pelo input. 
      return {
          ...wp,
          originalPoint: validOriginalPoints[index] 
      };
  });
  
  const orderedPoints = waypointsWithOriginal
    .sort((a, b) => a.waypoint_index - b.waypoint_index)
    .map(wp => ({
      ...wp.originalPoint,
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
  
  // Pega dados da matriz (primeiro ponto válido)
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
    optimization_notes: `Rota calculada com trânsito real (+25% margem de segurança). Inclui ${SERVICE_TIME} min de parada por entrega.`
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