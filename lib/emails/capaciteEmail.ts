// lib/emails/capaciteEmail.ts
type ComputeAllResult = {
  resume: {
    mensualiteMax: number;
    montantMax: number;
    mensualiteProjet?: number;
    assuranceMensuelle?: number;
    budgetTotalMax: number;
    tauxEndettementAvecProjet: number;
  };
  assessment?: {
    score: number;
    label: string;
    comment: string;
  } | null;
  actionPlan?: string;
};

function formatEuro(val: number) {
  if (!Number.isFinite(val)) return "-";
  return val.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function formatPct(val: number) {
  if (!Number.isFinite(val)) return "-";
  return (
    val.toLocaleString("fr-FR", {
      maximumFractionDigits: 2,
    }) + " %"
  );
}

function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildCapaciteEmailText(computed: ComputeAllResult) {
  const r = computed.resume;
  const b = computed.assessment;

  const parts: string[] = [];
  parts.push("VOTRE RAPPORT DE CAPACITE D’EMPRUNT — lokt.fr");
  parts.push("");
  parts.push("Bonjour,");
  parts.push("Voici votre rapport personnalisé : chiffres clés, score lokt.fr et plan d’action pour mieux préparer votre dossier.");
  parts.push("");
  parts.push("Récapitulatif :");
  parts.push(`- Mensualité max : ${formatEuro(r.mensualiteMax)}`);
  parts.push(`- Capital empruntable : ${formatEuro(r.montantMax)}`);
  if (typeof r.mensualiteProjet === "number") {
    parts.push(`- Mensualité projet assurance incluse : ${formatEuro(r.mensualiteProjet)}`);
  }
  parts.push(`- Budget max (avec apport) : ${formatEuro(r.budgetTotalMax)}`);
  parts.push(`- Endettement après projet : ${formatPct(r.tauxEndettementAvecProjet)}`);
  parts.push("");

  if (b) {
    parts.push(`Score lokt.fr : ${b.score}/100 — ${b.label}`);
    parts.push(b.comment);
    parts.push("");
  }

  if (computed.actionPlan) {
    parts.push("Plan d’action :");
    const blocks = computed.actionPlan
      .split("\n\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 10);

    for (const block of blocks) {
      parts.push(block.replace(/^###\s*/gm, "").replace(/\n/g, " "));
      parts.push("");
    }
  }

  parts.push("Relire / refaire la simulation : https://lokt.fr/capacite");
  parts.push("");
  parts.push("Calculs indicatifs. Ne constitue pas une offre de prêt.");
  parts.push("Vos données servent uniquement à vous transmettre ce rapport, retrouver votre simulation et améliorer lokt.fr. Aucune revente de données.");
  parts.push("— lokt.fr");

  return parts.join("\n");
}

export function buildCapaciteEmailHtml(computed: ComputeAllResult) {
  const r = computed.resume;
  const b = computed.assessment;

  const siteUrl = "https://lokt.fr";
  const logoUrl = `${siteUrl}/LOKT_LOGO.jpg`;
  const ctaUrl = `${siteUrl}/capacite`;

  const fmtSmall = (label: string, value: string) => `
    <td style="padding:10px 12px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">
      <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">${escapeHtml(label)}</div>
      <div style="margin-top:4px;font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(value)}</div>
    </td>
  `;

  const actionBlocks = (computed.actionPlan || "")
    .split("\n\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((block) => {
      if (block.startsWith("###")) {
        return `<h3 style="margin:14px 0 6px;font-size:14px;color:#0f172a;">${escapeHtml(
          block.replace(/^###\s*/, "")
        )}</h3>`;
      }
      const safe = escapeHtml(block).replace(/\n/g, "<br/>");
      return `<p style="margin:0 0 10px;color:#0f172a;line-height:1.55;font-size:13px;">${safe}</p>`;
    })
    .join("");

  return `
<div style="background:#f1f5f9;padding:18px 0;">
  <div style="max-width:640px;margin:0 auto;padding:0 14px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="padding:18px 18px 10px 18px;border-bottom:1px solid #e2e8f0;background:#ffffff;">
        <img src="${logoUrl}" alt="lokt.fr" width="130" style="display:block;max-width:130px;height:auto;margin:0 auto 8px;" />
        <h1 style="margin:0;text-align:center;font-size:18px;color:#0f172a;">Votre rapport de capacité d’emprunt</h1>
        <p style="margin:6px 0 0;text-align:center;color:#64748b;font-size:13px;line-height:1.5;">
          Chiffres clés, score lokt.fr™ et plan d’action personnalisé.
        </p>
      </div>

      <div style="padding:16px 18px;">
        <p style="margin:0 0 14px;color:#334155;font-size:13px;line-height:1.55;">
          Bonjour,<br/>
          voici une synthèse claire de votre capacité d’emprunt. Les montants restent indicatifs, mais ils donnent une base utile pour préparer un échange bancaire ou affiner votre projet.
        </p>

        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate;border-spacing:10px;">
          <tr>
            ${fmtSmall("Mensualité max", formatEuro(r.mensualiteMax))}
            ${fmtSmall("Capital empruntable", formatEuro(r.montantMax))}
          </tr>
          <tr>
            ${fmtSmall(
              "Mensualité assurance incluse",
              typeof r.mensualiteProjet === "number" ? formatEuro(r.mensualiteProjet) : "-"
            )}
            ${fmtSmall("Endettement après projet", formatPct(r.tauxEndettementAvecProjet))}
          </tr>
          <tr>
            ${fmtSmall("Budget max (avec apport)", formatEuro(r.budgetTotalMax))}
            ${fmtSmall(
              "Assurance estimée",
              typeof r.assuranceMensuelle === "number" ? formatEuro(r.assuranceMensuelle) + " / mois" : "-"
            )}
          </tr>
        </table>

        ${
          b
            ? `
          <div style="margin-top:10px;padding:14px;border:1px solid #e2e8f0;border-radius:14px;background:#0f172a;color:#ffffff;">
            <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#a5f3fc;">Score lokt.fr™</div>
            <div style="margin-top:6px;font-size:22px;font-weight:800;color:#ffffff;">${b.score}/100 <span style="font-size:14px;font-weight:700;color:#e2e8f0;">— ${escapeHtml(
                b.label
              )}</span></div>
            <p style="margin:8px 0 0;color:#e2e8f0;font-size:13px;line-height:1.55;">${escapeHtml(b.comment)}</p>
          </div>
        `
            : ``
        }

        <div style="margin-top:14px;text-align:center;">
          <a href="${ctaUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:999px;font-weight:700;font-size:13px;">
            Relire / refaire la simulation
          </a>
        </div>

        ${
          actionBlocks
            ? `
          <div style="margin-top:18px;padding-top:4px;">
            <h2 style="margin:0 0 8px;font-size:15px;color:#0f172a;">Plan d’action</h2>
            ${actionBlocks}
          </div>
        `
            : ``
        }

        <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;" />
        <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">
          Calculs indicatifs. Ne constitue pas une offre de prêt.
        </p>
        <p style="margin:6px 0 0;color:#64748b;font-size:12px;line-height:1.5;">
          Vos données servent à vous transmettre ce rapport, retrouver votre simulation et améliorer lokt.fr. Aucune revente de données.
        </p>
        <p style="margin:6px 0 0;color:#64748b;font-size:12px;">— lokt.fr</p>
      </div>
    </div>
  </div>
</div>
`.trim();
}
