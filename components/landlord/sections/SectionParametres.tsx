import React, { useEffect, useRef, useState } from "react";
import { ArrowPathIcon, Bars3Icon, CheckCircleIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { supabase } from "../../../lib/supabaseClient";
import type { LandlordSettings } from "../../../lib/landlord/types";
import {
  DEFAULT_LANDLORD_NAV_ORDER,
  getLandlordNavItems,
  normalizeLandlordNavOrder,
  type LandlordSectionKey,
} from "../navigation";

type Props = {
  userId: string;
  navOrder: LandlordSectionKey[];
  onNavOrderChange: (order: LandlordSectionKey[]) => void;
  landlord?: LandlordSettings | null;
  onLandlordChange?: (updated: LandlordSettings) => void;
};

const navStorageKey = (userId: string) => `landlord_nav_order:${userId}`;
const navSettingsKey = (userId: string) => `landlord_nav_order:${userId}`;

function moveNear(order: LandlordSectionKey[], key: LandlordSectionKey, targetKey: LandlordSectionKey, place: "before" | "after") {
  const next = [...order];
  const index = next.indexOf(key);
  const targetIndex = next.indexOf(targetKey);
  if (index < 0 || targetIndex < 0 || key === targetKey) return next;
  const [item] = next.splice(index, 1);
  const adjustedTargetIndex = next.indexOf(targetKey);
  next.splice(place === "after" ? adjustedTargetIndex + 1 : adjustedTargetIndex, 0, item);
  return next;
}

function formatIbanDisplay(raw: string) {
  return raw.replace(/\s/g, "").replace(/(.{4})/g, "$1 ").trim();
}

export function SectionParametres({ userId, navOrder, onNavOrderChange, landlord, onLandlordChange }: Props) {
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [draggingKey, setDraggingKey] = useState<LandlordSectionKey | null>(null);
  const normalizedOrder = normalizeLandlordNavOrder(navOrder);
  const items = getLandlordNavItems(normalizedOrder);
  const latestOrderRef = useRef<LandlordSectionKey[]>(normalizedOrder);
  const draggingKeyRef = useRef<LandlordSectionKey | null>(null);

  // RIB state
  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");
  const [ribSaving, setRibSaving] = useState(false);
  const [ribFeedback, setRibFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [ribLoaded, setRibLoaded] = useState(false);

  // Load current IBAN/BIC from DB (not from landlord prop to avoid stale prop)
  useEffect(() => {
    if (!supabase || !userId) return;
    (async () => {
      const { data } = await supabase.from("landlords").select("iban,bic").eq("user_id", userId).maybeSingle();
      setIban(data?.iban || "");
      setBic(data?.bic || "");
      setRibLoaded(true);
    })();
  }, [userId]);

  useEffect(() => {
    latestOrderRef.current = normalizedOrder;
  }, [normalizedOrder]);

  const applyOrder = (nextOrder: LandlordSectionKey[]) => {
    const clean = normalizeLandlordNavOrder(nextOrder);
    latestOrderRef.current = clean;
    onNavOrderChange(clean);
    setFeedback(null);
  };

  const persistOrder = async (nextOrder: LandlordSectionKey[]) => {
    const clean = normalizeLandlordNavOrder(nextOrder);
    latestOrderRef.current = clean;
    onNavOrderChange(clean);

    try {
      window.localStorage.setItem(navStorageKey(userId), JSON.stringify(clean));
    } catch {
      // La personnalisation reste active pour la session.
    }

    if (!supabase || !userId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: navSettingsKey(userId), value_json: { order: clean } }, { onConflict: "key" });
      if (error) throw error;
      setFeedback("Ordre du menu enregistré.");
    } catch {
      setFeedback("Ordre appliqué sur cet appareil. La sauvegarde en ligne sera disponible après mise à jour de la base.");
    } finally {
      setSaving(false);
    }
  };

  const saveOrder = async (nextOrder: LandlordSectionKey[]) => {
    applyOrder(nextOrder);
    await persistOrder(nextOrder);
  };

  const startDrag = (event: React.PointerEvent<HTMLElement>, key: LandlordSectionKey) => {
    if (saving) return;
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDraggingKey(key);
    draggingKeyRef.current = key;
    setFeedback(null);

    const onMove = (moveEvent: PointerEvent) => {
      const dragged = draggingKeyRef.current;
      if (!dragged) return;
      const element = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
      const row = element?.closest("[data-nav-key]") as HTMLElement | null;
      const targetKey = row?.dataset.navKey as LandlordSectionKey | undefined;
      if (!targetKey || targetKey === dragged) return;
      const rect = row.getBoundingClientRect();
      const place = moveEvent.clientY > rect.top + rect.height / 2 ? "after" : "before";
      const next = moveNear(latestOrderRef.current, dragged, targetKey, place);
      if (next.join("|") !== latestOrderRef.current.join("|")) applyOrder(next);
    };

    const onUp = () => {
      const finalOrder = latestOrderRef.current;
      draggingKeyRef.current = null;
      setDraggingKey(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      persistOrder(finalOrder);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const saveRib = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !userId) return;
    setRibSaving(true);
    setRibFeedback(null);
    try {
      const cleanIban = iban.replace(/\s/g, "").toUpperCase();
      const cleanBic = bic.replace(/\s/g, "").toUpperCase();
      const { data, error } = await supabase
        .from("landlords")
        .upsert(
          { user_id: userId, iban: cleanIban || null, bic: cleanBic || null, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        )
        .select()
        .maybeSingle();
      if (error) throw error;
      setIban(cleanIban);
      setBic(cleanBic);
      if (onLandlordChange && data) onLandlordChange(data as LandlordSettings);
      setRibFeedback({ ok: true, msg: cleanIban ? "Coordonnées bancaires enregistrées." : "Coordonnées bancaires supprimées." });
    } catch (err: any) {
      setRibFeedback({ ok: false, msg: err?.message || "Erreur lors de l'enregistrement." });
    } finally {
      setRibSaving(false);
    }
  };

  const clearRib = async () => {
    setIban("");
    setBic("");
    if (!supabase || !userId) return;
    setRibSaving(true);
    setRibFeedback(null);
    try {
      const { error } = await supabase
        .from("landlords")
        .upsert({ user_id: userId, iban: null, bic: null, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw error;
      setRibFeedback({ ok: true, msg: "Coordonnées bancaires supprimées." });
    } catch (err: any) {
      setRibFeedback({ ok: false, msg: err?.message || "Erreur lors de la suppression." });
    } finally {
      setRibSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Navigation reorder */}
      <section className="rounded-[1.75rem] border border-slate-200 bg-[#f6f9fc] p-3 shadow-sm sm:rounded-3xl sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Personnalisation</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Réorganiser le menu</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Glissez les tuiles dans l'ordre qui vous convient. Les premières positions alimentent la barre mobile.
            </p>
          </div>
          <button
            type="button"
            onClick={() => saveOrder(DEFAULT_LANDLORD_NAV_ORDER)}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
            Réinitialiser
          </button>
        </div>

        <div className="mt-5 space-y-2">
          {items.map((item, index) => {
            const Icon = item.icon;
            const isDragging = draggingKey === item.key;
            return (
              <div
                key={item.key}
                data-nav-key={item.key}
                onPointerDown={(event) => startDrag(event, item.key)}
                className={
                  "group flex touch-none select-none items-center gap-3 rounded-3xl border px-3 py-3 transition-all duration-150 " +
                  (isDragging
                    ? "scale-[1.015] cursor-grabbing border-[#635bff]/40 bg-white/80 opacity-75 shadow-[0_22px_55px_rgba(99,91,255,0.22)] ring-2 ring-[#635bff]/10"
                    : "cursor-grab border-slate-200 bg-white shadow-sm hover:-translate-y-0.5 hover:border-[#635bff]/20 hover:shadow-md")
                }
                role="button"
                tabIndex={0}
                aria-label={`Déplacer ${item.label}`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4f46e5]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-slate-950">{item.label}</p>
                  <p className="text-xs text-slate-500">
                    {index < 4 ? `Barre mobile · position ${index + 1}` : `Menu Plus · position ${index + 1}`}
                  </p>
                </div>
                <span
                  className={
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 shadow-sm transition " +
                    (isDragging ? "text-[#4f46e5]" : "group-hover:text-slate-500")
                  }
                  aria-hidden="true"
                >
                  <Bars3Icon className="h-5 w-5" aria-hidden="true" />
                </span>
              </div>
            );
          })}
        </div>

        {feedback ? (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{feedback}</span>
          </div>
        ) : null}
      </section>

      {/* RIB / coordonnées bancaires */}
      <section className="rounded-[1.75rem] border border-slate-200 bg-[#f6f9fc] p-3 shadow-sm sm:rounded-3xl sm:p-5">
        <div className="mb-4">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Paiement</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Coordonnées bancaires (RIB)</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Renseignez votre IBAN pour que vos locataires puissent voir les instructions de virement dans leur espace sécurisé.
          </p>
        </div>

        {/* RGPD notice */}
        <div className="mb-5 flex gap-2.5 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <ShieldCheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
          <p className="text-xs leading-5 text-indigo-800">
            <span className="font-semibold">Donnée personnelle financière (RGPD).</span> Votre IBAN est utilisé
            uniquement pour afficher les instructions de virement à votre locataire via son espace sécurisé.
            Il n'est jamais inclus dans les e-mails et vous pouvez le supprimer à tout moment.
            Seul un locataire avec un bail actif en mode virement peut le consulter.
          </p>
        </div>

        {ribLoaded ? (
          <form onSubmit={saveRib} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  IBAN
                </label>
                <input
                  type="text"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  placeholder="FR76 3000 6000 0112 3456 7890 189"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={42}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm tracking-wider text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                {iban.replace(/\s/g, "").length > 0 ? (
                  <p className="mt-1 font-mono text-[0.68rem] text-slate-500">{formatIbanDisplay(iban)}</p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  BIC / SWIFT <span className="font-normal text-slate-400">(optionnel)</span>
                </label>
                <input
                  type="text"
                  value={bic}
                  onChange={(e) => setBic(e.target.value)}
                  placeholder="BNPAFRPPXXX"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={11}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm uppercase tracking-wider text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={ribSaving}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8] px-5 py-2 text-sm font-semibold text-white shadow-md hover:opacity-90 disabled:opacity-60"
              >
                {ribSaving ? "Enregistrement…" : "Enregistrer"}
              </button>
              {(iban || bic) ? (
                <button
                  type="button"
                  onClick={clearRib}
                  disabled={ribSaving}
                  className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  Supprimer le RIB
                </button>
              ) : null}
            </div>

            {ribFeedback ? (
              <div className={`flex items-start gap-2 rounded-2xl border px-3 py-2 text-sm ${ribFeedback.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
                <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{ribFeedback.msg}</span>
              </div>
            ) : null}
          </form>
        ) : (
          <p className="text-sm text-slate-400">Chargement…</p>
        )}
      </section>
    </div>
  );
}
