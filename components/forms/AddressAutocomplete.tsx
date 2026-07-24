// components/forms/AddressAutocomplete.tsx
// Champ de saisie d'adresse : recherche via la Base Adresse Nationale
// (api-adresse.data.gouv.fr, gratuite, sans clé) et propose des adresses
// complètes. La sélection d'une suggestion préremplit adresse/CP/ville, qui
// passent alors en lecture seule pour éviter une incohérence (ex. adresse
// sélectionnée à Paris puis code postal modifié à la main par erreur).
// Une adresse absente de la base (construction très récente, hameau...)
// reste saisissable manuellement via le lien d'échappatoire.
import { useEffect, useRef, useState } from "react";
import type { AddressSuggestion } from "../../pages/api/address-search";

type Props = {
  id: string;
  label?: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  onAddressLine1Change: (value: string) => void;
  onPostalCodeChange: (value: string) => void;
  onCityChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  hint?: boolean;
};

export default function AddressAutocomplete({
  id,
  label,
  addressLine1,
  postalCode,
  city,
  onAddressLine1Change,
  onPostalCodeChange,
  onCityChange,
  placeholder = "Commencez à taper une adresse…",
  className = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm",
  hint = true,
}: Props) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [manualOverride, setManualOverride] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const locked = !manualOverride && !!postalCode.trim() && !!city.trim();

  useEffect(() => {
    const query = addressLine1.trim();
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const resp = await fetch(`/api/address-search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!resp.ok) throw new Error("Recherche indisponible.");
        const data = (await resp.json()) as AddressSuggestion[];
        if (controller.signal.aborted) return;
        setSuggestions(data);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { clearTimeout(t); controller.abort(); };
  }, [addressLine1]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleSelect = (s: AddressSuggestion) => {
    onAddressLine1Change(s.addressLine1);
    onPostalCodeChange(s.postalCode);
    onCityChange(s.city);
    setManualOverride(false);
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div className="relative space-y-1" ref={containerRef}>
      {label ? <label htmlFor={id} className="text-xs text-slate-700">{label}</label> : null}
      <input
        id={id}
        type="text"
        autoComplete="off"
        value={addressLine1}
        placeholder={placeholder}
        onChange={(e) => { onAddressLine1Change(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className={className}
      />
      {open && (loading || suggestions.length > 0) && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {loading && suggestions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">Recherche…</p>
          ) : (
            suggestions.map((s, i) => (
              <button
                key={`${s.label}-${i}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(s)}
                className="block w-full px-3 py-2 text-left text-xs text-slate-800 hover:bg-slate-50"
              >
                {s.label}
              </button>
            ))
          )}
        </div>
      )}
      {hint && !locked ? (
        <p className="text-[0.68rem] text-slate-400">Sélectionnez une suggestion pour préremplir le code postal et la ville — ou saisissez manuellement.</p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 pt-1">
        <input
          value={postalCode}
          onChange={(e) => onPostalCodeChange(e.target.value)}
          placeholder="Code postal"
          disabled={locked}
          className={locked ? `${className} cursor-not-allowed bg-slate-100 text-slate-500` : className}
        />
        <input
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
          placeholder="Ville"
          disabled={locked}
          className={locked ? `${className} cursor-not-allowed bg-slate-100 text-slate-500` : className}
        />
      </div>
      {locked ? (
        <button
          type="button"
          onClick={() => setManualOverride(true)}
          className="text-xs text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
        >
          Modifier manuellement
        </button>
      ) : null}
    </div>
  );
}
