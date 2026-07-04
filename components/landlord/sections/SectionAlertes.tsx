import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  BellAlertIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  HomeModernIcon,
  InformationCircleIcon,
  LockClosedIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../../lib/supabaseClient";
import {
  DEFAULT_LANDLORD_ALERT_PREFERENCES,
  normalizeLandlordAlertPreferences,
  type LandlordAlertPreferenceKey,
  type LandlordAlertPreferences,
  planAllowsLandlordAlert,
} from "../../../lib/landlordAlertPreferences";
import type { Plan } from "../../../lib/permissions";
import { Pill, SectionTitle } from "../UiBits";

type Props = { userId: string; plan: Plan };

type AlertConfig = {
  key: LandlordAlertPreferenceKey;
  title: string;
  desc: string;
  schedule: string;
  group: "Paiements et loyers" | "Baux et documents" | "Données manquantes" | "Dépôt de garantie";
  level: "Urgent" | "Anticipation" | "À compléter";
};

const ALERTS: AlertConfig[] = [
  {
    key: "late_payment",
    title: "Loyer en retard",
    desc: "Un loyer n'a pas été encaissé après sa date d'échéance. Vous recevez un rappel pour agir.",
    schedule: "Le lendemain · à 3 jours · à 7 jours · puis toutes les semaines",
    group: "Paiements et loyers",
    level: "Urgent",
  },
  {
    key: "due_soon",
    title: "Loyer à venir",
    desc: "Votre date d'encaissement approche. Un rappel pour préparer le suivi.",
    schedule: "3 jours avant · la veille · le jour même",
    group: "Paiements et loyers",
    level: "Anticipation",
  },
  {
    key: "receipt_to_finalize",
    title: "Quittance non envoyée",
    desc: "Le paiement est confirmé mais la quittance n'a pas encore été envoyée au locataire.",
    schedule: "Le lendemain · à 3 jours · à 7 jours · puis toutes les semaines",
    group: "Paiements et loyers",
    level: "Urgent",
  },
  {
    key: "rent_revision_due",
    title: "Révision annuelle du loyer",
    desc: "La date anniversaire du bail approche : c'est le moment de vérifier si une révision de loyer est possible.",
    schedule: "30 jours avant · 14 jours avant la date anniversaire",
    group: "Baux et documents",
    level: "Anticipation",
  },
  {
    key: "lease_end",
    title: "Fin de bail imminente",
    desc: "La fin de bail approche. Préparez le renouvellement ou la sortie du locataire.",
    schedule: "2 mois avant · 1 mois avant · 7 jours avant",
    group: "Baux et documents",
    level: "Anticipation",
  },
  {
    key: "expired_active_lease",
    title: "Bail terminé non clôturé",
    desc: "Le bail a dépassé sa date de fin mais n'a pas encore été archivé dans l'application.",
    schedule: "Le lendemain · 7 jours · puis toutes les semaines",
    group: "Baux et documents",
    level: "Urgent",
  },
  {
    key: "entry_inventory_missing",
    title: "État des lieux d'entrée manquant",
    desc: "Aucun état des lieux d'entrée n'est enregistré sur ce bail.",
    schedule: "7 jours avant · la veille pour préparer · puis le lendemain et 7 jours après si manquant",
    group: "Baux et documents",
    level: "Urgent",
  },
  {
    key: "exit_inventory_to_prepare",
    title: "État des lieux de sortie à planifier",
    desc: "La fin de bail approche sans état des lieux de sortie planifié.",
    schedule: "30 jours avant · 7 jours avant · la veille · puis le lendemain et 7 jours après si non finalisé",
    group: "Baux et documents",
    level: "Anticipation",
  },
  {
    key: "deposit_not_collected",
    title: "Dépôt de garantie non encaissé",
    desc: "Aucun encaissement de dépôt de garantie n'est enregistré sur ce bail.",
    schedule: "Le lendemain · 7 jours · puis toutes les semaines",
    group: "Dépôt de garantie",
    level: "Urgent",
  },
  {
    key: "deposit_return_overdue",
    title: "Restitution du dépôt de garantie en retard",
    desc: "Le délai légal de restitution du dépôt de garantie est dépassé.",
    schedule: "Le lendemain · 7 jours · puis toutes les semaines",
    group: "Dépôt de garantie",
    level: "Urgent",
  },
  {
    key: "tenant_email_missing",
    title: "Email du locataire manquant",
    desc: "L'email du locataire n'est pas renseigné. Il est nécessaire pour lui envoyer ses quittances automatiquement.",
    schedule: "Chaque semaine jusqu'à correction",
    group: "Données manquantes",
    level: "À compléter",
  },
  {
    key: "owner_email_missing",
    title: "Votre email manquant sur un bail",
    desc: "Votre adresse email n'est pas renseignée sur ce bail. Vous ne recevrez aucune notification le concernant.",
    schedule: "Chaque semaine jusqu'à correction",
    group: "Données manquantes",
    level: "À compléter",
  },
];

const GROUP_META: Record<AlertConfig["group"], { icon: ReactNode; desc: string }> = {
  "Paiements et loyers": {
    icon: <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />,
    desc: "Suivez l'encaissement de vos loyers et l'envoi des quittances.",
  },
  "Baux et documents": {
    icon: <HomeModernIcon className="h-5 w-5 text-indigo-600" />,
    desc: "Anticipez les échéances importantes liées à vos baux.",
  },
  "Dépôt de garantie": {
    icon: <ShieldExclamationIcon className="h-5 w-5 text-rose-500" />,
    desc: "Suivez l'encaissement et la restitution du dépôt de garantie.",
  },
  "Données manquantes": {
    icon: <InformationCircleIcon className="h-5 w-5 text-slate-500" />,
    desc: "Complétez les informations manquantes pour que les alertes fonctionnent correctement.",
  },
};

function Toggle({ checked, disabled, label, onChange }: { checked: boolean; disabled?: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full border transition ${
        checked ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-slate-200"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${checked ? "left-[1.35rem]" : "left-0.5"}`} />
    </button>
  );
}

function LevelPill({ level }: { level: AlertConfig["level"] }) {
  if (level === "Urgent") return <Pill tone="red">Urgent</Pill>;
  if (level === "Anticipation") return <Pill tone="amber">Anticipation</Pill>;
  return <Pill tone="slate">À compléter</Pill>;
}

export function SectionAlertes({ userId, plan }: Props) {
  const [preferences, setPreferences] = useState<LandlordAlertPreferences>(DEFAULT_LANDLORD_ALERT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !userId) return;
    setLoading(true);
    setError(null);
    const { data, error: loadError } = await supabase.from("landlord_alert_preferences").select("*").eq("user_id", userId).maybeSingle();
    if (loadError) setError(loadError.message);
    else setPreferences(normalizeLandlordAlertPreferences(data));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = useMemo(
    () => ALERTS.filter((alert) => preferences[alert.key] && planAllowsLandlordAlert(plan, alert.key)).length,
    [plan, preferences]
  );

  const save = useCallback(async (next: LandlordAlertPreferences) => {
    if (!supabase) return;
    setPreferences(next);
    setSaving(true);
    setMessage(null);
    setError(null);
    const { error: saveError } = await supabase.from("landlord_alert_preferences").upsert(
      { user_id: userId, ...next, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    if (saveError) {
      setError(saveError.message);
      await load();
    } else {
      setMessage("Préférences enregistrées.");
    }
    setSaving(false);
  }, [userId, load]);

  const groups = ["Paiements et loyers", "Baux et documents", "Dépôt de garantie", "Données manquantes"] as const;

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <SectionTitle
          kicker="Mes alertes"
          title="Personnalisez vos notifications"
          desc="Activez uniquement les alertes qui vous sont utiles. Chaque email est envoyé au bon moment, sans spam."
          right={
            <Pill tone={preferences.digest_enabled ? "emerald" : "slate"}>
              {preferences.digest_enabled ? `${activeCount} alertes actives` : "Notifications suspendues"}
            </Pill>
          }
        />

        <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-[#f6f9fc] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
              <BellAlertIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">Activer les notifications par email</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Désactivez cet interrupteur pour suspendre tous les emails d'un coup, sans perdre vos réglages.
              </p>
            </div>
          </div>
          <Toggle
            checked={preferences.digest_enabled}
            disabled={loading || saving}
            label="Activer ou désactiver toutes les notifications"
            onChange={() => void save({ ...preferences, digest_enabled: !preferences.digest_enabled })}
          />
        </div>

        {message ? <p className="mt-3 text-xs font-semibold text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-3 text-xs font-semibold text-red-700">{error}</p> : null}
      </div>

      {groups.map((group) => {
        const meta = GROUP_META[group];
        const groupAlerts = ALERTS.filter((alert) => alert.group === group);
        return (
          <div key={group} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">{meta.icon}</div>
              <div>
                <h3 className="text-sm font-semibold text-slate-950">{group}</h3>
                <p className="mt-0.5 text-xs text-slate-500">{meta.desc}</p>
              </div>
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {groupAlerts.map((alert) => {
                const allowed = planAllowsLandlordAlert(plan, alert.key);
                return (
                  <div key={alert.key} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{alert.title}</p>
                        <LevelPill level={alert.level} />
                        {!allowed ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#635bff]/20 bg-[#635bff]/5 px-2 py-0.5 text-[0.65rem] font-semibold text-[#4f46e5]">
                            <LockClosedIcon className="h-3 w-3" aria-hidden="true" />
                            lokt·one
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{alert.desc}</p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <ClockIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                        <p className="text-xs text-slate-500">{alert.schedule}</p>
                      </div>
                      {!allowed ? (
                        <Link href="/mon-compte/abonnement?source=alertes" className="mt-1 inline-flex text-xs font-semibold text-[#4f46e5] hover:underline">
                          Débloquer avec lokt·one
                        </Link>
                      ) : null}
                    </div>
                    <Toggle
                      checked={preferences[alert.key] && allowed}
                      disabled={loading || saving || !allowed}
                      label={`Activer ou désactiver : ${alert.title}`}
                      onChange={() => void save({ ...preferences, [alert.key]: !preferences[alert.key] })}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
        <p className="text-xs leading-5 text-emerald-900">
          Ces réglages s'appliquent aux alertes automatiques. L'email de confirmation d'encaissement du loyer se configure séparément, depuis chaque bail.
        </p>
      </div>
    </section>
  );
}
