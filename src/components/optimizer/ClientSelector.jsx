import React, { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Search, CheckCircle2, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ClientSelector({
  clientes,
  selectedClients,
  onSelectionChange,
  isLoading,
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredClientes = clientes.filter((cliente) => {
    const term = searchTerm.toLowerCase();
    return (
      cliente.nome.toLowerCase().includes(term) ||
      cliente.endereco.toLowerCase().includes(term) ||
      (cliente.bairro && cliente.bairro.toLowerCase().includes(term)) ||
      (cliente.municipio && cliente.municipio.toLowerCase().includes(term))
    );
  });

  const handleToggle = (clienteId) => {
    if (selectedClients.includes(clienteId)) {
      onSelectionChange(selectedClients.filter((id) => id !== clienteId));
    } else {
      onSelectionChange([...selectedClients, clienteId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedClients.length === filteredClientes.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(filteredClientes.map((c) => c.id));
    }
  };

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
        <Badge variant="outline" className="text-sm">
          {selectedClients.length} de {filteredClientes.length} selecionados
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSelectAll}
          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
        >
          {selectedClients.length === filteredClientes.length ? (
            <>
              <XCircle className="w-4 h-4 mr-1" />
              Desmarcar Todos
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Selecionar Todos
            </>
          )}
        </Button>
      </div>

      {/* Client List */}
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-3">
          {filteredClientes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Nenhum cliente encontrado</p>
            </div>
          ) : (
            filteredClientes.map((cliente) => {
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
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">
                          {cliente.nome}
                        </h4>
                        {isSelected && (
                          <Badge className="bg-blue-500 text-white">
                            Selecionado
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-start gap-2 text-sm text-gray-600 mb-2">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p className="leading-relaxed">{cliente.endereco}</p>
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
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}