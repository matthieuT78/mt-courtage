// pages/api/cron/legal-watch.ts
// Veille juridique hebdomadaire (baux/location) : interroge le JORF via l'API
// Légifrance (PISTE) et alerte sur Telegram tout nouveau décret/loi/ordonnance
// touchant au droit locatif, pour ne plus dépendre du hasard (post Instagram...)
// pour repérer un texte comme le décret n°2026-596 du 6 juillet 2026.
//
// Recherche restreinte au TITRE des textes (pas le texte intégral) : "bail"/
// "location"/"loyer" en texte intégral remonte des milliers de faux positifs
// (contrats, statuts de société...). Au titre, ces mots ne matchent quasiment
// que des textes réellement consacrés au droit locatif.
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { hasValidCronSecret } from "../../../lib/cronAuth";
import { sendTelegramMessage } from "../../../lib/telegram";

const OAUTH_URL = "https://sandbox-oauth.piste.gouv.fr/api/oauth/token";
const SEARCH_URL = "https://sandbox-api.piste.gouv.fr/dila/legifrance/lf-engine-app/search";
const LOOKBACK_DAYS = 8; // > périodicité hebdo, pour ne rien manquer en cas de run raté

type JorfResult = {
  titles: [{ cid: string; title: string }];
  jorfText: string;
  datePublication: string;
};

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.LEGIFRANCE_PISTE_CLIENT_ID;
  const clientSecret = process.env.LEGIFRANCE_PISTE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const resp = await fetch(OAUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret, scope: "openid" }),
  });
  if (!resp.ok) return null;
  const json = await resp.json();
  return json.access_token || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!hasValidCronSecret(req)) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ ok: false, error: "Supabase admin non configuré." });

  const token = await getAccessToken();
  if (!token) return res.status(500).json({ ok: false, error: "Auth PISTE impossible." });

  const searchResp = await fetch(SEARCH_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      recherche: {
        champs: [{ typeChamp: "TITLE", criteres: [{ typeRecherche: "UN_DES_MOTS", valeur: "bail location loyer", operateur: "ET" }], operateur: "ET" }],
        filtres: [{ facette: "NATURE", valeurs: ["DECRET", "LOI", "ORDONNANCE"] }],
        pageSize: 15,
        pageNumber: 1,
        sort: "PUBLICATION_DATE_DESC",
      },
      fond: "JORF",
    }),
  });
  if (!searchResp.ok) return res.status(502).json({ ok: false, error: `Recherche Légifrance impossible (${searchResp.status}).` });
  const searchJson = await searchResp.json();
  const results: JorfResult[] = searchJson.results || [];

  const cutoff = Date.now() - LOOKBACK_DAYS * 86_400_000;
  const recent = results.filter((r) => {
    const t = new Date(r.datePublication).getTime();
    return Number.isFinite(t) && t >= cutoff;
  });
  if (recent.length === 0) return res.status(200).json({ ok: true, sent: 0, checked: results.length });

  const cids = recent.map((r) => r.titles[0].cid);
  const { data: alreadySeen } = await supabaseAdmin.from("legal_watch_seen_texts").select("cid").in("cid", cids);
  const seenSet = new Set((alreadySeen || []).map((r) => r.cid));
  const fresh = recent.filter((r) => !seenSet.has(r.titles[0].cid));

  for (const r of fresh) {
    const cid = r.titles[0].cid;
    const title = r.titles[0].title;
    await sendTelegramMessage(
      `📜 <b>Veille juridique — bail/location</b>\n${title}\n${r.jorfText}\nhttps://www.legifrance.gouv.fr/jorf/id/${cid}`
    );
    await supabaseAdmin.from("legal_watch_seen_texts").insert({
      cid,
      title,
      jorf_ref: r.jorfText,
      published_at: r.datePublication?.slice(0, 10) || null,
    });
  }

  return res.status(200).json({ ok: true, sent: fresh.length, checked: results.length });
}
