import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import { Map, Navigation, Home } from "lucide-react";
import { motion } from "framer-motion";
import "leaflet/dist/leaflet.css";

export default function RouteMap({ route, pontoPartida, routeGeometry }) {
  if (!route || route.length === 0) return null;

  // Filter out invalid points
  const validRoute = route.filter(point => 
    point.latitude && 
    point.longitude && 
    !isNaN(point.latitude) && 
    !isNaN(point.longitude) &&
    Math.abs(point.latitude) <= 90 &&
    Math.abs(point.longitude) <= 180
  );

  if (validRoute.length === 0) {
    return (
      <Card className="bg-white shadow-xl">
        <CardContent className="p-6 text-center text-red-600">
          Erro: Coordenadas inválidas na rota. Por favor, otimize novamente.
        </CardContent>
      </Card>
    );
  }

  // Calculate center of map
  const center = [
    validRoute.reduce((sum, point) => sum + point.latitude, 0) / validRoute.length,
    validRoute.reduce((sum, point) => sum + point.longitude, 0) / validRoute.length,
  ];

  // Create polyline from Mapbox geometry (GeoJSON format: [lng, lat])
  // Convert to Leaflet format: [lat, lng]
  const routePositions = routeGeometry && routeGeometry.length > 0
    ? routeGeometry.map(coord => [coord[1], coord[0]])
    : validRoute.sort((a, b) => a.order - b.order).map(point => [point.latitude, point.longitude]);

  // Encontrar o ponto aproximado da última entrega para dividir ida/volta
  const lastDeliveryPoint = validRoute.find(p => p.order === validRoute.length - 1);
  let splitIndex = routePositions.length;
  
  if (lastDeliveryPoint && routeGeometry && routeGeometry.length > 0) {
    // Encontrar o índice mais próximo da última entrega na geometria
    let minDist = Infinity;
    routePositions.forEach((pos, idx) => {
      const dist = Math.pow(pos[0] - lastDeliveryPoint.latitude, 2) + 
                   Math.pow(pos[1] - lastDeliveryPoint.longitude, 2);
      if (dist < minDist) {
        minDist = dist;
        splitIndex = idx;
      }
    });
  }
  
  // Dividir a rota em ida e volta
  const routeIda = routePositions.slice(0, splitIndex + 1);
  const routeVolta = routePositions.slice(splitIndex);

  // Create custom marker colors based on order
  const getMarkerColor = (order, isMatriz) => {
    if (isMatriz) return "#10b981"; // green for matriz
    if (order === 1) return "#10b981"; // green for start (also matriz)
    if (order === validRoute.length) return "#10b981"; // green for end (return to matriz)
    return "#3b82f6"; // blue for middle points
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2 }}
    >
      <Card className="bg-white shadow-xl overflow-hidden">
        <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Map className="w-5 h-5 text-blue-600" />
            Mapa da Rota Otimizada
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[400px] w-full relative">
            <MapContainer
              center={center}
              zoom={12}
              className="h-full w-full"
              zoomControl={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />

              {/* Route line - Ida (azul) */}
              <Polyline
                positions={routeIda}
                color="#3b82f6"
                weight={5}
                opacity={0.8}
              />
              
              {/* Route line - Volta (laranja) */}
              {routeVolta.length > 1 && (
                <Polyline
                  positions={routeVolta}
                  color="#f97316"
                  weight={5}
                  opacity={0.8}
                  dashArray="10, 10"
                />
              )}

              {/* Markers */}
              {validRoute.map((point, index) => {
                const isMatriz = point.client_name?.includes("Matriz") || point.order === 1 || point.order === route.length;
                // Display number should be order - 1 for deliveries (since order 1 is Matriz)
                const displayNumber = point.order - 1;
                const markerHtml = `
                  <div style="
                    background-color: ${getMarkerColor(point.order, isMatriz)};
                    width: ${isMatriz ? '36px' : '32px'};
                    height: ${isMatriz ? '36px' : '32px'};
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                    font-size: ${isMatriz ? '16px' : '14px'};
                    border: 3px solid white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                  ">
                    ${isMatriz ? '🏠' : displayNumber}
                  </div>
                `;

                const icon = L.divIcon({
                  html: markerHtml,
                  className: "custom-marker",
                  iconSize: [isMatriz ? 36 : 32, isMatriz ? 36 : 32],
                  iconAnchor: [isMatriz ? 18 : 16, isMatriz ? 18 : 16],
                });

                return (
                  <Marker
                    key={index}
                    position={[point.latitude, point.longitude]}
                    icon={icon}
                  >
                    <Popup>
                      <div className="p-2">
                        <div className="flex items-center gap-2 mb-2">
                          {isMatriz ? (
                            <div className="flex items-center gap-1">
                              <Home className="w-4 h-4 text-green-600" />
                              <span className="font-semibold text-green-700">
                                {point.order === 1 ? "Saída - Matriz" : "Retorno - Matriz"}
                              </span>
                            </div>
                          ) : (
                            <>
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                style={{
                                  backgroundColor: getMarkerColor(point.order, isMatriz),
                                }}
                              >
                                {point.order - 1}
                              </div>
                              <span className="font-semibold">Entrega {point.order - 1}</span>
                            </>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-900 mb-1">
                          {point.client_name}
                        </p>
                        <p className="text-xs text-gray-700 mb-1">
                          {point.address}
                        </p>
                        {point.estimated_arrival && (
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Navigation className="w-3 h-3" />
                            Chegada: {point.estimated_arrival}
                          </p>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>

            {/* Legend */}
            <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 z-[1000]">
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-gray-700">Matriz (Início/Fim)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-gray-700">Entregas</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-0.5 bg-blue-500"></div>
                  <span className="text-gray-700">Ida</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-0.5 bg-orange-500" style={{backgroundImage: 'repeating-linear-gradient(90deg, #f97316 0, #f97316 4px, transparent 4px, transparent 8px)'}}></div>
                  <span className="text-gray-700">Volta</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}