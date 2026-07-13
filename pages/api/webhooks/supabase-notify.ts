import type { NextApiRequest, NextApiResponse } from "next";
import { sendTelegramMessage } from "../../../lib/telegram";

const CRON_SECRET = process.env.CRON_SECRET || "";

function requireSecret(req: NextApiRequest, res: NextApiResponse): boolean {
  const secret = (req.headers["x-webhook-secret"] as string) || "";
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return false;
  }
  return true;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function buildMessage(table: string, record: Record<string, any>, eventType: string): string | null {
  if (table === "users" || table === "auth.users") {
    const email = record.email || "?";
    const provider = record.app_metadata?.provider || "email";
    const confirmed = record.email_confirmed_at ? "✓" : "⏳";
    return `🆕 <b>Nouveau compte</b>\n${email}\nProvider: ${provider}\nConfirmé: ${confirmed}`;
  }

  if (table === "leads") {
    const tool = record.tool || "?";
    const city = record.city || "?";
    const postalCode = record.postal_code || "";
    const email = record.email || "anonyme";
    const hasPhone = record.phone ? "✓" : "-";
    const consentContact = record.consent_contact ? "✓" : "-";
    return `📋 <b>Nouveau lead</b>\n${tool} · ${city} ${postalCode}\n${email}\nTél: ${hasPhone} · Contact: ${consentContact}`;
  }

  if (table === "subscriptions") {
    const isInsert = eventType === "INSERT";
    const isActiveUpdate = eventType === "UPDATE" && record.status === "active";
    if (!isInsert && !isActiveUpdate) return null;
    const plan = record.plan || "?";
    const status = record.status || "?";
    const userId = record.user_id || "?";
    return `💳 <b>Nouveau abonnement</b>\n${plan} · ${status}\n${userId}`;
  }

  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Méthode non autorisée." });
  }

  if (!requireSecret(req, res)) return;

  try {
    const body = req.body || {};
    // Supabase Database Webhooks format
    const table: string = body.table || body.schema_name || "";
    const eventType: string = (body.type || body.event_type || "INSERT").toUpperCase();
    const record: Record<string, any> = body.record || body.new || {};

    const message = buildMessage(table, record, eventType);
    if (message) {
      await sendTelegramMessage(message);
    }

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error("[api/webhooks/supabase-notify]", error);
    return res.status(500).json({ ok: false, error: error?.message || "Erreur serveur." });
  }
}
