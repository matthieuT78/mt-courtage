import { emailLayout } from "./layout";

export function buildCapaciteEmail(computed: any) {
  const r = computed?.resume;
  const a = computed?.assessment;

  const contentHtml = `
  <p style="margin:12px 0 0 0;font-size:14px;color:#334155;">
    Voici le récapitulatif de votre simulation :
  </p>

  <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px;width:100%;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <tr><td style="padding:10px 12px;background:#f8fafc;font-size:12px;color:#64748b;">Mensualité max</td><td style="padding:10px 12px;font-size:13px;font-weight:700;">${fmtEuro(r?.mensualiteMax)}</td></tr>
    <tr><td style="padding:10px 12px;background:#f8fafc;font-size:12px;color:#64748b;">Capital empruntable</td><td style="padding:10px 12px;font-size:13px;font-weight:700;">${fmtEuro(r?.montantMax)}</td></tr>
    <tr><td style="padding:10px 12px;background:#f8fafc;font-size:12px;color:#64748b;">Budget max (avec apport)</td><td style="padding:10px 12px;font-size:13px;font-weight:700;">${fmtEuro(r?.budgetTotalMax)}</td></tr>
    <tr><td style="padding:10px 12px;background:#f8fafc;font-size:12px;color:#64748b;">Endettement après projet</td><td style="padding:10px 12px;font-size:13px;font-weight:700;">${fmtPct(r?.tauxEndettementAvecProjet)}</td></tr>
  </table>

  ${
    a
      ? `<div style="margin-top:16px;padding:12px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">
           <p style="margin:0;font-size:12px;color:#64748b;letter-spacing:.12em;text-transform:uppercase;">Score lokt.fr™</p>
           <p style="margin:6px 0 0 0;font-size:16px;font-weight:800;color:#0f172a;">${a.score}/100 — ${escapeHtml(a.label)}</p>
           <p style="margin:8px 0 0 0;font-size:13px;color:#334155;line-height:1.5;">${escapeHtml(a.comment)}</p>
         </div>`
      : ""
  }
  `;

  return emailLayout({
    title: "Votre rapport de capacité d’emprunt — lokt.fr",
    preheader: "Budget, mensualité, score lokt.fr™ et plan d’action.",
    contentHtml,
  });
}

function fmtEuro(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}
function fmtPct(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " %";
}
function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
