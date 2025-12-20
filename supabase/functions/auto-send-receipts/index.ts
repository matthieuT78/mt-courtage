// supabase/functions/auto-send-receipts/index.ts
// Deno / Supabase Edge Function

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type PaymentMode = "virement" | "prelevement" | "cheque" | "especes";

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function toMonthISO(d: Date) {
  return d.toISOString().slice(0, 7); // YYYY-MM
}

function getMonthPeriodFromYYYYMM(yyyymm: string) {
  const [yStr, mStr] = yyyymm.split("-");
  const y = Number(yStr);
  const m = Number(mStr) - 1;
  const start = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  // end: last day of month
  const end = new Date(Date.UTC(y, m + 1, 0, 0, 0, 0));
  return { start, end };
}

function formatEuro(val: number) {
  return Number(val || 0).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateFR(val?: string | null) {
  if (!val) return "";
  const d = new Date(val + "T00:00:00");
  if (Number.isNaN(d.getTime())) return val;
  return d.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "2-digit" });
}

// Renvoie {year, month, day, hour} dans un timezone IANA (Europe/Paris)
function getLocalParts(timezone: string, now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });

  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
  };
}

function buildLandlordAddress(l: any | null) {
  if (!l) return "";
  const parts = [
    l.address_line1 ?? l.address ?? null,
    l.address_line2 ?? null,
    [l.postal_code, l.city].filter(Boolean).join(" "),
    l.country ?? null,
  ].filter(Boolean).join("\n");
  return parts.trim();
}

function buildPropertyAddress(p: any | null) {
  if (!p) return "";
  const parts = [
    p.address_line1 ?? null,
    p.address_line2 ?? null,
    [p.postal_code, p.city].filter(Boolean).join(" "),
    p.country ?? null,
  ].filter(Boolean).join("\n");
  return parts.trim();
}

function generateQuittanceText(params: {
  bailleurNom: string;
  bailleurAdresse?: string | null;
  locataireNom: string;
  bienAdresse?: string | null;
  loyerHC: number;
  charges: number;
  periodeDebut: string;
  periodeFin: string;
  villeQuittance?: string | null;
  dateQuittance?: string | null;
  modePaiement: PaymentMode;
  mentionSolde: boolean;
}) {
  const {
    bailleurNom,
    bailleurAdresse,
    locataireNom,
    bienAdresse,
    loyerHC,
    charges,
    periodeDebut,
    periodeFin,
    villeQuittance,
    dateQuittance,
    modePaiement,
    mentionSolde,
  } = params;

  const total = (loyerHC || 0) + (charges || 0);
  const periodeStr =
    periodeDebut && periodeFin
      ? `pour la période du ${formatDateFR(periodeDebut)} au ${formatDateFR(periodeFin)}`
      : "";

  const villeDateStr =
    villeQuittance && dateQuittance ? `${villeQuittance}, le ${formatDateFR(dateQuittance)}` : "";

  const modePaiementLabel =
    modePaiement === "virement"
      ? "par virement bancaire"
      : modePaiement === "cheque"
      ? "par chèque"
      : modePaiement === "especes"
      ? "en espèces"
      : "par prélèvement";

  const lignes: string[] = [];

  lignes.push(bailleurNom || "Nom du bailleur");
  if (bailleurAdresse) lignes.push(bailleurAdresse);
  lignes.push("");

  lignes.push(`À l'attention de : ${locataireNom || "Locataire"}`);
  lignes.push("");

  lignes.push("QUITTANCE DE LOYER");
  lignes.push("".padEnd(22, "="));
  lignes.push("");

  lignes.push(
    `Je soussigné(e) ${bailleurNom || "[Nom du bailleur]"}, propriétaire du logement situé ${
      bienAdresse || "[Adresse du logement]"
    }, certifie avoir reçu de la part de ${locataireNom || "[Nom du locataire]"} la somme de ${formatEuro(total)} ` +
      `(${formatEuro(loyerHC)} de loyer hors charges et ${formatEuro(charges)} de provisions sur charges) ` +
      `${periodeStr ? periodeStr : ""}, ${modePaiementLabel}.`
  );

  lignes.push("");

  if (mentionSolde) {
    lignes.push(
      "La présente quittance vaut reçu pour toutes sommes versées à ce jour au titre des loyers et charges pour la période indiquée et éteint, à ce titre, toute dette de locataire envers le bailleur pour ladite période."
    );
    lignes.push("");
  }

  lignes.push(
    "La présente quittance ne préjuge en rien du paiement des loyers et charges antérieurs ou ultérieurs non quittancés."
  );
  lignes.push("");

  if (villeDateStr) {
    lignes.push(villeDateStr);
    lignes.push("");
  }

  lignes.push("Signature du bailleur :");
  lignes.push("");
  lignes.push("____________________________________");

  return lignes.join("\n");
}

async function sendEmailResend(args: {
  apiKey: string;
  from: string;
  to: string;
  bcc?: string | null;
  subject: string;
  text: string;
}) {
  const { apiKey, from, to, bcc, subject, text } = args;

  const payload: any = {
    from,
    to,
    subject,
    text,
  };
  if (bcc) payload.bcc = bcc;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    throw new Error(`Resend error ${res.status}: ${raw || res.statusText}`);
  }

  return await res.json().catch(() => ({}));
}

Deno.serve(async () => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
  const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "ImmoPilot <no-reply@immopilot.fr>";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing secrets (SUPABASE_URL/SERVICE_ROLE/RESEND_API_KEY)" }),
      { status: 500 }
    );
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const now = new Date();

  // On prend les baux avec auto_send_enabled
  const { data: leases, error: lErr } = await admin
    .from("leases")
    .select("*")
    .eq("auto_send_enabled", true);

  if (lErr) {
    return new Response(JSON.stringify({ ok: false, error: lErr.message }), { status: 500 });
  }

  const results: any[] = [];

  for (const lease of leases || []) {
    try {
      const tz = lease.auto_send_timezone || lease.timezone || "Europe/Paris";
      const parts = getLocalParts(tz, now);

      const targetDay = Number(lease.auto_send_day ?? 1);
      const targetHour = Number(lease.auto_send_hour ?? 9);

      if (parts.day !== targetDay || parts.hour !== targetHour) {
        continue; // pas le bon créneau
      }

      // période = mois courant (YYYY-MM) dans le timezone (approche simple)
      const y = parts.year;
      const m = String(parts.month).padStart(2, "0");
      const periodKey = `${y}-${m}`;

      // anti-doublon au niveau bail
      if (lease.last_auto_sent_period === periodKey) {
        continue;
      }

      const { start, end } = getMonthPeriodFromYYYYMM(periodKey);
      const period_start = toISODate(start);
      const period_end = toISODate(end);

      // sécurité: anti-doublon DB
      const { data: existing } = await admin
        .from("rent_receipts")
        .select("id")
        .eq("lease_id", lease.id)
        .eq("period_start", period_start)
        .eq("period_end", period_end)
        .maybeSingle();

      if (existing?.id) {
        // on marque quand même le bail pour éviter de spammer
        await admin.from("leases").update({ last_auto_sent_period: periodKey }).eq("id", lease.id);
        continue;
      }

      // Charger landlord + property + tenant pour texte + email
      const [{ data: landlord }, { data: prop }, { data: tenant }] = await Promise.all([
        admin.from("landlords").select("*").eq("user_id", lease.user_id).maybeSingle(),
        admin.from("properties").select("*").eq("id", lease.property_id).maybeSingle(),
        admin.from("tenants").select("*").eq("id", lease.tenant_id).maybeSingle(),
      ]);

      const bailleurNom = landlord?.display_name || "Bailleur";
      const bailleurAdresse = buildLandlordAddress(landlord || null);
      const locataireNom = (tenant?.full_name || "Locataire").trim();
      const bienAdresse = buildPropertyAddress(prop || null);

      const rentNum = Number(lease.rent_amount || 0);
      const chargesNum = Number(lease.charges_amount || 0);
      const total = rentNum + chargesNum;

      const issuePlace = landlord?.default_issue_place || prop?.city || null;
      const issueDate = toISODate(now);

      const pm = ((lease.payment_method || landlord?.default_payment_method || "virement") as PaymentMode);

      const content_text = generateQuittanceText({
        bailleurNom,
        bailleurAdresse,
        locataireNom,
        bienAdresse,
        loyerHC: rentNum,
        charges: chargesNum,
        periodeDebut: period_start,
        periodeFin: period_end,
        villeQuittance: issuePlace,
        dateQuittance: issueDate,
        modePaiement: pm,
        mentionSolde: true,
      });

      const sentTo = lease.tenant_receipt_email || tenant?.email || null;
      if (!sentTo) throw new Error("Email locataire manquant (tenant_receipt_email / tenant.email).");

      const bcc = landlord?.bcc_email || null;

      // 1) Créer la quittance en DB (status=generated)
      const { data: created, error: cErr } = await admin
        .from("rent_receipts")
        .insert({
          lease_id: lease.id,
          payment_id: null,
          period_start,
          period_end,
          rent_amount: rentNum,
          charges_amount: chargesNum,
          total_amount: total,
          issue_date: issueDate,
          issue_place: issuePlace,
          issued_at: now.toISOString(),
          content_text,
          pdf_url: null,
          sent_to_tenant_email: sentTo,
          sent_to_bcc_email: bcc,
          sent_at: null,
          status: "generated",
          archived_at: null,
          send_error: null,
        })
        .select()
        .single();

      if (cErr) throw cErr;

      // 2) Envoyer email via Resend
      const subject = `Quittance de loyer — ${period_start} → ${period_end}`;
      await sendEmailResend({
        apiKey: RESEND_API_KEY,
        from: FROM_EMAIL,
        to: sentTo,
        bcc,
        subject,
        text: content_text,
      });

      // 3) Marquer quittance envoyée => archivée
      await admin
        .from("rent_receipts")
        .update({
          sent_at: now.toISOString(),
          status: "archived",
          archived_at: now.toISOString(),
        })
        .eq("id", created.id);

      // 4) Marquer le bail pour éviter re-envoi
      await admin
        .from("leases")
        .update({ last_auto_sent_period: periodKey })
        .eq("id", lease.id);

      results.push({ lease_id: lease.id, period: periodKey, ok: true });
    } catch (e: any) {
      // On log un échec “soft” (et optionnellement on crée une quittance failed)
      results.push({ lease_id: lease?.id, ok: false, error: e?.message || String(e) });
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});
