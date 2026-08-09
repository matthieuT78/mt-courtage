// pages/api/company/lookup-siret.ts
//
// Vérifie un SIRET via l'API officielle recherche-entreprises.api.gouv.fr
// (gratuite, pas de clé requise) : existence, raison sociale, adresse, et
// statut actif/fermé — pour signaler une société radiée avant de générer un
// bail professionnel avec elle. Best-effort : une panne de l'API externe ne
// doit jamais bloquer la création du locataire, seulement priver l'utilisateur
// de la vérification.
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/apiAuth";

const API_URL = "https://recherche-entreprises.api.gouv.fr/search";

function normalizeSiret(value: unknown) {
  return String(value || "").replace(/\s+/g, "");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const auth = await requireApiUser(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });

  const siret = normalizeSiret(req.query.siret);
  if (!/^\d{14}$/.test(siret)) {
    return res.status(400).json({ ok: false, error: "Le SIRET doit contenir exactement 14 chiffres." });
  }

  try {
    const response = await fetch(`${API_URL}?q=${siret}&per_page=1`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error(`API entreprises ${response.status}`);
    const data = await response.json();
    const entreprise = data?.results?.[0];
    // Recherche plein texte côté API : on ne garde que si le SIRET renvoyé
    // correspond exactement (sinon "123" par ex. remonte des résultats sans rapport).
    const etablissement = (entreprise?.matching_etablissements || []).find((e: any) => e?.siret === siret);

    if (!entreprise || !etablissement) {
      return res.status(200).json({ ok: true, found: false });
    }

    return res.status(200).json({
      ok: true,
      found: true,
      siren: entreprise.siren,
      companyName: entreprise.nom_complet || entreprise.nom_raison_sociale || null,
      address: etablissement.adresse || null,
      companyActive: entreprise.etat_administratif === "A",
      establishmentActive: etablissement.etat_administratif === "A",
    });
  } catch (error: any) {
    console.error("[api/company/lookup-siret] error:", error);
    return res.status(200).json({ ok: false, error: "Vérification indisponible pour le moment." });
  }
}
