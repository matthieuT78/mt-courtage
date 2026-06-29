import Head from "next/head";
import Link from "next/link";
import {
  ArrowRightIcon,
  BookOpenIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  HomeModernIcon,
  LightBulbIcon,
  ShieldCheckIcon,
  SparklesIcon,
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
    <div className="min-h-screen bg-[#f7fbfb] text-slate-950">
      <Head>
        <title>{title} | lokt.fr</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={pageUrl} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      </Head>

      <AppHeader staticMode />

      <main>
        <section className="border-b border-slate-200 bg-white px-4 py-8 sm:py-12">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr),390px] lg:items-start">
            <div className="relative overflow-hidden rounded-[1.75rem] border border-cyan-100 bg-white shadow-sm">
              <div className="absolute inset-y-0 left-0 w-2 bg-cyan-700" aria-hidden />
              <div className="p-6 sm:p-8 lg:p-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[0.72rem] font-semibold text-cyan-800">
                  <SparklesIcon className="h-4 w-4" />
                  Simuler · Décider · Gérer
                </div>
                <h1 className="mt-5 max-w-4xl text-[2.35rem] font-semibold leading-[1.02] tracking-tight text-slate-950 sm:text-5xl">
                  Un outil pour bailleurs qui veulent garder la main.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                  lokt.fr est né d’un constat simple : un propriétaire particulier doit prendre des décisions sérieuses avec des informations dispersées entre tableurs, emails, simulateurs, PDF et rappels oubliés.
                </p>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                  Notre objectif est de relier les deux moments qui comptent vraiment : décider avant d’acheter ou d’arbitrer, puis gérer proprement une fois le locataire en place.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link href="/outil-gestion-locative" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-cyan-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-cyan-800">
                    Découvrir l’outil bailleur
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                  <Link href="/guides" className="inline-flex min-h-11 items-center justify-center rounded-full border border-cyan-200 bg-white px-5 py-2.5 text-sm font-semibold text-cyan-900 hover:bg-cyan-50">
                    Lire les guides
                  </Link>
                </div>
              </div>
            </div>

            <aside className="relative overflow-hidden rounded-[1.75rem] border border-indigo-100 bg-[#172554] p-5 text-white shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-cyan-200">Ce que l’on construit</p>
                  <h2 className="mt-2 text-2xl font-semibold leading-tight">Un cockpit sobre pour les décisions du quotidien.</h2>
                </div>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-cyan-200 ring-1 ring-white/10">
                  <HomeModernIcon className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-5 grid gap-3">
                {[
                  { label: "Mission", value: "Décisions plus claires", icon: LightBulbIcon },
                  { label: "Produit", value: "Gestion locative simple", icon: ClipboardDocumentCheckIcon },
                  { label: "Public", value: "Bailleurs autonomes", icon: UserGroupIcon },
                  { label: "Contact", value: "contact@lokt.fr", icon: ShieldCheckIcon },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/10 px-3 py-3">
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
          <div className="mx-auto max-w-6xl">
            <div className="max-w-3xl">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-cyan-700">Notre angle</p>
              <h2 className="mt-2 text-3xl font-semibold leading-tight text-slate-950">Moins de dispersion, plus de continuité.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Un bailleur n’a pas seulement besoin d’un simulateur ou d’un modèle de document. Il a besoin de comprendre ce qu’il fait, puis de retrouver les bonnes informations au bon moment.
              </p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              ["Décider", "Capacité d’emprunt, rentabilité, prêt relais, plus-value et vision du parc : les calculettes donnent un ordre de grandeur avant de s’engager."],
              ["Gérer", "Biens, baux, locataires, loyers, quittances, candidatures, états des lieux, inventaire, finance et historique restent reliés au bon logement."],
              ["Documenter", "Les événements importants du bail doivent laisser une trace : paiement, relance, travaux, départ, dépôt de garantie et justificatifs."],
              ["Se former", "25 articles de blog et 8 guides pratiques couvrent la fiscalité (LMNP, régime réel, IRL), les contrats, les diagnostics et les procédures du quotidien."],
            ].map(([heading, text], index) => (
              <article key={heading} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className={["mb-4 h-1.5 w-12 rounded-full bg-cyan-500", "mb-4 h-1.5 w-12 rounded-full bg-indigo-500", "mb-4 h-1.5 w-12 rounded-full bg-emerald-500", "mb-4 h-1.5 w-12 rounded-full bg-violet-500"][index]} />
                <h2 className="text-lg font-semibold text-slate-950">{heading}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </article>
            ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-12 sm:pb-16">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr,360px]">
            <article className="overflow-hidden rounded-[1.75rem] border border-cyan-100 bg-white shadow-sm">
              <div className="bg-gradient-to-r from-cyan-700 via-indigo-700 to-slate-950 p-6 text-white sm:p-8">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-cyan-100">Notre méthode</p>
                <h2 className="mt-2 text-3xl font-semibold leading-tight">Des contenus utiles, des calculs lisibles, des limites assumées.</h2>
              </div>
              <div className="grid gap-6 p-6 sm:p-8">
                {[
                  {
                    title: "Des pages pensées pour l’action",
                    text:
                      "Une page sur la quittance doit expliquer quand la générer, ce qu’elle prouve et ce qu’il faut faire en cas de paiement partiel. Une page sur l’IRL doit donner la formule, les conditions et les limites. Nous préférons consolider les sujets plutôt que multiplier des pages creuses.",
                    icon: DocumentTextIcon,
                  },
                  {
                    title: "Des sources quand la règle compte",
                    text:
                      "Lorsque le sujet touche aux règles de location, à la fiscalité LMNP ou aux documents réglementaires, les contenus renvoient vers Service-Public.fr, l’ANIL, l’Insee ou impots.gouv.fr. lokt.fr donne un cadre pratique, pas une consultation juridique personnalisée.",
                    icon: BookOpenIcon,
                  },
                  {
                    title: "Un produit qui suit la vie réelle du bail",
                    text:
                      "Le tableau de bord ne doit pas seulement afficher des données. Il doit montrer ce qui mérite attention : dossiers de candidature reçus, paiement manquant, quittance bloquée, bail à clôturer, dépôt de garantie à traiter ou document à conserver.",
                    icon: CheckCircleIcon,
                  },
                ].map(({ title: cardTitle, text, icon: Icon }) => (
                  <div key={cardTitle} className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[44px,1fr]">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-cyan-700 ring-1 ring-cyan-100">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">{cardTitle}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                    </div>
                  </div>
                ))}

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                  <p className="font-semibold">Avertissement fiscal et juridique</p>
                  <p className="mt-2">
                    Les règles peuvent évoluer et certains cas dépendent du logement, de la commune, du bail ou de la situation fiscale du bailleur. Vérifiez les textes applicables et sollicitez un professionnel lorsque l’enjeu est significatif.
                  </p>
                </div>
              </div>
            </article>

            <aside className="h-max rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Continuer</p>
              <div className="mt-4 grid gap-3">
                <Link href="/outil-gestion-locative" className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm font-semibold text-cyan-950 hover:border-cyan-300 hover:bg-cyan-100">
                  Outil de gestion locative →
                </Link>
                <Link href="/guides" className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm font-semibold text-indigo-950 hover:border-indigo-300 hover:bg-indigo-100">
                  Guides bailleurs →
                </Link>
                <Link href="/blog" className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm font-semibold text-violet-950 hover:border-violet-300 hover:bg-violet-100">
                  Blog & articles →
                </Link>
                <Link href="/modele-quittance-loyer-pdf" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-950 hover:border-emerald-300 hover:bg-emerald-100">
                  Quittance de loyer →
                </Link>
                <Link href="/tarifs" className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-950 hover:border-slate-300 hover:bg-white">
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
