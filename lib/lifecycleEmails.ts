function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function benefitRow(params: { emoji: string; bg: string; title: string; text: string }) {
  const { emoji, bg, title, text } = params;
  return `
    <tr>
      <td style="padding:0 0 14px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td width="44" valign="top" style="padding-right:14px;">
              <div style="width:36px;height:36px;border-radius:12px;background:${bg};text-align:center;line-height:36px;font-size:18px;">${emoji}</div>
            </td>
            <td valign="top">
              <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(title)}</p>
              <p style="margin:0;font-size:13.5px;line-height:1.5;color:#64748b;">${escapeHtml(text)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function lokyTip(text: string) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:4px 0 20px;background:#f8fafc;border:1px solid #eef2ff;border-radius:14px;">
      <tr>
        <td width="52" valign="top" style="padding:14px 0 14px 14px;">
          <img src="https://lokt.fr/loky-avatar.png" alt="Loky" width="36" height="36" style="display:block;border-radius:10px;width:36px;height:36px;" />
        </td>
        <td valign="top" style="padding:14px 14px 14px 12px;">
          <p style="margin:0 0 2px;font-size:12.5px;font-weight:700;color:#4338ca;">Loky, l'assistant lokt</p>
          <p style="margin:0;font-size:13.5px;line-height:1.5;color:#334155;">${text}</p>
        </td>
      </tr>
    </table>`;
}

function shell(params: {
  heroEmoji: string;
  heroLabel: string;
  title: string;
  intro: string;
  benefitsHtml: string;
  noteHtml?: string;
  lokyTipHtml?: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryHtml?: string;
}) {
  const { heroEmoji, heroLabel, title, intro, benefitsHtml, noteHtml, lokyTipHtml, ctaLabel, ctaHref, secondaryHtml } = params;
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:92vw;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:20px 24px;border-bottom:1px solid #f1f5f9;">
              <img src="https://lokt.fr/lokt-logo-small.jpg" alt="lokt.fr" height="38" style="display:block;height:38px;width:auto;" />
            </td>
          </tr>

          <tr>
            <td style="background:#4f46e5;background:linear-gradient(135deg,#4338ca,#4d9cff 60%,#06b6d4);padding:32px 24px;text-align:center;">
              <div style="width:56px;height:56px;margin:0 auto 14px;border-radius:16px;background:rgba(255,255,255,0.18);text-align:center;line-height:56px;font-size:28px;">${heroEmoji}</div>
              <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.75);">${escapeHtml(heroLabel)}</p>
              <h1 style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:21px;line-height:1.3;color:#ffffff;">${escapeHtml(title)}</h1>
            </td>
          </tr>

          <tr>
            <td style="padding:26px 24px 8px;font-family:Arial,sans-serif;color:#0f172a;">
              <p style="margin:0 0 20px;font-size:14.5px;line-height:1.6;color:#334155;">${intro}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                ${benefitsHtml}
              </table>
              ${noteHtml ? `<div style="margin:6px 0 22px;padding:12px 14px;border-left:3px solid #cbd5e1;background:#f8fafc;border-radius:0 10px 10px 0;"><p style="margin:0;font-size:13px;line-height:1.55;color:#64748b;">${noteHtml}</p></div>` : `<div style="height:8px;"></div>`}
              ${lokyTipHtml || ""}
              <a href="${ctaHref}" style="display:inline-block;margin:4px 0 4px;padding:13px 26px;border-radius:999px;background:#0f172a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">${escapeHtml(ctaLabel)}</a>
              ${secondaryHtml ? `<p style="margin:12px 0 4px;font-size:13px;line-height:1.5;">${secondaryHtml}</p>` : ""}
            </td>
          </tr>

          <tr>
            <td style="padding:22px 24px;border-top:1px solid #f1f5f9;background:#f8fafc;font-family:Arial,sans-serif;">
              <p style="margin:0 0 10px;font-size:12.5px;font-weight:700;color:#334155;">lokt — la gestion locative simplifiée</p>
              <p style="margin:0 0 14px;font-size:12px;line-height:1.5;color:#94a3b8;">Baux, quittances, états des lieux et suivi des loyers, réunis au même endroit pour les propriétaires bailleurs.</p>
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:12px;"><a href="https://lokt.fr/aide" style="color:#4f46e5;text-decoration:none;">Aide &amp; contact</a></td>
                  <td style="font-size:12px;color:#cbd5e1;padding:0 8px;">·</td>
                  <td style="font-size:12px;"><a href="https://lokt.fr/tarifs" style="color:#4f46e5;text-decoration:none;">Tarifs</a></td>
                </tr>
              </table>
              <p style="margin:16px 0 0;font-size:11px;line-height:1.5;color:#cbd5e1;">Vous recevez cet email suite à la création de votre compte. © lokt</p>
            </td>
          </tr>
        </table>
        <div style="height:18px"></div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function greet(landlordName: string) {
  return landlordName ? `Bonjour ${landlordName},` : "Bonjour,";
}

export function buildNoPropertyEmail(params: { baseUrl: string; landlordName: string }) {
  const { baseUrl, landlordName } = params;
  const benefitsHtml = [
    benefitRow({ emoji: "📊", bg: "#eef2ff", title: "Suivi automatique", text: "Occupation et loyers attendus visibles chaque mois, sans tableur." }),
    benefitRow({ emoji: "🧾", bg: "#ecfdf5", title: "Quittances générées", text: "Dès qu'un locataire est rattaché, plus rien à faire à la main." }),
    benefitRow({ emoji: "🔔", bg: "#fff7ed", title: "Alertes intelligentes", text: "Retard de paiement ou échéance à venir : lokt vous prévient." }),
  ].join("");
  return {
    subject: "Un pas vous sépare de votre tableau de bord lokt",
    html: shell({
      heroEmoji: "🏠",
      heroLabel: "Étape 1 sur 2",
      title: `${greet(landlordName)} ajoutez votre premier bien`,
      intro: "Ajouter votre premier bien est la première brique sur lokt : adresse, type de logement, quelques infos — 2 minutes suffisent. C'est ce qui débloque tout le reste.",
      benefitsHtml,
      lokyTipHtml: lokyTip("Une fois connecté, vous pouvez aussi simplement me demander de créer votre bien : dites-moi juste l'adresse, je m'occupe du reste."),
      ctaLabel: "Ajouter mon premier bien",
      ctaHref: `${baseUrl}/espace-bailleur?tab=biens`,
    }),
  };
}

export function buildNoLeaseEmail(params: { baseUrl: string; landlordName: string }) {
  const { baseUrl, landlordName } = params;
  const benefitsHtml = [
    benefitRow({ emoji: "💶", bg: "#eef2ff", title: "Loyer et échéance fixés", text: "Montant, charges et date de paiement enregistrés une fois pour toutes." }),
    benefitRow({ emoji: "🧾", bg: "#ecfdf5", title: "Quittances activées", text: "Génération et relances de retard deviennent possibles." }),
    benefitRow({ emoji: "🔗", bg: "#fff7ed", title: "Tout relié", text: "Le bien et le locataire apparaissent liés partout dans le tableau de bord." }),
  ].join("");
  return {
    subject: "Il ne vous manque qu'une étape pour tout activer",
    html: shell({
      heroEmoji: "🔑",
      heroLabel: "Étape 2 sur 2",
      title: `${greet(landlordName)} créez votre première location`,
      intro: "Bien et locataire sont prêts dans lokt — il ne reste qu'à créer la <strong>location</strong> qui les rattache l'un à l'autre.",
      benefitsHtml,
      noteHtml: "Sans cette étape, votre bien et votre locataire existent chacun de leur côté : rien n'est encore suivi entre les deux.",
      lokyTipHtml: lokyTip("Vous pouvez aussi me demander directement de créer la location : dites-moi qui loue quoi, je fais le lien."),
      ctaLabel: "Créer la location",
      ctaHref: `${baseUrl}/espace-bailleur?tab=baux`,
    }),
  };
}
