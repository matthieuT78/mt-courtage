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
  className?: string;
};

export default function PostalCodeCityFields({
  idPrefix,
  postalCode,
  city,
  onPostalCodeChange,
  onCityChange,
  postalCodeName = "postal_code",
  cityName = "city",
  className = "mt-3 grid gap-3 sm:grid-cols-3",
}: Props) {
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<"postal" | "city" | null>(null);
  const normalizedPostalCode = postalCode.replace(/\D/g, "").slice(0, 5);
  const normalizedCity = city.trim();
  const searchQuery =
    activeField === "city" && normalizedCity.length >= 2
      ? normalizedCity
      : activeField === "postal" && normalizedPostalCode.length >= 2
      ? normalizedPostalCode
      : "";

  useEffect(() => {
    if (!searchQuery) {
      setSuggestions([]);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/cities-search?q=${encodeURIComponent(searchQuery)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Recherche indisponible.");
        const data = (await response.json()) as CitySuggestion[];
        if (controller.signal.aborted) return;
        const matching =
          activeField === "postal" && normalizedPostalCode.length === 5
            ? (data || []).filter((item) => item.postalCode === normalizedPostalCode)
            : data || [];
        setSuggestions(matching);
        if (activeField === "postal" && normalizedPostalCode.length === 5 && matching.length === 1) onCityChange(matching[0].name);
        if (!matching.length && searchQuery.length >= 3) setError("Aucune commune trouvée pour cette saisie.");
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
  }, [activeField, normalizedCity, normalizedPostalCode, onCityChange, searchQuery]);

  const selectCity = (suggestion: CitySuggestion) => {
    onPostalCodeChange(suggestion.postalCode);
    onCityChange(suggestion.name);
    setSuggestions([]);
    setError(null);
    setActiveField(null);
  };

  const suggestionList = suggestions.length ? (
    <div className="absolute z-20 mt-1 max-h-52 w-full min-w-[260px] overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
      {suggestions.map((suggestion) => (
        <button
          key={`${suggestion.inseeCode}-${suggestion.postalCode}`}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => selectCity(suggestion)}
          className="block w-full px-3 py-2 text-left text-xs text-slate-800 hover:bg-slate-50"
        >
          {suggestion.name} <span className="text-slate-500">({suggestion.postalCode})</span>
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div className={className}>
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
          onFocus={() => setActiveField("postal")}
          onChange={(event) => {
            setActiveField("postal");
            onPostalCodeChange(event.target.value.replace(/\D/g, "").slice(0, 5));
          }}
          onBlur={() => window.setTimeout(() => setActiveField((current) => (current === "postal" ? null : current)), 120)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        {activeField === "postal" ? suggestionList : null}
      </div>

      <div className="relative space-y-1 sm:col-span-2">
        <label htmlFor={`${idPrefix}_city`} className="text-xs text-slate-700">
          Ville *
        </label>
        <input
          id={`${idPrefix}_city`}
          name={cityName}
          autoComplete="address-level2"
          value={city}
          onFocus={() => setActiveField("city")}
          onChange={(event) => {
            setActiveField("city");
            onCityChange(event.target.value);
          }}
          onBlur={() => window.setTimeout(() => setActiveField((current) => (current === "city" ? null : current)), 120)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        {activeField === "city" ? suggestionList : null}
        {loading ? <p className="text-[0.7rem] text-slate-500">Recherche de la commune...</p> : null}
        {error ? <p className="text-[0.7rem] text-amber-700">{error}</p> : null}
      </div>
    </div>
  );
}
