import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { List, MapPin, Clock, RefreshCw, User, Home, Navigation, GripVertical, Printer, FileText } from "lucide-react";
import { motion } from "framer-motion";

export default function DraggableRouteList({ route, onReorder, onPrint, notasFiscais, onOpenNotaFiscal, onRefreshTimes }) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);



  if (!route || route.length === 0) return null;

  const matrizInicio = route[0];
  const matrizFim = route[route.length - 1];
  const entregas = route.slice(1, -1);

  const handleRefreshTimes = async () => {
    if (!onRefreshTimes) return;
    setIsRefreshing(true);
    await onRefreshTimes();
    setIsRefreshing(false);
  };

  const handleOpenWaze = () => {
    if (entregas.length > 0) {
      const firstStop = entregas[0];
      const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(firstStop.address)}&navigate=yes`;
      window.open(wazeUrl, '_blank');
    }
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    
    if (sourceIndex === destIndex) return;

    const newEntregas = Array.from(entregas);
    const [movedItem] = newEntregas.splice(sourceIndex, 1);
    newEntregas.splice(destIndex, 0, movedItem);

    onReorder(newEntregas, destIndex);
  };

  const renderMatrizCard = (point, label, isFirst) => (
    <div className={`p-4 rounded-xl border-2 bg-green-50 border-green-200`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 shadow-md bg-green-500">
          <Home className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <Badge className="bg-green-500 text-white hover:bg-green-600 mb-2">
            {label}
          </Badge>
          <div className="flex items-start gap-2 mb-2">
            <Home className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
            <p className="font-bold leading-relaxed text-green-700">
              {point.client_name}
            </p>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
            <p className="text-gray-700 leading-relaxed">{point.address}</p>
          </div>
          
          {!isFirst && point.estimated_arrival && (
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
              <Clock className="w-4 h-4" />
              <span>Chegada prevista: {point.estimated_arrival}</span>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Card className="bg-white shadow-xl">
        <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-xl">
              <List className="w-5 h-5 text-indigo-600" />
              Sequência de Entregas
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onPrint}
                className="gap-2"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshTimes}
                disabled={isRefreshing}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Atualizando...' : 'Atualizar Horários'}
              </Button>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Arraste os cartões para alterar a prioridade. As entregas seguintes serão reordenadas automaticamente.
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-3">
            {renderMatrizCard(matrizInicio, "Saída - Matriz", true)}

            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="entregas">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-3"
                  >
                    {entregas.map((point, index) => (
                      <Draggable
                        key={`entrega-${index}`}
                        draggableId={`entrega-${index}`}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`p-4 rounded-xl border-2 transition-all bg-blue-50 border-blue-200 ${
                              snapshot.isDragging ? "shadow-lg ring-2 ring-blue-400" : "hover:shadow-md"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                {...provided.dragHandleProps}
                                className="mt-2 cursor-grab active:cursor-grabbing"
                              >
                                <GripVertical className="w-5 h-5 text-gray-400" />
                              </div>
                              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 shadow-md bg-blue-500">
                                {index + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <Badge className="bg-blue-500 text-white hover:bg-blue-600 mb-2">
                                  Entrega {index + 1}
                                </Badge>
                                <div className="flex items-start gap-2 mb-2">
                                  <User className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
                                  <p className="font-bold leading-relaxed text-gray-900">
                                    {point.client_name}
                                  </p>
                                </div>
                                <div className="flex items-start gap-2">
                                  <MapPin className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
                                  <p className="text-gray-700 leading-relaxed">
                                    {point.address}
                                  </p>
                                </div>
                                {point.estimated_arrival && (
                                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                                    <Clock className="w-4 h-4" />
                                    <span>Chegada prevista: {point.estimated_arrival}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenNotaFiscal && onOpenNotaFiscal(point.client_name);
                                    }}
                                    className="gap-2"
                                  >
                                    <FileText className="w-4 h-4" />
                                    Notas Fiscais
                                    {notasFiscais?.[point.client_name]?.length > 0 && (
                                      <Badge className="bg-blue-500 text-white ml-1">
                                        {notasFiscais[point.client_name].length}
                                      </Badge>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            {renderMatrizCard(matrizFim, "Retorno - Matriz", false)}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <Button
              onClick={handleOpenWaze}
              className="w-full h-14 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              <Navigation className="w-6 h-6 mr-3" />
              Abrir Rota no Waze
            </Button>
            <p className="text-xs text-gray-500 text-center mt-2">
              Abrirá o Waze com a primeira entrega
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}