import { useEffect, useState } from "react";

type CitySuggestion = {
  name: string;
  postalCode: string;
  inseeCode: string;
};

type Props = {
  idPrefix: string;
  postalCode: string;
  city: string;
  onPostalCodeChange: (value: string) => void;
  onCityChange: (value: string) => void;
  postalCodeName?: string;
  cityName?: string;
};

export default function PostalCodeCityFields({
  idPrefix,
  postalCode,
  city,
  onPostalCodeChange,
  onCityChange,
  postalCodeName = "postal_code",
  cityName = "city",
}: Props) {
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalizedPostalCode = postalCode.replace(/\D/g, "").slice(0, 5);

  useEffect(() => {
    if (!/^\d{5}$/.test(normalizedPostalCode)) {
      setSuggestions([]);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/cities-search?q=${encodeURIComponent(normalizedPostalCode)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Recherche indisponible.");
        const data = (await response.json()) as CitySuggestion[];
        if (controller.signal.aborted) return;
        const matching = (data || []).filter((item) => item.postalCode === normalizedPostalCode);
        setSuggestions(matching);
        if (matching.length === 1) onCityChange(matching[0].name);
        if (!matching.length) setError("Aucune commune trouvée pour ce code postal.");
      } catch (loadError: any) {
        if (loadError?.name === "AbortError") return;
        setSuggestions([]);
        setError("Impossible de rechercher la commune pour le moment.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [normalizedPostalCode, onCityChange]);

  const selectCity = (suggestion: CitySuggestion) => {
    onPostalCodeChange(suggestion.postalCode);
    onCityChange(suggestion.name);
    setSuggestions([]);
    setError(null);
  };

  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-3">
      <div className="relative space-y-1">
        <label htmlFor={`${idPrefix}_postal`} className="text-xs text-slate-700">
          Code postal *
        </label>
        <input
          id={`${idPrefix}_postal`}
          name={postalCodeName}
          autoComplete="postal-code"
          inputMode="numeric"
          value={postalCode}
          onChange={(event) => onPostalCodeChange(event.target.value.replace(/\D/g, "").slice(0, 5))}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        {suggestions.length > 1 ? (
          <div className="absolute z-20 mt-1 max-h-44 w-full min-w-[240px] overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {suggestions.map((suggestion) => (
              <button
                key={`${suggestion.inseeCode}-${suggestion.postalCode}`}
                type="button"
                onClick={() => selectCity(suggestion)}
                className="block w-full px-3 py-2 text-left text-xs text-slate-800 hover:bg-slate-50"
              >
                {suggestion.name} <span className="text-slate-500">({suggestion.postalCode})</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-1 sm:col-span-2">
        <label htmlFor={`${idPrefix}_city`} className="text-xs text-slate-700">
          Ville *
        </label>
        <input
          id={`${idPrefix}_city`}
          name={cityName}
          autoComplete="address-level2"
          value={city}
          onChange={(event) => onCityChange(event.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        {loading ? <p className="text-[0.7rem] text-slate-500">Recherche de la commune...</p> : null}
        {error ? <p className="text-[0.7rem] text-amber-700">{error}</p> : null}
      </div>
    </div>
  );
}
