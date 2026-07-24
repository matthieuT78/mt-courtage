// pages/api/address-search.ts
// Proxy vers la Base Adresse Nationale (BAN) — API officielle du gouvernement
// français, gratuite et sans clé. Retourne des adresses complètes (numéro,
// rue, code postal, ville) à partir d'une saisie libre.
import type { NextApiRequest, NextApiResponse } from "next";

export type AddressSuggestion = {
  label: string;
  addressLine1: string;
  postalCode: string;
  city: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const q = (req.query.q as string | undefined)?.trim();

  if (!q || q.length < 3) {
    return res.status(200).json([] as AddressSuggestion[]);
  }

  try {
    const url = new URL("https://api-adresse.data.gouv.fr/search/");
    url.searchParams.set("q", q);
    url.searchParams.set("limit", "6");
    // Pas de filtre "type=housenumber" : on veut aussi remonter les résultats de
    // type "street" pour qu'une saisie qui commence par le nom de la rue (sans
    // numéro) propose déjà des suggestions, pas seulement une saisie "N rue X".

    const resp = await fetch(url.toString());
    if (!resp.ok) throw new Error("Erreur appel API Adresse (BAN)");

    const data = (await resp.json()) as any;
    const features = (data?.features || []) as any[];

    const result: AddressSuggestion[] = features.map((f) => ({
      label: f.properties?.label || "",
      addressLine1: f.properties?.name || "",
      postalCode: f.properties?.postcode || "",
      city: f.properties?.city || "",
    }));

    res.setHeader("Cache-Control", "public, max-age=3600");
    res.status(200).json(result);
  } catch (e) {
    console.error("Erreur /api/address-search", e);
    res.status(500).json({ error: "Erreur serveur auto-complétion adresse" });
  }
}
