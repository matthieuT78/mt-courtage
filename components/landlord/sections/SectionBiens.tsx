import React, { useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { SectionTitle } from "../UiBits";

type Props = {
  userId: string;
  properties?: any[];
  photos?: any[]; // optionnel
  onRefresh: () => Promise<void>;
};

const EMPTY = {
  id: null as string | null,
  type: "apartment",
  label: "",
  address_line1: "", // obligatoire
  postal_code: "",
  city: "",
  description: "",
  surface_m2: "",
  rooms: "",
  energy_class: "",
  energy_value: "",
  ghg_class: "",
};

const toNumOrNull = (v: string) => {
  const n = Number(String(v || "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const badge = (tone: "slate" | "emerald" | "amber" | "red", label: string) => {
  const cls =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "red"
      ? "border-red-200 bg-red-50 text-red-900"
      : "border-slate-200 bg-slate-50 text-slate-800";
  return (
    <span className={"inline-flex items-center rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold " + cls}>
      {label}
    </span>
  );
};

function isArchived(p: any) {
  return (p?.status || "").toLowerCase() === "archived";
}

export function SectionBiens({ userId, properties, photos, onRefresh }: Props) {
  const safeProperties = Array.isArray(properties) ? properties : [];
  const safePhotos = Array.isArray(photos) ? photos : [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const filteredProps = useMemo(() => {
    return safeProperties.filter((p) => (showArchived ? true : !isArchived(p)));
  }, [safeProperties, showArchived]);

  const actifsCount = useMemo(() => safeProperties.filter((p) => !isArchived(p)).length, [safeProperties]);
  const archivedCount = useMemo(() => safeProperties.filter((p) => isArchived(p)).length, [safeProperties]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    // ⚠️ on cherche dans ALL, pas juste les actifs
    return safeProperties.find((p) => p?.id === selectedId) || null;
  }, [safeProperties, selectedId]);

  const selectedIsArchived = selected ? isArchived(selected) : false;

  const photosByProperty = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const ph of safePhotos) {
      const pid = ph?.property_id;
      if (!pid) continue;
      if (!m.has(pid)) m.set(pid, []);
      m.get(pid)!.push(ph);
    }
    return m;
  }, [safePhotos]);

  const selectedPhotos = useMemo(() => {
    if (!selectedId) return [];
    return photosByProperty.get(selectedId) ?? [];
  }, [photosByProperty, selectedId]);

  const validate = (f: typeof EMPTY) => {
    const label = (f.label || "").trim();
    const addr1 = (f.address_line1 || "").trim();
    if (!label) return "Veuillez renseigner le nom du bien.";
    if (!addr1) return "Veuillez renseigner l’adresse (ligne 1).";
    return null;
  };

  const resetToCreate = () => {
    setErr(null);
    setOk(null);
    setSelectedId(null);
    setForm(EMPTY);
  };

  const openEdit = (p: any) => {
    setErr(null);
    setOk(null);
    setSelectedId(p.id);

    setForm({
      ...EMPTY,
      ...p,
      id: p.id,
      label: p.label ?? "",
      address_line1: p.address_line1 ?? "",
      postal_code: p.postal_code ?? "",
      city: p.city ?? "",
      description: p.description ?? "",
      surface_m2: p.surface_m2 != null ? String(p.surface_m2) : "",
      rooms: p.rooms != null ? String(p.rooms) : "",
      energy_class: p.energy_class ?? "",
      energy_value: p.energy_value != null ? String(p.energy_value) : "",
      ghg_class: p.ghg_class ?? "",
    });
  };

  const safeRefresh = async () => {
    try {
      await onRefresh?.();
    } catch (e) {
      console.error("[SectionBiens] onRefresh error:", e);
    }
  };

  const saveProperty = async () => {
    if (!userId) {
      setErr("userId manquant (DashboardShell/useLandlordDashboard).");
      return;
    }

    setSaving(true);
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé (env manquantes ?).");

      const vErr = validate(form);
      if (vErr) throw new Error(vErr);

      const payload = {
        user_id: userId,
        type: form.type,
        label: (form.label || "").trim(),
        address_line1: (form.address_line1 || "").trim(),
        postal_code: (form.postal_code || "").trim() || null,
        city: (form.city || "").trim() || null,
        description: (form.description || "").trim() || null,
        surface_m2: form.surface_m2 ? toNumOrNull(form.surface_m2) : null,
        rooms: form.rooms ? toNumOrNull(form.rooms) : null,
        energy_class: (form.energy_class || "").trim() || null,
        energy_value: form.energy_value ? toNumOrNull(form.energy_value) : null,
        ghg_class: (form.ghg_class || "").trim() || null,
        // 👇 si le bien est archivé et que tu l’édites, on ne le “réactive” pas automatiquement.
        // Si tu veux le réactiver, utilise “Restaurer”.
        status: form.id ? (selectedIsArchived ? "archived" : "active") : "active",
      };

      if (form.id) {
        const { error } = await supabase.from("properties").update(payload).eq("id", form.id).eq("user_id", userId);
        if (error) throw error;
        setOk("Bien mis à jour ✅");
      } else {
        const { data, error } = await supabase.from("properties").insert(payload).select("id").single();
        if (error) throw error;
        const newId = (data as any)?.id ?? null;
        setOk("Bien créé ✅");
        setSelectedId(newId);
      }

      await safeRefresh();
    } catch (e: any) {
      console.error("[saveProperty] error:", e);
      setErr(e?.message || "Erreur lors de l’enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const archive = async (id: string) => {
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé (env manquantes ?).");
      if (!userId) throw new Error("userId manquant.");

      const { error } = await supabase
        .from("properties")
        .update({ status: "archived" })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;

      setOk("Bien archivé ✅");

      // ✅ on ne reset PAS la fiche : on reste sur le bien, juste “archivé”
      await safeRefresh();

      // ✅ si showArchived est off, on l’active automatiquement pour éviter l’effet “disparition”
      if (!showArchived) setShowArchived(true);
    } catch (e: any) {
      setErr(e?.message || "Impossible d’archiver ce bien.");
    }
  };

  const restore = async (id: string) => {
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé (env manquantes ?).");
      if (!userId) throw new Error("userId manquant.");

      const { error } = await supabase
        .from("properties")
        .update({ status: "active" })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;

      setOk("Bien restauré ✅");
      await safeRefresh();
    } catch (e: any) {
      setErr(e?.message || "Impossible de restaurer ce bien.");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer définitivement ce bien ?")) return;

    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé (env manquantes ?).");
      if (!userId) throw new Error("userId manquant.");

      const { error } = await supabase.from("properties").delete().eq("id", id).eq("user_id", userId);
      if (error) throw error;

      setOk("Bien supprimé ✅");
      if (selectedId === id) resetToCreate();
      await safeRefresh();
    } catch (e: any) {
      setErr(e?.message || "Suppression impossible (baux existants ?).");
    }
  };

  const uploadPhoto = async (file: File, propertyId: string) => {
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé (env manquantes ?).");
      if (!userId) throw new Error("userId manquant.");

      if (file.size > 2 * 1024 * 1024) throw new Error("Image > 2 Mo refusée.");

      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${userId}/${propertyId}/${Date.now()}-${safeName}`;

      const { error: upErr } = await supabase.storage.from("property-photos").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/*",
      });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from("property-photos").getPublicUrl(path);
      const url = data?.publicUrl;
      if (!url) throw new Error("Impossible d’obtenir l’URL publique de la photo.");

      const { error: insErr } = await supabase.from("property_photos").insert({
        user_id: userId,
        property_id: propertyId,
        url,
      });
      if (insErr) throw insErr;

      setOk("Photo ajoutée ✅");
      await safeRefresh();
    } catch (e: any) {
      setErr(e?.message || "Erreur upload.");
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-5">
      <SectionTitle
        kicker="Biens"
        title="Parc immobilier"
        desc="Sélectionne un bien, puis édite en dessous. Adresse obligatoire. Photos (2 Mo max)."
      />

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
      ) : null}
      {ok ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</div>
      ) : null}

      {/* ✅ LISTE */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <p className="text-[0.75rem] font-semibold text-slate-900">Mes biens</p>
            {badge("slate", `${actifsCount} actif(s)`)}
            {archivedCount ? badge("slate", `${archivedCount} archivé(s)`) : null}
          </div>

          <button
            type="button"
            onClick={resetToCreate}
            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            + Nouveau bien
          </button>
        </div>

        {/* ✅ toggle archived */}
        <label className="inline-flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Afficher les biens archivés
        </label>

        {filteredProps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
            {safeProperties.length === 0 ? (
              <>Aucun bien pour le moment. Clique sur <span className="font-semibold">“Nouveau bien”</span>.</>
            ) : (
              <>Aucun bien (selon le filtre actuel).</>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProps.map((p) => {
              const isActiveCard = p.id === selectedId;
              const pPhotos = photosByProperty.get(p.id) ?? [];
              const archived = isArchived(p);

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openEdit(p)}
                  className={
                    "rounded-2xl border p-4 text-left transition " +
                    (isActiveCard
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-slate-200 bg-white hover:bg-slate-50") +
                    (archived ? " opacity-85" : "")
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{p.label || "Bien"}</p>
                      <p className="mt-1 text-xs text-slate-600 truncate">
                        {(p.type || "—") +
                          " • " +
                          (p.address_line1 || "Adresse manquante") +
                          " • " +
                          (p.city || "—")}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {archived ? badge("amber", "Archivé") : badge("emerald", "Actif")}
                        {p.surface_m2 ? badge("slate", `${p.surface_m2} m²`) : null}
                        {p.rooms ? badge("slate", `${p.rooms} pièces`) : null}
                        {pPhotos.length ? badge("emerald", `${pPhotos.length} photo(s)`) : badge("slate", "0 photo")}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {badge(isActiveCard ? "emerald" : "slate", isActiveCard ? "Sélectionné" : "Ouvrir")}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ✅ FICHE */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[0.75rem] font-semibold text-slate-900">{form.id ? "Fiche du bien" : "Créer un bien"}</p>
            <p className="text-xs text-slate-600">
              Champs obligatoires : <span className="font-semibold">Nom</span> et{" "}
              <span className="font-semibold">Adresse (ligne 1)</span>.
            </p>
            {form.id ? (
              <p className="mt-1 text-xs text-slate-600">
                Statut :{" "}
                <span className={"font-semibold " + (selectedIsArchived ? "text-amber-700" : "text-emerald-700")}>
                  {selectedIsArchived ? "Archivé" : "Actif"}
                </span>
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveProperty}
              disabled={saving}
              className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {saving ? "Enregistrement…" : form.id ? "Mettre à jour" : "Créer"}
            </button>

            {form.id ? (
              <>
                {!selectedIsArchived ? (
                  <button
                    type="button"
                    onClick={() => archive(form.id!)}
                    disabled={saving}
                    className="rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Archiver
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => restore(form.id!)}
                    disabled={saving}
                    className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    Restaurer
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => remove(form.id!)}
                  disabled={saving}
                  className="rounded-full border border-red-200 bg-white px-5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  Supprimer
                </button>
              </>
            ) : null}

            <button
              type="button"
              onClick={resetToCreate}
              disabled={saving}
              className="rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              Nouveau
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder="Nom du bien *"
            value={form.label}
            onChange={(e) => setForm((s) => ({ ...s, label: e.target.value }))}
          />

          <select
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            value={form.type}
            onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))}
          >
            <option value="apartment">Appartement</option>
            <option value="house">Maison</option>
            <option value="garage">Garage</option>
            <option value="parking">Parking</option>
            <option value="other">Autre</option>
          </select>
        </div>

        <input
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          placeholder="Adresse (ligne 1) *"
          value={form.address_line1}
          onChange={(e) => setForm((s) => ({ ...s, address_line1: e.target.value }))}
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <input
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder="Code postal"
            value={form.postal_code}
            onChange={(e) => setForm((s) => ({ ...s, postal_code: e.target.value }))}
          />
          <input
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder="Ville"
            value={form.city}
            onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
          />
          <input
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder="Surface (m²)"
            value={form.surface_m2}
            onChange={(e) => setForm((s) => ({ ...s, surface_m2: e.target.value }))}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder="Pièces"
            value={form.rooms}
            onChange={(e) => setForm((s) => ({ ...s, rooms: e.target.value }))}
          />
          <input
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder="DPE (A-G)"
            value={form.energy_class}
            onChange={(e) => setForm((s) => ({ ...s, energy_class: e.target.value }))}
          />
        </div>

        <textarea
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          rows={3}
          placeholder="Description (étage, balcon, etc.)"
          value={form.description}
          onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder="kWh/m²/an"
            value={form.energy_value}
            onChange={(e) => setForm((s) => ({ ...s, energy_value: e.target.value }))}
          />
          <input
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder="GES (A-G)"
            value={form.ghg_class}
            onChange={(e) => setForm((s) => ({ ...s, ghg_class: e.target.value }))}
          />
        </div>

        {/* ✅ Photos */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">Photos</p>
            {form.id ? badge("emerald", `${selectedPhotos.length} photo(s)`) : badge("slate", "Crée d’abord le bien")}
          </div>

          {!form.id ? (
            <p className="text-sm text-slate-700">Crée le bien pour pouvoir ajouter des photos.</p>
          ) : (
            <>
              <div>
                <label className="text-[0.7rem] text-slate-600">Ajouter une photo (2 Mo max)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && form.id) uploadPhoto(f, form.id);
                    e.currentTarget.value = "";
                  }}
                  className="mt-1 block text-xs"
                />
              </div>

              {selectedPhotos.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedPhotos.slice(0, 10).map((ph: any) => (
                    <a
                      key={ph.id || ph.url}
                      href={ph.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block h-16 w-16 overflow-hidden rounded-xl border border-slate-200 bg-white"
                      title="Ouvrir"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ph.url} alt="" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600">Aucune photo pour l’instant.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
