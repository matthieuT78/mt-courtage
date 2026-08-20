import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { sendEmailViaResend } from "../../../lib/mailer/resend";
import { hasValidCronSecret } from "../../../lib/cronAuth";
import {
  normalizeLandlordAlertPreferences,
  planAllowsLandlordAlert,
  type LandlordAlertPreferenceKey,
  type LandlordAlertPreferences,
} from "../../../lib/landlordAlertPreferences";
import { getServerUserPlan } from "../../../lib/serverPermissions";
import { alertCronFailures } from "../../../lib/cronAlert";
import { getLeaseRentPeriod } from "../../../lib/rentPeriod";

type AlertTone = "red" | "amber" | "slate";

type AlertItem = {
  key: string;
  preferenceKey: LandlordAlertPreferenceKey;
  tone: AlertTone;
  title: string;
  detail: string;
  href: string;
  propertyId?: string;
  actionable?: boolean; // false pour les alertes purement informatives (rien à traiter côté lokt)
};

type LeaseRow = Record<string, any>;

const DAY_MS = 24 * 60 * 60 * 1000;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function todayParis() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function daysBetween(a: Date, b: Date) {
  const aa = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bb = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((bb - aa) / DAY_MS);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

function parseISODate(v?: string | null) {
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function nextLeaseAnniversary(startDate: Date, today: Date) {
  const anniversaryForYear = (year: number) => {
    const month = startDate.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(startDate.getDate(), lastDay));
  };
  const anniversary = anniversaryForYear(today.getFullYear());
  return anniversary >= today ? anniversary : anniversaryForYear(today.getFullYear() + 1);
}

function clampDay(year: number, month0: number, rawDay: any) {
  const last = new Date(year, month0 + 1, 0).getDate();
  const day = Math.max(1, Math.min(31, Number(rawDay || 1) || 1));
  return Math.min(day, last);
}

function dueDateForCurrentPeriod(today: Date, lease: LeaseRow) {
  const day = Number(lease.payment_day || 1) || 1;
  const periodDate = today;
  const periodKey = `${periodDate.getFullYear()}-${pad2(periodDate.getMonth() + 1)}`;
  const rentPeriod = getLeaseRentPeriod(lease, periodKey);
  if (!rentPeriod) return null;

  const dueDay = clampDay(today.getFullYear(), today.getMonth(), day);
  return {
    period: { start: rentPeriod.periodStart, end: rentPeriod.periodEnd },
    dueDate: new Date(today.getFullYear(), today.getMonth(), dueDay),
  };
}

function isActiveLease(lease: LeaseRow, today: Date) {
  const status = String(lease.status || "").toLowerCase();
  const end = parseISODate(lease.end_date);
  if (status === "ended" || status === "archived" || status === "draft") return false;
  return !end || end >= today;
}

function labelForLease(lease: LeaseRow, propertiesById: Map<string, any>, tenantsById: Map<string, any>) {
  const property = propertiesById.get(lease.property_id);
  const tenant = tenantsById.get(lease.tenant_id);
  return {
    property: property?.label || property?.address_line1 || "Bien sans libellé",
    tenant: tenant?.full_name || [tenant?.first_name, tenant?.last_name].filter(Boolean).join(" ") || "Locataire",
  };
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
}

function daysSince(today: Date, value?: string | null) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return Math.max(0, daysBetween(new Date(date.getFullYear(), date.getMonth(), date.getDate()), today));
}

// Au-delà de ce délai, une relance non résolue passe de hebdo à mensuelle —
// sans plafond, une alerte comme "état des lieux d'entrée manquant" peut
// nager indéfiniment (cas réel observé en base : relances hebdo depuis plus
// de 2 ans sur un bail actif). Mensuel garde le rappel vivant sans
// contribuer à la fatigue d'alerte.
const STALE_AFTER_DAYS = 180;
const STALE_REPEAT_DAYS = 28;

function recurringScheduleKey(prefix: string, daysElapsed: number, firstDays: number[], repeatEveryDays?: number) {
  if (firstDays.includes(daysElapsed)) return `${prefix}:day-${daysElapsed}`;
  const repeatFrom = firstDays[firstDays.length - 1];
  if (!repeatEveryDays || daysElapsed <= repeatFrom) return null;
  const interval = daysElapsed > STALE_AFTER_DAYS ? STALE_REPEAT_DAYS : repeatEveryDays;
  return daysElapsed % interval === 0 ? `${prefix}:day-${daysElapsed}` : null;
}

function weeklyScheduleKey(prefix: string, today: Date, daysElapsed?: number | null) {
  if (daysElapsed != null && daysElapsed > STALE_AFTER_DAYS) {
    return `${prefix}:month-${today.getFullYear()}-${pad2(today.getMonth() + 1)}`;
  }
  const monday = new Date(today);
  const day = monday.getDay() || 7;
  monday.setDate(monday.getDate() - day + 1);
  return `${prefix}:week-${toISODate(monday)}`;
}

const ALERT_SERVICE_MAP: Partial<Record<LandlordAlertPreferenceKey, string>> = {
  late_payment:            "gestion_courante",
  due_soon:                "gestion_courante",
  receipt_to_finalize:     "gestion_courante",
  rent_revision_due:       "gestion_courante",
  tenant_email_missing:    "gestion_courante",
  lease_end:               "bail_edl",
  expired_active_lease:    "bail_edl",
  entry_inventory_missing: "bail_edl",
  exit_inventory_to_prepare: "bail_edl",
  // Le dépôt de garantie est collecté et restitué au même moment que la
  // signature du bail et les états des lieux — regroupé sous "bail_edl"
  // plutôt qu'une catégorie de délégation séparée.
  deposit_not_collected:   "bail_edl",
  deposit_return_overdue:  "bail_edl",
};

function isServiceDelegated(propertyId: string | undefined, preferenceKey: LandlordAlertPreferenceKey, propertiesById: Map<string, any>): boolean {
  if (!propertyId) return false;
  const property = propertiesById.get(propertyId);
  const delegated: string[] = Array.isArray(property?.delegated_services) ? property.delegated_services : [];
  if (delegated.length === 0) return false;
  const service = ALERT_SERVICE_MAP[preferenceKey];
  return !!service && delegated.includes(service);
}

async function ownerEmailForUser(userId: string, leases: LeaseRow[]) {
  const leaseEmail = leases.map((l) => String(l.reminder_email || "").trim()).find(Boolean);
  if (leaseEmail) return leaseEmail;

  const userRes = await supabaseAdmin?.auth.admin.getUserById(userId);
  return userRes?.data?.user?.email || null;
}

// Pourquoi cette alerte compte, et quoi faire concrètement — affiché sous
// chaque carte d'alerte. Écrit une fois ici plutôt que de laisser deviner
// au bailleur le sens métier de chaque titre technique.
const ALERT_GUIDANCE: Partial<Record<LandlordAlertPreferenceKey, { why: string; how: string }>> = {
  late_payment: {
    why: "Un loyer non réglé à l'échéance doit être traité vite : plus l'inaction dure, plus les démarches ultérieures (relance, mise en demeure, procédure) prennent du retard.",
    how: "Contactez d'abord le locataire pour un rappel amiable. Si le retard persiste, passez à une relance formelle puis à une mise en demeure par lettre recommandée.",
  },
  due_soon: {
    why: "Rappel préventif — le loyer n'est pas encore en retard, rien ne vous est encore demandé.",
    how: "Aucune action pour l'instant. L'alerte suivante (retard de paiement) ne se déclenchera que si le paiement n'est toujours pas confirmé après l'échéance.",
  },
  receipt_to_finalize: {
    why: "Le paiement est confirmé mais la quittance n'a pas été générée ni envoyée — le locataire n'a donc pas de preuve de paiement officielle.",
    how: "Générez et envoyez la quittance depuis l'onglet Quittances.",
  },
  rent_revision_due: {
    why: "Sans révision à la date anniversaire, le loyer reste figé alors que la clause de révision (indexée sur l'IRL) vous permet de suivre l'inflation — chaque année sautée est un manque à gagner qui ne se rattrape pas rétroactivement.",
    how: "Vérifiez la clause de révision du bail, la classe DPE (loyer gelé si F ou G) et l'IRL applicable, puis envoyez la notification de révision au locataire.",
  },
  tenant_email_missing: {
    why: "Sans email locataire, l'envoi automatique des quittances est impossible — vous repassez en gestion manuelle sans vous en rendre compte.",
    how: "Ajoutez l'adresse email du locataire depuis sa fiche.",
  },
  entry_inventory_missing: {
    why: "Sans état des lieux d'entrée, impossible de prouver l'état du logement à l'arrivée du locataire — en cas de litige au départ, vous n'avez aucune référence pour justifier une retenue sur le dépôt de garantie.",
    how: "Planifiez et réalisez l'état des lieux d'entrée avec le locataire, puis finalisez-le dans lokt.fr.",
  },
  owner_email_missing: {
    why: "Sans email de notification, vous ne recevez plus les validations de paiement ni les alertes automatiques — vous perdez en visibilité sur vos baux.",
    how: "Renseignez un email de notification dans les réglages du bail.",
  },
  deposit_not_collected: {
    why: "Le dépôt de garantie protège contre d'éventuelles dégradations ou impayés en fin de bail — sans lui, vous êtes exposé sans filet en cas de litige au départ.",
    how: "Réclamez le dépôt de garantie au locataire et confirmez son encaissement dans lokt.fr.",
  },
  deposit_return_overdue: {
    why: "La loi impose un délai strict pour restituer la caution — 1 mois si l'état des lieux de sortie est conforme à celui d'entrée, 2 mois sinon. Passé ce délai, une pénalité de 10 % du loyer mensuel hors charges est due par mois de retard commencé (art. 22, loi du 6 juillet 1989).",
    how: "Comparez les états des lieux d'entrée et de sortie, déduisez les retenues justifiées, et restituez le solde au locataire sans tarder.",
  },
  expired_active_lease: {
    why: "La date de fin du bail est dépassée mais il reste marqué actif — ça fausse le suivi (alertes, reconduction, finance) et cache souvent un oubli de clôture ou une date mal saisie.",
    how: "Clôturez le bail si le locataire est parti, ou corrigez la date de fin si elle est erronée.",
  },
  lease_end: {
    why: "À l'approche de l'échéance, il faut choisir entre laisser reconduire tacitement, renouveler, ou donner congé — et un congé pour vente ou reprise doit respecter un délai de 6 mois (location vide) ou 3 mois (meublé) avant l'échéance.",
    how: "Décidez si vous laissez reconduire, renouvelez, ou donnez congé — et si c'est un congé, envoyez-le suffisamment tôt pour respecter le délai légal.",
  },
  exit_inventory_to_prepare: {
    why: "Sans état des lieux de sortie signé, impossible de justifier une retenue sur le dépôt de garantie en cas de dégradations, et le délai légal de restitution de la caution ne peut pas être respecté correctement.",
    how: "Planifiez et réalisez l'état des lieux de sortie avec le locataire, puis finalisez-le dans lokt.fr.",
  },
};

function renderAlertCard(alert: AlertItem) {
  const baseUrl = appUrl();
  const color = alert.tone === "red" ? "#b91c1c" : alert.tone === "amber" ? "#92400e" : "#334155";
  const bg = alert.tone === "red" ? "#fef2f2" : alert.tone === "amber" ? "#fffbeb" : "#f8fafc";
  const actionable = alert.actionable !== false;
  const linkLabel = actionable ? "Traiter cette action sur lokt.fr" : "Consulter dans lokt.fr";

  const guidance = ALERT_GUIDANCE[alert.preferenceKey];
  const guidanceNote = guidance
    ? `<p style="margin:8px 0 0;color:#334155;font-size:12px;line-height:1.5">
        <strong>Pourquoi :</strong> ${guidance.why}<br/>
        <strong>Comment traiter :</strong> ${guidance.how}
      </p>`
    : "";

  // Seule alerte pour laquelle un bailleur peut avoir fait un choix délibéré
  // (pas d'EDL par choix) plutôt qu'un simple oubli — on le renvoie vers le
  // réglage par bail plutôt que de laisser croire que la seule option est
  // de couper l'alerte globalement dans les préférences.
  const optOutNote =
    alert.preferenceKey === "entry_inventory_missing"
      ? `<p style="margin:8px 0 0;color:#64748b;font-size:12px;line-height:1.45">
          Vous ne comptez pas faire d'état des lieux d'entrée pour ce bail ? Ouvrez-le, cliquez sur « Modifier », puis « Options avancées »,
          et cochez « Pas d'état des lieux d'entrée pour ce bail » — cette alerte ne sera plus envoyée pour cette location précise (vos autres baux ne sont pas concernés).
        </p>`
      : "";

  return `
      <div style="padding:12px;border:1px solid #e2e8f0;border-radius:12px;background:${bg};margin-bottom:12px;">
        <p style="margin:0 0 4px;font-weight:700;color:${color}">${alert.title}</p>
        <p style="margin:0 0 10px;color:#334155;font-size:14px;line-height:1.45">${alert.detail}</p>
        <a href="${baseUrl}${alert.href}" style="font-size:13px;color:#0f172a;font-weight:700">${linkLabel}</a>
        ${guidanceNote}
        ${optOutNote}
      </div>`;
}

// Un seul email par bailleur et par run, quel que soit le nombre d'alertes
// dues ce jour-là — avant, chaque alerte partait dans un email séparé (un
// bailleur avec 3 problèmes simultanés recevait 3 emails d'un coup), ce que
// le nom "digest_enabled" du réglage ne laissait pas du tout deviner.
function renderDigestEmail(alerts: AlertItem[]) {
  const anyActionable = alerts.some((a) => a.actionable !== false);
  const allActionable = alerts.every((a) => a.actionable !== false);

  const intro =
    alerts.length === 1
      ? alerts[0].actionable !== false
        ? "Une action nécessite votre attention dans votre espace bailleur."
        : "Voici un rappel concernant votre espace bailleur — rien à traiter pour l'instant."
      : anyActionable
      ? `${alerts.length} points nécessitent votre attention dans votre espace bailleur.`
      : `${alerts.length} rappels concernant votre espace bailleur — rien d'urgent à traiter.`;

  const footer = allActionable
    ? "Cet email automatique suit l'échéancier métier de chaque alerte. Chacune disparaît dès que l'action correspondante est traitée."
    : "Cet email automatique regroupe vos rappels du jour. Aucune action n'est requise pour les points marqués comme préventifs.";

  return `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;color:#0f172a">
      <p>Bonjour,</p>
      <p>${intro}</p>
      ${alerts.map(renderAlertCard).join("")}
      <p style="margin-top:4px;font-size:12px;color:#64748b">
        ${footer}
      </p>
    </div>
  `;
}

function digestSubject(alerts: AlertItem[]) {
  if (alerts.length === 1) return `lokt.fr - ${alerts[0].title}`;
  const urgent = alerts.filter((a) => a.tone === "red").length;
  return urgent > 0
    ? `lokt.fr - ${alerts.length} alertes sur votre espace bailleur (${urgent} urgente${urgent > 1 ? "s" : ""})`
    : `lokt.fr - ${alerts.length} alertes sur votre espace bailleur`;
}

async function alreadySent(userId: string, alertKey: string) {
  const { data, error } = await supabaseAdmin!
    .from("landlord_alert_notification_sends")
    .select("id")
    .eq("user_id", userId)
    .eq("alert_key", alertKey)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

async function markSent(userId: string, alert: AlertItem) {
  const { error } = await supabaseAdmin!.from("landlord_alert_notification_sends").insert({
    user_id: userId,
    alert_key: alert.key,
    preference_key: alert.preferenceKey,
    sent_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!hasValidCronSecret(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });

    const force = String(req.query.force || "") === "1";
    const dryRun = String(req.query.dryRun || "") === "1";
    const today = todayParis();
    const runDate = toISODate(today);

    // ── Appliquer les révisions IRL programmées ───────────────────────────
    if (!dryRun) {
      const { data: pendingRevisions } = await supabaseAdmin
        .from("leases")
        .select("id, rent_amount, irl_sent_new_rent")
        .lte("irl_apply_on", runDate)
        .is("irl_applied_at", null)
        .not("irl_sent_new_rent", "is", null);

      for (const lease of pendingRevisions || []) {
        await supabaseAdmin.from("leases").update({
          rent_amount: (lease as any).irl_sent_new_rent,
          irl_applied_at: new Date().toISOString(),
          irl_previous_rent: (lease as any).rent_amount,
        }).eq("id", (lease as any).id);
      }
    }
    const baseUrl = appUrl();
    if (!baseUrl && !dryRun) return res.status(500).json({ error: "NEXT_PUBLIC_SITE_URL ou APP_URL manquant." });

    const [
      { data: leases, error: leasesError },
      { data: properties, error: propertiesError },
      { data: tenants, error: tenantsError },
      { data: payments, error: paymentsError },
      { data: receipts, error: receiptsError },
      { data: reports, error: reportsError },
      { data: preferences, error: preferencesError },
    ] = await Promise.all([
      supabaseAdmin.from("leases").select("*"),
      supabaseAdmin.from("properties").select("id,user_id,label,address_line1,status,delegated_services"),
      supabaseAdmin.from("tenants").select("id,user_id,full_name,first_name,last_name,email,archived_at"),
      supabaseAdmin.from("rent_payments").select("id,lease_id,period_start,period_end,paid_at,total_amount"),
      supabaseAdmin.from("rent_receipts").select("id,lease_id,period_start,period_end,pdf_url,sent_at,status"),
      supabaseAdmin.from("inventory_reports").select("id,user_id,lease_id,report_type,status,performed_at"),
      supabaseAdmin.from("landlord_alert_preferences").select("*"),
    ]);

    if (leasesError) throw leasesError;
    if (propertiesError) throw propertiesError;
    if (tenantsError) throw tenantsError;
    if (paymentsError) throw paymentsError;
    if (receiptsError) throw receiptsError;
    if (reportsError) throw reportsError;
    if (preferencesError) throw preferencesError;

    const leasesList = (leases || []) as LeaseRow[];
    const propertiesById = new Map((properties || []).map((p: any) => [p.id, p]));
    const tenantsById = new Map((tenants || []).map((t: any) => [t.id, t]));
    const reportsByLease = new Map<string, any[]>();
    const preferencesByUserId = new Map<string, LandlordAlertPreferences>(
      (preferences || []).map((preference: any) => [preference.user_id, normalizeLandlordAlertPreferences(preference)])
    );
    for (const report of reports || []) {
      if (!reportsByLease.has((report as any).lease_id)) reportsByLease.set((report as any).lease_id, []);
      reportsByLease.get((report as any).lease_id)!.push(report);
    }

    const paymentsByLeasePeriod = new Map<string, any>();
    for (const payment of payments || []) {
      paymentsByLeasePeriod.set(`${(payment as any).lease_id}:${(payment as any).period_start}:${(payment as any).period_end}`, payment);
    }

    const receiptsByLeasePeriod = new Map<string, any>();
    for (const receipt of receipts || []) {
      receiptsByLeasePeriod.set(`${(receipt as any).lease_id}:${(receipt as any).period_start}:${(receipt as any).period_end}`, receipt);
    }

    const userLeases = new Map<string, LeaseRow[]>();
    for (const lease of leasesList) {
      if (!lease.user_id) continue;
      if (!userLeases.has(lease.user_id)) userLeases.set(lease.user_id, []);
      userLeases.get(lease.user_id)!.push(lease);
    }

    const results: any[] = [];
    const allFailures: Array<{ email?: string | null; error: string }> = [];

    for (const [userId, userLeaseList] of userLeases.entries()) {
      const userPreferences = preferencesByUserId.get(userId) || normalizeLandlordAlertPreferences();
      const userPlan = await getServerUserPlan(userId);
      if (!userPreferences.digest_enabled) {
        results.push({ userId, skipped: "alert_emails_disabled" });
        continue;
      }

      const alerts: AlertItem[] = [];

      for (const lease of userLeaseList) {
        const labels = labelForLease(lease, propertiesById, tenantsById);
        const active = isActiveLease(lease, today);
        const leaseReports = reportsByLease.get(lease.id) || [];
        const entryEdl = leaseReports.find((r) => r.report_type === "entry");
        const hasPreparedEntryEdl =
          !!entryEdl && ["ready", "signed", "archived"].includes(String(entryEdl.status || "").toLowerCase());
        const exitEdl = leaseReports.find((r) => r.report_type === "exit");
        const leaseEnd = parseISODate(lease.end_date);
        const leaseStart = parseISODate(lease.start_date);

        if (active) {
          const schedule = dueDateForCurrentPeriod(today, lease);
          if (!schedule) continue;
          const { period, dueDate } = schedule;
          const payment = paymentsByLeasePeriod.get(`${lease.id}:${period.start}:${period.end}`);
          const receipt = receiptsByLeasePeriod.get(`${lease.id}:${period.start}:${period.end}`);
          const paid = !!payment?.paid_at;
          const daysToDue = daysBetween(today, dueDate);

          if (!paid && daysToDue < 0) {
            // Premier palier à J+3 (pas J+1) : laisse le temps au mail de confirmation
            // de paiement (envoyé à J+1) de faire son travail avant de parler de retard.
            const scheduleKey = recurringScheduleKey(`late:${lease.id}:${period.start}`, Math.abs(daysToDue), [3, 7, 14], 7);
            if (scheduleKey) {
              alerts.push({
                key: scheduleKey,
                preferenceKey: "late_payment",
                tone: "red",
                title: `Retard de paiement - ${labels.property}`,
                detail: `${labels.tenant} n'est pas marqué payé pour la période ${period.start} au ${period.end}. Échéance dépassée depuis ${Math.abs(daysToDue)} jour(s).`,
                href: "/espace-bailleur",
                propertyId: lease.property_id,
              });
            }
          } else if (!paid && daysToDue === 3) {
            // Rappel unique et anticipé : inutile de relancer par email à J-1 et J-0,
            // ça ne devient une vraie action à traiter que si le loyer passe en retard.
            alerts.push({
              key: `due-soon:${lease.id}:${period.start}:day-${daysToDue}`,
              preferenceKey: "due_soon",
              tone: "amber",
              title: `Loyer bientôt exigible - ${labels.property}`,
              detail: `${labels.tenant} doit régler le loyer d'ici ${daysToDue} jours.`,
              href: "/espace-bailleur",
              propertyId: lease.property_id,
              actionable: false,
            });
          }

          if (paid && (!receipt?.pdf_url || !receipt?.sent_at) && !lease.receipts_disabled) {
            const daysAfterPayment = daysSince(today, payment?.paid_at);
            const scheduleKey =
              daysAfterPayment === null
                ? weeklyScheduleKey(`receipt:${lease.id}:${period.start}`, today)
                : recurringScheduleKey(`receipt:${lease.id}:${period.start}`, daysAfterPayment, [1, 3, 7], 7);
            if (scheduleKey) {
              alerts.push({
                key: scheduleKey,
                preferenceKey: "receipt_to_finalize",
                tone: "amber",
                title: `Quittance à finaliser - ${labels.property}`,
                detail: `Le paiement de ${labels.tenant} est confirmé, mais la quittance n'est pas encore générée et envoyée.`,
                href: "/espace-bailleur",
                propertyId: lease.property_id,
              });
            }
          }

          if (leaseStart && leaseStart <= today) {
            const anniversary = nextLeaseAnniversary(leaseStart, today);
            const daysToAnniversary = daysBetween(today, anniversary);
            if (daysToAnniversary === 30 || daysToAnniversary === 14) {
              alerts.push({
                key: `rent-revision:${lease.id}:${toISODate(anniversary)}:${daysToAnniversary}`,
                preferenceKey: "rent_revision_due",
                tone: "slate",
                title: `Révision annuelle du loyer à préparer - ${labels.property}`,
                detail: `Le bail de ${labels.tenant} atteint sa date anniversaire dans ${daysToAnniversary} jours. Vérifiez la clause de révision, le DPE et l'IRL applicable avant toute demande au locataire. La hausse n'est pas automatique.`,
                href: "/revision-loyer-irl",
                propertyId: lease.property_id,
              });
            }
          }

          if (!lease.receipts_disabled && !lease.tenant_receipt_email && !tenantsById.get(lease.tenant_id)?.email) {
            alerts.push({
              key: weeklyScheduleKey(`tenant-email:${lease.id}`, today, leaseStart ? daysBetween(leaseStart, today) : null),
              preferenceKey: "tenant_email_missing",
              tone: "amber",
              title: `Email locataire manquant - ${labels.property}`,
              detail: `Ajoutez un email pour ${labels.tenant} afin d'envoyer les quittances automatiquement.`,
              href: "/espace-bailleur",
              propertyId: lease.property_id,
            });
          }

          if (!hasPreparedEntryEdl && leaseStart && !lease.entry_edl_not_required) {
            const daysToStart = daysBetween(today, leaseStart);
            // Avant/le jour du début du bail : deux rappels ponctuels de préparation.
            // Après le début : relance hebdomadaire tant que l'EDL n'est pas fait
            // (namespace distinct pour ne jamais entrer en collision avec les clés
            // de préparation ci-dessus).
            const scheduleKey =
              daysToStart === 7 || daysToStart === 1
                ? `entry-edl:${lease.id}:day-${daysToStart}`
                : daysToStart < 0
                ? recurringScheduleKey(`entry-edl-overdue:${lease.id}`, -daysToStart, [1, 7], 7)
                : null;
            if (scheduleKey) {
              alerts.push({
                key: scheduleKey,
                preferenceKey: "entry_inventory_missing",
                tone: "amber",
                title: `État des lieux d'entrée manquant - ${labels.property}`,
                detail: `Aucun EDL d'entrée n'est rattaché au bail de ${labels.tenant}.`,
                href: "/espace-bailleur",
                propertyId: lease.property_id,
              });
            }
          }

          if (!lease.reminder_email) {
            alerts.push({
              key: weeklyScheduleKey(`owner-email:${lease.id}`, today, leaseStart ? daysBetween(leaseStart, today) : null),
              preferenceKey: "owner_email_missing",
              tone: "slate",
              title: `Email bailleur manquant - ${labels.property}`,
              detail: "Ajoutez un email de notification pour recevoir les validations de paiement et alertes automatiques.",
              href: "/espace-bailleur",
              propertyId: lease.property_id,
            });
          }
        }

        // Caution non encaissée : bail actif, dépôt attendu, non encore encaissé depuis >= 7 j
        if (active && Number(lease.deposit_amount || 0) > 0 && !lease.deposit_paid_at && leaseStart) {
          const daysAfterStart = daysBetween(leaseStart, today);
          if (daysAfterStart >= 7) {
            alerts.push({
              key: weeklyScheduleKey(`deposit-not-collected:${lease.id}`, today, daysAfterStart),
              preferenceKey: "deposit_not_collected",
              tone: "amber",
              title: `Caution non encaissee - ${labels.property}`,
              detail: `Le depot de garantie de ${labels.tenant} (${Number(lease.deposit_amount).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}) n'a pas encore ete encaisse.`,
              href: "/espace-bailleur?tab=locataires",
              propertyId: lease.property_id,
            });
          }
        }

        // Caution a restituer : bail termine (end_date fiabilisee par le workflow de
        // depart, qui l'ecrase avec la date effective de sortie saisie par le
        // bailleur), caution encaissee mais non restituee. Le delai legal (art. 22,
        // loi du 6 juillet 1989) est de 1 mois si l'EDL de sortie est conforme a
        // celui d'entree, 2 mois si des degradations sont constatees — l'app ne
        // detecte pas automatiquement les degradations (aucune comparaison EDL
        // entree/sortie n'existe), donc les deux seuils sont presentes sans trancher.
        if (
          !active &&
          lease.deposit_paid_at &&
          !lease.deposit_returned_at &&
          leaseEnd
        ) {
          const daysAfterOneMonth = daysBetween(addMonths(leaseEnd, 1), today);
          const daysAfterTwoMonths = daysBetween(addMonths(leaseEnd, 2), today);

          let scheduleKey: string | null = null;
          let tone: AlertTone = "amber";
          let title = "";
          let detail = "";

          if (daysAfterTwoMonths >= 0) {
            scheduleKey = recurringScheduleKey(`deposit-return-2m:${lease.id}`, daysAfterTwoMonths, [0], 7);
            tone = "red";
            title = `Délai légal maximum dépassé — ${labels.property}`;
            detail = `Le bail de ${labels.tenant} est terminé depuis plus de 2 mois et la caution n'a pas été restituée. C'est le délai légal maximum même en cas de dégradations constatées — une pénalité de 10% du loyer mensuel hors charges est due par mois de retard commencé (art. 22, loi du 6 juillet 1989).`;
          } else if (daysAfterOneMonth >= 0) {
            scheduleKey = recurringScheduleKey(`deposit-return-1m:${lease.id}`, daysAfterOneMonth, [0], 7);
            tone = "amber";
            title = `Caution à restituer — ${labels.property}`;
            detail = `Le bail de ${labels.tenant} est terminé depuis plus d'1 mois et la caution n'a pas été restituée. Délai légal : 1 mois si l'état des lieux de sortie est conforme à celui d'entrée, 2 mois si des dégradations ont été constatées.`;
          }

          if (scheduleKey) {
            alerts.push({
              key: scheduleKey,
              preferenceKey: "deposit_return_overdue",
              tone,
              title,
              detail,
              href: "/espace-bailleur?tab=locataires",
              propertyId: lease.property_id,
            });
          }
        }

        if (leaseEnd) {
          const daysToEnd = daysBetween(today, leaseEnd);
          const leaseStatus = String(lease.status || "").toLowerCase();

          if (leaseStatus === "active" && daysToEnd < 0) {
            const scheduleKey = recurringScheduleKey(`expired-active:${lease.id}`, Math.abs(daysToEnd), [1, 7], 7);
            if (scheduleKey) {
              alerts.push({
                key: scheduleKey,
                preferenceKey: "expired_active_lease",
                tone: "red",
                title: `Bail expiré encore actif - ${labels.property}`,
                detail: `La date de fin du bail de ${labels.tenant} est dépassée. Clôturez le bail ou corrigez la date.`,
                href: "/espace-bailleur?tab=locataires",
                propertyId: lease.property_id,
              });
            }
          } else if (active && [60, 30, 7].includes(daysToEnd)) {
            alerts.push({
              key: `lease-end:${lease.id}:${daysToEnd}`,
              preferenceKey: "lease_end",
              tone: "amber",
              title: `Bail bientôt à échéance - ${labels.property}`,
              detail: `Le bail de ${labels.tenant} arrive à échéance dans ${daysToEnd} jour(s). Préparez renouvellement, congé ou sortie.`,
              href: "/espace-bailleur?tab=locataires",
              propertyId: lease.property_id,
            });
          }

          if (
            ["active", "ended"].includes(leaseStatus) &&
            (!exitEdl || !["ready", "signed", "archived"].includes(String(exitEdl.status || "").toLowerCase()))
          ) {
            // Avant/le jour de fin de bail : trois rappels ponctuels de préparation.
            // Après la fin : relance hebdomadaire tant que non finalisé (namespace
            // distinct, même logique que pour l'EDL d'entrée ci-dessus).
            const scheduleKey =
              [30, 7, 1].includes(daysToEnd)
                ? `exit-edl:${lease.id}:day-${daysToEnd}`
                : daysToEnd < 0
                ? recurringScheduleKey(`exit-edl-overdue:${lease.id}`, -daysToEnd, [1, 7], 7)
                : null;
            if (scheduleKey) {
              alerts.push({
                key: scheduleKey,
                preferenceKey: "exit_inventory_to_prepare",
                tone: "amber",
                title: `État des lieux de sortie à préparer - ${labels.property}`,
                detail: `Le bail de ${labels.tenant} se termine bientôt ou est terminé. L'EDL de sortie n'est pas finalisé.`,
                href: "/espace-bailleur?tab=locataires",
                propertyId: lease.property_id,
              });
            }
          }
        }
      }

      const uniqueAlerts = Array.from(
        new Map(
          alerts
            .filter((alert) => userPreferences[alert.preferenceKey] && planAllowsLandlordAlert(userPlan, alert.preferenceKey))
            .filter((alert) => !isServiceDelegated(alert.propertyId, alert.preferenceKey, propertiesById))
            .map((a) => [a.key, a])
        ).values()
      ).slice(0, 24);
      if (uniqueAlerts.length === 0) {
        results.push({ userId, skipped: "no_alerts" });
        continue;
      }

      const to = await ownerEmailForUser(userId, userLeaseList);
      if (!to) {
        results.push({ userId, skipped: "no_owner_email", alerts: uniqueAlerts.length });
        continue;
      }

      if (dryRun) {
        results.push({ userId, to, dryRun: true, alerts: uniqueAlerts });
        continue;
      }

      const skipped: string[] = [];
      const dueAlerts: AlertItem[] = [];
      for (const alert of uniqueAlerts) {
        if (!force && (await alreadySent(userId, alert.key))) {
          skipped.push(alert.key);
          continue;
        }
        dueAlerts.push(alert);
      }

      if (dueAlerts.length === 0) {
        results.push({ userId, to, sent: [], skipped, failed: [] });
        continue;
      }

      const mail = await sendEmailViaResend({
        to,
        subject: digestSubject(dueAlerts),
        html: renderDigestEmail(dueAlerts),
      });

      if (!mail.ok) {
        const failed = dueAlerts.map((a) => ({ key: a.key, error: mail.error }));
        allFailures.push({ email: to, error: `digest (${dueAlerts.length} alerte${dueAlerts.length > 1 ? "s" : ""}) : ${mail.error}` });
        results.push({ userId, to, sent: [], skipped, failed });
        continue;
      }

      for (const alert of dueAlerts) await markSent(userId, alert);
      results.push({ userId, to, sent: dueAlerts.map((a) => a.key), skipped, failed: [] });
    }

    await alertCronFailures("landlord-alerts", allFailures);

    return res.status(200).json({
      ok: true,
      runDate,
      dryRun,
      results,
    });
  } catch (e: any) {
    console.error("[cron/landlord-alerts] error:", e);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
