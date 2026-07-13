import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { hasValidCronSecret } from "../../../lib/cronAuth";
import { sendTelegramMessage } from "../../../lib/telegram";

const WINDOW_MINUTES = 11; // légèrement > intervalle cron (10 min) pour éviter les trous

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!hasValidCronSecret(req)) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ ok: false, error: "Supabase admin non configuré." });

  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
  const messages: string[] = [];

  // ── Nouveaux comptes ──────────────────────────────────────────────────────
  try {
    const { data: { users } = { users: [] } } = await supabaseAdmin.auth.admin.listUsers();
    const newUsers = (users || []).filter((u) => u.created_at && u.created_at >= since);
    for (const u of newUsers) {
      const provider = (u.app_metadata?.provider as string) || "email";
      const confirmed = u.email_confirmed_at ? "✓ confirmé" : "⏳ non confirmé";
      messages.push(`🆕 <b>Nouveau compte</b>\n${u.email || "?"}\n${provider === "google" ? "Google SSO" : "Email lokt"} · ${confirmed}`);
    }
  } catch { /* silencieux */ }

  // ── Nouveaux leads ────────────────────────────────────────────────────────
  try {
    const { data: leads } = await supabaseAdmin
      .from("leads")
      .select("tool,email,city,postal_code,phone,consent_contact,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    for (const l of leads || []) {
      const loc = [l.city, l.postal_code ? `(${l.postal_code})` : ""].filter(Boolean).join(" ") || "?";
      const tel = l.phone ? "📞" : "-";
      const contact = l.consent_contact ? "✓ contactable" : "non contactable";
      messages.push(`📋 <b>Nouveau lead</b>\n${l.tool || "?"} · ${loc}\n${l.email || "anonyme"} · ${tel} · ${contact}`);
    }
  } catch { /* silencieux */ }

  // ── Nouveaux abonnements payants ──────────────────────────────────────────
  try {
    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id,plan,status,billing_interval,updated_at")
      .gte("updated_at", since)
      .eq("status", "active")
      .not("plan", "eq", "calc_full"); // ignorer le plan gratuit

    for (const s of subs || []) {
      const interval = s.billing_interval === "manual" ? "forcé manuel" : s.billing_interval || "?";
      messages.push(`💳 <b>Nouvel abonnement</b>\n${s.plan} · ${interval}`);
    }
  } catch { /* silencieux */ }

  // ── Envoi ─────────────────────────────────────────────────────────────────
  for (const msg of messages) {
    await sendTelegramMessage(msg);
  }

  return res.status(200).json({ ok: true, sent: messages.length, since });
}
