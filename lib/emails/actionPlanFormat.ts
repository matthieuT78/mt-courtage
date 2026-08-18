// lib/emails/actionPlanFormat.ts
//
// Format partagé pour le "plan d'action" envoyé dans les emails de rapport
// (capacité, prêt relais, acheter ou louer, investissement, plus-value).
// Chaque wizard sérialise ses ActionPlanItem[] (voir components/*Wizard.tsx)
// en blocs "### [TYPE] Titre\nCorps" séparés par une ligne vide — ce module
// les reparse pour reproduire, dans l'email, le même code couleur que les
// badges affichés dans l'app (rouge/ambre/émeraude/indigo).

export type ActionBlockType = "blocking" | "warning" | "positive" | "tip";

export const ACTION_TYPE_LABELS: Record<ActionBlockType, string> = {
  blocking: "Bloquant",
  warning: "À surveiller",
  positive: "Atout",
  tip: "Conseil",
};

const ACTION_TYPE_STYLES: Record<ActionBlockType, { bg: string; border: string; text: string }> = {
  blocking: { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" },
  warning: { bg: "#fffbeb", border: "#fde68a", text: "#92400e" },
  positive: { bg: "#ecfdf5", border: "#a7f3d0", text: "#065f46" },
  tip: { bg: "#eef2ff", border: "#c7d2fe", text: "#3730a3" },
};

function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function parseActionBlock(rawBlock: string): { type: ActionBlockType | null; title: string; body: string } {
  const block = rawBlock.replace(/^###\s*/, "").trim();
  const match = block.match(/^\[(BLOCKING|WARNING|POSITIVE|TIP)\]\s*([^\n]*)\n?([\s\S]*)$/);
  if (!match) return { type: null, title: "", body: block };
  const [, rawType, title, body] = match;
  return { type: rawType.toLowerCase() as ActionBlockType, title: title.trim(), body: body.trim() };
}

function splitBlocks(actionPlan: string, limit: number): string[] {
  return (actionPlan || "")
    .split("\n\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, limit);
}

/** Rendu HTML : une carte colorée par bloc typé, badge + titre + corps. */
export function renderActionPlanHtml(actionPlan: string, limit = 12): string {
  return splitBlocks(actionPlan, limit)
    .map((raw) => {
      const { type, title, body } = parseActionBlock(raw);
      if (!type) {
        const safe = escapeHtml(raw.replace(/^###\s*/, "")).replace(/\n/g, "<br/>");
        return `<p style="margin:0 0 10px;color:#0f172a;line-height:1.55;font-size:13px;">${safe}</p>`;
      }
      const style = ACTION_TYPE_STYLES[type];
      return `
        <div style="margin:0 0 10px;padding:12px 14px;border:1px solid ${style.border};border-radius:12px;background:${style.bg};">
          <span style="display:inline-block;margin-bottom:6px;padding:2px 8px;border-radius:999px;background:${style.border};color:${style.text};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;">${ACTION_TYPE_LABELS[type]}</span>
          <div style="font-size:13px;font-weight:700;color:${style.text};margin:0 0 4px;">${escapeHtml(title)}</div>
          <div style="font-size:13px;color:#334155;line-height:1.55;">${escapeHtml(body).replace(/\n/g, "<br/>")}</div>
        </div>
      `;
    })
    .join("");
}

/** Rendu texte brut : "[Label] Titre" puis le corps sur la ligne suivante. */
export function renderActionPlanTextLines(actionPlan: string, limit = 10): string[] {
  const lines: string[] = [];
  for (const raw of splitBlocks(actionPlan, limit)) {
    const { type, title, body } = parseActionBlock(raw);
    if (type) {
      lines.push(`[${ACTION_TYPE_LABELS[type]}] ${title}`);
      lines.push(body);
    } else {
      lines.push(raw.replace(/^###\s*/gm, "").replace(/\n/g, " "));
    }
    lines.push("");
  }
  return lines;
}
