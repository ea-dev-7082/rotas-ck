import React, { useState, useRef, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";
import { MAPBOX_TOKEN } from "@/components/optimizer/mapboxService";

/**
 * Campo de endereço com autocompleção via Mapbox Geocoding API.
 * Mostra no máximo 3 sugestões (ruas, bairros, cidades, municípios).
 */
export default function MapboxAddressInput({
  value,
  onChange,
  onSelect,
  placeholder = "Rua, número, bairro, município...",
  mapboxToken,
  disabled = false,
  className = "",
}) {
  const token = mapboxToken || MAPBOX_TOKEN;
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  // Evita fechar o dropdown quando o usuário clica numa sugestão
  const isSelectingRef = useRef(false);

  const fetchSuggestions = useCallback(
    async (query) => {
      if (!query || query.trim().length < 2) {
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }

      setIsSearching(true);
      isSearchingRef.current = true;
      try {
        const encoded = encodeURIComponent(query.trim());
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${token}&country=BR&limit=5&language=pt&types=address,neighborhood,locality,place,region`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);
        const data = await res.json();

        const features = data.features || [];
        console.log("[Mapbox] features recebidas:", features.length, features.map(f => f.place_name));
        const mapped = features.map((f) => {
          const ctx = f.context || [];
          const bairro =
            ctx.find((c) => c.id?.startsWith("neighborhood"))?.text || "";
          const municipio =
            ctx.find(
              (c) =>
                c.id?.startsWith("place") || c.id?.startsWith("locality")
            )?.text || "";

          return {
            place_name: f.place_name,
            label: f.place_name,
            latitude: f.center[1],
            longitude: f.center[0],
            bairro,
            municipio,
          };
        });

        setSuggestions(mapped);
        setShowDropdown(mapped.length > 0);
      } catch (err) {
        console.error("MapboxAddressInput error:", err);
        setSuggestions([]);
        setShowDropdown(false);
      } finally {
        setIsSearching(false);
        isSearchingRef.current = false;
      }
    },
    [token]
  );

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 350);
  };

  const isSearchingRef = useRef(false);

  // Fecha via blur, mas só se não estiver no meio de uma seleção ou carregando
  const handleBlur = () => {
    setTimeout(() => {
      if (!isSelectingRef.current && !isSearchingRef.current) {
        setShowDropdown(false);
        setSuggestions([]);
      }
      isSelectingRef.current = false;
    }, 500);
  };

  const handleSelect = (suggestion) => {
    isSelectingRef.current = true;
    onChange(suggestion.place_name);
    setSuggestions([]);
    setShowDropdown(false);
    if (onSelect) onSelect(suggestion);
    // Foca de volta no input após seleção
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
        <Input
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-9 pr-8"
          autoComplete="off"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 animate-spin pointer-events-none" />
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <ul
          ref={dropdownRef}
          className="absolute z-[9999] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden"
          style={{ position: "absolute", zIndex: 99999 }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {suggestions.map((s, i) => (
            <li
              key={i}
              onClick={() => handleSelect(s)}
              className="flex items-start gap-2 px-3 py-2.5 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors border-b border-gray-100 last:border-b-0"
            >
              <MapPin className="w-3.5 h-3.5 mt-0.5 text-blue-500 shrink-0" />
              <span className="text-sm text-gray-800 leading-snug">
                {s.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}