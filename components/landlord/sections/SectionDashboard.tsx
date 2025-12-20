// components/landlord/sections/SectionDashboard.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { KpiCard, SectionTitle, formatEuro, fmtDate, Pill } from "../UiBits";
import type { Lease, Property, Tenant } from "../../../lib/landlord/types";
import type { LandlordSectionKey } from "../SidebarNav";
import { supabase } from "../../../lib/supabaseClient";

export function SectionDashboard({
  monthRange,
  monthlyExpected,
  monthlyPaid,
  lateCount,
  depositTotal,
  occupancyRate,
  alerts,
  activeLeases,
  propertyById,
  tenantById,

  // ✅ NEW (parcours guidé)
  propertiesCount,
  tenantsCount,
  leasesCount,
  onGo,

  // ✅ optionnel : pour persister en DB (sinon on reste localStorage only)
  userId,
}: {
  monthRange: { startISO: string; endISO: string };
  monthlyExpected: number;
  monthlyPaid: number;
  lateCount: number;
  depositTotal: number;
  occupancyRate: number;
  alerts: { tone: "emerald" | "amber" | "red"; title: string; desc: string; action?: string }[];
  activeLeases: Lease[];
  propertyById: Map<string, Property>;
  tenantById: Map<string, Tenant>;

  propertiesCount: number;
  tenantsCount: number;
  leasesCount: number;
  onGo: (k: LandlordSectionKey) => void;

  userId?: string;
}) {
  const ratio = monthlyExpected > 0 ? Math.round((monthlyPaid / monthlyExpected) * 100) : 0;

  // -----------------------------
  // ✅ Onboarding: persistence + auto-hide
  // -----------------------------
  const HIDE_AFTER_DAYS = 7;

  const storageKey = useMemo(() => {
    const u = (userId || "").trim();
    return `imp:onboarding_done_at:${u || "anon"}`;
  }, [userId]);

  const [doneAtISO, setDoneAtISO] = useState<string | null>(null);
  const [justCompleted, setJustCompleted] = useState(false);
  const prevPercentRef = useRef<number>(-1);

  // Load localStorage doneAt
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(storageKey);
      if (v) setDoneAtISO(v);
    } catch {
      // ignore
    }
  }, [storageKey]);

  const onboarding = useMemo(() => {
    const hasProperty = propertiesCount > 0;
    const hasTenant = tenantsCount > 0;
    const hasLease = leasesCount > 0;

    const steps = [
      { key: "biens" as LandlordSectionKey, label: "Créer un bien", done: hasProperty },
      { key: "locataires" as LandlordSectionKey, label: "Créer un locataire", done: hasTenant },
      { key: "baux" as LandlordSectionKey, label: "Créer un bail", done: hasLease },
    ];

    const doneCount = steps.filter((s) => s.done).length;
    const percent = Math.round((doneCount / steps.length) * 100);

    const next =
      !hasProperty ? steps[0] : !hasTenant ? steps[1] : !hasLease ? steps[2] : null;

    const headline =
      percent === 100
        ? "✅ Mise en route terminée"
        : percent >= 66
        ? "Plus qu’une étape avant votre premier workflow complet"
        : percent >= 33
        ? "Bien joué — on continue"
        : "Démarrons en 2 minutes";

    const sub =
      percent === 100
        ? "Vous pouvez maintenant gérer loyers, quittances et états des lieux."
        : next?.key === "biens"
        ? "Commencez par créer un bien : adresse, infos, statut…"
        : next?.key === "locataires"
        ? "Ajoutez le locataire : nom, email, téléphone…"
        : "Créez le bail : c’est lui qui relie Bien + Locataire et active loyers/quittances.";

    // ✅ IMPORTANT: pas de bouton “Générer une quittance”
    const cta = next ? { key: next.key, label: `→ ${next.label}` } : null;

    return { steps, doneCount, percent, next, headline, sub, cta };
  }, [propertiesCount, tenantsCount, leasesCount]);

  const toneFromPercent = (p: number) =>
    (p >= 100 ? "emerald" : p >= 66 ? "indigo" : p >= 33 ? "amber" : "slate");

  const shouldHideOnboarding = useMemo(() => {
    if (!doneAtISO) return false;
    const t = new Date(doneAtISO).getTime();
    if (!Number.isFinite(t)) return false;
    const days = (Date.now() - t) / (1000 * 60 * 60 * 24);
    return days >= HIDE_AFTER_DAYS;
  }, [doneAtISO]);

  // Persist + animate when reaching 100%
  useEffect(() => {
    const prev = prevPercentRef.current;
    const curr = onboarding.percent;
    prevPercentRef.current = curr;

    if (curr === 100 && prev >= 0 && prev < 100) {
      setJustCompleted(true);
      const t = setTimeout(() => setJustCompleted(false), 2200);
      // persist doneAt (local)
      const nowISO = new Date().toISOString();
      setDoneAtISO(nowISO);
      try {
        window.localStorage.setItem(storageKey, nowISO);
      } catch {
        // ignore
      }

      // (optionnel) persist en DB via app_settings (si policies OK)
      // clé par user: "onboarding_done_at:<userId>"
      (async () => {
        try {
          if (!supabase || !userId) return;
          const key = `onboarding_done_at:${userId}`;
          await supabase.from("app_settings").upsert(
            { key, value_json: { done_at: nowISO } },
            { onConflict: "key" }
          );
        } catch {
          // silence: on ne casse pas l’UX si la policy bloque
        }
      })();

      return () => clearTimeout(t);
    }
  }, [onboarding.percent, storageKey, userId]);

  return (
    <div className="space-y-5">
      {/* ✅ WAOU: parcours guidé (auto-masqué après X jours) */}
      {!shouldHideOnboarding ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                Mise en route
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {onboarding.headline}
              </p>
              <p className="mt-1 text-[0.85rem] text-slate-600">{onboarding.sub}</p>
              {doneAtISO && onboarding.percent === 100 ? (
                <p className="mt-1 text-xs text-slate-500">
                  Terminé le {new Date(doneAtISO).toLocaleDateString("fr-FR")}
                  {" • "}Masqué automatiquement après {HIDE_AFTER_DAYS} jours
                </p>
              ) : null}
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <span className={justCompleted ? "animate-pulse" : ""}>
                <Pill tone={toneFromPercent(onboarding.percent) as any}>
                  {onboarding.percent}%
                </Pill>
              </span>

              {onboarding.cta ? (
                <button
                  type="button"
                  onClick={() => onGo(onboarding.cta!.key)}
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  {onboarding.cta.label}
                </button>
              ) : (
                <span
                  className={
                    "rounded-full px-3 py-1.5 text-xs font-semibold " +
                    (justCompleted
                      ? "bg-emerald-200 text-emerald-900 animate-pulse"
                      : "bg-emerald-100 text-emerald-800")
                  }
                >
                  ✔ Prêt
                </span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className={justCompleted ? "h-full bg-emerald-500 transition-all duration-700" : "h-full bg-emerald-500"}
                style={{ width: `${onboarding.percent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-600">
              {onboarding.doneCount}/3 étapes terminées
              {onboarding.percent === 100 ? " • Vous êtes prêt ✅" : ""}
            </p>
          </div>

          {/* Checklist */}
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {onboarding.steps.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => onGo(s.key)}
                className={
                  "rounded-xl border px-3 py-3 text-left transition " +
                  (s.done
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100")
                }
              >
                <p className="text-sm font-semibold text-slate-900">
                  {s.done ? "✅" : "⬜"} {s.label}
                </p>
                <p className="mt-0.5 text-[0.8rem] text-slate-600">
                  {s.key === "biens"
                    ? "Adresse, infos, statut…"
                    : s.key === "locataires"
                    ? "Nom, email, contact…"
                    : "Bien + Locataire + loyer"}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Tableau de bord existant */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
        <SectionTitle
          kicker="Vue globale"
          title="Tableau de bord"
          desc={`Période : ${fmtDate(monthRange.startISO)} → ${fmtDate(
            monthRange.endISO
          )} • Suivi loyers, retards, quittances et santé du parc.`}
          right={
            <div className="flex items-center gap-2">
              <Pill tone={occupancyRate >= 80 ? "emerald" : occupancyRate >= 60 ? "amber" : "red"}>
                Occupation {occupancyRate}%
              </Pill>
              <Pill tone={lateCount > 0 ? "red" : "emerald"}>
                {lateCount > 0 ? "Retards" : "RAS"}
              </Pill>
            </div>
          }
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Loyers attendus (mois)"
            value={formatEuro(monthlyExpected)}
            hint="Charges incluses (si paramétrées)"
          />
          <KpiCard
            title="Loyers encaissés (mois)"
            value={formatEuro(monthlyPaid)}
            hint={monthlyExpected > 0 ? `Taux d’encaissement : ${ratio}%` : "—"}
            tone={monthlyExpected > 0 && monthlyPaid >= monthlyExpected ? "emerald" : "slate"}
          />
          <KpiCard
            title="Retards"
            value={`${lateCount}`}
            hint={lateCount > 0 ? "À traiter rapidement" : "Tout est à l’heure"}
            tone={lateCount > 0 ? "red" : "emerald"}
          />
          <KpiCard
            title="Dépôts de garantie"
            value={formatEuro(depositTotal)}
            hint="Somme des dépôts (baux actifs)"
            tone="indigo"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
          <SectionTitle
            kicker="Priorités"
            title="Alertes & actions"
            desc="Ce qui mérite votre attention maintenant."
          />
          <div className="space-y-2">
            {alerts.map((a, idx) => {
              const cls =
                a.tone === "red"
                  ? "border-red-200 bg-red-50 text-red-900"
                  : a.tone === "amber"
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900";
              return (
                <div key={idx} className={"rounded-xl border px-3 py-3 " + cls}>
                  <p className="text-sm font-semibold">{a.title}</p>
                  <p className="mt-0.5 text-[0.8rem] opacity-90">{a.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
          <SectionTitle kicker="Pilotage" title="Baux actifs" desc="Un bail = Bien + Locataire + loyers/quittances." />
          {activeLeases.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-[0.85rem] text-slate-700">
              Aucun bail actif. Ajoutez un bien, un locataire, puis créez un bail.
            </div>
          ) : (
            <div className="space-y-2">
              {activeLeases.slice(0, 6).map((l) => {
                const p = propertyById.get(l.property_id);
                const t = tenantById.get(l.tenant_id);
                const total = Number(l.rent_amount || 0) + Number(l.charges_amount || 0);
                return (
                  <div key={l.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {p?.label || "Bien"} • {t?.full_name || "Locataire"}
                        </p>
                        <p className="mt-0.5 text-[0.8rem] text-slate-700">
                          Total mensuel : <span className="font-semibold">{formatEuro(total)}</span>{" "}
                          <span className="text-slate-500">
                            ({formatEuro(l.rent_amount)} + {formatEuro(l.charges_amount)})
                          </span>
                        </p>
                        <p className="mt-0.5 text-[0.75rem] text-slate-500">
                          Début : {fmtDate(l.start_date)} • Fin : {fmtDate(l.end_date)}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <Pill tone={(l.auto_quittance_enabled ? "emerald" : "amber") as any}>
                          Quittances {l.auto_quittance_enabled ? "auto" : "manuel"}
                        </Pill>
                      </div>
                    </div>
                  </div>
                );
              })}
              {activeLeases.length > 6 ? (
                <p className="text-[0.75rem] text-slate-500">+{activeLeases.length - 6} autres baux…</p>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
