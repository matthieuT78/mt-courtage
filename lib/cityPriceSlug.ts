// lib/cityPriceSlug.ts
// Utilitaires de slug purs (aucune dépendance Node/Supabase) — à importer
// depuis les composants de page directement (contrairement à
// lib/cityPriceData.ts, qui doit rester réservé à getStaticProps/getStaticPaths
// pour ne pas faire fuiter fs/Supabase dans le bundle client).
export function slugifyCityName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function citySlug(cityName: string, inseeCode: string): string {
  return `${slugifyCityName(cityName)}-${inseeCode}`;
}

// Les codes INSEE font 5 caractères (ex. "75056", "2A004" pour la Corse) :
// toujours le dernier segment du slug, quel que soit le nom de la commune.
export function parseCitySlug(slug: string): string | null {
  const match = slug.match(/-(\w{5})$/i);
  return match ? match[1].toUpperCase() : null;
}
