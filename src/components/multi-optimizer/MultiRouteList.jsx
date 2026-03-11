import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  MapPin,
  Clock,
  User,
  Car,
  Truck,
  Package,
  AlertTriangle,
} from "lucide-react";

export default function MultiRouteList({ routes, dropped, onSelectRoute }) {
  const [expandedRoute, setExpandedRoute] = useState(null);

  const toggleExpand = (idx) => {
    setExpandedRoute(expandedRoute === idx ? null : idx);
  };

  return (
    <div className="space-y-4">
      {/* Resumo Geral */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500">Rotas Geradas</p>
              <p className="text-2xl font-bold text-indigo-600">{routes.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Entregas</p>
              <p className="text-2xl font-bold text-blue-600">
                {routes.reduce((sum, r) => sum + r.total_entregas, 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Distância Total</p>
              <p className="text-2xl font-bold text-green-600">
                {routes.reduce((sum, r) => sum + r.total_distance_km, 0).toFixed(1)} km
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Tempo Total</p>
              <p className="text-2xl font-bold text-purple-600">
                {Math.floor(routes.reduce((sum, r) => sum + r.total_time_minutes, 0) / 60)}h{" "}
                {Math.round(routes.reduce((sum, r) => sum + r.total_time_minutes, 0) % 60)}min
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Serviços não atendidos */}
      {dropped?.services?.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
              <p className="font-semibold text-sm">
                {dropped.services.length} entrega(s) não puderam ser atendidas
              </p>
            </div>
            <div className="mt-2 space-y-1">
              {dropped.services.map((svc, idx) => (
                <p key={idx} className="text-xs text-amber-600">
                  • {svc.name || svc}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Rotas */}
      {routes.map((route, idx) => (
        <Card
          key={idx}
          className="overflow-hidden border-2 transition-all"
          style={{ borderColor: route.color + "40" }}
        >
          <CardHeader
            className="py-3 px-4 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => toggleExpand(idx)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: route.color }}
                >
                  {idx + 1}
                </div>
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Car className="w-4 h-4" />
                    {route.vehicle_name}
                    {route.vehicle_placa && (
                      <span className="text-xs text-gray-500">
                        ({route.vehicle_placa})
                      </span>
                    )}
                  </CardTitle>
                  {route.motorista_nome && (
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {route.motorista_nome}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      {route.total_entregas}
                    </span>
                    <span>{route.total_distance_km.toFixed(1)} km</span>
                    <span>
                      {Math.floor(route.total_time_minutes / 60)}h{" "}
                      {Math.round(route.total_time_minutes % 60)}min
                    </span>
                  </div>
                </div>
                {expandedRoute === idx ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </div>

            {/* Stats Mobile */}
            <div className="flex gap-3 mt-2 sm:hidden">
              <Badge variant="outline" className="text-xs">
                <Package className="w-3 h-3 mr-1" />
                {route.total_entregas} entregas
              </Badge>
              <Badge variant="outline" className="text-xs">
                {route.total_distance_km.toFixed(1)} km
              </Badge>
            </div>
          </CardHeader>

          {/* Conteúdo expandido */}
          {expandedRoute === idx && (
            <CardContent className="px-4 pb-4 pt-0">
              <div className="space-y-2">
                {route.stops.map((stop, stopIdx) => {
                  const isMatriz =
                    stop.type === "start" || stop.type === "end";

                  return (
                    <div
                      key={stopIdx}
                      className={`p-3 rounded-lg border ${
                        isMatriz
                          ? "bg-green-50 border-green-200"
                          : "bg-white border-gray-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${
                            isMatriz ? "bg-green-500" : ""
                          }`}
                          style={
                            isMatriz ? {} : { backgroundColor: route.color }
                          }
                        >
                          {isMatriz
                            ? "🏠"
                            : stop.order -
                              route.stops.filter(
                                (s, i) =>
                                  i < stopIdx && s.type === "start"
                              ).length}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 truncate">
                            {stop.client_name}
                          </p>
                          <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            {stop.address}
                          </p>
                        </div>
                        {stop.estimated_arrival && (
                          <Badge
                            variant="outline"
                            className="flex-shrink-0 text-xs"
                          >
                            <Clock className="w-3 h-3 mr-1" />
                            {stop.estimated_arrival}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 mt-4 pt-3 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSelectRoute && onSelectRoute(route)}
                  className="flex-1"
                >
                  <Truck className="w-4 h-4 mr-2" />
                  Agendar esta Rota
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}