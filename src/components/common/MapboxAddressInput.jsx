import React, { useState, useRef, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";
import { MAPBOX_TOKEN } from "@/components/optimizer/mapboxService";

/**
 * Campo de endereço com autocompleção via Mapbox Geocoding API.
 * Mostra no máximo 3 sugestões (ruas, bairros, cidades, municípios).
 *
 * Props:
 *   value        – string exibida no input
 *   onChange     – (value: string) => void  (atualiza só o texto)
 *   onSelect     – ({ address, latitude, longitude, bairro, municipio, place_name }) => void
 *   placeholder  – string opcional
 *   mapboxToken  – token opcional (usa default se não passar)
 *   disabled     – boolean opcional
 *   className    – className extra no wrapper
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
  const wrapperRef = useRef(null);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(
    async (query) => {
      if (!query || query.trim().length < 3) {
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }

      setIsSearching(true);
      try {
        const encoded = encodeURIComponent(query.trim());
        // types inclui address, neighborhood (bairro), locality, place (cidade/município), region
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${token}&country=BR&limit=3&language=pt&types=address,neighborhood,locality,place,region`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Geocoding error");
        const data = await res.json();

        const features = data.features || [];
        const mapped = features.map((f) => {
          // Extrai contexto: bairro, município, estado
          const ctx = f.context || [];
          const bairro =
            ctx.find((c) => c.id?.startsWith("neighborhood"))?.text || "";
          const municipio =
            ctx.find((c) => c.id?.startsWith("place") || c.id?.startsWith("locality"))?.text || "";
          const estado =
            ctx.find((c) => c.id?.startsWith("region"))?.text || "";

          return {
            place_name: f.place_name,
            address: f.place_name,
            latitude: f.center[1],
            longitude: f.center[0],
            bairro,
            municipio,
            estado,
            // Label curto para exibir na lista
            label: f.place_name,
          };
        });

        setSuggestions(mapped);
        setShowDropdown(mapped.length > 0);
      } catch {
        setSuggestions([]);
        setShowDropdown(false);
      } finally {
        setIsSearching(false);
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

  const handleSelect = (suggestion) => {
    onChange(suggestion.place_name);
    setShowDropdown(false);
    setSuggestions([]);
    if (onSelect) onSelect(suggestion);
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <Input
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-9 pr-8"
          autoComplete="off"
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
          }}
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 animate-spin" />
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <li
              key={i}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(s);
              }}
              className="flex items-start gap-2 px-3 py-2.5 cursor-pointer hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
            >
              <MapPin className="w-3.5 h-3.5 mt-0.5 text-blue-500 shrink-0" />
              <span className="text-sm text-gray-800 leading-snug line-clamp-2">
                {s.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}