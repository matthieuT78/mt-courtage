import fs from "node:fs";
import path from "node:path";

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.trim().startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/g, "")];
      })
  );
}

function required(env, key) {
  const value = String(env[key] || "").trim();
  if (!value) throw new Error(`${key} manquante dans .env.local.`);
  return value;
}

function readTemplate(name) {
  const directory = path.join(process.cwd(), "supabase", "email-templates");
  const start = fs.readFileSync(path.join(directory, "_base-start.html"), "utf8");
  const content = fs.readFileSync(path.join(directory, `${name}.html`), "utf8");
  const end = fs.readFileSync(path.join(directory, "_base-end.html"), "utf8");
  return `${start}\n${content}\n${end}`.trim();
}

function projectRef(env) {
  const configured = String(env.SUPABASE_PROJECT_REF || "").trim();
  if (configured) return configured;
  const supabaseUrl = String(env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "").trim();
  const match = supabaseUrl.match(/^https:\/\/([^.]+)\.supabase\.co\/?$/i);
  if (!match) throw new Error("SUPABASE_PROJECT_REF manquante et impossible à déduire depuis NEXT_PUBLIC_SUPABASE_URL.");
  return match[1];
}

function senderEmail(env) {
  const configured = String(env.SUPABASE_AUTH_SMTP_ADMIN_EMAIL || "").trim();
  if (configured) return configured;
  const resendFrom = String(env.RESEND_FROM || "").trim();
  const bracketMatch = resendFrom.match(/<([^>]+)>/);
  return String(bracketMatch?.[1] || resendFrom).trim();
}

const env = { ...parseEnvFile(".env.local"), ...process.env };
const ref = projectRef(env);
const apply = process.argv.includes("--apply");
const dryRun = process.argv.includes("--dry-run") || !apply;
const includeSmtp = process.argv.includes("--include-smtp");
const token = apply ? required(env, "SUPABASE_ACCESS_TOKEN") : "";

const payload = {
  site_url: "https://lokt.fr",
  mailer_subjects_confirmation: "Confirmez votre inscription | lokt.fr",
  mailer_templates_confirmation_content: readTemplate("confirmation"),
  mailer_subjects_invite: "Votre espace locataire lokt.fr est prêt",
  mailer_templates_invite_content: readTemplate("invite"),
  mailer_subjects_recovery: "Réinitialisez votre mot de passe | lokt.fr",
  mailer_templates_recovery_content: readTemplate("recovery"),
  mailer_subjects_magic_link: "Votre lien de connexion | lokt.fr",
  mailer_templates_magic_link_content: readTemplate("magic-link"),
  mailer_subjects_email_change: "Confirmez votre nouvelle adresse email | lokt.fr",
  mailer_templates_email_change_content: readTemplate("email-change"),
};

if (includeSmtp) {
  Object.assign(payload, {
    external_email_enabled: true,
    mailer_autoconfirm: false,
    smtp_admin_email: senderEmail(env) || required(env, "SUPABASE_AUTH_SMTP_ADMIN_EMAIL"),
    smtp_host: String(env.SUPABASE_AUTH_SMTP_HOST || "smtp.resend.com"),
    smtp_port: String(env.SUPABASE_AUTH_SMTP_PORT || 465),
    smtp_user: String(env.SUPABASE_AUTH_SMTP_USER || "resend"),
    smtp_pass: String(env.SUPABASE_AUTH_SMTP_PASS || env.RESEND_API_KEY || "") || required(env, "SUPABASE_AUTH_SMTP_PASS"),
    smtp_sender_name: String(env.SUPABASE_AUTH_SMTP_SENDER_NAME || "lokt.fr"),
  });
}

console.log(`${dryRun ? "[dry-run]" : "[apply]"} Supabase Auth ${ref}`);
console.log(`Templates : confirmation, invitation, récupération, magic link, changement d'email`);
console.log(`SMTP personnalisé : ${includeSmtp ? "inclus" : "non modifié"}`);

if (dryRun) process.exit(0);

const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

const body = await response.json().catch(() => null);
if (!response.ok) throw new Error(body?.message || body?.error || `Supabase Management API ${response.status}`);

console.log("Configuration Supabase Auth mise à jour.");
