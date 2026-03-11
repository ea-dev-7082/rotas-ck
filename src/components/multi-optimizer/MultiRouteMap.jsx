import React, { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import { Map } from "lucide-react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

const customMarkerStyle = `
  .custom-marker-icon {
    background: transparent !important;
    border: none !important;
  }
`;

export default function MultiRouteMap({ routes, matrizData }) {
  useEffect(() => {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: iconRetinaUrl.src || iconRetinaUrl,
      iconUrl: iconUrl.src || iconUrl,
      shadowUrl: shadowUrl.src || shadowUrl,
    });
  }, []);

  if (!routes || routes.length === 0) return null;

  // Coleta todos os pontos válidos de todas as rotas
  const allPoints = [];
  routes.forEach((route) => {
    route.stops.forEach((stop) => {
      if (stop.latitude && stop.longitude) {
        allPoints.push(stop);
      }
    });
  });

  if (allPoints.length === 0) return null;

  const center = [
    allPoints.reduce((sum, p) => sum + p.latitude, 0) / allPoints.length,
    allPoints.reduce((sum, p) => sum + p.longitude, 0) / allPoints.length,
  ];

  return (
    <>
      <style>{customMarkerStyle}</style>
      <Card className="bg-white shadow-xl overflow-hidden">
        <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Map className="w-5 h-5 text-indigo-600" />
            Mapa Multi-Rotas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[500px] w-full relative z-0">
            <MapContainer
              center={center}
              zoom={11}
              className="h-full w-full"
              key={`multi-map-${routes.length}-${allPoints.length}`}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />

              {/* Polylines para cada rota */}
              {routes.map((route, routeIdx) => {
                const positions = route.stops
                  .filter((s) => s.latitude && s.longitude)
                  .sort((a, b) => a.order - b.order)
                  .map((s) => [s.latitude, s.longitude]);

                return (
                  <Polyline
                    key={`route-line-${routeIdx}`}
                    positions={positions}
                    pathOptions={{
                      color: route.color,
                      weight: 4,
                      opacity: 0.8,
                    }}
                  />
                );
              })}

              {/* Marcador da Matriz */}
              {matrizData?.latitude && matrizData?.longitude && (
                <Marker
                  position={[matrizData.latitude, matrizData.longitude]}
                  icon={L.divIcon({
                    html: `<div style="background-color:#10b981;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:16px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">🏠</div>`,
                    className: "custom-marker-icon",
                    iconSize: [36, 36],
                    iconAnchor: [18, 18],
                  })}
                >
                  <Popup>
                    <strong>Matriz</strong>
                    <br />
                    <span className="text-xs">{matrizData.endereco}</span>
                  </Popup>
                </Marker>
              )}

              {/* Marcadores de cada rota */}
              {routes.map((route, routeIdx) =>
                route.stops
                  .filter(
                    (s) =>
                      s.latitude &&
                      s.longitude &&
                      s.type !== "start" &&
                      s.type !== "end"
                  )
                  .map((stop, stopIdx) => {
                    const icon = L.divIcon({
                      html: `<div style="background-color:${route.color};width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:12px;border:2px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3);">${stopIdx + 1}</div>`,
                      className: "custom-marker-icon",
                      iconSize: [28, 28],
                      iconAnchor: [14, 14],
                    });

                    return (
                      <Marker
                        key={`route-${routeIdx}-stop-${stopIdx}`}
                        position={[stop.latitude, stop.longitude]}
                        icon={icon}
                      >
                        <Popup>
                          <div className="p-1 min-w-[180px]">
                            <strong className="text-sm">{stop.client_name}</strong>
                            <p className="text-xs text-gray-500">{stop.address}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className="inline-block w-3 h-3 rounded-full"
                                style={{ backgroundColor: route.color }}
                              />
                              <span className="text-xs font-medium">
                                {route.vehicle_name}
                              </span>
                            </div>
                            {stop.estimated_arrival && (
                              <p className="text-xs text-blue-600 mt-1 font-medium">
                                🕒 {stop.estimated_arrival}
                              </p>
                            )}
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })
              )}
            </MapContainer>

            {/* Legenda */}
            <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 z-[1000] border">
              <p className="text-xs font-bold text-gray-700 mb-2">Rotas</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>Matriz</span>
                </div>
                {routes.map((route, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: route.color }}
                    />
                    <span className="truncate max-w-[120px]">
                      {route.vehicle_name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}