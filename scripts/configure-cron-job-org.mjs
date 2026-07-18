import fs from "node:fs";

const API_URL = "https://api.cron-job.org/jobs";

function parseEnvFile(path) {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.trim().startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
        return [line.slice(0, index).trim(), value];
      })
  );
}

const env = { ...parseEnvFile(".env.local"), ...process.env };
const apiKey = env.CRON_JOB_ORG_API_KEY || env.EASYCRON_API_KEY;
const cronSecret = env.CRON_SECRET;
const configuredSiteUrl = String(env.CRON_TARGET_BASE_URL || env.APP_URL || env.NEXT_PUBLIC_SITE_URL || "");
const siteUrl = (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configuredSiteUrl) ? "https://lokt.fr" : configuredSiteUrl || "https://lokt.fr").replace(/\/$/, "");
const dryRun = process.argv.includes("--dry-run");
const enableJobs = process.argv.includes("--enable");

if (!apiKey) throw new Error("CRON_JOB_ORG_API_KEY manquante dans .env.local.");
if (!cronSecret) throw new Error("CRON_SECRET manquante dans .env.local.");

const jobs = [
  {
    title: "lokt - validation mensuelle des loyers",
    url: `${siteUrl}/api/cron/rent-reminders`,
    hours: [9],
    minutes: [0],
  },
  {
    title: "lokt - contrôle des alertes bailleur",
    legacyTitles: ["lokt - alertes bailleur quotidiennes"],
    url: `${siteUrl}/api/cron/landlord-alerts`,
    hours: [9],
    minutes: [30],
  },
  {
    title: "lokt - relance validation loyer J+1",
    url: `${siteUrl}/api/cron/rent-followups`,
    hours: [9],
    minutes: [15],
  },
  {
    title: "lokt - relance amiable locataire J+3",
    url: `${siteUrl}/api/cron/tenant-payment-reminders`,
    hours: [9],
    minutes: [20],
  },
  {
    title: "lokt - alertes Telegram (nouveaux comptes, leads, abonnements)",
    url: `${siteUrl}/api/cron/telegram-alerts`,
    hours: [-1],
    minutes: [0, 10, 20, 30, 40, 50],
  },
  {
    title: "lokt - relance validation email inscription J+1",
    url: `${siteUrl}/api/cron/signup-confirmation-reminder`,
    hours: [9],
    minutes: [25],
  },
];

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${options.method || "GET"} ${url}: ${body?.message || response.statusText}`);
  return body;
}

function payloadFor(job) {
  return {
    job: {
      enabled: enableJobs,
      title: job.title,
      url: job.url,
      saveResponses: false,
      auth: {
        enable: true,
        user: "lokt-cron",
        password: cronSecret,
      },
      notification: {
        onFailure: true,
        onFailureCount: 1,
        onSuccess: true,
        onDisable: true,
      },
      schedule: {
        timezone: "Europe/Paris",
        expiresAt: 0,
        hours: job.hours,
        mdays: [-1],
        minutes: job.minutes,
        months: [-1],
        wdays: [-1],
      },
      requestMethod: 0,
    },
  };
}

const existing = await request(API_URL);
const existingByTitle = new Map((existing.jobs || []).map((job) => [job.title, job]));

for (const job of jobs) {
  const current = existingByTitle.get(job.title) || job.legacyTitles?.map((title) => existingByTitle.get(title)).find(Boolean);
  const action = current ? "update" : "create";
  if (dryRun) {
    console.log(`[dry-run] ${action} ${job.title} -> ${job.url} (${job.hours[0]}:${String(job.minutes[0]).padStart(2, "0")}, Europe/Paris, ${enableJobs ? "actif" : "inactif"})`);
    continue;
  }

  if (current) {
    await request(`${API_URL}/${current.jobId}`, { method: "PATCH", body: JSON.stringify(payloadFor(job)) });
  } else {
    await request(API_URL, { method: "PUT", body: JSON.stringify(payloadFor(job)) });
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }
  console.log(`${action === "create" ? "Created" : "Updated"}: ${job.title}`);
}

console.log(dryRun ? "cron-job.org dry-run terminé." : "cron-job.org synchronisé.");
