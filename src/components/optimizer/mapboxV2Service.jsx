// ==============================================
// Mapbox Optimization V2 API - Multi-Route Service
// ==============================================

// Submeter problema de roteamento (POST assíncrono)
export async function submitRoutingProblem(problemDocument, mapboxToken) {
  const url = `https://api.mapbox.com/optimized-trips/v2?access_token=${mapboxToken}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(problemDocument),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao submeter problema: ${response.status} - ${errorText}`);
  }

  return await response.json(); // { id, status }
}

// Recuperar solução (GET com polling)
export async function retrieveSolution(jobId, mapboxToken, maxAttempts = 30, intervalMs = 2000) {
  const url = `https://api.mapbox.com/optimized-trips/v2/${jobId}?access_token=${mapboxToken}`;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(url);
    
    if (response.status === 200) {
      return await response.json(); // Solução completa
    }
    
    if (response.status === 202) {
      // Ainda processando, aguardar
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      continue;
    }
    
    const errorText = await response.text();
    throw new Error(`Erro ao recuperar solução: ${response.status} - ${errorText}`);
  }

  throw new Error("Timeout: A otimização demorou demais para ser processada.");
}

// Montar documento de problema de roteamento
export function buildRoutingProblem({
  matrizCoords,     // { latitude, longitude }
  vehicles,         // [{ id, name, capacidade?, motorista_nome }]
  services,         // [{ id, nome, latitude, longitude, duration, time_windows? }]
  startTime,        // ISO string ex: "2026-03-11T08:00:00-03:00"
}) {
  // Monta as locations
  const locations = [
    {
      name: "matriz",
      coordinates: [matrizCoords.longitude, matrizCoords.latitude],
    },
  ];

  // Adiciona clientes como locations
  services.forEach((svc) => {
    locations.push({
      name: svc.id,
      coordinates: [svc.longitude, svc.latitude],
    });
  });

  // Monta veículos
  const vehiclesDocs = vehicles.map((v) => ({
    name: v.id,
    routing_profile: "mapbox/driving",
    start_location: "matriz",
    end_location: "matriz",
    capacities: v.capacidade ? { volume: parseInt(v.capacidade) || 100 } : { volume: 100 },
    earliest_start: startTime,
    latest_end: addHoursToISO(startTime, 12), // 12h de jornada máxima
  }));

  // Monta serviços (entregas)
  const servicesDocs = services.map((svc) => {
    const doc = {
      name: svc.id,
      location: svc.id,
      duration: svc.duration || 1200, // 20 min padrão em segundos
      requirements: {},
    };

    // Adiciona janelas de tempo se existirem
    if (svc.time_windows && svc.time_windows.length > 0) {
      doc.time_windows = svc.time_windows;
    }

    return doc;
  });

  return {
    version: 1,
    locations,
    vehicles: vehiclesDocs,
    services: servicesDocs,
  };
}

// Processar solução V2 em formato amigável para a interface
export function processV2Solution(solution, servicesMap, vehiclesMap, matrizData) {
  const routes = [];

  if (!solution.routes || solution.routes.length === 0) {
    return { routes, dropped: solution.dropped || { services: [], shipments: [] } };
  }

  // Cores para as rotas
  const ROUTE_COLORS = [
    "#3b82f6", // blue
    "#ef4444", // red
    "#10b981", // green
    "#f59e0b", // amber
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#06b6d4", // cyan
    "#84cc16", // lime
  ];

  solution.routes.forEach((route, routeIndex) => {
    const vehicleInfo = vehiclesMap[route.vehicle] || {};
    const stops = [];
    let totalDistance = 0;

    route.stops.forEach((stop, stopIndex) => {
      const serviceInfo = servicesMap[stop.location] || {};
      const isMatriz = stop.location === "matriz";

      stops.push({
        order: stopIndex + 1,
        client_name: isMatriz ? matrizData.nome : (serviceInfo.nome || stop.location),
        client_id: isMatriz ? null : stop.location,
        address: isMatriz ? matrizData.endereco : (serviceInfo.endereco || ""),
        latitude: isMatriz ? matrizData.latitude : (serviceInfo.latitude || 0),
        longitude: isMatriz ? matrizData.longitude : (serviceInfo.longitude || 0),
        estimated_arrival: stop.eta ? formatISOToTime(stop.eta) : "",
        type: stop.type,
        wait: stop.wait || 0,
        odometer: stop.odometer || 0,
      });

      if (stop.odometer) {
        totalDistance = Math.max(totalDistance, stop.odometer);
      }
    });

    const deliveryStops = stops.filter(s => s.type !== "start" && s.type !== "end");

    routes.push({
      vehicle_id: route.vehicle,
      vehicle_name: vehicleInfo.descricao || route.vehicle,
      vehicle_placa: vehicleInfo.placa || "",
      motorista_nome: vehicleInfo.motorista_nome || "",
      motorista_id: vehicleInfo.motorista_id || "",
      motorista_email: vehicleInfo.motorista_email || "",
      color: ROUTE_COLORS[routeIndex % ROUTE_COLORS.length],
      stops,
      total_entregas: deliveryStops.length,
      total_distance_km: totalDistance / 1000,
      total_time_minutes: calculateRouteDuration(stops),
    });
  });

  return {
    routes,
    dropped: solution.dropped || { services: [], shipments: [] },
  };
}

// --- Helpers ---

function addHoursToISO(isoStr, hours) {
  const date = new Date(isoStr);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function formatISOToTime(isoStr) {
  const date = new Date(isoStr);
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function calculateRouteDuration(stops) {
  if (stops.length < 2) return 0;
  const start = stops.find(s => s.type === "start");
  const end = stops.find(s => s.type === "end");
  if (!start?.estimated_arrival || !end?.estimated_arrival) return 0;

  const parseTime = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  return parseTime(end.estimated_arrival) - parseTime(start.estimated_arrival);
}