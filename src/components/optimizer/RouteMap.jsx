import React, { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import { Map, Navigation, Home } from "lucide-react";
import { motion } from "framer-motion";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// 1. CORREÇÃO DOS ÍCONES (Essencial para não ficarem invisíveis)
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

// Estilo para remover o quadrado branco padrão do Leaflet
const customMarkerStyle = `
  .custom-marker-icon {
    background: transparent !important;
    border: none !important;
  }
`;

// 2. FUNÇÃO DE BLINDAGEM DE COORDENADAS
// Converte qualquer formato (texto com vírgula, texto com ponto) para Número Real
const parseCoordinate = (coord) => {
  if (coord === null || coord === undefined) return null;
  
  // Se já for número, retorna
  if (typeof coord === "number") return coord;
  
  // Se for texto, troca vírgula por ponto e converte
  if (typeof coord === "string") {
    const stringCoord = coord.replace(",", ".");
    const parsed = parseFloat(stringCoord);
    return isNaN(parsed) ? null : parsed;
  }
  
  return null;
};

export default function RouteMap({ route, pontoPartida, routeGeometry }) {
  // Configuração inicial dos ícones
  useEffect(() => {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: iconRetinaUrl.src || iconRetinaUrl,
      iconUrl: iconUrl.src || iconUrl,
      shadowUrl: shadowUrl.src || shadowUrl,
    });
  }, []);

  if (!route || route.length === 0) return null;

  // 3. FILTRAGEM SEGURA
  // Garante que só entrem no mapa pontos com coordenadas válidas
  const validRoute = route.map(point => {
    const lat = parseCoordinate(point.latitude);
    const lng = parseCoordinate(point.longitude);

    // Se a conversão falhar, avisa no console mas não quebra o mapa
    if (lat === null || lng === null) {
      console.warn(`⚠️ Ponto ignorado (Coordenada inválida): ${point.client_name}`, point);
      return null;
    }

    // Retorna o ponto com as coordenadas corrigidas (números)
    return { ...point, latitude: lat, longitude: lng };
  }).filter(Boolean);

  if (validRoute.length === 0) {
    return (
      <Card className="bg-white shadow-xl">
        <CardContent className="p-6 text-center text-red-600">
          Erro: Nenhuma coordenada válida encontrada para exibição.
        </CardContent>
      </Card>
    );
  }

  // Define o centro do mapa baseado nos pontos válidos
  const center = [
    validRoute.reduce((sum, point) => sum + point.latitude, 0) / validRoute.length,
    validRoute.reduce((sum, point) => sum + point.longitude, 0) / validRoute.length,
  ];

  // Prepara a linha da rota (Geometria que vem do Mapbox)
  const routePositions = routeGeometry && routeGeometry.length > 0
    ? routeGeometry.map(coord => [coord[1], coord[0]]) // Mapbox manda [lng, lat], Leaflet usa [lat, lng]
    : validRoute.sort((a, b) => a.order - b.order).map(point => [point.latitude, point.longitude]);

  // Separa Ida e Volta visualmente
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
    if (isMatriz) return "#10b981"; // Verde (Matriz)
    if (order === 1) return "#10b981"; 
    if (order === route.length) return "#10b981"; 
    return "#3b82f6"; // Azul (Entregas)
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
              // 4. CHAVE DE RESET: Força o React a redesenhar o mapa se a rota mudar.
              // Isso corrige o problema de "pins fantasmas" ao trocar de rota.
              key={`map-${validRoute.length}-${center[0]}`} 
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />

              {/* Linha Azul Sólida (Ida) */}
              <Polyline
                positions={routeIda}
                pathOptions={{ color: "#3b82f6", weight: 5, opacity: 0.8 }}
              />
              
              {/* Linha Laranja Tracejada (Volta) */}
              {routeVolta.length > 1 && (
                <Polyline
                  positions={routeVolta}
                  pathOptions={{ color: "#f97316", weight: 5, opacity: 0.8, dashArray: "10, 10" }}
                />
              )}

              {/* Renderização dos Pinos */}
              {validRoute.map((point, index) => {
                const isMatriz = point.client_name?.toLowerCase().includes("matriz") || point.order === 1 || point.order === route.length;
                
                // O número exibido no pino é a Ordem - 1 (pois Matriz é 1)
                const displayLabel = isMatriz ? '🏠' : (point.order - 1);

                // HTML do ícone personalizado
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
                  iconAnchor: [15, 15], // Centraliza o pino exatamente na coordenada
                  popupAnchor: [0, -15]
                });

                return (
                  <Marker
                    // Chave única para evitar conflito de renderização
                    key={`marker-${point.client_name}-${index}`}
                    position={[point.latitude, point.longitude]}
                    icon={icon}
                  >
                    <Popup>
                      <div className="p-2 min-w-[200px]">
                        <strong className="block mb-1 text-sm">{point.client_name}</strong>
                        <span className="text-xs text-gray-600 block mb-2">{point.address}</span>
                        {point.estimated_arrival && (
                            <div className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded inline-block font-semibold">
                                🕒 Chegada: {point.estimated_arrival}
                            </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>

            {/* Legenda do Mapa */}
            <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 z-[1000] border border-gray-100">
               <div className="space-y-2 text-xs">
                 <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-green-500"></div>
                   <span className="text-gray-700">Matriz</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                   <span className="text-gray-700">Entregas</span>
                 </div>
               </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}