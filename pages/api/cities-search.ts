// pages/api/cities-search.ts
import type { NextApiRequest, NextApiResponse } from "next";

type CitySuggestion = {
  name: string;
  postalCode: string;
  inseeCode: string;
};

function normalizeSearch(raw: string) {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(arrondissement|arr\.?|eme|ème|er|e)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueCities(cities: CitySuggestion[]) {
  const seen = new Set<string>();
  const result: CitySuggestion[] = [];

  for (const city of cities) {
    const key = `${city.inseeCode}:${city.postalCode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(city);
  }

  return result;
}

function departmentFromPostalPrefix(prefix: string) {
  if (/^97[1-8]/.test(prefix)) return prefix.slice(0, 3);
  if (/^98[4-9]/.test(prefix)) return prefix.slice(0, 3);
  if (/^20/.test(prefix)) return prefix.slice(0, 2);
  return prefix.slice(0, 2);
}

async function searchGeoApi(params: { postalCode?: string; postalPrefix?: string; name?: string }) {
  const url = new URL("https://geo.api.gouv.fr/communes");
  if (params.postalCode) url.searchParams.set("codePostal", params.postalCode);
  if (params.postalPrefix && !params.postalCode) url.searchParams.set("codeDepartement", departmentFromPostalPrefix(params.postalPrefix));
  if (params.name) url.searchParams.set("nom", params.name);
  url.searchParams.set("fields", "nom,codesPostaux,code,population");
  url.searchParams.set("limit", params.postalPrefix && !params.postalCode ? "100" : "10");
  url.searchParams.set("boost", "population");

  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error("Erreur appel API geo.api.gouv.fr");

  const data = (await resp.json()) as any[];
  const result: CitySuggestion[] = [];

  for (const item of data) {
    const nom = item.nom as string;
    const codesPostaux: string[] = item.codesPostaux || [];
    const codeInsee: string = item.code;

    for (const cp of codesPostaux) {
      if (params.postalCode && cp !== params.postalCode) continue;
      if (params.postalPrefix && !cp.startsWith(params.postalPrefix)) continue;
      result.push({
        name: nom,
        postalCode: cp,
        inseeCode: codeInsee,
      });
    }
  }

  return result;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const q = (req.query.q as string | undefined)?.trim();

  if (!q || q.length < 2) {
    return res.status(200).json([] as CitySuggestion[]);
  }

  try {
    const normalized = normalizeSearch(q);
    const postalCode = normalized.match(/\b\d{5}\b/)?.[0] || null;
    const postalPrefix = /^\d{2,4}$/.test(normalized) ? normalized : null;
    const name = normalizeSearch(normalized.replace(/\b\d{4,5}\b/g, ""));

    const searches: Array<Promise<CitySuggestion[]>> = [];
    if (postalCode) searches.push(searchGeoApi({ postalCode }));
    if (!postalCode && postalPrefix) searches.push(searchGeoApi({ postalPrefix }));
    if (name.length >= 2) searches.push(searchGeoApi({ name }));
    if (!postalCode && !name && normalized.length >= 2) searches.push(searchGeoApi({ name: normalized }));

    const batches = await Promise.all(searches.length ? searches : [searchGeoApi({ name: normalized })]);
    const result = uniqueCities(batches.flat());

    res.status(200).json(result.slice(0, 10));
  } catch (e) {
    console.error("Erreur /api/cities-search", e);
    res.status(500).json({ error: "Erreur serveur auto-complétion" });
  }
}
