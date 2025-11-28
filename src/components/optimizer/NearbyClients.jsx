import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, TrendingUp, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function NearbyClients({ nearbyClients }) {
  if (!nearbyClients || nearbyClients.length === 0) return null;

  // Criar uma key única baseada nos nomes dos clientes para forçar re-render
  const listKey = nearbyClients.map(c => c.nome).join('-');

  return (
    <motion.div
      key={listKey}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 shadow-xl">
        <CardHeader className="border-b border-amber-200">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="w-5 h-5 text-amber-600" />
            Clientes Próximos - Oportunidade de Promoção
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Aproveite a rota otimizada para visitar estes clientes próximos e oferecer promoções especiais
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {nearbyClients.map((cliente, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 * index }}
                className="p-4 rounded-xl border-2 border-amber-200 bg-white hover:shadow-lg transition-all hover:border-amber-400"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-100 flex-shrink-0 shadow-md">
                    <TrendingUp className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-bold text-gray-900 leading-tight">
                        {cliente.nome}
                      </h4>
                      <Badge className="bg-amber-500 text-white hover:bg-amber-600 flex-shrink-0">
                        Próximo
                      </Badge>
                    </div>
                    <div className="flex items-start gap-2 mb-2 text-sm text-gray-700">
                      <MapPin className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="leading-relaxed">{cliente.endereco}</p>
                    </div>
                    {cliente.telefone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <Phone className="w-4 h-4 text-amber-500" />
                        <span>{cliente.telefone}</span>
                      </div>
                    )}
                    {cliente.proximity_reason && (
                      <div className="mt-3 pt-3 border-t border-amber-100">
                        <p className="text-xs text-amber-700 italic">
                          <strong>Por que visitar:</strong> {cliente.proximity_reason}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}