import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { sendEmailViaResend } from "../../../lib/mailer/resend";
import { hasValidCronSecret } from "../../../lib/cronAuth";
import {
  normalizeLandlordAlertPreferences,
  type LandlordAlertPreferenceKey,
  type LandlordAlertPreferences,
} from "../../../lib/landlordAlertPreferences";

type AlertTone = "red" | "amber" | "slate";

type AlertItem = {
  key: string;
  preferenceKey: LandlordAlertPreferenceKey;
  tone: AlertTone;
  title: string;
  detail: string;
  href: string;
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

function monthRangeFor(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: toISODate(start), end: toISODate(end) };
}

function clampDay(year: number, month0: number, rawDay: any) {
  const last = new Date(year, month0 + 1, 0).getDate();
  const day = Math.max(1, Math.min(31, Number(rawDay || 1) || 1));
  return Math.min(day, last);
}

function dueDateForCurrentPeriod(today: Date, lease: LeaseRow) {
  const paymentType = String(lease.payment_type || "terme_a_echoir").toLowerCase();
  const day = Number(lease.payment_day || 1) || 1;

  if (paymentType === "terme_echu") {
    const prevPeriod = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const dueDay = clampDay(today.getFullYear(), today.getMonth(), day);
    return {
      period: monthRangeFor(prevPeriod),
      dueDate: new Date(today.getFullYear(), today.getMonth(), dueDay),
    };
  }

  const dueDay = clampDay(today.getFullYear(), today.getMonth(), day);
  return {
    period: monthRangeFor(today),
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

async function ownerEmailForUser(userId: string, leases: LeaseRow[]) {
  const leaseEmail = leases.map((l) => String(l.reminder_email || "").trim()).find(Boolean);
  if (leaseEmail) return leaseEmail;

  const userRes = await supabaseAdmin?.auth.admin.getUserById(userId);
  return userRes?.data?.user?.email || null;
}

function renderEmail(alerts: AlertItem[]) {
  const baseUrl = appUrl();
  const rows = alerts
    .map((a) => {
      const color = a.tone === "red" ? "#b91c1c" : a.tone === "amber" ? "#92400e" : "#334155";
      const bg = a.tone === "red" ? "#fef2f2" : a.tone === "amber" ? "#fffbeb" : "#f8fafc";
      return `
        <tr>
          <td style="padding:12px;border:1px solid #e2e8f0;border-radius:12px;background:${bg}">
            <p style="margin:0 0 4px;font-weight:700;color:${color}">${a.title}</p>
            <p style="margin:0 0 10px;color:#334155;font-size:14px;line-height:1.45">${a.detail}</p>
            <a href="${baseUrl}${a.href}" style="font-size:13px;color:#0f172a;font-weight:700">Ouvrir dans lokt.fr</a>
          </td>
        </tr>
        <tr><td style="height:8px"></td></tr>
      `;
    })
    .join("");

  return `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;color:#0f172a">
      <p>Bonjour,</p>
      <p>Voici les alertes importantes détectées dans votre espace bailleur.</p>
      <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0">${rows}</table>
      <p style="margin-top:16px;font-size:12px;color:#64748b">
        Email automatique envoyé une fois par jour maximum. Les alertes disparaissent quand les actions sont traitées.
      </p>
    </div>
  `;
}

async function alreadySentToday(userId: string, digestDate: string) {
  const { data, error } = await supabaseAdmin!
    .from("landlord_alert_sends")
    .select("id")
    .eq("user_id", userId)
    .eq("digest_date", digestDate)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

async function markSent(userId: string, digestDate: string, alertCount: number) {
  const { error } = await supabaseAdmin!.from("landlord_alert_sends").insert({
    user_id: userId,
    digest_date: digestDate,
    alert_count: alertCount,
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
    const digestDate = toISODate(today);
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
      supabaseAdmin.from("properties").select("id,user_id,label,address_line1,status"),
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
      if (!userPreferences.digest_enabled) {
        results.push({ userId, skipped: "digest_disabled" });
        continue;
      }

      if (!force && (await alreadySentToday(userId, digestDate))) {
        results.push({ userId, skipped: "already_sent_today" });
        continue;
      }

      const alerts: AlertItem[] = [];

      for (const lease of userLeaseList) {
        const labels = labelForLease(lease, propertiesById, tenantsById);
        const active = isActiveLease(lease, today);
        const leaseReports = reportsByLease.get(lease.id) || [];
        const hasEntryEdl = leaseReports.some((r) => r.report_type === "entry");
        const exitEdl = leaseReports.find((r) => r.report_type === "exit");
        const leaseEnd = parseISODate(lease.end_date);
        const leaseStart = parseISODate(lease.start_date);

        if (active) {
          const { period, dueDate } = dueDateForCurrentPeriod(today, lease);
          const payment = paymentsByLeasePeriod.get(`${lease.id}:${period.start}:${period.end}`);
          const receipt = receiptsByLeasePeriod.get(`${lease.id}:${period.start}:${period.end}`);
          const paid = !!payment?.paid_at;
          const daysToDue = daysBetween(today, dueDate);

          if (!paid && daysToDue < 0) {
            alerts.push({
              key: `late:${lease.id}:${period.start}`,
              preferenceKey: "late_payment",
              tone: "red",
              title: `Retard de paiement - ${labels.property}`,
              detail: `${labels.tenant} n'est pas marqué payé pour la période ${period.start} au ${period.end}. Échéance dépassée depuis ${Math.abs(daysToDue)} jour(s).`,
              href: "/espace-bailleur",
            });
          } else if (!paid && daysToDue >= 0 && daysToDue <= 3) {
            alerts.push({
              key: `due-soon:${lease.id}:${period.start}`,
              preferenceKey: "due_soon",
              tone: "amber",
              title: `Loyer bientôt exigible - ${labels.property}`,
              detail: `${labels.tenant} doit régler le loyer dans ${daysToDue} jour(s).`,
              href: "/espace-bailleur",
            });
          }

          if (paid && (!receipt?.pdf_url || !receipt?.sent_at)) {
            alerts.push({
              key: `receipt:${lease.id}:${period.start}`,
              preferenceKey: "receipt_to_finalize",
              tone: "amber",
              title: `Quittance à finaliser - ${labels.property}`,
              detail: `Le paiement de ${labels.tenant} est confirmé, mais la quittance n'est pas encore générée et envoyée.`,
              href: "/espace-bailleur",
            });
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
                href: "/guides/revision-loyer-irl",
              });
            }
          }

          if (!lease.tenant_receipt_email && !tenantsById.get(lease.tenant_id)?.email) {
            alerts.push({
              key: `tenant-email:${lease.id}`,
              preferenceKey: "tenant_email_missing",
              tone: "amber",
              title: `Email locataire manquant - ${labels.property}`,
              detail: `Ajoutez un email pour ${labels.tenant} afin d'envoyer les quittances automatiquement.`,
              href: "/espace-bailleur",
            });
          }

          if (!hasEntryEdl && leaseStart && daysBetween(today, leaseStart) <= 7) {
            alerts.push({
              key: `entry-edl:${lease.id}`,
              preferenceKey: "entry_inventory_missing",
              tone: "amber",
              title: `État des lieux d'entrée manquant - ${labels.property}`,
              detail: `Aucun EDL d'entrée n'est rattaché au bail de ${labels.tenant}.`,
              href: "/espace-bailleur",
            });
          }

          if (leaseEnd) {
            const daysToEnd = daysBetween(today, leaseEnd);
            if (daysToEnd < 0) {
              alerts.push({
                key: `expired-active:${lease.id}`,
                preferenceKey: "expired_active_lease",
                tone: "red",
                title: `Bail expiré encore actif - ${labels.property}`,
                detail: `La date de fin du bail de ${labels.tenant} est dépassée. Clôturez le bail ou corrigez la date.`,
                href: "/espace-bailleur",
              });
            } else if ([60, 30, 7].some((d) => daysToEnd <= d && daysToEnd > d - 7)) {
              alerts.push({
                key: `lease-end:${lease.id}:${daysToEnd}`,
                preferenceKey: "lease_end",
                tone: "amber",
                title: `Bail bientôt à échéance - ${labels.property}`,
                detail: `Le bail de ${labels.tenant} arrive à échéance dans ${daysToEnd} jour(s). Préparez renouvellement, congé ou sortie.`,
                href: "/espace-bailleur",
              });
            }

            if (daysToEnd <= 30 && (!exitEdl || !["ready", "signed", "archived"].includes(String(exitEdl.status || "").toLowerCase()))) {
              alerts.push({
                key: `exit-edl:${lease.id}`,
                preferenceKey: "exit_inventory_to_prepare",
                tone: "amber",
                title: `État des lieux de sortie à préparer - ${labels.property}`,
                detail: `Le bail de ${labels.tenant} se termine bientôt ou est terminé. L'EDL de sortie n'est pas finalisé.`,
                href: "/espace-bailleur",
              });
            }
          }

          if (!lease.reminder_email) {
            alerts.push({
              key: `owner-email:${lease.id}`,
              preferenceKey: "owner_email_missing",
              tone: "slate",
              title: `Email bailleur manquant - ${labels.property}`,
              detail: "Ajoutez un email de notification pour recevoir les validations de paiement et alertes automatiques.",
              href: "/espace-bailleur",
            });
          }
        }
      }

      const uniqueAlerts = Array.from(new Map(alerts.filter((alert) => userPreferences[alert.preferenceKey]).map((a) => [a.key, a])).values()).slice(0, 12);
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

      const mail = await sendEmailViaResend({
        to,
        subject: `lokt.fr - ${uniqueAlerts.length} alerte(s) bailleur à traiter`,
        html: renderEmail(uniqueAlerts),
      });

      if (!mail.ok) {
        results.push({ userId, to, sent: false, error: mail.error, alerts: uniqueAlerts.length });
        continue;
      }

      await markSent(userId, digestDate, uniqueAlerts.length);
      results.push({ userId, to, sent: true, alerts: uniqueAlerts.length });
    }

    return res.status(200).json({
      ok: true,
      digestDate,
      dryRun,
      results,
    });
  } catch (e: any) {
    console.error("[cron/landlord-alerts] error:", e);
    return res.status(500).json({ error: e?.message || "Erreur interne" });
  }
}
