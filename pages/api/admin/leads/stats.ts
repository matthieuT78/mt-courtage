import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : null;

const PLAN_PRICES: Record<string, { label: string; monthly: number; annual?: number }> = {
  calc_full: { label: "Gratuit", monthly: 0 },
  landlord_5: { label: "Starter", monthly: 4.9, annual: 49 },
  landlord_15: { label: "Essentiel", monthly: 9.9, annual: 99 },
  landlord_unlimited: { label: "Pro / agence", monthly: 0 },
};

function requireAdmin(req: NextApiRequest, res: NextApiResponse) {
  const token = (req.headers["x-admin-token"] as string) || (req.query.token as string) || "";
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return false;
  }
  return true;
}

function dayKey(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function safeDate(value: string | null | undefined) {
  const t = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
}

function countBy<T>(rows: T[], pick: (row: T) => string | null | undefined) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = String(pick(row) || "Non renseigné");
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

function countByDay(rows: Array<{ created_at?: string | null }>, days: number) {
  const map = new Map<string, number>();
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    map.set(d.toISOString().slice(0, 10), 0);
  }

  for (const row of rows) {
    const key = dayKey(row.created_at);
    if (map.has(key)) map.set(key, (map.get(key) || 0) + 1);
  }

  return Array.from(map.entries()).map(([day, count]) => ({ day, count }));
}

function latest<T>(rows: T[], pick: (row: T) => string | null | undefined) {
  return rows.reduce<string | null>((acc, row) => {
    const v = pick(row);
    if (!v) return acc;
    if (!acc || safeDate(v) > safeDate(acc)) return v;
    return acc;
  }, null);
}

function activeSubscription(row: any) {
  const status = String(row?.status || "").toLowerCase();
  const endsAt = row?.ends_at ? new Date(row.ends_at).getTime() : null;
  return (status === "active" || status === "trialing") && (!endsAt || endsAt > Date.now());
}

function estimatedMonthlyRevenue(row: any) {
  if (!activeSubscription(row)) return 0;
  const plan = String(row?.plan || "");
  const price = PLAN_PRICES[plan];
  if (!price) return 0;
  const interval = String(row?.billing_interval || "").toLowerCase();
  if (interval === "year" || interval === "yearly") return (price.annual || price.monthly * 12) / 12;
  return price.monthly;
}

function asNumber(value: any): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const cleaned = value.replace(/\s/g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pickNumber(source: any, paths: string[]) {
  for (const path of paths) {
    const value = path.split(".").reduce<any>((acc, key) => (acc == null ? undefined : acc[key]), source);
    const n = asNumber(value);
    if (n != null) return n;
  }
  return null;
}

function percentile(values: number[], p: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[idx];
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rangeLabel(value: number | null, ranges: Array<[number, string]>, fallback = "Non renseigné") {
  if (value == null) return fallback;
  for (const [limit, label] of ranges) {
    if (value < limit) return label;
  }
  return ranges[ranges.length - 1]?.[1] || fallback;
}

function extractLeadMetrics(lead: any) {
  const payload = lead?.payload || {};
  const budget = asNumber(lead?.project_budget_target) ?? pickNumber(payload, [
    "input.project_budget_target",
    "input.prixCible",
    "inputs.prixBien",
    "input.salePrice",
    "input.valeurBienActuel",
    "output.resume.budgetMax",
    "output.resume.budget_max",
    "output.resume.cashNetSeller",
  ]);
  const propertyValue = pickNumber(payload, [
    "input.prixBien",
    "inputs.prixBien",
    "input.valeurBienActuel",
    "input.salePrice",
    "output.resume.valeurBien",
  ]);
  const loan = pickNumber(payload, [
    "input.prixCible",
    "input.crdActuel",
    "input.loan.principal",
    "input.loan.crdKnown",
    "input.crdKnown",
    "input.montantPret",
    "output.resume.capitalRestantDu",
  ]);
  const contribution = pickNumber(payload, [
    "input.apportPersonnel",
    "input.apportPerso",
    "inputs.apport",
    "input.apport",
    "input.apportPersonnel",
  ]);
  const rent = pickNumber(payload, ["inputs.loyerMensuel", "input.loyerMensuel", "output.resume.loyerMensuel"]);
  const cashflow = pickNumber(payload, ["output.resume.cashFlowMensuel", "output.resume.cashflowMensuel", "output.resume.cashFlow", "output.resume.cashflow"]);
  const grossYield = pickNumber(payload, ["output.resume.rendementBrut", "output.resume.rendement_brut", "output.resume.grossYield"]);
  const netYield = pickNumber(payload, ["output.resume.rendementNet", "output.resume.rendement_net", "output.resume.netYield"]);
  const bankability = pickNumber(payload, ["output.bankability.score", "output.resume.score", "output.opportunity.score"]);

  let score = 0;
  const reasons: string[] = [];
  const projectAmount = budget ?? propertyValue;
  if (projectAmount != null) {
    if (projectAmount >= 500000) {
      score += 35;
      reasons.push("projet élevé");
    } else if (projectAmount >= 250000) {
      score += 25;
      reasons.push("projet solide");
    } else if (projectAmount >= 120000) {
      score += 15;
      reasons.push("projet exploitable");
    }
  }
  if (contribution != null) {
    if (contribution >= 80000) {
      score += 25;
      reasons.push("apport fort");
    } else if (contribution >= 30000) {
      score += 18;
      reasons.push("apport correct");
    } else if (contribution >= 10000) {
      score += 8;
      reasons.push("apport présent");
    }
  }
  if (lead?.phone) {
    score += 12;
    reasons.push("téléphone");
  }
  if (lead?.consent_contact) {
    score += 10;
    reasons.push("contact autorisé");
  }
  if (bankability != null) {
    score += Math.min(15, Math.max(0, bankability / 7));
    reasons.push("score projet");
  }
  if (cashflow != null && cashflow >= 0) {
    score += 8;
    reasons.push("cash-flow positif");
  }
  if ((netYield ?? grossYield ?? 0) >= 6) {
    score += 7;
    reasons.push("rendement intéressant");
  }

  const cappedScore = Math.round(Math.min(100, score));
  const tier = cappedScore >= 70 ? "Chaud" : cappedScore >= 45 ? "À travailler" : "Froid";

  return {
    id: lead?.id,
    tool: lead?.tool || "Non renseigné",
    city: lead?.city || null,
    postal_code: lead?.postal_code || null,
    created_at: lead?.created_at || null,
    hasPhone: !!lead?.phone,
    consentContact: !!lead?.consent_contact,
    budget,
    propertyValue,
    loan,
    contribution,
    rent,
    cashflow,
    grossYield,
    netYield,
    bankability,
    score: cappedScore,
    tier,
    reasons,
  };
}

function buildLeadQuality(leads: any[]) {
  const rows = leads.map(extractLeadMetrics);
  const withBudget = rows.filter((row) => row.budget != null).map((row) => row.budget as number);
  const withContribution = rows.filter((row) => row.contribution != null).map((row) => row.contribution as number);
  const withLoan = rows.filter((row) => row.loan != null).map((row) => row.loan as number);
  const top = rows
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((row) => ({
      id: row.id,
      tool: row.tool,
      city: row.city,
      postal_code: row.postal_code,
      created_at: row.created_at,
      score: row.score,
      tier: row.tier,
      budget: row.budget,
      propertyValue: row.propertyValue,
      loan: row.loan,
      contribution: row.contribution,
      cashflow: row.cashflow,
      netYield: row.netYield,
      hasPhone: row.hasPhone,
      consentContact: row.consentContact,
      reasons: row.reasons.slice(0, 4),
    }));

  return {
    scored: rows.filter((row) => row.score > 0).length,
    hot: rows.filter((row) => row.tier === "Chaud").length,
    warm: rows.filter((row) => row.tier === "À travailler").length,
    cold: rows.filter((row) => row.tier === "Froid").length,
    avgScore: average(rows.map((row) => row.score).filter((value) => value > 0)) || 0,
    avgBudget: average(withBudget),
    medianBudget: percentile(withBudget, 0.5),
    p90Budget: percentile(withBudget, 0.9),
    avgContribution: average(withContribution),
    avgLoan: average(withLoan),
    byBudgetRange: countBy(rows, (row) =>
      rangeLabel(row.budget ?? row.propertyValue, [
        [150000, "< 150 k€"],
        [250000, "150–250 k€"],
        [400000, "250–400 k€"],
        [650000, "400–650 k€"],
        [Number.POSITIVE_INFINITY, "650 k€+"],
      ])
    ).map(({ key, count }) => ({ range: key, count })),
    byTier: countBy(rows, (row) => row.tier).map(({ key, count }) => ({ tier: key, count })),
    byTool: countBy(rows, (row) => row.tool).map(({ key, count }) => ({ tool: key, count })),
    top,
  };
}

async function fetchAllUsers() {
  if (!supabaseAdmin) return [];
  const users: any[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...(data.users || []));
    if (!data.users?.length || data.users.length < 1000) break;
  }
  return users;
}

async function selectTable(table: string, columns = "*") {
  if (!supabaseAdmin) return { data: [], error: "Supabase admin non configuré." };
  const { data, error } = await supabaseAdmin.from(table).select(columns);
  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  if (!requireAdmin(req, res)) return;
  if (!supabaseAdmin) return res.status(500).json({ ok: false, error: "Supabase admin non configuré." });

  try {
    const days = Math.min(Math.max(parseInt((req.query.days as string) || "30", 10), 1), 365);
    const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [
      usersSettled,
      leadsRes,
      subscriptionsRes,
      profilesRes,
      propertiesRes,
      leasesRes,
      tenantsRes,
      receiptsRes,
    ] = await Promise.all([
      fetchAllUsers().then((data) => ({ data, error: null })).catch((e) => ({ data: [], error: e?.message || "Erreur auth users" })),
      selectTable("leads", "id,created_at,tool,user_id,email,phone,postal_code,city,consent_analysis,consent_contact,status,project_budget_target,payload"),
      selectTable("subscriptions", "user_id,plan,status,ends_at,billing_interval,stripe_customer_id,stripe_subscription_id,stripe_price_id,cancel_at_period_end,updated_at"),
      selectTable("profiles", "*"),
      selectTable("properties", "id,user_id,status,created_at"),
      selectTable("leases", "id,user_id,status,created_at,start_date,end_date,property_id,tenant_id"),
      selectTable("tenants", "id,user_id,email,archived_at,created_at"),
      selectTable("rent_receipts", "id,lease_id,status,created_at,period_start,period_end,total_amount,pdf_url,sent_at,send_error"),
    ]);

    const users = usersSettled.data as any[];
    const leads = leadsRes.data as any[];
    const subscriptions = subscriptionsRes.data as any[];
    const profiles = profilesRes.data as any[];
    const properties = propertiesRes.data as any[];
    const leases = leasesRes.data as any[];
    const tenants = tenantsRes.data as any[];
    const receipts = receiptsRes.data as any[];

    const recentLeads = leads.filter((lead) => safeDate(lead.created_at) >= safeDate(since));
    const recentUsers = users.filter((user) => safeDate(user.created_at) >= safeDate(since));
    const recentProperties = properties.filter((property) => safeDate(property.created_at) >= safeDate(since));
    const recentReceipts = receipts.filter((receipt) => safeDate(receipt.created_at) >= safeDate(since));
    const monthReceipts = receipts.filter((receipt) => safeDate(receipt.created_at) >= monthStart.getTime());

    const uniqueLeadEmails = new Set(leads.map((lead) => String(lead.email || "").toLowerCase()).filter(Boolean));
    const usersWithEmail = users.filter((user) => user.email);
    const confirmedUsers = users.filter((user) => user.email_confirmed_at || user.confirmed_at);
    const activePaidSubscriptions = subscriptions.filter((row) => activeSubscription(row) && String(row.plan || "").startsWith("landlord_"));
    const activeSubscriptions = subscriptions.filter(activeSubscription);
    const paidUserIds = new Set(activePaidSubscriptions.map((row) => row.user_id).filter(Boolean));
    const landlordUserIds = new Set([...properties.map((row) => row.user_id), ...leases.map((row) => row.user_id)].filter(Boolean));
    const freeLandlordUsers = Math.max(0, landlordUserIds.size - paidUserIds.size);

    let consentAnalysisYes = 0;
    let consentContactYes = 0;
    let leadsWithPhone = 0;
    let leadsWithUser = 0;
    for (const lead of leads) {
      if (lead.consent_analysis) consentAnalysisYes++;
      if (lead.consent_contact) consentContactYes++;
      if (lead.phone) leadsWithPhone++;
      if (lead.user_id) leadsWithUser++;
    }

    const byTool = countBy(leads, (lead) => lead.tool).map(({ key, count }) => ({ tool: key, count }));
    const byStatus = countBy(leads, (lead) => lead.status).map(({ key, count }) => ({ status: key, count }));
    const byPlan = countBy(subscriptions, (row) => row.plan).map(({ key, count }) => ({ plan: key, label: PLAN_PRICES[key]?.label || key, count }));
    const bySubscriptionStatus = countBy(subscriptions, (row) => row.status).map(({ key, count }) => ({ status: key, count }));
    const byPropertyStatus = countBy(properties, (row) => row.status).map(({ key, count }) => ({ status: key, count }));
    const byLeaseStatus = countBy(leases, (row) => row.status).map(({ key, count }) => ({ status: key, count }));
    const byReceiptStatus = countBy(receipts, (row) => row.status).map(({ key, count }) => ({ status: key, count }));

    const mrr = subscriptions.reduce((sum, row) => sum + estimatedMonthlyRevenue(row), 0);
    const activeProperties = properties.filter((row) => String(row.status || "").toLowerCase() !== "archived").length;
    const archivedProperties = properties.length - activeProperties;
    const activeLeases = leases.filter((row) => String(row.status || "").toLowerCase() === "active").length;
    const archivedTenants = tenants.filter((row) => row.archived_at).length;
    const sentReceipts = receipts.filter((row) => row.sent_at).length;
    const pdfReceipts = receipts.filter((row) => row.pdf_url).length;
    const failedReceipts = receipts.filter((row) => row.send_error).length;
    const receiptAmount = receipts.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
    const monthReceiptAmount = monthReceipts.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
    const leadQuality = buildLeadQuality(leads);

    return res.status(200).json({
      ok: true,
      generated_at: new Date().toISOString(),
      window_days: days,
      dataWarnings: [
        usersSettled.error ? `auth.users: ${usersSettled.error}` : null,
        leadsRes.error ? `leads: ${leadsRes.error}` : null,
        subscriptionsRes.error ? `subscriptions: ${subscriptionsRes.error}` : null,
        profilesRes.error ? `profiles: ${profilesRes.error}` : null,
        propertiesRes.error ? `properties: ${propertiesRes.error}` : null,
        leasesRes.error ? `leases: ${leasesRes.error}` : null,
        tenantsRes.error ? `tenants: ${tenantsRes.error}` : null,
        receiptsRes.error ? `rent_receipts: ${receiptsRes.error}` : null,
      ].filter(Boolean),
      total: leads.length,
      byTool,
      byStatus,
      consents: {
        consent_analysis_yes: consentAnalysisYes,
        consent_contact_yes: consentContactYes,
        consent_analysis_rate: leads.length ? consentAnalysisYes / leads.length : 0,
        consent_contact_rate: leads.length ? consentContactYes / leads.length : 0,
      },
      byDay: countByDay(recentLeads, days),
      leads: {
        total: leads.length,
        windowTotal: recentLeads.length,
        avgPerDay: days ? recentLeads.length / days : 0,
        withPhone: leadsWithPhone,
        withPhoneRate: leads.length ? leadsWithPhone / leads.length : 0,
        linkedToAccount: leadsWithUser,
        linkedToAccountRate: leads.length ? leadsWithUser / leads.length : 0,
        uniqueEmails: uniqueLeadEmails.size,
        latestLeadAt: latest(leads, (lead) => lead.created_at),
        hottestTool: byTool[0] || null,
      },
      leadQuality,
      users: {
        total: users.length,
        withEmail: usersWithEmail.length,
        confirmed: confirmedUsers.length,
        confirmedRate: users.length ? confirmedUsers.length / users.length : 0,
        windowTotal: recentUsers.length,
        latestUserAt: latest(users, (user) => user.created_at),
        profiles: profiles.length,
        profileCompletionRate: users.length ? profiles.length / users.length : 0,
      },
      subscriptions: {
        total: subscriptions.length,
        active: activeSubscriptions.length,
        activePaid: activePaidSubscriptions.length,
        freeLandlordUsers,
        paidConversionRate: users.length ? activePaidSubscriptions.length / users.length : 0,
        mrr,
        arr: mrr * 12,
        arpu: activePaidSubscriptions.length ? mrr / activePaidSubscriptions.length : 0,
        byPlan,
        byStatus: bySubscriptionStatus,
        cancelAtPeriodEnd: subscriptions.filter((row) => row.cancel_at_period_end).length,
      },
      landlord: {
        landlordUsers: landlordUserIds.size,
        properties: {
          total: properties.length,
          active: activeProperties,
          archived: archivedProperties,
          windowTotal: recentProperties.length,
          byStatus: byPropertyStatus,
        },
        leases: {
          total: leases.length,
          active: activeLeases,
          byStatus: byLeaseStatus,
        },
        tenants: {
          total: tenants.length,
          archived: archivedTenants,
          active: tenants.length - archivedTenants,
        },
        receipts: {
          total: receipts.length,
          windowTotal: recentReceipts.length,
          monthTotal: monthReceipts.length,
          sent: sentReceipts,
          pdfReady: pdfReceipts,
          failed: failedReceipts,
          totalAmount: receiptAmount,
          monthAmount: monthReceiptAmount,
          byStatus: byReceiptStatus,
        },
      },
      conversion: {
        leadEmailToAccountRate: uniqueLeadEmails.size ? usersWithEmail.length / uniqueLeadEmails.size : 0,
        accountToLandlordRate: users.length ? landlordUserIds.size / users.length : 0,
        accountToPaidRate: users.length ? activePaidSubscriptions.length / users.length : 0,
        landlordToPaidRate: landlordUserIds.size ? activePaidSubscriptions.length / landlordUserIds.size : 0,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
