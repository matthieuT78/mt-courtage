// lib/emails/pret-relais.ts

type ResumeRelais = {
  montantRelais: number;
  mensualiteNouveauMax: number;
  capitalNouveau: number;
  budgetMax: number;

  revenusPrisEnCompte?: number;
  mensualitesExistantes?: number;
  tauxEndettementActuel?: number;
  tauxEndettementAvecProjet?: number;
};

type Bankability = {
  score: number;
  label: string;
  comment: string;
};

type PretRelaisComputed = {
  output?: {
    resume?: ResumeRelais | null;
    texteDetail?: string | null;
    texte?: string | null;
    bankability?: Bankability | null;
  } | null;

  // fallback compat
  resume?: ResumeRelais | null;
  texteDetail?: string | null;
  texte?: string | null;
  bankability?: Bankability | null;
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

function pickOutput(computedAny: any) {
  const c = (computedAny || {}) as PretRelaisComputed;

  const resume = (c.output?.resume || c.resume || null) as ResumeRelais | null;
  const bankability = (c.output?.bankability || c.bankability || null) as Bankability | null;

  // dans ton wizard, tu as texteDetail; dans computeAll(), tu as "texte"
  const texteDetail =
    (c.output?.texteDetail || c.output?.texte || c.texteDetail || c.texte || "") as string;

  return { resume, bankability, texteDetail };
}

/**
 * Même logique de rendu que capacité :
 * - split double newline -> sections
 * - chaque section: 1ère ligne = titre, le reste = paragraphes
 */
function analysisToBlocks(analysis: string) {
  const text = String(analysis || "").trim();
  if (!text) return { html: "", textBlocks: [] as string[] };

  const sections = text
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);

  const html = sections
    .map((section) => {
      const lines = section
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      if (!lines.length) return "";

      const title = lines[0];
      const body = lines.slice(1).join("\n");

      // capacité utilisait des <h3> et <p> / <br/>
      const h = `<h3 style="margin:14px 0 6px;font-size:14px;color:#0f172a;">${escapeHtml(title)}</h3>`;
      const p =
        body.length > 0
          ? `<p style="margin:0 0 10px;color:#0f172a;line-height:1.55;font-size:13px;">${escapeHtml(body).replace(
              /\n/g,
              "<br/>"
            )}</p>`
          : "";

      return h + p;
    })
    .join("");

  // textBlocks : on garde une version simple
  const textBlocks = sections.map((section) => section.replace(/\n+/g, " ").trim());
  return { html, textBlocks };
}

export function buildPretRelaisEmailText(computedAny: any) {
  const { resume, bankability, texteDetail } = pickOutput(computedAny);

  const parts: string[] = [];
  parts.push("VOTRE RAPPORT DE PRÊT RELAIS — lokt.fr");
  parts.push("");
  parts.push("Bonjour,");
  parts.push("Voici votre rapport personnalisé : budget de rachat, relais estimé, score lokt.fr et points de vigilance.");
  parts.push("");
  parts.push("Récapitulatif :");

  if (resume) {
    parts.push(`- Montant du relais : ${formatEuro(resume.montantRelais)}`);
    parts.push(`- Mensualité max (nouveau prêt) : ${formatEuro(resume.mensualiteNouveauMax)}`);
    parts.push(`- Capital nouveau prêt : ${formatEuro(resume.capitalNouveau)}`);
    parts.push(`- Budget max : ${formatEuro(resume.budgetMax)}`);
    parts.push("");
  } else {
    parts.push("- Données manquantes : impossible de générer le récapitulatif.");
    parts.push("");
  }

  if (bankability) {
    parts.push(`Score lokt.fr : ${bankability.score}/100 — ${bankability.label}`);
    parts.push(bankability.comment);
    parts.push("");
  }

  if (texteDetail) {
    parts.push("Analyse :");
    const { textBlocks } = analysisToBlocks(texteDetail);
    for (const b of textBlocks.slice(0, 10)) {
      parts.push(b);
      parts.push("");
    }
  }

  parts.push("Relire / refaire la simulation : https://lokt.fr/pret-relais");
  parts.push("");
  parts.push("Calculs indicatifs. Ne constitue pas une offre de prêt.");
  parts.push("Vos données servent uniquement à vous transmettre ce rapport, retrouver votre simulation et améliorer lokt.fr. Aucune revente de données.");
  parts.push("— lokt.fr");

  return parts.join("\n");
}

export function buildPretRelaisEmailHtml(computedAny: any) {
  const { resume, bankability, texteDetail } = pickOutput(computedAny);

  const siteUrl = "https://lokt.fr";
  const logoUrl = `${siteUrl}/LOKT_LOGO.jpg`;
  const ctaUrl = `${siteUrl}/pret-relais`;

  const fmtSmall = (label: string, value: string) => `
    <td style="padding:10px 12px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">
      <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">${escapeHtml(label)}</div>
      <div style="margin-top:4px;font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(value)}</div>
    </td>
  `;

  const recapCells = resume
    ? `
      <tr>
        ${fmtSmall("Montant du relais", formatEuro(resume.montantRelais))}
        ${fmtSmall("Mensualité max", formatEuro(resume.mensualiteNouveauMax))}
      </tr>
      <tr>
        ${fmtSmall("Capital nouveau prêt", formatEuro(resume.capitalNouveau))}
        ${fmtSmall("Budget max", formatEuro(resume.budgetMax))}
      </tr>
    `
    : `
      <tr>
        ${fmtSmall("Simulation", "Données manquantes")}
        ${fmtSmall("Action", "Relancer le calcul")}
      </tr>
    `;

  const analysis = analysisToBlocks(texteDetail || "");
  const analysisHtml = analysis.html;

  return `
<div style="background:#f1f5f9;padding:18px 0;">
  <div style="max-width:640px;margin:0 auto;padding:0 14px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="padding:18px 18px 10px 18px;border-bottom:1px solid #e2e8f0;background:#ffffff;">
        <img src="${logoUrl}" alt="lokt.fr" width="130" style="display:block;max-width:130px;height:auto;margin:0 auto 8px;" />
        <h1 style="margin:0;text-align:center;font-size:18px;color:#0f172a;">Votre rapport de prêt relais</h1>
        <p style="margin:6px 0 0;text-align:center;color:#64748b;font-size:13px;line-height:1.5;">
          Budget de rachat, relais estimé, score lokt.fr™ et points de vigilance.
        </p>
      </div>

      <div style="padding:16px 18px;">
        <p style="margin:0 0 14px;color:#334155;font-size:13px;line-height:1.55;">
          Bonjour,<br/>
          voici une synthèse de votre projet de prêt relais. Ce montage est sensible : vérifiez toujours les hypothèses avec votre banque avant de vous engager.
        </p>

        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate;border-spacing:10px;">
          ${recapCells}
        </table>

        ${
          bankability
            ? `
          <div style="margin-top:10px;padding:14px;border:1px solid #e2e8f0;border-radius:14px;background:#0f172a;color:#ffffff;">
            <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#a5f3fc;">Score lokt.fr™</div>
            <div style="margin-top:6px;font-size:22px;font-weight:800;color:#ffffff;">${bankability.score}/100 <span style="font-size:14px;font-weight:700;color:#e2e8f0;">— ${escapeHtml(
                bankability.label
              )}</span></div>
            <p style="margin:8px 0 0;color:#e2e8f0;font-size:13px;line-height:1.55;">${escapeHtml(
              bankability.comment
            )}</p>
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
          analysisHtml
            ? `
          <div style="margin-top:18px;padding-top:4px;">
            <h2 style="margin:0 0 8px;font-size:15px;color:#0f172a;">Analyse</h2>
            ${analysisHtml}
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
