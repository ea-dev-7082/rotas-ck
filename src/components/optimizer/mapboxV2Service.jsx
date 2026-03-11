// ==============================================
// Multi-Route Service usando Mapbox Optimization V1
// Divide clientes entre veículos por proximidade geográfica
// e otimiza cada rota individualmente com a API V1 gratuita
// ==============================================

import { optimizeRoute, processOptimizationResult } from "./mapboxService";

const ROUTE_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

// Distância euclidiana simples entre dois pontos
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Divide clientes em clusters geográficos (K-means simplificado)
function clusterClients(clients, numVehicles, matrizCoords) {
  if (numVehicles <= 1) return [clients];
  if (clients.length <= numVehicles) {
    return clients.map((c) => [c]);
  }

  // Ordena clientes por ângulo em relação à matriz (setorização)
  const clientsWithAngle = clients.map((c) => {
    const angle = Math.atan2(
      c.latitude - matrizCoords.latitude,
      c.longitude - matrizCoords.longitude
    );
    return { ...c, _angle: angle };
  });

  clientsWithAngle.sort((a, b) => a._angle - b._angle);

  // Divide em setores iguais
  const clusters = Array.from({ length: numVehicles }, () => []);
  clientsWithAngle.forEach((client, idx) => {
    const clusterIdx = idx % numVehicles;
    clusters[clusterIdx].push(client);
  });

  return clusters.filter((c) => c.length > 0);
}

// Otimiza múltiplas rotas usando a API V1
export async function optimizeMultiRoutes({
  matrizCoords,
  vehicles,
  clients,
  mapboxToken,
  startTime = "08:00",
  serviceTime = 20,
  trafficBuffer = 10,
}) {
  const numVehicles = vehicles.length;

  // 1. Dividir clientes em clusters
  const clusters = clusterClients(clients, numVehicles, matrizCoords);

  // 2. Otimizar cada cluster como rota independente
  const routes = [];

  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    const vehicle = vehicles[i] || vehicles[vehicles.length - 1];

    if (cluster.length === 0) continue;

    // Monta pontos: matriz + clientes + matriz (retorno)
    const points = [
      {
        nome: "Matriz",
        endereco: matrizCoords.endereco || "Matriz",
        latitude: matrizCoords.latitude,
        longitude: matrizCoords.longitude,
      },
      ...cluster.map((c) => ({
        nome: c.nome,
        endereco: c.endereco,
        latitude: c.latitude,
        longitude: c.longitude,
        id: c.id,
        telefone: c.telefone,
      })),
    ];

    // Otimizar com API V1
    const optimizationData = await optimizeRoute(points, mapboxToken);

    const result = processOptimizationResult(
      optimizationData,
      points,
      startTime,
      serviceTime,
      trafficBuffer
    );

    if (result.optimized_route.length === 0) continue;

    // Formata stops
    const stops = result.optimized_route.map((stop, idx) => ({
      order: idx + 1,
      client_name: stop.client_name,
      client_id: cluster.find((c) => c.nome === stop.client_name)?.id || null,
      address: stop.address,
      latitude: stop.latitude,
      longitude: stop.longitude,
      estimated_arrival: stop.estimated_arrival,
      type:
        idx === 0
          ? "start"
          : idx === result.optimized_route.length - 1
          ? "end"
          : "service",
    }));

    routes.push({
      vehicle_id: vehicle.id,
      vehicle_name: vehicle.name,
      vehicle_placa: vehicle.placa || "",
      motorista_nome: vehicle.motorista_nome || "",
      motorista_id: vehicle.motorista_id || "",
      motorista_email: vehicle.motorista_email || "",
      color: ROUTE_COLORS[i % ROUTE_COLORS.length],
      stops,
      route_geometry: result.route_geometry,
      total_entregas: stops.filter(
        (s) => s.type !== "start" && s.type !== "end"
      ).length,
      total_distance_km: Math.round(result.total_distance_km * 10) / 10,
      total_time_minutes: Math.round(result.total_time_minutes),
    });
  }

  return { routes, dropped: { services: [] } };
}