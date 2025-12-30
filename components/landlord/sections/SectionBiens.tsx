// components/landlord/sections/SectionBiens.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { SectionTitle } from "../UiBits";
import { ExpandableSection } from "../ui/ExpandableSection";
import { ExpandableRow } from "../ui/ExpandableRow";
import { badge, pluralFR } from "../ui/uiHelpers";

type Props = {
  userId: string;
  properties?: any[];
  photos?: any[];
  onRefresh: () => Promise<void>;
};

const CREATE_ID = "__create__";

const EMPTY = {
  id: null as string | null,
  type: "apartment",
  label: "",
  address_line1: "",
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

function isArchived(p: any) {
  return (p?.status || "").toLowerCase() === "archived";
}

export function SectionBiens({ userId, properties, photos, onRefresh }: Props) {
  const safeProperties = Array.isArray(properties) ? properties : [];
  const safePhotos = Array.isArray(photos) ? photos : [];

  const [expandedId, setExpandedId] = useState<string | null>(null); // "__create__" ou propertyId
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

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

  const { actifs, archives } = useMemo(() => {
    const a = safeProperties.filter((p) => !isArchived(p));
    const ar = safeProperties.filter((p) => isArchived(p));
    return { actifs: a, archives: ar };
  }, [safeProperties]);

  const [createForm, setCreateForm] = useState(EMPTY);
  const [editForms, setEditForms] = useState<Record<string, typeof EMPTY>>({});

  const validate = (f: typeof EMPTY) => {
    const label = (f.label || "").trim();
    const addr1 = (f.address_line1 || "").trim();
    if (!label) return "Veuillez renseigner le nom du bien.";
    if (!addr1) return "Veuillez renseigner l’adresse (ligne 1).";
    return null;
  };

  const safeRefresh = async () => {
    try {
      await onRefresh?.();
    } catch (e) {
      console.error("[SectionBiens] onRefresh error:", e);
    }
  };

  const hydrateEditForm = (p: any) => {
    if (!p?.id) return;

    setEditForms((prev) => {
      if (prev[p.id]) return prev;

      return {
        ...prev,
        [p.id]: {
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
        },
      };
    });
  };

  // hydrate quand on ouvre une row bien
  useEffect(() => {
    setErr(null);
    setOk(null);

    if (!expandedId || expandedId === CREATE_ID) return;
    const p = safeProperties.find((x) => x?.id === expandedId);
    if (!p) return;
    hydrateEditForm(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedId]);

  const saveProperty = async (propertyId?: string) => {
    if (!userId) {
      setErr("userId manquant.");
      return;
    }

    setSaving(true);
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé (env manquantes ?).");

      const isEdit = !!propertyId;
      const form = isEdit ? editForms[propertyId!] : createForm;
      if (!form) throw new Error("Formulaire introuvable.");

      const vErr = validate(form);
      if (vErr) throw new Error(vErr);

      const selectedIsArchived = isEdit ? isArchived(safeProperties.find((p) => p?.id === propertyId)) : false;

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
        status: isEdit ? (selectedIsArchived ? "archived" : "active") : "active",
      };

      if (isEdit) {
        const { error } = await supabase.from("properties").update(payload).eq("id", propertyId).eq("user_id", userId);
        if (error) throw error;
        setOk("Bien mis à jour ✅");
      } else {
        const { data, error } = await supabase.from("properties").insert(payload).select("id").single();
        if (error) throw error;

        const newId = (data as any)?.id ?? null;

        setOk("Bien créé ✅");
        setCreateForm(EMPTY);
        setExpandedId(newId);
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
      if (!supabase) throw new Error("Supabase non initialisé.");
      if (!userId) throw new Error("userId manquant.");

      const { error } = await supabase
        .from("properties")
        .update({ status: "archived" })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;

      setOk("Bien archivé ✅");
      await safeRefresh();
    } catch (e: any) {
      setErr(e?.message || "Impossible d’archiver ce bien.");
    }
  };

  const restore = async (id: string) => {
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé.");
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
      if (!supabase) throw new Error("Supabase non initialisé.");
      if (!userId) throw new Error("userId manquant.");

      const { error } = await supabase.from("properties").delete().eq("id", id).eq("user_id", userId);
      if (error) throw error;

      setOk("Bien supprimé ✅");
      if (expandedId === id) setExpandedId(null);
      await safeRefresh();
    } catch (e: any) {
      setErr(e?.message || "Suppression impossible (baux existants ?).");
    }
  };

  const uploadPhoto = async (file: File, propertyId: string) => {
    setErr(null);
    setOk(null);

    try {
      if (!supabase) throw new Error("Supabase non initialisé.");
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

  const renderForm = (
    form: typeof EMPTY,
    setForm: (updater: (prev: typeof EMPTY) => typeof EMPTY) => void,
    propertyId?: string | null
  ) => {
    const selectedPhotos = propertyId ? (photosByProperty.get(propertyId) ?? []) : [];

    return (
      <>
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
          className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          placeholder="Adresse (ligne 1) *"
          value={form.address_line1}
          onChange={(e) => setForm((s) => ({ ...s, address_line1: e.target.value }))}
        />

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
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

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
          className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          rows={3}
          placeholder="Description (étage, balcon, etc.)"
          value={form.description}
          onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
        />

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
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

        {/* Photos */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">Photos</p>
            {propertyId ? badge("emerald", `${selectedPhotos.length} photo(s)`) : badge("slate", "Crée d’abord le bien")}
          </div>

          {!propertyId ? (
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
                    if (f && propertyId) uploadPhoto(f, propertyId);
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
                      onClick={(e) => e.stopPropagation()}
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
      </>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-5">
      <SectionTitle
        kicker="Biens"
        title="Parc immobilier"
        desc="Même UX partout : une ligne Créer + sections Actifs / Archivés. Chaque ligne est cliquable."
      />

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
      ) : null}
      {ok ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</div>
      ) : null}

      <div className="grid gap-4">
        {/* ✅ LIGNE CRÉER (pas de section) */}
        <ExpandableRow
          id={CREATE_ID}
          expandedId={expandedId}
          setExpandedId={(id) => {
            setErr(null);
            setOk(null);
            setExpandedId(id);
          }}
          tone="sky"
          hideRight
          left={
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {badge("sky", "Créer")}
                <p className="text-sm font-semibold text-slate-900">+ Nouveau bien</p>
              </div>
              <p className="mt-0.5 text-xs text-slate-600">Nom + Adresse (ligne 1) obligatoires.</p>
            </div>
          }
        >
          {renderForm(createForm, (updater) => setCreateForm((prev) => updater(prev)), null)}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => saveProperty(undefined)}
              disabled={saving}
              className="rounded-full bg-sky-600 px-5 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
            >
              {saving ? "Enregistrement…" : "Créer"}
            </button>

            <button
              type="button"
              onClick={() => {
                setCreateForm(EMPTY);
                setExpandedId(null);
              }}
              disabled={saving}
              className="rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              Annuler
            </button>
          </div>
        </ExpandableRow>

        {/* ✅ ACTIFS */}
        <ExpandableSection
          title="Actifs"
          subtitle="Clique une ligne pour voir / modifier."
          right={badge("emerald", pluralFR(actifs.length, "bien"))}
          defaultOpen={true}
        >
          {actifs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
              Aucun bien actif.
            </div>
          ) : (
            <div className="space-y-2">
              {actifs.map((p: any) => {
                const open = expandedId === p.id;
                const pPhotos = photosByProperty.get(p.id) ?? [];

                const f = editForms[p.id] ?? {
                  ...EMPTY,
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
                };

                return (
                  <ExpandableRow
                    key={p.id}
                    id={p.id}
                    expandedId={expandedId}
                    setExpandedId={(id) => {
                      setErr(null);
                      setOk(null);
                      if (id && id !== CREATE_ID) hydrateEditForm(p);
                      setExpandedId(id);
                    }}
                    left={
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{p.label || "Bien"}</p>
                        <p className="mt-0.5 text-xs text-slate-600 truncate">
                          {(p.type || "—") + " • " + (p.address_line1 || "Adresse manquante") + " • " + (p.city || "—")}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {badge("emerald", "Actif")}
                          {p.surface_m2 ? badge("slate", `${p.surface_m2} m²`) : null}
                          {p.rooms ? badge("slate", `${p.rooms} pièces`) : null}
                          {pPhotos.length ? badge("emerald", `${pPhotos.length} photo(s)`) : badge("slate", "0 photo")}
                        </div>
                      </div>
                    }
                    right={open ? badge("slate", "Ouvert") : null}
                  >
                    {renderForm(f, (updater) => setEditForms((m) => ({ ...m, [p.id]: updater(m[p.id] ?? f) })), p.id)}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => saveProperty(p.id)}
                        disabled={saving}
                        className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                      >
                        {saving ? "Enregistrement…" : "Mettre à jour"}
                      </button>

                      <button
                        type="button"
                        onClick={() => archive(p.id)}
                        disabled={saving}
                        className="rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Archiver
                      </button>

                      <button
                        type="button"
                        onClick={() => remove(p.id)}
                        disabled={saving}
                        className="rounded-full border border-red-200 bg-white px-5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        Supprimer
                      </button>
                    </div>
                  </ExpandableRow>
                );
              })}
            </div>
          )}
        </ExpandableSection>

        {/* ✅ ARCHIVÉS */}
        <ExpandableSection
          title="Archivés"
          subtitle="Restaure si besoin, ou supprime."
          right={badge("amber", pluralFR(archives.length, "bien"))}
          defaultOpen={false}
        >
          {archives.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
              Aucun bien archivé.
            </div>
          ) : (
            <div className="space-y-2">
              {archives.map((p: any) => {
                const open = expandedId === p.id;
                const pPhotos = photosByProperty.get(p.id) ?? [];

                const f = editForms[p.id] ?? {
                  ...EMPTY,
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
                };

                return (
                  <ExpandableRow
                    key={p.id}
                    id={p.id}
                    expandedId={expandedId}
                    setExpandedId={(id) => {
                      setErr(null);
                      setOk(null);
                      if (id && id !== CREATE_ID) hydrateEditForm(p);
                      setExpandedId(id);
                    }}
                    left={
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{p.label || "Bien"}</p>
                        <p className="mt-0.5 text-xs text-slate-600 truncate">
                          {(p.type || "—") + " • " + (p.address_line1 || "Adresse manquante") + " • " + (p.city || "—")}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {badge("amber", "Archivé")}
                          {pPhotos.length ? badge("slate", `${pPhotos.length} photo(s)`) : badge("slate", "0 photo")}
                        </div>
                      </div>
                    }
                    right={open ? badge("slate", "Ouvert") : null}
                  >
                    {renderForm(f, (updater) => setEditForms((m) => ({ ...m, [p.id]: updater(m[p.id] ?? f) })), p.id)}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => saveProperty(p.id)}
                        disabled={saving}
                        className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                      >
                        {saving ? "Enregistrement…" : "Mettre à jour"}
                      </button>

                      <button
                        type="button"
                        onClick={() => restore(p.id)}
                        disabled={saving}
                        className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        Restaurer
                      </button>

                      <button
                        type="button"
                        onClick={() => remove(p.id)}
                        disabled={saving}
                        className="rounded-full border border-red-200 bg-white px-5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        Supprimer
                      </button>
                    </div>
                  </ExpandableRow>
                );
              })}
            </div>
          )}
        </ExpandableSection>
      </div>
    </div>
  );
}
