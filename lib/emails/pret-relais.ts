// lib/emails/pret-relais.ts
import { emailLayout } from "./layout";

function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatEuro(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function formatPct(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " %";
}

function kpiCard(label: string, value: string, note?: string) {
  return `
  <td width="50%" valign="top" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:12px;">
    <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;margin-bottom:6px;">
      ${escapeHtml(label)}
    </div>
    <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:4px;">
      ${escapeHtml(value)}
    </div>
    ${note ? `<div style="font-size:12px;color:#64748b;line-height:1.4;">${escapeHtml(note)}</div>` : ""}
  </td>
  `;
}

function splitTextIntoBlocks(text: string) {
  const chunks = (text || "")
    .split(/\n\s*\n/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 14);

  return chunks.map((block) => {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const title = lines[0] || "";
    const bodyLines = lines.slice(1);
    return { title, bodyLines };
  });
}

export function buildPretRelaisEmail(params: { email: string; computed: any; subject?: string }) {
  const subject = params.subject || "Votre simulation de prêt relais — lokt.fr";

  const computed = params.computed || {};
  const out = computed.output ?? computed;

  const resume = out?.resume ?? {};
  const bankability = out?.bankability ?? null;

  // Dans ton wizard tu envoies "texteDetail"
  const texteDetail = String(out?.texteDetail ?? out?.texte ?? "");

  const preheader = "Récapitulatif + détails de votre simulation prêt relais (à conserver).";

  const recapTable = `
  <div style="margin:0 0 12px 0;">
    <p style="margin:0 0 6px 0;color:#334155;font-size:13px;line-height:1.5;">
      Récapitulatif de votre simulation prêt relais.
    </p>
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:10px 10px;margin:0 0 10px 0;">
    <tr>
      ${kpiCard("Montant du relais", formatEuro(resume.montantRelais), "Valeur × % − CRD")}
      ${kpiCard("Mensualité max", formatEuro(resume.mensualiteNouveauMax), "Selon endettement cible")}
    </tr>
    <tr>
      ${kpiCard("Capital nouveau prêt", formatEuro(resume.capitalNouveau), "Selon taux / durée")}
      ${kpiCard("Budget max", formatEuro(resume.budgetMax), "Relais + nouveau prêt + apport")}
    </tr>
  </table>

  <p style="margin:0 0 12px 0;color:#64748b;font-size:12px;line-height:1.5;">
    Les montants sont indicatifs et dépendent des conditions bancaires, assurances et frais.
  </p>
  `;

  const scoreBlock = bankability
    ? `
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:14px 0;" />

    <h2 style="margin:0 0 8px 0;font-size:15px;color:#0f172a;">Score Lokt.fr™</h2>

    <div style="border:1px solid #e2e8f0;border-radius:14px;background:#0f172a;padding:12px 14px;margin:0 0 10px 0;">
      <p style="margin:0;color:#e2e8f0;font-size:12px;letter-spacing:.12em;text-transform:uppercase;">
        Évaluation
      </p>
      <p style="margin:6px 0 0 0;color:#ffffff;font-size:16px;font-weight:700;">
        ${escapeHtml(String(bankability.score))}/100 — ${escapeHtml(String(bankability.label))}
      </p>
      <p style="margin:6px 0 0 0;color:#cbd5e1;font-size:13px;line-height:1.5;">
        ${escapeHtml(String(bankability.comment))}
      </p>
      ${
        resume?.tauxEndettementAvecProjet != null
          ? `<p style="margin:8px 0 0 0;color:#cbd5e1;font-size:12px;">
              Endettement projeté : <strong style="color:#fff;">${escapeHtml(formatPct(resume.tauxEndettementAvecProjet))}</strong>
            </p>`
          : ""
      }
    </div>
    `
    : "";

  const detailBlocks = splitTextIntoBlocks(texteDetail);

  const detailsHtml = `
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:14px 0;" />
    <h2 style="margin:0 0 8px 0;font-size:15px;color:#0f172a;">Analyse détaillée</h2>
    <p style="margin:0 0 12px 0;color:#334155;font-size:13px;line-height:1.5;">
      Si vous souhaitez transmettre cette simulation à un conseiller, vous pouvez simplement transférer cet email.
    </p>

    ${detailBlocks
      .map((b) => {
        const body = b.bodyLines.length ? b.bodyLines.map((l) => escapeHtml(l)).join("<br/>") : "";
        return `
        <div style="border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;margin:10px 0;background:#ffffff;">
          <div style="font-weight:700;color:#0f172a;font-size:13px;margin-bottom:6px;">${escapeHtml(b.title)}</div>
          ${body ? `<div style="color:#334155;font-size:13px;line-height:1.55;">${body}</div>` : ""}
        </div>
      `;
      })
      .join("")}
  `;

  const contentHtml = `
    <div style="margin-top:8px;">
      <p style="margin:0 0 10px 0;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#0ea5e9;">
        PRÊT RELAIS
      </p>
      ${recapTable}
      ${scoreBlock}
      ${detailsHtml}

      <hr style="border:none;border-top:1px solid #e2e8f0;margin:14px 0;" />
      <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">
        Cet email a été envoyé automatiquement suite à votre simulation sur lokt.fr.
        Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer ce message.
      </p>
    </div>
  `;

  const html = emailLayout({
    title: "Votre simulation, sauvegardée.",
    preheader,
    contentHtml,
  });

  const text = [
    "Votre simulation de prêt relais — lokt.fr",
    "",
    `Montant du relais : ${formatEuro(resume.montantRelais)}`,
    `Mensualité max : ${formatEuro(resume.mensualiteNouveauMax)}`,
    `Capital nouveau prêt : ${formatEuro(resume.capitalNouveau)}`,
    `Budget max : ${formatEuro(resume.budgetMax)}`,
    bankability ? "" : "",
    bankability ? `Score Lokt.fr : ${bankability.score}/100 — ${bankability.label}` : "",
    bankability?.comment ? bankability.comment : "",
    "",
    "Analyse détaillée :",
    texteDetail,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}
