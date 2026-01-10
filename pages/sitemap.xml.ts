export default function Sitemap() {}

export async function getServerSideProps({ res }) {
  const base = "https://lokt.fr";

  const urls = [
    "",
    "/capacite",
    "/pret-relais",
    "/investissement",
    "/parc-immobilier",
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls.map(u => `
      <url>
        <loc>${base}${u}</loc>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
      </url>
    `).join("")}
  </urlset>`;

  res.setHeader("Content-Type", "text/xml");
  res.write(xml);
  res.end();

  return { props: {} };
}
