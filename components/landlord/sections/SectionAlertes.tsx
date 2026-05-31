import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellAlertIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  HomeModernIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../../lib/supabaseClient";
import {
  DEFAULT_LANDLORD_ALERT_PREFERENCES,
  normalizeLandlordAlertPreferences,
  type LandlordAlertPreferenceKey,
  type LandlordAlertPreferences,
} from "../../../lib/landlordAlertPreferences";
import { Pill, SectionTitle } from "../UiBits";

type Props = { userId: string };

type AlertConfig = {
  key: LandlordAlertPreferenceKey;
  title: string;
  desc: string;
  group: "Paiements et quittances" | "Baux et états des lieux" | "Qualité des données";
  level: "Prioritaire" | "Prévention" | "Configuration";
};

const ALERTS: AlertConfig[] = [
  { key: "late_payment", title: "Loyer en retard", desc: "Échéance dépassée et paiement toujours non confirmé.", group: "Paiements et quittances", level: "Prioritaire" },
  { key: "due_soon", title: "Loyer bientôt exigible", desc: "Échéance prévue dans les trois prochains jours.", group: "Paiements et quittances", level: "Prévention" },
  { key: "receipt_to_finalize", title: "Quittance à finaliser", desc: "Paiement confirmé, mais PDF absent ou quittance non envoyée.", group: "Paiements et quittances", level: "Prioritaire" },
  { key: "rent_revision_due", title: "Révision annuelle du loyer à préparer", desc: "Contrôle de la clause du bail, du DPE et de l’IRL un mois puis deux semaines avant la date anniversaire.", group: "Baux et états des lieux", level: "Prévention" },
  { key: "lease_end", title: "Bail bientôt à échéance", desc: "Rappels progressifs à l’approche de la date de fin du bail.", group: "Baux et états des lieux", level: "Prévention" },
  { key: "expired_active_lease", title: "Bail expiré encore actif", desc: "Date de fin dépassée alors que le bail n’est pas clôturé.", group: "Baux et états des lieux", level: "Prioritaire" },
  { key: "entry_inventory_missing", title: "État des lieux d’entrée manquant", desc: "Aucun état des lieux d’entrée n’est rattaché au bail.", group: "Baux et états des lieux", level: "Prioritaire" },
  { key: "exit_inventory_to_prepare", title: "État des lieux de sortie à préparer", desc: "La fin du bail approche et la sortie n’est pas finalisée.", group: "Baux et états des lieux", level: "Prévention" },
  { key: "tenant_email_missing", title: "Email locataire manquant", desc: "L’adresse nécessaire à l’envoi automatique des quittances est absente.", group: "Qualité des données", level: "Configuration" },
  { key: "owner_email_missing", title: "Email bailleur manquant", desc: "L’adresse de notification du bailleur n’est pas configurée sur le bail.", group: "Qualité des données", level: "Configuration" },
];

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

export function SectionAlertes({ userId }: Props) {
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
    else setPreferences(normalizeLandlordAlertPreferences(data as any));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = useMemo(() => ALERTS.filter((alert) => preferences[alert.key]).length, [preferences]);

  const save = async (next: LandlordAlertPreferences) => {
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
  };

  const groups = ["Paiements et quittances", "Baux et états des lieux", "Qualité des données"] as const;

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <SectionTitle
          kicker="Contrôle des alertes"
          title="Choisissez les emails utiles à votre gestion"
          desc="Un seul récapitulatif quotidien est envoyé lorsqu’au moins une alerte activée nécessite votre attention."
          right={<Pill tone={preferences.digest_enabled ? "emerald" : "slate"}>{preferences.digest_enabled ? `${activeCount} alertes actives` : "Emails suspendus"}</Pill>}
        />

        <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-[#f6f9fc] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
              <BellAlertIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">Récapitulatif quotidien par email</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">Désactivez cet interrupteur pour suspendre tous les emails d’alertes métier sans perdre vos choix détaillés.</p>
            </div>
          </div>
          <Toggle
            checked={preferences.digest_enabled}
            disabled={loading || saving}
            label="Activer ou désactiver le récapitulatif quotidien"
            onChange={() => void save({ ...preferences, digest_enabled: !preferences.digest_enabled })}
          />
        </div>

        {message ? <p className="mt-3 text-xs font-semibold text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-3 text-xs font-semibold text-red-700">{error}</p> : null}
      </div>

      {groups.map((group) => (
        <div key={group} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-2">
            {group === "Paiements et quittances" ? <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" /> : null}
            {group === "Baux et états des lieux" ? <HomeModernIcon className="h-5 w-5 text-[#4f46e5]" /> : null}
            {group === "Qualité des données" ? <InformationCircleIcon className="h-5 w-5 text-slate-500" /> : null}
            <h3 className="text-sm font-semibold text-slate-950">{group}</h3>
          </div>

          <div className="mt-4 divide-y divide-slate-200">
            {ALERTS.filter((alert) => alert.group === group).map((alert) => (
              <div key={alert.key} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{alert.title}</p>
                    <Pill tone={alert.level === "Prioritaire" ? "red" : alert.level === "Prévention" ? "amber" : "slate"}>{alert.level}</Pill>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{alert.desc}</p>
                </div>
                <Toggle
                  checked={preferences[alert.key]}
                  disabled={loading || saving}
                  label={`Activer ou désactiver : ${alert.title}`}
                  onChange={() => void save({ ...preferences, [alert.key]: !preferences[alert.key] })}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
        <p className="text-xs leading-5 text-emerald-900">
          Ces réglages pilotent le récapitulatif quotidien. Le mail distinct demandant de confirmer l’encaissement du loyer reste géré depuis chaque bail.
        </p>
      </div>
    </section>
  );
}
