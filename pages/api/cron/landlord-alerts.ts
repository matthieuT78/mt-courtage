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

function recurringScheduleKey(prefix: string, daysElapsed: number, firstDays: number[], repeatEveryDays?: number) {
  if (firstDays.includes(daysElapsed)) return `${prefix}:day-${daysElapsed}`;
  const repeatFrom = firstDays[firstDays.length - 1];
  if (repeatEveryDays && daysElapsed > repeatFrom && daysElapsed % repeatEveryDays === 0) {
    return `${prefix}:day-${daysElapsed}`;
  }
  return null;
}

function weeklyScheduleKey(prefix: string, today: Date) {
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
  deposit_not_collected:   "depot_garantie",
  deposit_return_overdue:  "depot_garantie",
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

function renderEmail(alert: AlertItem) {
  const baseUrl = appUrl();
  const color = alert.tone === "red" ? "#b91c1c" : alert.tone === "amber" ? "#92400e" : "#334155";
  const bg = alert.tone === "red" ? "#fef2f2" : alert.tone === "amber" ? "#fffbeb" : "#f8fafc";

  return `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;color:#0f172a">
      <p>Bonjour,</p>
      <p>Une action nécessite votre attention dans votre espace bailleur.</p>
      <div style="padding:12px;border:1px solid #e2e8f0;border-radius:12px;background:${bg}">
        <p style="margin:0 0 4px;font-weight:700;color:${color}">${alert.title}</p>
        <p style="margin:0 0 10px;color:#334155;font-size:14px;line-height:1.45">${alert.detail}</p>
        <a href="${baseUrl}${alert.href}" style="font-size:13px;color:#0f172a;font-weight:700">Traiter cette action sur lokt.fr</a>
      </div>
      <p style="margin-top:16px;font-size:12px;color:#64748b">
        Cet email automatique suit l'échéancier métier de cette alerte. Il disparaît dès que l'action est traitée.
      </p>
    </div>
  `;
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
            const scheduleKey = recurringScheduleKey(`late:${lease.id}:${period.start}`, Math.abs(daysToDue), [3, 7], 7);
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
          } else if (!paid && [3, 1, 0].includes(daysToDue)) {
            alerts.push({
              key: `due-soon:${lease.id}:${period.start}:day-${daysToDue}`,
              preferenceKey: "due_soon",
              tone: "amber",
              title: `Loyer bientôt exigible - ${labels.property}`,
              detail: `${labels.tenant} doit régler le loyer dans ${daysToDue} jour(s).`,
              href: "/espace-bailleur",
              propertyId: lease.property_id,
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
              key: weeklyScheduleKey(`tenant-email:${lease.id}`, today),
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
            const scheduleKey = [7, 1, -1, -7].includes(daysToStart) ? `entry-edl:${lease.id}:day-${daysToStart}` : null;
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
              key: weeklyScheduleKey(`owner-email:${lease.id}`, today),
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
              key: weeklyScheduleKey(`deposit-not-collected:${lease.id}`, today),
              preferenceKey: "deposit_not_collected",
              tone: "amber",
              title: `Caution non encaissee - ${labels.property}`,
              detail: `Le depot de garantie de ${labels.tenant} (${Number(lease.deposit_amount).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}) n'a pas encore ete encaisse.`,
              href: "/espace-bailleur?tab=locataires",
              propertyId: lease.property_id,
            });
          }
        }

        // Caution a restituer : bail termine, caution encaissee mais non restituee depuis >= 30 j
        if (
          !active &&
          lease.deposit_paid_at &&
          !lease.deposit_returned_at &&
          leaseEnd
        ) {
          const daysAfterEnd = daysBetween(leaseEnd, today);
          if (daysAfterEnd >= 30) {
            const scheduleKey = recurringScheduleKey(`deposit-return:${lease.id}`, daysAfterEnd, [30, 60], 30);
            if (scheduleKey) {
              alerts.push({
                key: scheduleKey,
                preferenceKey: "deposit_return_overdue",
                tone: "red",
                title: `Caution non restituee - ${labels.property}`,
                detail: `Le bail de ${labels.tenant} est termine depuis ${daysAfterEnd} jour(s) et le depot de garantie n'a pas encore ete restitue. Delai legal : 1 mois (2 mois si dommages constates).`,
                href: "/espace-bailleur?tab=locataires",
                propertyId: lease.property_id,
              });
            }
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
            const scheduleKey = [30, 7, 1, -1, -7].includes(daysToEnd) ? `exit-edl:${lease.id}:day-${daysToEnd}` : null;
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

      const sent: string[] = [];
      const skipped: string[] = [];
      const failed: { key: string; error: string }[] = [];
      for (const alert of uniqueAlerts) {
        if (!force && (await alreadySent(userId, alert.key))) {
          skipped.push(alert.key);
          continue;
        }
        const mail = await sendEmailViaResend({
          to,
          subject: `lokt.fr - ${alert.title}`,
          html: renderEmail(alert),
        });
        if (!mail.ok) {
          failed.push({ key: alert.key, error: mail.error });
          continue;
        }
        await markSent(userId, alert);
        sent.push(alert.key);
      }
      results.push({ userId, to, sent, skipped, failed });
    }

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
