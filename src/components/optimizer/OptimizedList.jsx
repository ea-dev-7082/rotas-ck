import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { List, MapPin, Clock, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function OptimizedList({ route }) {
  const [copied, setCopied] = React.useState(false);

  if (!route || route.length === 0) return null;

  const handleCopyList = () => {
    const text = route
      .map((point) => `${point.order}. ${point.address}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Card className="bg-white shadow-xl">
        <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl">
              <List className="w-5 h-5 text-indigo-600" />
              Sequência de Entregas
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyList}
              className="gap-2"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copiar Lista
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-3">
            {route.map((point, index) => {
              const isFirst = point.order === 1;
              const isLast = point.order === route.length;

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className={`p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                    isFirst
                      ? "bg-green-50 border-green-200"
                      : isLast
                      ? "bg-red-50 border-red-200"
                      : "bg-blue-50 border-blue-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 shadow-md ${
                        isFirst
                          ? "bg-green-500"
                          : isLast
                          ? "bg-red-500"
                          : "bg-blue-500"
                      }`}
                    >
                      {point.order}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {isFirst && (
                          <Badge className="bg-green-500 text-white hover:bg-green-600">
                            Início
                          </Badge>
                        )}
                        {isLast && (
                          <Badge className="bg-red-500 text-white hover:bg-red-600">
                            Último
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
                        <p className="text-gray-900 font-medium leading-relaxed">
                          {point.address}
                        </p>
                      </div>
                      {point.estimated_arrival && (
                        <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                          <Clock className="w-4 h-4" />
                          <span>Chegada prevista: {point.estimated_arrival}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}