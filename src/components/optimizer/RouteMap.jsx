import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import { Map, Navigation } from "lucide-react";
import { motion } from "framer-motion";
import "leaflet/dist/leaflet.css";

export default function RouteMap({ route }) {
  if (!route || route.length === 0) return null;

  // Calculate center of map
  const center = [
    route.reduce((sum, point) => sum + point.latitude, 0) / route.length,
    route.reduce((sum, point) => sum + point.longitude, 0) / route.length,
  ];

  // Create polyline coordinates
  const polylinePositions = route.map((point) => [
    point.latitude,
    point.longitude,
  ]);

  // Create custom marker colors based on order
  const getMarkerColor = (order) => {
    if (order === 1) return "#22c55e"; // green for start
    if (order === route.length) return "#ef4444"; // red for end
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
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Route line */}
              <Polyline
                positions={polylinePositions}
                color="#3b82f6"
                weight={4}
                opacity={0.7}
              />

              {/* Markers */}
              {route.map((point, index) => {
                const markerHtml = `
                  <div style="
                    background-color: ${getMarkerColor(point.order)};
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                    font-size: 14px;
                    border: 3px solid white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                  ">
                    ${point.order}
                  </div>
                `;

                const icon = L.divIcon({
                  html: markerHtml,
                  className: "custom-marker",
                  iconSize: [32, 32],
                  iconAnchor: [16, 16],
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
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{
                              backgroundColor: getMarkerColor(point.order),
                            }}
                          >
                            {point.order}
                          </div>
                          <span className="font-semibold">
                            {point.order === 1
                              ? "Início"
                              : point.order === route.length
                              ? "Último"
                              : `Parada ${point.order}`}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-1">
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
                  <span className="text-gray-700">Início</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-gray-700">Paradas</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-gray-700">Último</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}