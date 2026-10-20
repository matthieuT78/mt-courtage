// pages/api/tools/extract-property-tax.ts
//
// Extrait le montant total de taxe foncière et la ligne TEOM (taxe
// d'enlèvement des ordures ménagères) depuis un avis de taxe foncière
// importé dans l'outil "TEOM récupérable" — même principe que
// extract_invoice_document (lib/landlord/assistantTools.ts) côté Loky, mais
// hors chat : l'outil est un calculateur local, pas un enregistrement lokt,
// donc rien à router via la conversation.
import type { NextApiRequest, NextApiResponse } from "next";
import Anthropic from "@anthropic-ai/sdk";
import { requireApiUser } from "../../../lib/apiAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { LEASE_CONTRACT_BUCKET } from "../../../lib/leaseContract";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const { stagingPath } = (req.body || {}) as { stagingPath?: string };
    const path = String(stagingPath || "");
    if (!path.startsWith(`${auth.userId}/loky-imports/`)) {
      return res.status(403).json({ error: "Document introuvable ou non autorisé." });
    }

    const { data: file, error: downloadError } = await supabaseAdmin.storage.from(LEASE_CONTRACT_BUCKET).download(path);
    if (downloadError || !file) return res.status(404).json({ error: "Document introuvable — a-t-il bien fini d'être envoyé ?" });
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Extraction indisponible (clé API manquante)." });
    const client = new Anthropic({ apiKey });
    const model = process.env.ANTHROPIC_DOCUMENT_MODEL || "claude-sonnet-5";

    const response = await client.messages.create({
      model,
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
            {
              type: "text",
              text: `Ce document est probablement un avis de taxe foncière français. Extrais les informations dans EXACTEMENT ce format JSON, sans aucun texte avant ou après, sans bloc markdown :
{
  "is_property_tax_notice": boolean (false si ce document n'est manifestement pas un avis de taxe foncière),
  "property_tax_total": number|null (montant total à payer de la taxe foncière, en euros, sans symbole — case "Montant à payer" ou total en bas de l'avis),
  "teom_amount": number|null (montant de la ligne "TEOM" ou "Taxe d'enlèvement des ordures ménagères", distincte du total — souvent une ligne à part dans le détail du calcul, pas le total),
  "year": number|null (année d'imposition visible sur l'avis),
  "notes": string (en français, signale ce qui est absent, ambigu, ou si la ligne TEOM n'apparaît pas séparément sur ce document — chaîne vide si rien à signaler)
}
N'invente jamais une valeur absente du document : utilise null.`,
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    let parsed: Record<string, any>;
    try {
      const raw = (textBlock?.text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      parsed = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: "Le document n'a pas pu être analysé (réponse inattendue). Réessaie, ou renseigne les montants manuellement." });
    }

    if (parsed.is_property_tax_notice === false) {
      return res.status(200).json({ ok: true, isPropertyTaxNotice: false, notes: parsed.notes || "Ce document ne ressemble pas à un avis de taxe foncière." });
    }

    // Best-effort cleanup du fichier de transit — ne bloque jamais la réponse.
    await supabaseAdmin.storage.from(LEASE_CONTRACT_BUCKET).remove([path]).catch(() => {});

    return res.status(200).json({
      ok: true,
      isPropertyTaxNotice: true,
      propertyTaxTotal: parsed.property_tax_total ?? null,
      teomAmount: parsed.teom_amount ?? null,
      year: parsed.year ?? null,
      notes: parsed.notes || "",
    });
  } catch (error: any) {
    console.error("[api/tools/extract-property-tax] error:", error);
    return res.status(500).json({ error: error?.message || "Extraction impossible." });
  }
}
