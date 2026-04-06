import React, { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Search, CheckCircle2, XCircle, UserRound, ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

const ITEMS_PER_PAGE = 50; // Renderiza 50 por vez para performance

export default function ClientSelector({
  clientes,
  selectedClients,
  onSelectionChange,
  isLoading,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const scrollRef = useRef(null);

  // Reseta a contagem visível quando muda a busca
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [searchTerm]);

  // Filtra TODOS os clientes (sem slice)
  const filteredClientes = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return clientes;

    return clientes.filter((cliente) => {
      const nome = cliente.nome?.toLowerCase() || "";
      const endereco = cliente.endereco?.toLowerCase() || "";
      const bairro = cliente.bairro?.toLowerCase() || "";
      const municipio = cliente.municipio?.toLowerCase() || "";

      return (
        nome.includes(term) ||
        endereco.includes(term) ||
        bairro.includes(term) ||
        municipio.includes(term)
      );
    });
  }, [clientes, searchTerm]);

  // Apenas os itens visíveis na tela (renderização progressiva)
  const displayedClientes = useMemo(
    () => filteredClientes.slice(0, visibleCount),
    [filteredClientes, visibleCount]
  );

  const hasMore = visibleCount < filteredClientes.length;
  const remainingCount = filteredClientes.length - visibleCount;

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + ITEMS_PER_PAGE, filteredClientes.length));
  }, [filteredClientes.length]);

  // Detecta scroll perto do final para carregar mais automaticamente
  const handleScroll = useCallback((e) => {
    const target = e.target;
    if (!target) return;

    const { scrollTop, scrollHeight, clientHeight } = target;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;

    if (isNearBottom && hasMore) {
      handleLoadMore();
    }
  }, [hasMore, handleLoadMore]);

  const handleToggle = (clienteId) => {
    if (selectedClients.includes(clienteId)) {
      onSelectionChange(selectedClients.filter((id) => id !== clienteId));
    } else {
      onSelectionChange([...selectedClients, clienteId]);
    }
  };

  const handleSelectAll = () => {
    // Selecionar/desmarcar TODOS os filtrados (não apenas os visíveis)
    const allFilteredIds = filteredClientes.map((c) => c.id);
    const allSelected = allFilteredIds.every((id) => selectedClients.includes(id));

    if (allSelected) {
      // Remove apenas os filtrados da seleção (mantém outros já selecionados)
      onSelectionChange(
        selectedClients.filter((id) => !allFilteredIds.includes(id))
      );
    } else {
      // Adiciona todos os filtrados à seleção atual (sem duplicar)
      const newSelection = [...new Set([...selectedClients, ...allFilteredIds])];
      onSelectionChange(newSelection);
    }
  };

  // Verifica se TODOS os filtrados estão selecionados
  const allFilteredSelected = useMemo(() => {
    if (filteredClientes.length === 0) return false;
    return filteredClientes.every((c) => selectedClients.includes(c.id));
  }, [filteredClientes, selectedClients]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array(5)
          .fill(0)
          .map((_, i) => (
            <div key={i} className="p-4 border rounded-lg">
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Buscar por nome, endereço, bairro ou município..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            {selectedClients.length} selecionados
          </Badge>
          <Badge variant="secondary" className="text-sm text-gray-500">
            {filteredClientes.length} encontrados
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSelectAll}
          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
        >
          {allFilteredSelected ? (
            <>
              <XCircle className="w-4 h-4 mr-1" />
              Desmarcar Todos
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Selecionar Todos ({filteredClientes.length})
            </>
          )}
        </Button>
      </div>

      {/* Client List com scroll infinito */}
      <ScrollArea
        className="h-[400px] pr-4"
        ref={scrollRef}
        onScrollCapture={handleScroll}
      >
        <div className="space-y-3">
          {displayedClientes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Nenhum cliente encontrado</p>
            </div>
          ) : (
            <>
              {displayedClientes.map((cliente) => {
                const isSelected = selectedClients.includes(cliente.id);
                return (
                  <div
                    key={cliente.id}
                    onClick={() => handleToggle(cliente.id)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                      isSelected
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleToggle(cliente.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="font-semibold text-gray-900">
                            {cliente.nome}
                          </h4>
                          {cliente.isManual && (
                            <Badge
                              variant="outline"
                              className="border-amber-300 text-amber-700"
                            >
                              <UserRound className="w-3 h-3 mr-1" />
                              Manual
                            </Badge>
                          )}
                          {isSelected && (
                            <Badge className="bg-blue-500 text-white">
                              Selecionado
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-start gap-2 text-sm text-gray-600 mb-2">
                          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <p className="leading-relaxed">
                            {cliente.endereco}
                          </p>
                        </div>
                        {cliente.telefone && (
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Phone className="w-4 h-4" />
                            <span>{cliente.telefone}</span>
                          </div>
                        )}
                        {cliente.observacoes && (
                          <p className="text-xs text-gray-500 mt-2 italic">
                            {cliente.observacoes}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Botão Carregar Mais */}
              {hasMore && (
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  className="w-full mt-2 border-dashed border-gray-300 text-gray-500 hover:text-blue-600 hover:border-blue-300"
                >
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Carregar mais ({remainingCount} restantes)
                </Button>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
