import Head from "next/head";
import Link from "next/link";
import {
  BookOpenIcon,
  CheckCircleIcon,
  HomeModernIcon,
  ShieldCheckIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import AppFooter from "../components/AppFooter";
import AppHeader from "../components/AppHeader";

const siteUrl = "https://lokt.fr";
const pageUrl = `${siteUrl}/a-propos`;
const title = "À propos de lokt.fr : éditeur, mission et fiabilité";
const description =
  "Découvrez lokt.fr, outil français pour aider les propriétaires bailleurs à simuler, décider et gérer leurs locations avec des contenus vérifiés et sourcés.";

export default function AProposPage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: title,
    description,
    url: pageUrl,
    mainEntity: {
      "@type": "Organization",
      name: "lokt.fr",
      url: siteUrl,
      email: "contact@lokt.fr",
    },
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-950">
      <Head>
        <title>{title} | lokt.fr</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={pageUrl} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      </Head>

      <AppHeader />

      <main>
        <section className="border-b border-slate-200 bg-white px-4 py-8 sm:py-12">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr),420px] lg:items-stretch">
            <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
              <div className="absolute inset-y-0 left-0 w-2 bg-slate-950" aria-hidden />
              <div className="p-6 sm:p-8 lg:p-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[0.72rem] font-semibold text-slate-700">
                  <ShieldCheckIcon className="h-4 w-4 text-slate-950" />
                  Identité et fiabilité
                </div>
                <h1 className="mt-5 max-w-4xl text-[2.35rem] font-semibold leading-[1.02] tracking-tight text-slate-950 sm:text-5xl">
                  Aider les bailleurs à gérer plus proprement.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                  lokt.fr relie les calculettes immobilières et l’espace bailleur pour accompagner un propriétaire avant l’achat, puis pendant la location.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link href="/outil-gestion-locative" className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">
                    Découvrir l’outil bailleur
                  </Link>
                  <Link href="/guides" className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                    Lire les guides
                  </Link>
                </div>
              </div>
            </div>

            <aside className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-400">Ce que l’on construit</p>
                  <h2 className="mt-2 text-2xl font-semibold leading-tight">Un outil sobre pour propriétaires autonomes.</h2>
                </div>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-cyan-200">
                  <HomeModernIcon className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-5 grid gap-3">
                {[
                  { label: "Mission", value: "Simuler puis gérer", icon: HomeModernIcon },
                  { label: "Public", value: "Bailleurs particuliers", icon: UserGroupIcon },
                  { label: "Contenus", value: "Guides sourcés", icon: BookOpenIcon },
                  { label: "Contact", value: "contact@lokt.fr", icon: ShieldCheckIcon },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-cyan-200" />
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="px-4 py-12 sm:py-16">
          <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
            {[
              ["Décider", "Capacité d’emprunt, rentabilité, prêt relais, plus-value et parc immobilier."],
              ["Gérer", "Biens, baux, locataires, loyers, quittances, états des lieux, inventaire et finance."],
              ["Rassurer", "Des guides pratiques avec sources officielles lorsque le sujet touche au droit ou à la fiscalité."],
            ].map(([heading, text]) => (
              <article key={heading} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-950">{heading}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="px-4 pb-12 sm:pb-16">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr,360px]">
            <article className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
              <div className="bg-slate-950 p-6 text-white sm:p-8">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-cyan-200">Fiabilité</p>
                <h2 className="mt-2 text-3xl font-semibold leading-tight">Des contenus utiles, pas des promesses magiques.</h2>
              </div>
              <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-2">
                <div className="space-y-3 text-sm leading-7 text-slate-700">
                  <p>
                    Les pages et guides lokt.fr donnent des repères pratiques aux bailleurs. Ils ne remplacent pas un conseil juridique,
                    fiscal ou comptable individualisé.
                  </p>
                  <p>
                    Lorsque le sujet touche aux règles de location, à la fiscalité LMNP ou aux documents réglementaires, les guides
                    renvoient vers des sources officielles comme Service-Public.fr, ANIL ou impots.gouv.fr.
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                  <p className="font-semibold">Avertissement fiscal et juridique</p>
                  <p className="mt-2">
                    Les règles peuvent évoluer et certains cas dépendent du logement, de la commune, du bail ou de la situation fiscale du bailleur.
                    Vérifiez les textes applicables et sollicitez un professionnel lorsque l’enjeu est significatif.
                  </p>
                </div>
              </div>
            </article>

            <aside className="h-max rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Continuer</p>
              <div className="mt-4 grid gap-3">
                <Link href="/outil-gestion-locative" className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-950 hover:border-indigo-200 hover:bg-indigo-50">
                  Outil de gestion locative →
                </Link>
                <Link href="/guides" className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-950 hover:border-indigo-200 hover:bg-indigo-50">
                  Ressources bailleurs →
                </Link>
                <Link href="/tarifs" className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-950 hover:border-indigo-200 hover:bg-indigo-50">
                  Tarifs →
                </Link>
              </div>
            </aside>
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}
