// scripts/source-widget-prospects.mjs
//
// Insère dans Supabase (table widget_prospects) les contacts trouvés lors
// d'une session de recherche web (agences immobilières, blogs immo) — pas de
// scraping embarqué ici, juste l'insertion d'une liste déjà vérifiée à la
// main (email réellement affiché sur le site de la cible, jamais deviné).
//
// Entrée : scripts/data/widget-prospects-staging.csv (colonnes : name,email,
// segment,city,source). Une fois inséré, le fichier staging est vidé (ne
// garde que l'en-tête) pour ne jamais ré-insérer deux fois la même session.
// Les doublons d'email sont ignorés silencieusement (contrainte unique en
// base) même si le fichier n'a pas été vidé entre deux sessions.
//
// Usage :
//   node scripts/source-widget-prospects.mjs

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.trim().startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/g, "")];
      })
  );
}

const env = { ...parseEnvFile(path.join(process.cwd(), ".env.local")), ...process.env };
const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants dans .env.local.");
  process.exit(1);
}

const STAGING_PATH = path.join(process.cwd(), "scripts", "data", "widget-prospects-staging.csv");
const HEADERS = ["name", "email", "segment", "city", "source"];

function parseCsvLine(line) {
  const cells = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { cells.push(cur); cur = ""; }
    else cur += c;
  }
  cells.push(cur);
  return cells;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  });
}

async function main() {
  if (!fs.existsSync(STAGING_PATH)) {
    console.error(`Fichier introuvable : ${STAGING_PATH}. Crée-le avec l'en-tête : ${HEADERS.join(",")}`);
    process.exit(1);
  }

  const rows = parseCsv(fs.readFileSync(STAGING_PATH, "utf8")).filter((r) => r.email && r.name && r.segment);
  if (rows.length === 0) {
    console.log("Aucun contact à insérer (staging vide).");
    return;
  }

  const invalidSegment = rows.find((r) => r.segment !== "agence" && r.segment !== "blog");
  if (invalidSegment) {
    console.error(`Segment invalide pour ${invalidSegment.email} : "${invalidSegment.segment}" (attendu "agence" ou "blog").`);
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const payload = rows.map((r) => ({
    name: r.name,
    email: r.email.trim().toLowerCase(),
    segment: r.segment,
    city: r.city || null,
    source: r.source || "recherche web",
  }));

  const { data, error } = await supabase
    .from("widget_prospects")
    .upsert(payload, { onConflict: "email", ignoreDuplicates: true })
    .select("email");

  if (error) {
    console.error("Erreur d'insertion :", error.message);
    process.exit(1);
  }

  console.log(`${data?.length ?? 0} nouveau(x) contact(s) inséré(s) sur ${rows.length} proposé(s) (doublons ignorés).`);

  // Vide le staging (garde l'en-tête) pour ne jamais ré-insérer la même session.
  fs.writeFileSync(STAGING_PATH, HEADERS.join(",") + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
