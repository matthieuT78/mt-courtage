import Head from "next/head";
import Link from "next/link";
import type { GetStaticPaths, GetStaticProps } from "next";
import AppHeader from "../../../components/AppHeader";
import AppFooter from "../../../components/AppFooter";
import PretRelaisWizard from "../../../components/PretRelaisWizard";

const MONTANTS = [200000, 250000, 300000, 350000, 400000, 450000, 500000, 550000, 600000, 700000, 800000, 900000, 1000000];

function formatEuroLabel(n: number) {
  if (n >= 1000000) return `${n / 1000000} million €`;
  return `${(n / 1000).toLocaleString("fr-FR")} 000 €`;
}

function formatEuroShort(n: number) {
  if (n >= 1000000) return `${n / 1000000}M €`;
  return `${n / 1000}k €`;
}

type Props = {
  valeur: number;
};

export default function SimulateurPretRelaisValeur({ valeur }: Props) {
  const label = formatEuroLabel(valeur);
  const short = formatEuroShort(valeur);
  const relaisMin = Math.round(valeur * 0.6);
  const relaisMax = Math.round(valeur * 0.8);
  const interetsMin = Math.round((relaisMin * 0.04) / 12);
  const interetsMax = Math.round((relaisMax * 0.04) / 12);

  const title = `Simulateur prêt relais ${label} — Calculette gratuite 2026 | lokt.fr`;
  const description = `Calculez votre prêt relais pour un bien de ${label}. Montant estimé entre ${(relaisMin / 1000).toLocaleString("fr-FR")} 000 € et ${(relaisMax / 1000).toLocaleString("fr-FR")} 000 €, intérêts indicatifs dès ${interetsMin} €/mois. Simulation gratuite, sans engagement.`;

  const otherMontants = MONTANTS.filter((m) => m !== valeur);

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={`https://lokt.fr/simulateur/pret-relais/${valeur}`} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={`https://lokt.fr/simulateur/pret-relais/${valeur}`} />
        <meta property="og:type" content="website" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebPage",
              name: title,
              description,
              url: `https://lokt.fr/simulateur/pret-relais/${valeur}`,
              breadcrumb: {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "lokt.fr", item: "https://lokt.fr" },
                  { "@type": "ListItem", position: 2, name: "Simulateur prêt relais", item: "https://lokt.fr/pret-relais" },
                  { "@type": "ListItem", position: 3, name: `Prêt relais ${label}`, item: `https://lokt.fr/simulateur/pret-relais/${valeur}` },
                ],
              },
            }),
          }}
        />
      </Head>

      <AppHeader />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            <Link href="/pret-relais" className="hover:text-indigo-600">Simulateur prêt relais</Link>
            {" · "}
            <span>{short}</span>
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">
            Prêt relais pour un bien de {label}
          </h1>
          <p className="mt-2 text-slate-600 text-sm leading-relaxed">
            Pour un bien estimé à {label}, la banque avance généralement entre{" "}
            <strong>{(relaisMin / 1000).toLocaleString("fr-FR")} 000 €</strong> et{" "}
            <strong>{(relaisMax / 1000).toLocaleString("fr-FR")} 000 €</strong> (60 % à 80 %, capital restant dû déduit).
            Intérêts intercalaires indicatifs : {interetsMin} €–{interetsMax} €/mois à 4 % annuel.
            Ajustez vos données pour obtenir votre estimation personnalisée.
          </p>
        </div>

        <PretRelaisWizard initialValeur={valeur} />

        <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Simuler un autre montant</h2>
          <div className="flex flex-wrap gap-2">
            {otherMontants.map((m) => (
              <Link
                key={m}
                href={`/simulateur/pret-relais/${m}`}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
              >
                {formatEuroLabel(m)}
              </Link>
            ))}
          </div>
          <Link
            href="/pret-relais"
            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
          >
            ← Simulateur complet (avec nouveau crédit)
          </Link>
        </section>
      </main>

      <AppFooter />
    </>
  );
}

export const getStaticPaths: GetStaticPaths = () => ({
  paths: MONTANTS.map((m) => ({ params: { valeur: String(m) } })),
  fallback: "blocking",
});

export const getStaticProps: GetStaticProps<Props> = ({ params }) => {
  const raw = Number(params?.valeur);
  if (!raw || raw < 50000 || raw > 5000000) return { notFound: true };
  return { props: { valeur: raw } };
};
