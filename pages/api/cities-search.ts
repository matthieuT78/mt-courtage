// pages/api/cities-search.ts
import type { NextApiRequest, NextApiResponse } from "next";

type CitySuggestion = {
  name: string;
  postalCode: string;
  inseeCode: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const q = (req.query.q as string | undefined)?.trim();

  if (!q || q.length < 2) {
    return res.status(200).json([] as CitySuggestion[]);
  }

  try {
    const isPostalCode = /^\d{4,5}$/.test(q);
    const baseUrl = "https://geo.api.gouv.fr/communes";

    const url = new URL(baseUrl);
    if (isPostalCode) {
      url.searchParams.set("codePostal", q);
    } else {
      url.searchParams.set("nom", q);
    }
    url.searchParams.set("fields", "nom,codesPostaux,code,population");
    url.searchParams.set("limit", "10");
    url.searchParams.set("boost", "population");

    const resp = await fetch(url.toString());
    if (!resp.ok) {
      throw new Error("Erreur appel API geo.api.gouv.fr");
    }

    const data = (await resp.json()) as any[];

    // On normalise : 1 suggestion = 1 CP + 1 commune
    const result: CitySuggestion[] = [];

    for (const item of data) {
      const nom = item.nom as string;
      const codesPostaux: string[] = item.codesPostaux || [];
      const codeInsee: string = item.code;

      for (const cp of codesPostaux) {
        result.push({
          name: nom,
          postalCode: cp,
          inseeCode: codeInsee,
        });
      }
    }

    // On limite la liste finale
    res.status(200).json(result.slice(0, 10));
  } catch (e) {
    console.error("Erreur /api/cities-search", e);
    res.status(500).json({ error: "Erreur serveur auto-complétion" });
  }
}
