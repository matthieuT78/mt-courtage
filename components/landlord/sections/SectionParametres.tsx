import React, { useEffect, useRef, useState } from "react";
import { ArrowPathIcon, Bars3Icon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { supabase } from "../../../lib/supabaseClient";
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

export function SectionParametres({ userId, navOrder, onNavOrderChange }: Props) {
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [draggingKey, setDraggingKey] = useState<LandlordSectionKey | null>(null);
  const normalizedOrder = normalizeLandlordNavOrder(navOrder);
  const items = getLandlordNavItems(normalizedOrder);
  const latestOrderRef = useRef<LandlordSectionKey[]>(normalizedOrder);
  const draggingKeyRef = useRef<LandlordSectionKey | null>(null);

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

  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-[#f6f9fc] p-3 shadow-sm sm:rounded-3xl sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Personnalisation</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Réorganiser le menu</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Glissez les tuiles dans l’ordre qui vous convient. Les premières positions alimentent la barre mobile.
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
  );
}
