// pages/api/irl-history.ts
// Expose en lecture la table irl_values (source INSEE, synchronisée par
// pages/api/cron/sync-irl.ts) pour les composants client qui ont besoin de
// l'historique IRL — notamment le générateur de notification de révision de
// loyer (SectionModeles.tsx), qui utilisait jusqu'ici un fichier statique
// codé en dur (lib/irlData.ts) nécessitant une resynchronisation manuelle à
// chaque trimestre. Donnée publique (publication INSEE), pas besoin d'auth.
import type { NextApiRequest, NextApiResponse } from "next";
import { getIrlHistory } from "../../lib/irl-service";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const limit = Math.min(40, Math.max(1, Number(req.query.limit) || 24));
  const history = await getIrlHistory(limit);

  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).json({ history });
}
