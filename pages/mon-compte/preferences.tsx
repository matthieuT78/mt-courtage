// pages/mon-compte/preferences.tsx
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { ArrowPathIcon, Bars3Icon, CheckCircleIcon } from "@heroicons/react/24/outline";
import AccountLayout from "../../components/account/AccountLayout";
import { signOutAll } from "../../lib/authUtils";
import { useAuthUser } from "../../hooks/useAuthUser";
import { supabase } from "../../lib/supabaseClient";
import {
  DEFAULT_LANDLORD_NAV_ORDER,
  getLandlordNavItems,
  normalizeLandlordNavOrder,
  type LandlordSectionKey,
} from "../../components/landlord/navigation";

const navStorageKey = (userId: string) => `landlord_nav_order:${userId}`;

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

export default function MonComptePreferencesPage() {
  const router = useRouter();
  const { checking, user, isLoggedIn } = useAuthUser();

  const [navOrder, setNavOrder] = useState<LandlordSectionKey[]>(DEFAULT_LANDLORD_NAV_ORDER);
  const [orderLoaded, setOrderLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [draggingKey, setDraggingKey] = useState<LandlordSectionKey | null>(null);

  const latestOrderRef = useRef<LandlordSectionKey[]>(DEFAULT_LANDLORD_NAV_ORDER);
  const draggingKeyRef = useRef<LandlordSectionKey | null>(null);

  const handleLogout = async () => { await signOutAll(); };

  // Load order from localStorage then Supabase
  useEffect(() => {
    if (!user?.id) return;
    const key = navStorageKey(user.id);
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = normalizeLandlordNavOrder(JSON.parse(raw));
        setNavOrder(parsed);
        latestOrderRef.current = parsed;
        setOrderLoaded(true);
        return;
      }
    } catch {}

    if (!supabase) { setOrderLoaded(true); return; }
    supabase
      .from("app_settings")
      .select("value_json")
      .eq("key", key)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value_json?.order) {
          const parsed = normalizeLandlordNavOrder(data.value_json.order);
          setNavOrder(parsed);
          latestOrderRef.current = parsed;
        }
        setOrderLoaded(true);
      });
  }, [user?.id]);

  const applyOrder = (next: LandlordSectionKey[]) => {
    const clean = normalizeLandlordNavOrder(next);
    latestOrderRef.current = clean;
    setNavOrder(clean);
    setFeedback(null);
  };

  const persistOrder = async (next: LandlordSectionKey[]) => {
    const clean = normalizeLandlordNavOrder(next);
    latestOrderRef.current = clean;
    setNavOrder(clean);

    if (user?.id) {
      try { localStorage.setItem(navStorageKey(user.id), JSON.stringify(clean)); } catch {}
    }

    if (!supabase || !user?.id) return;
    setSaving(true);
    try {
      const key = navStorageKey(user.id);
      await supabase.from("app_settings").upsert({ key, value_json: { order: clean } }, { onConflict: "key" });
      setFeedback("Ordre du menu enregistré.");
    } catch {
      setFeedback("Ordre appliqué sur cet appareil. La sauvegarde en ligne sera disponible sous peu.");
    } finally {
      setSaving(false);
    }
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

  if (checking) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-sm text-slate-500">Chargement…</p>
    </div>
  );

  const items = getLandlordNavItems(navOrder);

  return (
    <AccountLayout userEmail={user?.email ?? null} active="preferences" onLogout={handleLogout}>
      <div className="space-y-5 max-w-2xl">
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm sm:px-8">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-indigo-600 mb-1">Préférences</p>
          <h1 className="text-xl font-semibold text-slate-900">Personnalisation du site</h1>
          <p className="mt-1.5 text-sm leading-6 text-slate-500">
            Réorganisez les onglets de l'espace bailleur dans l'ordre qui vous convient. Les 4 premières positions alimentent la barre mobile.
          </p>
        </div>

        {!isLoggedIn ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Connexion requise</h2>
            <p className="mt-2 text-sm text-slate-600">Connectez-vous pour modifier vos préférences.</p>
            <a href="/mon-compte" className="mt-5 inline-flex rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
              Me connecter
            </a>
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm sm:px-8">
            <div className="flex items-center justify-between gap-4 mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Ordre des onglets</p>
              <button
                type="button"
                onClick={() => persistOrder(DEFAULT_LANDLORD_NAV_ORDER)}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
              >
                <ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
                Réinitialiser
              </button>
            </div>

            {!orderLoaded ? (
              <p className="text-sm text-slate-400">Chargement…</p>
            ) : (
              <div className="space-y-2">
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
                          ? "scale-[1.015] cursor-grabbing border-indigo-300 bg-white/80 opacity-75 shadow-[0_22px_55px_rgba(99,91,255,0.22)] ring-2 ring-indigo-100"
                          : "cursor-grab border-slate-200 bg-white shadow-sm hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md")
                      }
                      role="button"
                      tabIndex={0}
                      aria-label={`Déplacer ${item.label}`}
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-semibold text-slate-950">{item.label}</p>
                        <p className="text-xs text-slate-500">
                          {index < 4 ? `Barre mobile · position ${index + 1}` : `Menu Plus · position ${index + 1}`}
                        </p>
                      </div>
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 shadow-sm transition group-hover:text-slate-500" aria-hidden="true">
                        <Bars3Icon className="h-5 w-5" />
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {feedback && (
              <div className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{feedback}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </AccountLayout>
  );
}
