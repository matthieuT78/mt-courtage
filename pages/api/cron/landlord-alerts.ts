import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { sendEmailViaResend } from "../../../lib/mailer/resend";
import { hasValidCronSecret } from "../../../lib/cronAuth";
import {
  normalizeLandlordAlertPreferences,
  planAllowsLandlordAlert,
  planAllowsAllLandlordAlerts,
  type LandlordAlertPreferenceKey,
  type LandlordAlertPreferences,
} from "../../../lib/landlordAlertPreferences";
import { getServerUserPlan } from "../../../lib/serverPermissions";
import { alertCronFailures } from "../../../lib/cronAlert";
import { getLeaseRentPeriod } from "../../../lib/rentPeriod";
import { computeLeaseWatchInfo } from "../../../lib/landlord/leaseRenewal";
import type { DelegatedServiceKey } from "../../../lib/landlord/delegatedServices";
import { emailLayout } from "../../../lib/emails/layout";

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
  // HTML additionnel affiché sous le "pourquoi/comment" — réservé au pitch
  // lokt·one + tuto manuel, montré uniquement aux comptes gratuits sur
  // l'alerte "Loyer à valider" (cf. late_payment ci-dessous).
  upsellHtml?: string;
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

const ALERT_SERVICE_MAP: Partial<Record<LandlordAlertPreferenceKey, DelegatedServiceKey>> = {
  late_payment:            "gestion_courante",
  receipt_to_finalize:     "gestion_courante",
  rent_revision_due:       "gestion_courante",
  tenant_email_missing:    "gestion_courante",
  co_tenant_email_missing: "gestion_courante",
  lease_end:               "bail_edl",
  expired_active_lease:    "bail_edl",
  entry_inventory_missing: "bail_edl",
  exit_inventory_to_prepare: "bail_edl",
  // Le dépôt de garantie est collecté et restitué au même moment que la
  // signature du bail et les états des lieux — regroupé sous "bail_edl"
  // plutôt qu'une catégorie de délégation séparée.
  deposit_not_collected:   "bail_edl",
  deposit_return_overdue:  "bail_edl",
  avenant_pending:         "bail_edl",
  // Attestation d'assurance : document de conformité mentionné à la
  // signature du bail et à la remise des clés, comme le dépôt de garantie
  // et l'EDL -> bail_edl (pas gestion_courante : ce n'est pas un flux
  // financier comme les loyers/quittances/IRL).
  insurance_certificate_missing: "bail_edl",
  // DPE : préparé avec le bail (dossier de diagnostic technique) -> bail_edl.
  dpe_missing:             "bail_edl",
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
    why: "Cette alerte signale que le paiement n'a pas été validé dans lokt — pas que votre locataire est en retard. Sans synchronisation bancaire, l'outil ne peut pas savoir si le loyer est arrivé tant que vous ne le confirmez pas vous-même.",
    how: "Si le loyer est bien arrivé, validez-le en quelques secondes depuis la section Quittances. S'il n'est pas arrivé, c'est le moment de relancer votre locataire.",
  },
  receipt_to_finalize: {
    why: "Le paiement est confirmé mais la quittance ne lui a pas encore été envoyée — le locataire n'a donc pas de preuve de paiement officielle.",
    how: "Générez (si besoin) et envoyez la quittance depuis l'onglet Quittances.",
  },
  rent_revision_due: {
    why: "Sans révision à la date anniversaire, le loyer reste figé alors que la clause de révision (indexée sur l'IRL) vous permet de suivre l'inflation — chaque année sautée est un manque à gagner qui ne se rattrape pas rétroactivement.",
    how: "Vérifiez la clause de révision du bail, la classe DPE (loyer gelé si F ou G) et l'IRL applicable, puis envoyez la notification de révision au locataire.",
  },
  tenant_email_missing: {
    why: "Sans email locataire, l'envoi automatique des quittances est impossible — vous repassez en gestion manuelle sans vous en rendre compte.",
    how: "Ajoutez l'adresse email du locataire depuis sa fiche.",
  },
  co_tenant_email_missing: {
    why: "Le co-locataire a les mêmes droits que le locataire (quittances, relances, signature électronique, accès à l'espace locataire) mais sans email, il ne reçoit rien de tout ça et ne peut pas être invité à signer le bail.",
    how: "Ajoutez l'adresse email du co-locataire depuis sa fiche locataire.",
  },
  avenant_pending: {
    why: "Ce bail est professionnel (hors loi du 6 juillet 1989) : après une promotion de colocataire, le départ ne prend juridiquement effet que par un avenant signé par toutes les parties.",
    how: "Régénère le bail depuis \"Bail\" sur cette location et fais-le signer par toutes les parties.",
  },
  entry_inventory_missing: {
    why: "Sans état des lieux d'entrée, impossible de prouver l'état du logement à l'arrivée du locataire — en cas de litige au départ, vous n'avez aucune référence pour justifier une retenue sur le dépôt de garantie.",
    how: "Planifiez et réalisez l'état des lieux d'entrée avec le locataire, puis finalisez-le dans lokt.fr.",
  },
  owner_email_missing: {
    why: "Sans cet email, vous ne recevez plus les emails de confirmation de paiement en un clic ni leurs relances automatiques. Les autres notifications (cette alerte incluse, et la copie des quittances) continuent d'arriver sur l'email de connexion de votre compte par défaut.",
    how: "Renseignez un email de notification dans les réglages du bail — utile si vous voulez recevoir ces emails sur une autre adresse que celle du compte.",
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
    why: "À l'approche de l'échéance, il faut choisir entre laisser reconduire tacitement ou renouveler. Un congé pour vente ou reprise doit respecter un délai de 6 mois (location vide) ou 3 mois (meublé) avant l'échéance — cette alerte n'apparaît qu'à partir de 60 jours, donc ce délai est déjà dépassé pour donner congé sur cette échéance précise.",
    how: "Si vous vouliez donner congé pour vente ou reprise, le délai légal est probablement déjà passé pour cette échéance : anticipez la prochaine dès maintenant. Sinon, décidez si vous laissez reconduire tacitement ou si vous proposez un avenant au locataire.",
  },
  exit_inventory_to_prepare: {
    why: "Sans état des lieux de sortie signé, impossible de justifier une retenue sur le dépôt de garantie en cas de dégradations, et le délai légal de restitution de la caution ne peut pas être respecté correctement.",
    how: "Planifiez et réalisez l'état des lieux de sortie avec le locataire, puis finalisez-le dans lokt.fr.",
  },
};

function euro(n: number) {
  return Number(n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

// Reprend le visuel de lib/freePlanQuittanceReminderEmail.ts (tableau récap,
// étapes numérotées en cercles, bloc CTA sombre) plutôt que le style brut des
// autres cartes d'alerte — celle-ci a un but marketing, elle doit avoir fière
// allure, pas ressembler à une notification technique.
function buildFreePlanLatePaymentUpsell(params: {
  propertyLabel: string;
  tenantName: string;
  rentPeriod: { rent: number; charges: number; total: number } | null;
}) {
  const baseUrl = appUrl();
  const tarifsUrl = `${baseUrl}/tarifs?ref=late_payment_alert`;
  const quittancesUrl = `${baseUrl}/espace-bailleur?tab=quittances`;
  const total = params.rentPeriod?.total ?? 0;
  const tenantFirstName = params.tenantName.split(" ")[0];

  const steps: Array<{ label: string; action: string; rest: string }> = [
    { label: "Ouvrez la section", action: "« Quittances »", rest: "depuis le menu de votre espace bailleur." },
    { label: "Cliquez sur", action: "« Confirmer payé »", rest: "(ou « Solde reçu » si le paiement est partiel) en face de ce locataire." },
    { label: "Vérifiez le montant, et laissez cochée", action: "« Envoyer la quittance au locataire par email une fois générée »", rest: "." },
    { label: "Validez", action: "— paiement confirmé, PDF généré et quittance envoyée à votre locataire", rest: "en un seul clic." },
  ];
  const stepsHtml = steps
    .map(
      (s, i) => `
    <tr>
      <td style="padding:7px 10px 7px 0;vertical-align:top;width:26px;">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:999px;background:#0f172a;color:#ffffff;font-size:12px;font-weight:800;">${i + 1}</span>
      </td>
      <td style="padding:7px 0;font-size:13px;line-height:1.5;color:#334155;">
        ${s.label} <b style="color:#0f172a;">${s.action}</b> ${s.rest}
      </td>
    </tr>`
    )
    .join("");

  return `
    <div style="margin-top:14px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;padding:14px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:13px;">
        <tr>
          <td style="padding:4px 0;color:#64748b;">Locataire</td>
          <td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${params.tenantName}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#64748b;">Montant attendu</td>
          <td style="padding:4px 0;text-align:right;font-weight:800;color:#0f172a;">${euro(total)}</td>
        </tr>
      </table>
    </div>

    <div style="margin-top:12px;padding:20px;border-radius:12px;background:#0f172a;">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#94a3b8;font-weight:700;">
        La solution simple
      </p>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#e2e8f0;">
        Avec <b style="color:#ffffff;">lokt·one</b>, la confirmation du paiement, la quittance et l'envoi à ${tenantFirstName} se font automatiquement, chaque mois, sans que vous ayez à vous reconnecter.
      </p>
      <a href="${tarifsUrl}" style="display:block;text-align:center;padding:14px 18px;border-radius:10px;background:#ffffff;color:#0f172a;text-decoration:none;font-weight:800;font-size:15px;">
        Automatiser mes quittances — 6,90&nbsp;€/mois
      </a>
    </div>

    <p style="margin:18px 0 8px;text-align:center;font-size:13px;color:#64748b;">
      Ou faites-le vous-même maintenant, en 4 étapes :
    </p>
    <div style="border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;padding:10px 14px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        ${stepsHtml}
      </table>
    </div>
    <a href="${quittancesUrl}" style="display:block;text-align:center;margin-top:12px;padding:12px 18px;border-radius:10px;border:1px solid #cbd5e1;color:#0f172a;text-decoration:none;font-weight:700;font-size:14px;">
      Aller dans la section Quittances
    </a>
  `;
}

function renderAlertCard(alert: AlertItem) {
  const baseUrl = appUrl();
  const accent = alert.tone === "red" ? "#dc2626" : alert.tone === "amber" ? "#d97706" : "#94a3b8";
  const actionable = alert.actionable !== false;
  const linkLabel = actionable ? "Traiter cette action sur lokt.fr" : "Consulter dans lokt.fr";

  const guidance = ALERT_GUIDANCE[alert.preferenceKey];
  const guidanceNote = guidance
    ? `<div style="margin-top:12px;padding:10px 12px;border-radius:10px;background:#f8fafc;">
        <p style="margin:0;color:#475569;font-size:12.5px;line-height:1.55;">
          <strong style="color:#0f172a;">Pourquoi :</strong> ${guidance.why}<br/>
          <strong style="color:#0f172a;">Comment traiter :</strong> ${guidance.how}
        </p>
      </div>`
    : "";

  // L'état des lieux (entrée ou sortie) reste géré par le bailleur pour ce bail précis : si
  // l'agence s'en charge, c'est la délégation du bien (Logements > Services délégués > "Bail &
  // états des lieux") qui supprime cette alerte via isServiceDelegated ci-dessous — pas un
  // réglage par bail. Ne rien proposer d'autre ici évite de recréer un mécanisme redondant.
  const optOutNote =
    alert.preferenceKey === "entry_inventory_missing" || alert.preferenceKey === "exit_inventory_to_prepare"
      ? `<p style="margin:8px 0 0;color:#64748b;font-size:12px;line-height:1.45">
          Ce bien est géré par une agence pour le bail et l'état des lieux ? Configurez la délégation sur ce bien (Logements → le bien → « Bail &amp; états des lieux ») pour ne plus recevoir cette alerte sur aucun de ses baux.
        </p>`
      : "";

  // Carte à visée marketing (upsellHtml) : pas de boîte ambre/rouge imbriquée
  // autour d'un bloc déjà riche visuellement — juste un titre sobre, puis le
  // contenu prend toute la place.
  if (alert.upsellHtml) {
    return `
      <div style="margin-bottom:16px;">
        <p style="margin:0 0 4px;font-weight:700;color:#0f172a;font-size:15px;">${alert.title}</p>
        <p style="margin:0;color:#334155;font-size:14px;line-height:1.45">${alert.detail}</p>
        ${alert.upsellHtml}
      </div>`;
  }

  return `
      <div style="margin-bottom:14px;padding:16px 18px;border-radius:12px;border:1px solid #e2e8f0;border-left:4px solid ${accent};background:#ffffff;">
        <p style="margin:0 0 6px;font-weight:700;color:#0f172a;font-size:15px;">${alert.title}</p>
        <p style="margin:0 0 14px;color:#475569;font-size:14px;line-height:1.5;">${alert.detail}</p>
        <a href="${baseUrl}${alert.href}" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;">${linkLabel}</a>
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

  const contentHtml = `
    <p style="margin:12px 0 0;font-size:14px;color:#334155;">${intro}</p>
    <div style="margin-top:16px;">
      ${alerts.map(renderAlertCard).join("")}
    </div>
  `;

  return emailLayout({
    title: digestSubject(alerts),
    preheader: intro,
    contentHtml,
    footerText: footer,
  });
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
      { data: lots, error: lotsError },
      { data: tenants, error: tenantsError },
      { data: payments, error: paymentsError },
      { data: receipts, error: receiptsError },
      { data: reports, error: reportsError },
      { data: preferences, error: preferencesError },
      { data: contractDocs, error: contractDocsError },
    ] = await Promise.all([
      supabaseAdmin.from("leases").select("*"),
      supabaseAdmin.from("properties").select("id,user_id,label,address_line1,status,delegated_services,energy_class"),
      supabaseAdmin.from("property_lots").select("id,energy_class"),
      supabaseAdmin.from("tenants").select("id,user_id,full_name,first_name,last_name,email,archived_at"),
      supabaseAdmin.from("rent_payments").select("id,lease_id,period_start,period_end,paid_at,total_amount"),
      supabaseAdmin.from("rent_receipts").select("id,lease_id,period_start,period_end,pdf_url,sent_at,status"),
      supabaseAdmin.from("inventory_reports").select("id,user_id,lease_id,report_type,status,performed_at"),
      supabaseAdmin.from("landlord_alert_preferences").select("*"),
      supabaseAdmin.from("lease_contract_documents").select("lease_id,generated_at"),
    ]);

    if (leasesError) throw leasesError;
    if (propertiesError) throw propertiesError;
    if (lotsError) throw lotsError;
    if (tenantsError) throw tenantsError;
    if (paymentsError) throw paymentsError;
    if (receiptsError) throw receiptsError;
    if (reportsError) throw reportsError;
    if (preferencesError) throw preferencesError;
    if (contractDocsError) throw contractDocsError;

    const leasesList = (leases || []) as LeaseRow[];
    const propertiesById = new Map((properties || []).map((p: any) => [p.id, p]));
    const lotsById = new Map((lots || []).map((l: any) => [l.id, l]));
    const tenantsById = new Map((tenants || []).map((t: any) => [t.id, t]));
    // Le plus récent generated_at par bail — voir avenant_pending plus bas.
    const latestContractGeneratedAtByLease = new Map<string, string>();
    for (const doc of (contractDocs || []) as any[]) {
      const prev = latestContractGeneratedAtByLease.get(doc.lease_id);
      if (doc.generated_at && (!prev || doc.generated_at > prev)) latestContractGeneratedAtByLease.set(doc.lease_id, doc.generated_at);
    }
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

    // Isole le traitement de chaque bailleur : si l'un d'eux déclenche une
    // erreur ou traîne trop longtemps (cause exacte non identifiable sans accès
    // aux logs Vercel), les autres continuent d'être traités plutôt que de
    // perdre tout le lot — incident réel constaté (cron-job.org) : ~14 bailleurs
    // sur 15 sans digest plusieurs jours sur les 4 dernières semaines.
    async function processOneLandlord(
      userId: string,
      userLeaseList: LeaseRow[]
    ): Promise<{ result: any; failure?: { email?: string | null; error: string } }> {
      const userPreferences = preferencesByUserId.get(userId) || normalizeLandlordAlertPreferences();
      const userPlan = await getServerUserPlan(userId);
      if (!userPreferences.digest_enabled) {
        return { result: { userId, skipped: "alert_emails_disabled" } };
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
            // de paiement (envoyé à J+1, plan payant) de faire son travail avant de
            // reparler de cette période.
            const scheduleKey = recurringScheduleKey(`late:${lease.id}:${period.start}`, Math.abs(daysToDue), [3, 7, 14], 7);
            if (scheduleKey) {
              // "Loyer à valider", pas "Retard de paiement" : sans synchro bancaire,
              // on sait seulement que le bailleur n'a pas confirmé — pas que le
              // locataire n'a pas payé. Accuser à tort serait trompeur (et le ton
              // rouge/urgent avec).
              const isFreePlan = !planAllowsAllLandlordAlerts(userPlan);
              const rentPeriod = isFreePlan ? getLeaseRentPeriod(lease, period.start.slice(0, 7)) : null;
              alerts.push({
                key: scheduleKey,
                preferenceKey: "late_payment",
                tone: "amber",
                title: `Loyer à valider - ${labels.property}`,
                detail: `Le loyer de ${labels.tenant} n'a pas été validé dans lokt pour la période ${period.start} au ${period.end} — échéance dépassée depuis ${Math.abs(daysToDue)} jour(s). Cela ne veut pas dire qu'il n'a pas été payé, juste que ce n'est pas encore confirmé dans l'outil.`,
                href: "/espace-bailleur?tab=quittances",
                propertyId: lease.property_id,
                upsellHtml: isFreePlan ? buildFreePlanLatePaymentUpsell({ propertyLabel: labels.property, tenantName: labels.tenant, rentPeriod }) : undefined,
              });
            }
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
                detail: `Le paiement de ${labels.tenant} est confirmé, mais la quittance ne lui a pas encore été envoyée.`,
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

          if (!hasPreparedEntryEdl && leaseStart) {
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

          if (lease.co_tenant_id && !tenantsById.get(lease.co_tenant_id)?.email) {
            alerts.push({
              key: weeklyScheduleKey(`co-tenant-email:${lease.id}`, today, leaseStart ? daysBetween(leaseStart, today) : null),
              preferenceKey: "co_tenant_email_missing",
              tone: "amber",
              title: `Email co-locataire manquant - ${labels.property}`,
              detail: `Ajoutez un email pour le co-locataire de ${labels.tenant} afin qu'il reçoive ses quittances et puisse être invité à signer le bail.`,
              href: "/espace-bailleur",
              propertyId: lease.property_id,
            });
          }

          // Avenant légalement requis uniquement pour un bail professionnel
          // (hors loi du 6 juillet 1989) : pour un bail d'habitation, la
          // solidarité de la partie qui part cesse automatiquement 6 mois
          // après son congé (art. 8-1 IV), sans avenant pour cette seule
          // promotion — même logique que SectionBaux.tsx et les emails de
          // promote-co-tenant.ts / remove-co-tenant.ts.
          if (lease.co_tenant_promoted_at && lease.lease_kind === "professional") {
            const generatedAt = latestContractGeneratedAtByLease.get(lease.id);
            if (!generatedAt || generatedAt < lease.co_tenant_promoted_at) {
              alerts.push({
                key: weeklyScheduleKey(`avenant-pending:${lease.id}`, today, leaseStart ? daysBetween(leaseStart, today) : null),
                preferenceKey: "avenant_pending",
                tone: "amber",
                title: `Avenant à faire signer - ${labels.property}`,
                detail: `Le bail signé mentionne encore l'ancien locataire suite à une promotion de colocataire — régénère-le et fais-le signer par ${labels.tenant} et le bailleur.`,
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
              detail: "Ajoutez un email de notification pour recevoir les confirmations de paiement en un clic et leurs relances automatiques (les autres notifications continuent d'arriver sur l'email de votre compte).",
              href: "/espace-bailleur",
              propertyId: lease.property_id,
            });
          }

          // Obligation légale (art. 7g loi du 6 juillet 1989) pour une location à
          // usage de résidence principale, nue ou meublée, y compris bail
          // mobilité — pas pour un bail professionnel ou "autre".
          const insuranceEligibleKind = ["furnished_primary", "furnished_student", "mobility", "empty_primary"].includes(
            String(lease.lease_kind || "furnished_primary")
          );
          if (insuranceEligibleKind) {
            const receivedAt = parseISODate(lease.insurance_certificate_received_at);
            const insuranceExpired = !!receivedAt && daysBetween(receivedAt, today) > 365;
            if (!receivedAt || insuranceExpired) {
              alerts.push({
                key: weeklyScheduleKey(`insurance-certificate:${lease.id}`, today, leaseStart ? daysBetween(leaseStart, today) : null),
                preferenceKey: "insurance_certificate_missing",
                tone: "amber",
                title: `Attestation d'assurance ${insuranceExpired ? "à renouveler" : "manquante"} - ${labels.property}`,
                detail: insuranceExpired
                  ? `L'attestation d'assurance habitation de ${labels.tenant} date de plus d'un an — demandez la version à jour.`
                  : `Aucune attestation d'assurance habitation enregistrée pour ${labels.tenant}.`,
                href: "/espace-bailleur?tab=baux",
                propertyId: lease.property_id,
              });
            }
          }

          // DPE obligatoire, annexé au bail — pas de date de référence en base
          // (contrairement à l'assurance) donc on ne détecte que l'absence, pas
          // la péremption à 10 ans.
          const dpeProperty = propertiesById.get(lease.property_id);
          const dpeLot = lease.lot_id ? lotsById.get(lease.lot_id) : null;
          const effectiveEnergyClass = (dpeLot as any)?.energy_class || (dpeProperty as any)?.energy_class || null;
          if (!effectiveEnergyClass) {
            alerts.push({
              key: weeklyScheduleKey(`dpe-missing:${lease.id}`, today, leaseStart ? daysBetween(leaseStart, today) : null),
              preferenceKey: "dpe_missing",
              tone: "amber",
              title: `DPE manquant - ${labels.property}`,
              detail: `Aucune classe énergétique (DPE) renseignée pour ce logement — obligatoire en annexe du bail.`,
              href: "/espace-bailleur?tab=biens",
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
          const leaseStatus = String(lease.status || "").toLowerCase();
          // `end_date` en base reste figé sur la date de fin d'origine : une
          // reconduction tacite ne l'avance jamais (cf. leaseRenewal.ts). Pour
          // un bail actif, recalculer l'échéance réelle du cycle en cours —
          // sinon un bail qui se reconduit tout seul sans action du bailleur
          // se retrouve alerté "expiré" ou "bientôt à échéance" indéfiniment
          // (incident réel constaté : 7 relances hebdo envoyées à tort).
          const watchInfo = leaseStatus === "active" ? computeLeaseWatchInfo(lease, today) : null;
          const renewing = !!watchInfo?.renewalEnabled;
          const effectiveEnd = watchInfo?.watchDate || leaseEnd;
          const daysToEnd = daysBetween(today, effectiveEnd);

          if (!renewing && leaseStatus === "active" && daysToEnd < 0) {
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
          } else if (!renewing && active && [60, 30, 7].includes(daysToEnd)) {
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
            !renewing &&
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
        return { result: { userId, skipped: "no_alerts" } };
      }

      const to = await ownerEmailForUser(userId, userLeaseList);
      if (!to) {
        return { result: { userId, skipped: "no_owner_email", alerts: uniqueAlerts.length } };
      }

      if (dryRun) {
        return { result: { userId, to, dryRun: true, alerts: uniqueAlerts } };
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
        return { result: { userId, to, sent: [], skipped, failed: [] } };
      }

      const mail = await sendEmailViaResend({
        to,
        subject: digestSubject(dueAlerts),
        html: renderDigestEmail(dueAlerts),
      });

      if (!mail.ok) {
        const failed = dueAlerts.map((a) => ({ key: a.key, error: mail.error }));
        return {
          result: { userId, to, sent: [], skipped, failed },
          failure: { email: to, error: `digest (${dueAlerts.length} alerte${dueAlerts.length > 1 ? "s" : ""}) : ${mail.error}` },
        };
      }

      for (const alert of dueAlerts) await markSent(userId, alert);
      return { result: { userId, to, sent: dueAlerts.map((a) => a.key), skipped, failed: [] } };
    }

    const PER_LANDLORD_TIMEOUT_MS = 12000;
    function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
      return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout après ${ms}ms`)), ms)),
      ]);
    }

    for (const [userId, userLeaseList] of userLeases.entries()) {
      const startedAt = Date.now();
      try {
        const { result, failure } = await withTimeout(processOneLandlord(userId, userLeaseList), PER_LANDLORD_TIMEOUT_MS);
        results.push({ ...result, durationMs: Date.now() - startedAt });
        if (failure) allFailures.push(failure);
      } catch (e: any) {
        const message = e?.message || "Erreur ou timeout";
        console.error(`[cron/landlord-alerts] échec pour ${userId} après ${Date.now() - startedAt}ms:`, message);
        results.push({ userId, error: message, durationMs: Date.now() - startedAt });
        allFailures.push({ error: `Traitement du bailleur ${userId} : ${message}` });
      }
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
