/**
 * Générateur d'articles de blog lokt.fr
 *
 * Usage :
 *   node scripts/new-article.mjs "Titre ou sujet de l'article"
 *   node scripts/new-article.mjs "Titre" --slug mon-slug-custom
 *   node scripts/new-article.mjs "Titre" --brief "focus sur X, inclure tableau Y"
 *
 * Sortie :
 *   - content/blog/<slug>.md   (article complet)
 *   - Console : prompt image à coller dans ChatGPT + nom de fichier attendu
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ─── Env ────────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadEnv() {
  try {
    const content = fs.readFileSync(path.join(root, ".env.local"), "utf-8");
    for (const line of content.split("\n")) {
      const m = line.match(/^([^#\s][^=]*)=(.*)$/);
      if (m && !process.env[m[1].trim()]) {
        process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {}
}
loadEnv();

// ─── Args ────────────────────────────────────────────────────────────────────
const rawArgs = process.argv.slice(2);
if (!rawArgs.length || rawArgs[0].startsWith("--")) {
  console.error("Usage : node scripts/new-article.mjs \"Sujet de l'article\" [--slug mon-slug] [--brief \"contexte\"]");
  process.exit(1);
}

const topic = rawArgs[0];
const slugArg = rawArgs.indexOf("--slug") !== -1 ? rawArgs[rawArgs.indexOf("--slug") + 1] : null;
const briefArg = rawArgs.indexOf("--brief") !== -1 ? rawArgs[rawArgs.indexOf("--brief") + 1] : null;

function toSlug(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

const slug = slugArg || toSlug(topic);

// ─── Date ────────────────────────────────────────────────────────────────────
const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

// ─── Prompt ──────────────────────────────────────────────────────────────────
const systemPrompt = `Tu es rédacteur expert pour lokt.fr, une plateforme française de gestion locative et de simulation immobilière.
Audience : bailleurs, investisseurs, propriétaires immobiliers. Ton : professionnel, direct, chiffré, factuel. Jamais de fioriture.
Langue : français. Date du jour : ${today}.

RÈGLES DE STYLE STRICTES :
- Commence TOUJOURS le contenu textuel (après le frontmatter) par un titre H1 (# Titre)
- Sections H2 (##) avec un angle concret ou chiffré dans le titre
- Tableaux Markdown quand c'est plus clair qu'une liste
- Jamais de listes à puces seules sans contexte
- Chaque section doit apporter une info actionnable ou un chiffre précis
- Liens internes vers les outils lokt.fr quand pertinent : /pret-relais, /capacite, /investissement, /outil-gestion-locative
- Ne jamais inventer de jurisprudence ou de chiffres sans préciser "indicatif"

CATÉGORIES disponibles : "Gestion locative" | "Investissement locatif" | "Fiscalité" | "Financement immobilier" | "Capacité d'emprunt" | "Réglementation"

FORMAT FRONTMATTER OBLIGATOIRE (YAML) :
---
title: "Titre SEO avec année si pertinent"
description: "Description 140-160 caractères, commence par un fait/chiffre concret"
date: "${today}"
category: "UNE des catégories listées ci-dessus"
tags: ["tag1", "tag2", "tag3", "tag4", "tag5"]
relatedCalculators: []  # parmi : "capacite", "pret-relais", "investissement", "parc-immobilier", "acheter-ou-louer", "revision-loyer"
coverImage: "/blog/${slug}.jpg"
faq:
  - q: "Question 1 ?"
    a: "Réponse courte et précise (3-5 phrases max)"
  - q: "Question 2 ?"
    a: "..."
  # 4 à 6 FAQ total, ciblant les requêtes longue traîne Google
---

CONTENU : 800 à 1400 mots, H2 + H3, tableaux si pertinent, section "## FAQ" en fin avec les mêmes questions que le frontmatter réécrites en prose.
La toute dernière ligne doit être un CTA vers un outil lokt.fr pertinent (lien Markdown).

PUIS, après l'article, sur une ligne séparée par trois tirets (---), génère un PROMPT IMAGE pour ChatGPT/DALL-E 4 :
Format : IMAGE_PROMPT: <prompt en anglais, photorealistic, real estate context, no text, clean composition, 16:9, professional photography>
`;

const userPrompt = `Génère un article de blog complet pour lokt.fr sur le sujet suivant :

SUJET : ${topic}
SLUG : ${slug}
${briefArg ? `CONTEXTE SUPPLÉMENTAIRE : ${briefArg}` : ""}

Respecte strictement le format frontmatter YAML et le style décrit.`;

// ─── Call Claude ─────────────────────────────────────────────────────────────
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("❌ ANTHROPIC_API_KEY manquant dans .env.local");
  process.exit(1);
}

const client = new Anthropic({ apiKey });

console.log(`\n📝 Génération de l'article : "${topic}"\n`);

const message = await client.messages.create({
  model: "claude-opus-4-8",
  max_tokens: 4096,
  messages: [
    { role: "user", content: userPrompt },
  ],
  system: systemPrompt,
});

const raw = message.content[0].text;

// ─── Parse article vs image prompt ───────────────────────────────────────────
const splitIdx = raw.lastIndexOf("\nIMAGE_PROMPT:");
let articleMd = raw;
let imagePrompt = null;

if (splitIdx !== -1) {
  articleMd = raw.slice(0, splitIdx).trim();
  imagePrompt = raw.slice(splitIdx).replace(/\nIMAGE_PROMPT:\s*/, "").trim();
} else {
  // Try without the separator line
  const imgLine = raw.split("\n").findIndex((l) => l.startsWith("IMAGE_PROMPT:"));
  if (imgLine !== -1) {
    imagePrompt = raw.split("\n")[imgLine].replace("IMAGE_PROMPT:", "").trim();
    articleMd = raw.split("\n").slice(0, imgLine).join("\n").trim();
  }
}

// ─── Write article ────────────────────────────────────────────────────────────
const outDir = path.join(root, "content", "blog");
const outFile = path.join(outDir, `${slug}.md`);

if (fs.existsSync(outFile)) {
  const backup = `${outFile}.bak`;
  fs.renameSync(outFile, backup);
  console.warn(`⚠️  Fichier existant sauvegardé : ${backup}`);
}

fs.writeFileSync(outFile, articleMd, "utf-8");

// ─── Output ───────────────────────────────────────────────────────────────────
console.log(`✅ Article créé : content/blog/${slug}.md`);
console.log(`   (~${articleMd.split(" ").length} mots)\n`);

console.log("─".repeat(60));
console.log("🖼  PROMPT IMAGE (coller dans ChatGPT → DALL-E 4)");
console.log("─".repeat(60));
console.log(imagePrompt || "(non généré — relance avec le même sujet)");
console.log("─".repeat(60));
console.log(`\n📁 Enregistre l'image dans : public/blog/${slug}.jpg`);
console.log(`   (format : JPG, ratio 16:9, min 1200×675 px)\n`);

console.log("Prochaine étape :");
console.log(`  1. Ouvre content/blog/${slug}.md et relis`);
console.log(`  2. Colle le prompt image dans ChatGPT, enregistre sous public/blog/${slug}.jpg`);
console.log(`  3. git add content/blog/${slug}.md public/blog/${slug}.jpg`);
console.log(`  4. git commit -m "Add article: ${slug}"`);
console.log(`  5. git push  → Vercel déploie\n`);
