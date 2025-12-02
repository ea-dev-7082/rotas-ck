import React, { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import { Map, Navigation, Home } from "lucide-react";
import { motion } from "framer-motion";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Correção dos assets padrão do Leaflet (Prevenção de bugs de ícone sumido)
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

// Estilo para garantir que o DivIcon não tenha fundo branco/borda padrão
const customMarkerStyle = `
  .custom-marker-icon {
    background: transparent !important;
    border: none !important;
  }
`;

export default function RouteMap({ route, pontoPartida, routeGeometry }) {
  // Efeito para garantir carregamento dos assets
  useEffect(() => {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: iconRetinaUrl.src || iconRetinaUrl,
      iconUrl: iconUrl.src || iconUrl,
      shadowUrl: shadowUrl.src || shadowUrl,
    });
  }, []);

  if (!route || route.length === 0) return null;

  // 1. FILTRAGEM E SANITIZAÇÃO RIGOROSA
  const validRoute = route.filter(point => {
    const lat = Number(point.latitude);
    const lng = Number(point.longitude);
    return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
  });

  if (validRoute.length === 0) {
    return (
      <Card className="bg-white shadow-xl">
        <CardContent className="p-6 text-center text-red-600">
          Erro: Coordenadas inválidas. Verifique o cadastro dos clientes.
        </CardContent>
      </Card>
    );
  }

  const center = [
    validRoute.reduce((sum, point) => sum + Number(point.latitude), 0) / validRoute.length,
    validRoute.reduce((sum, point) => sum + Number(point.longitude), 0) / validRoute.length,
  ];

  // Preparação da geometria da linha
  const routePositions = routeGeometry && routeGeometry.length > 0
    ? routeGeometry.map(coord => [coord[1], coord[0]])
    : validRoute.sort((a, b) => a.order - b.order).map(point => [Number(point.latitude), Number(point.longitude)]);

  // Lógica de divisão Ida/Volta
  const lastDeliveryPoint = validRoute.find(p => p.order === validRoute.length - 1);
  let splitIndex = routePositions.length;
  
  if (lastDeliveryPoint && routeGeometry && routeGeometry.length > 0) {
    let minDist = Infinity;
    routePositions.forEach((pos, idx) => {
      const dist = Math.pow(pos[0] - Number(lastDeliveryPoint.latitude), 2) + 
                   Math.pow(pos[1] - Number(lastDeliveryPoint.longitude), 2);
      if (dist < minDist) {
        minDist = dist;
        splitIndex = idx;
      }
    });
  }
  
  const routeIda = routePositions.slice(0, splitIndex + 1);
  const routeVolta = routePositions.slice(splitIndex);

  const getMarkerColor = (order, isMatriz) => {
    if (isMatriz) return "#10b981"; 
    if (order === 1) return "#10b981"; 
    if (order === validRoute.length) return "#10b981"; 
    return "#3b82f6"; 
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
              // 2. CHAVE MÁGICA: Força o re-render total se a quantidade de pontos ou o centro mudar
              // Isso resolve 99% dos problemas de pins desaparecidos
              key={`${validRoute.length}-${center[0]}`} 
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
                const isMatriz = point.client_name?.includes("Matriz") || point.order === 1 || point.order === route.length;
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
                  className: "custom-marker-icon",
                  iconSize: [isMatriz ? 36 : 32, isMatriz ? 36 : 32],
                  iconAnchor: [isMatriz ? 18 : 16, isMatriz ? 18 : 16],
                  popupAnchor: [0, -10]
                });

                return (
                  <Marker
                    // 3. CHAVE ÚNICA ROBUSTA: Usa o nome do cliente + index
                    // Evita que o React reutilize markers errados
                    key={`${point.client_name}-${index}-${point.order}`}
                    position={[Number(point.latitude), Number(point.longitude)]}
                    icon={icon}
                  >
                    <Popup>
                      <div className="p-2 min-w-[200px]">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold">{point.client_name}</span>
                        </div>
                        <p className="text-xs text-gray-700">{point.address}</p>
                        {point.estimated_arrival && (
                          <p className="text-xs text-gray-500 mt-1">
                            Chegada: {point.estimated_arrival}
                          </p>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>

            {/* Legenda (Mantida igual) */}
            <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 z-[1000]">
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