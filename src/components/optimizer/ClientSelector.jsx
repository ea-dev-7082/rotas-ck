import React, { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Phone,
  Search,
  CheckCircle2,
  XCircle,
  UserRound,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const ITEMS_PER_PAGE = 50;
const SCROLL_THRESHOLD = 300;

// ========== ITEM INDIVIDUAL (memo para evitar re-render) ==========
const ClientItem = React.memo(({ cliente, isSelected, onToggle }) => (
  <div
    onClick={() => onToggle(cliente.id)}
    className={`p-3 border-2 rounded-lg cursor-pointer transition-colors ${
      isSelected
        ? "border-blue-500 bg-blue-50"
        : "border-gray-200 hover:border-blue-300"
    }`}
  >
    <div className="flex items-start gap-3">
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onToggle(cliente.id)}
        className="mt-1"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h4 className="font-semibold text-gray-900 text-sm">
            {cliente.nome}
          </h4>
          {cliente.isManual && (
            <Badge
              variant="outline"
              className="border-amber-300 text-amber-700 text-xs px-1.5 py-0"
            >
              <UserRound className="w-3 h-3 mr-1" />
              Manual
            </Badge>
          )}
          {isSelected && (
            <Badge className="bg-blue-500 text-white text-xs px-1.5 py-0">
              ✓
            </Badge>
          )}
        </div>
        <div className="flex items-start gap-1.5 text-xs text-gray-600">
          <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <p className="leading-relaxed line-clamp-2">{cliente.endereco}</p>
        </div>
        {cliente.telefone && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
            <Phone className="w-3.5 h-3.5" />
            <span>{cliente.telefone}</span>
          </div>
        )}
      </div>
    </div>
  </div>
));

ClientItem.displayName = "ClientItem";

// ========== COMPONENTE PRINCIPAL ==========
export default function ClientSelector({
  clientes,
  selectedClients,
  onSelectionChange,
  isLoading,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const listRef = useRef(null);
  const debounceTimer = useRef(null);

  // ========== DEBOUNCE DA BUSCA (300ms) ==========
  const handleSearchChange = useCallback((e) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
      setVisibleCount(ITEMS_PER_PAGE);
    }, 300);
  }, []);

  // Cleanup do timer
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  // ========== FILTRAGEM (usa debouncedSearch, não searchTerm) ==========
  const filteredClientes = useMemo(() => {
    const term = debouncedSearch.toLowerCase().trim();
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
  }, [clientes, debouncedSearch]);

  // ========== ITENS VISÍVEIS ==========
  const displayedClientes = useMemo(
    () => filteredClientes.slice(0, visibleCount),
    [filteredClientes, visibleCount]
  );

  const hasMore = visibleCount < filteredClientes.length;
  const remainingCount = filteredClientes.length - visibleCount;

  // ========== SET DE SELECIONADOS (lookup O(1) em vez de .includes O(n)) ==========
  const selectedSet = useMemo(
    () => new Set(selectedClients),
    [selectedClients]
  );

  // ========== HANDLERS ==========
  const handleToggle = useCallback(
    (clienteId) => {
      if (selectedSet.has(clienteId)) {
        onSelectionChange(selectedClients.filter((id) => id !== clienteId));
      } else {
        onSelectionChange([...selectedClients, clienteId]);
      }
    },
    [selectedClients, selectedSet, onSelectionChange]
  );

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) =>
      Math.min(prev + ITEMS_PER_PAGE, filteredClientes.length)
    );
  }, [filteredClientes.length]);

  // ========== SCROLL INFINITO (no div nativo, não no ScrollArea) ==========
  const handleScroll = useCallback(
    (e) => {
      if (!hasMore) return;
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      if (scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD) {
        handleLoadMore();
      }
    },
    [hasMore, handleLoadMore]
  );

  const handleSelectAll = useCallback(() => {
    const allFilteredIds = filteredClientes.map((c) => c.id);
    const allSelected = allFilteredIds.every((id) => selectedSet.has(id));

    if (allSelected) {
      const filterSet = new Set(allFilteredIds);
      onSelectionChange(selectedClients.filter((id) => !filterSet.has(id)));
    } else {
      const newSelection = [
        ...new Set([...selectedClients, ...allFilteredIds]),
      ];
      onSelectionChange(newSelection);
    }
  }, [filteredClientes, selectedClients, selectedSet, onSelectionChange]);

  const allFilteredSelected = useMemo(() => {
    if (filteredClientes.length === 0) return false;
    return filteredClientes.every((c) => selectedSet.has(c.id));
  }, [filteredClientes, selectedSet]);

  // ========== LOADING STATE ==========
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

  // ========== RENDER ==========
  return (
    <div className="space-y-4">
      {/* Search com debounce */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Buscar por nome, endereço, bairro ou município..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="pl-10"
        />
        {searchTerm !== debouncedSearch && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-blue-400 animate-spin" />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            {selectedClients.length} selecionados
          </Badge>
          <Badge variant="secondary" className="text-xs text-gray-500">
            {filteredClientes.length} encontrados
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSelectAll}
          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-xs"
        >
          {allFilteredSelected ? (
            <>
              <XCircle className="w-4 h-4 mr-1" />
              Desmarcar
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Todos ({filteredClientes.length})
            </>
          )}
        </Button>
      </div>

      {/* Client List — div nativo com overflow para scroll confiável */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="h-[400px] overflow-y-auto pr-2 space-y-2"
        style={{ overscrollBehavior: "contain" }}
      >
        {displayedClientes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Nenhum cliente encontrado</p>
          </div>
        ) : (
          <>
            {displayedClientes.map((cliente) => (
              <ClientItem
                key={cliente.id}
                cliente={cliente}
                isSelected={selectedSet.has(cliente.id)}
                onToggle={handleToggle}
              />
            ))}

            {/* Indicador de carregamento / Botão carregar mais */}
            {hasMore && (
              <button
                onClick={handleLoadMore}
                className="w-full py-3 text-sm text-gray-400 hover:text-blue-600 flex items-center justify-center gap-2 transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
                Mais {Math.min(remainingCount, ITEMS_PER_PAGE)} de{" "}
                {remainingCount} restantes
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
