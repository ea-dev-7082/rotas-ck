import React, { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import { Map, Navigation, Home } from "lucide-react";
import { motion } from "framer-motion";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Correção dos assets (mantida pois é essencial)
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

const customMarkerStyle = `
  .custom-marker-icon {
    background: transparent !important;
    border: none !important;
  }
`;

// --- FUNÇÃO DE CORREÇÃO DE COORDENADAS ---
// Transforma "-22,987" ou "-22.987" em número real -22.987
const parseCoordinate = (coord) => {
  if (coord === null || coord === undefined) return null;
  if (typeof coord === "number") return coord;
  
  // Se for string, troca vírgula por ponto e tenta converter
  const stringCoord = coord.toString().replace(",", ".");
  const parsed = parseFloat(stringCoord);
  
  return isNaN(parsed) ? null : parsed;
};

export default function RouteMap({ route, pontoPartida, routeGeometry }) {
  useEffect(() => {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: iconRetinaUrl.src || iconRetinaUrl,
      iconUrl: iconUrl.src || iconUrl,
      shadowUrl: shadowUrl.src || shadowUrl,
    });
  }, []);

  if (!route || route.length === 0) return null;

  // 1. FILTRAGEM ROBUSTA (Com Log para Debug)
  const validRoute = route.map(point => {
    const lat = parseCoordinate(point.latitude);
    const lng = parseCoordinate(point.longitude);

    // Se falhar, avisa no console qual cliente está com erro
    if (lat === null || lng === null) {
      console.warn(`⚠️ Cliente ignorado por coordenada inválida: ${point.client_name}`, point);
      return null;
    }

    return { ...point, latitude: lat, longitude: lng };
  }).filter(Boolean); // Remove os nulos

  if (validRoute.length === 0) {
    return (
      <Card className="bg-white shadow-xl">
        <CardContent className="p-6 text-center text-red-600">
          Erro: Nenhuma coordenada válida encontrada. Verifique se os endereços possuem Latitude/Longitude.
        </CardContent>
      </Card>
    );
  }

  // Define o centro do mapa
  const center = [
    validRoute.reduce((sum, point) => sum + point.latitude, 0) / validRoute.length,
    validRoute.reduce((sum, point) => sum + point.longitude, 0) / validRoute.length,
  ];

  // Prepara a linha azul (Geometria)
  const routePositions = routeGeometry && routeGeometry.length > 0
    ? routeGeometry.map(coord => [coord[1], coord[0]]) // Mapbox manda [lng, lat], Leaflet quer [lat, lng]
    : validRoute.sort((a, b) => a.order - b.order).map(point => [point.latitude, point.longitude]);

  // Divisão Ida/Volta (Visual)
  const lastDeliveryPoint = validRoute.find(p => p.order === validRoute.length - 1);
  let splitIndex = routePositions.length;
  
  if (lastDeliveryPoint && routeGeometry && routeGeometry.length > 0) {
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
  
  const routeIda = routePositions.slice(0, splitIndex + 1);
  const routeVolta = routePositions.slice(splitIndex);

  const getMarkerColor = (order, isMatriz) => {
    if (isMatriz) return "#10b981"; // Verde
    if (order === 1) return "#10b981"; 
    if (order === route.length) return "#10b981"; 
    return "#3b82f6"; // Azul
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2 }}
    >
      <style>{customMarkerStyle}</style>
      
      <Card className="bg-white shadow-xl overflow-hidden">
        <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Map className="w-5 h-5 text-blue-600" />
            Mapa da Rota Otimizada
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[400px] w-full relative z-0">
            <MapContainer
              center={center}
              zoom={12}
              className="h-full w-full"
              zoomControl={true}
              // CHAVE CRÍTICA: Se mudar a quantidade de pontos, reseta o mapa
              key={`map-${validRoute.length}-${center[0]}`} 
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />

              <Polyline
                positions={routeIda}
                pathOptions={{ color: "#3b82f6", weight: 5, opacity: 0.8 }}
              />
              
              {routeVolta.length > 1 && (
                <Polyline
                  positions={routeVolta}
                  pathOptions={{ color: "#f97316", weight: 5, opacity: 0.8, dashArray: "10, 10" }}
                />
              )}

              {validRoute.map((point, index) => {
                // Lógica para identificar Matriz e Ordem visual
                const isMatriz = point.client_name?.toLowerCase().includes("matriz") || point.order === 1 || point.order === route.length;
                
                // IMPORTANTE: Se o ponto 2 sumiu por erro de lat/long, o ponto 3 vira o segundo da lista
                // Usamos point.order original para manter o número correto na bolinha
                const displayLabel = isMatriz ? '🏠' : (point.order - 1);

                const markerHtml = `
                  <div style="
                    background-color: ${getMarkerColor(point.order, isMatriz)};
                    width: ${isMatriz ? '36px' : '30px'};
                    height: ${isMatriz ? '36px' : '30px'};
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                    font-size: ${isMatriz ? '16px' : '14px'};
                    border: 2px solid white;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                  ">
                    ${displayLabel}
                  </div>
                `;

                const icon = L.divIcon({
                  html: markerHtml,
                  className: "custom-marker-icon",
                  iconSize: [30, 30],
                  iconAnchor: [15, 15], // Centraliza exatamente no ponto
                  popupAnchor: [0, -15]
                });

                return (
                  <Marker
                    // Key única composta garante renderização
                    key={`marker-${point.client_name}-${index}`}
                    position={[point.latitude, point.longitude]}
                    icon={icon}
                  >
                    <Popup>
                      <div className="p-2 min-w-[200px]">
                        <strong className="block mb-1 text-sm">{point.client_name}</strong>
                        <span className="text-xs text-gray-600 block mb-2">{point.address}</span>
                        {point.estimated_arrival && (
                            <div className="text-xs bg-gray-100 p-1 rounded inline-block">
                                🕒 Chegada: {point.estimated_arrival}
                            </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}