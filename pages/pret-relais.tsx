// pages/pret-relais.tsx
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import PretRelaisWizard from "../components/PretRelaisWizard";
import { supabase } from "../lib/supabaseClient";

type SimpleUser = {
  email?: string;
  user_metadata?: {
    full_name?: string;
  };
};

// ✅ JSON-LD SAFE: évite tout crash si un schema est undefined/malformé
function JsonLd({ data }: { data: any }) {
  const items = Array.isArray(data) ? data : [data];

  const safeItems = items.filter(
    (x) => x && typeof x === "object" && typeof x["@context"] === "string" && x["@context"].length > 0
  );

  return (
    <>
      {safeItems.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}

function firstNameFromUser(user: SimpleUser | null) {
  const raw = user?.user_metadata?.full_name || (user?.email ? user.email.split("@")[0] : "");
  const first =
    String(raw || "")
      .trim()
      .split(/\s+/)[0] || "";
  if (!first) return "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function FaqItem({ q, a }: { q: string; a: React.ReactNode }) {
  return (
    <details className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between">
        <span className="pr-4">{q}</span>
        <span className="text-slate-400 group-open:rotate-180 transition">▾</span>
      </summary>
      <div className="mt-2 text-sm text-slate-700 leading-relaxed">{a}</div>
    </details>
  );
}

export default function PretRelaisPage() {
  const [user, setUser] = useState<SimpleUser | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchSession = async () => {
      try {
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        if (!isMounted) return;
        setUser(data.session?.user ?? null);
      } catch (e) {
        console.error("Erreur récupération session (pret-relais)", e);
      }
    };

    fetchSession();

    const { data: authListener } =
      supabase?.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) return;
        setUser(session?.user ?? null);
      }) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe?.();
    };
  }, []);

  const displayName = useMemo(() => firstNameFromUser(user), [user]);
  const isLoggedIn = !!user;

  // --- SEO
  const siteUrl = "https://lokt.fr";
  const pagePath = "/pret-relais";
  const pageUrl = `${siteUrl}${pagePath}`;

  // ✅ SEO: Title + Description mieux alignés requêtes ("simulateur", "pret relais")
  const title = "Simulateur de prêt relais (pret relais) — calcul & budget avant vente | lokt.fr";
  const description =
    "Simulateur de prêt relais (pret relais) gratuit : estimez le montant du relais, le nouveau prêt possible, l’apport et votre budget d’achat avant de vendre. Résultat clair en 2 minutes.";

  // OG image (non transparent, OK WhatsApp)
  const ogImage = `${siteUrl}/lokt-logo.jpg`;

  const faqData = useMemo(
    () => [
      {
        q: "Qu’est-ce qu’un prêt relais ?",
        a: "Un prêt relais permet d’acheter un nouveau bien avant d’avoir vendu le bien actuel. La banque avance une partie de la valeur du bien à vendre (après déduction du capital restant dû).",
      },
      {
        q: "Quel montant de relais puis-je obtenir ?",
        a: "Cela dépend notamment de la valeur estimée du bien, du capital restant dû et du pourcentage retenu par la banque (souvent une décote). La calculette vous donne un ordre de grandeur.",
      },
      {
        q: "Comment calculez-vous le budget total ?",
        a: "Le budget est généralement la somme : prêt relais + nouveau prêt + apport. La simulation aide à comparer plusieurs hypothèses (prix de vente, durée, taux, apport).",
      },
      {
        q: "Quels sont les coûts d’un prêt relais ?",
        a: "Selon la formule (relais sec ou relais adossé), vous pouvez avoir des intérêts intercalaires, des frais de dossier et parfois une assurance. La banque peut aussi appliquer une décote sur le prix de vente estimé.",
      },
      {
        q: "Les résultats sont-ils fiables ?",
        a: "Les résultats sont indicatifs : chaque banque a ses règles (durée du relais, franchise, assurance, frais, décote). Utilisez l’outil pour préparer votre scénario et vos échanges.",
      },
      {
        q: "Dois-je créer un compte ?",
        a: "Non pour la V1 : vous pouvez utiliser la calculette librement. Certaines fonctionnalités à venir pourront nécessiter un compte.",
      },
    ],
    []
  );

  // ✅ mêmes “modifs SEO” que /capacite :
  // - JSON-LD enrichi avec SoftwareApplication (plutôt que Service)
  // - Breadcrumb
  // - Contenu SEO visible : “comment ça marche”, “exemple rapide”
  const jsonLd = useMemo(() => {
    const webPage = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: title,
      url: pageUrl,
      description,
      inLanguage: "fr-FR",
      isPartOf: {
        "@type": "WebSite",
        name: "lokt.fr",
        url: siteUrl,
      },
    };

    const app = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Simulateur de prêt relais",
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      url: pageUrl,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
      },
      provider: {
        "@type": "Organization",
        name: "lokt.fr",
        url: siteUrl,
        logo: ogImage,
      },
      areaServed: "FR",
    };

    const breadcrumb = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${siteUrl}/` },
        { "@type": "ListItem", position: 2, name: "Prêt relais", item: pageUrl },
      ],
    };

    const faqPage = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqData.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    };

    return [webPage, app, breadcrumb, faqPage];
  }, [title, description, pageUrl, siteUrl, ogImage, faqData]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={pageUrl} />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="lokt.fr" />
        <meta property="og:locale" content="fr_FR" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:secure_url" content={ogImage} />
        <meta property="og:image:alt" content="Simulateur de prêt relais — lokt.fr" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />

        {/* ✅ JSON-LD (SAFE) */}
        <JsonLd data={jsonLd} />
      </Head>

      <AppHeader />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.7rem] sm:text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                CALCULETTE PRÊT RELAIS
              </p>

              <span className="hidden sm:inline-flex items-center rounded-full border border-amber-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-amber-700">
                lokt.fr
              </span>
            </div>

            {/* ✅ H1 “mot-clé exact” */}
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
              {isLoggedIn && displayName
                ? `Bonjour ${displayName} — Simulateur de prêt relais : estimez votre budget avant de vendre.`
                : "Simulateur de prêt relais — estimez votre budget avant de vendre."}
            </h1>

            {/* ✅ Intro enrichie + variante sans accent */}
            <p className="text-xs text-slate-600 max-w-2xl">
              Ce <strong>simulateur de prêt relais</strong>
              vous aide à estimer le <strong>montant du relais</strong>, votre <strong>nouveau prêt possible</strong> et le{" "}
              <strong>budget d’achat total</strong>. Parcours guidé : valeur du bien actuel, capital restant dû, décote,
              apport, puis paramètres du futur prêt.
            </p>

            {/* Maillage interne discret (comme capacité) */}
            <div className="pt-1 flex flex-wrap gap-2">
              <Link href="/" className="text-xs font-semibold underline decoration-amber-200 text-amber-800">
                Accueil →
              </Link>
              <Link href="/capacite" className="text-xs font-semibold underline decoration-amber-200 text-amber-800">
                Capacité d’emprunt →
              </Link>
              <Link href="/investissement" className="text-xs font-semibold underline decoration-amber-200 text-amber-800">
                Rentabilité locative →
              </Link>
              <Link
                href="/parc-immobilier"
                className="text-xs font-semibold underline decoration-amber-200 text-amber-800"
              >
                Parc immobilier →
              </Link>
            </div>
          </section>

          {/* Calculette */}
          <PretRelaisWizard showSaveButton={isLoggedIn} />

          {/* Bloc SEO discret (enrichi comme capacité) */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Simulateur de prêt relais : acheter avant d’avoir vendu
              </h2>

              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Cette calculette de prêt relais vous permet d’estimer le montant de relais mobilisable à partir de la
                valeur de votre bien actuel, du capital restant dû et du pourcentage retenu par la banque. Elle projette
                ensuite votre capacité pour un nouveau prêt et votre budget d’achat total (relais + nouveau prêt +
                apport). Utile si vous cherchez un <strong>calcul pret relais</strong> rapide avant rendez-vous banque.
              </p>

              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Les résultats restent indicatifs : chaque banque applique ses propres règles (durée du relais, franchise,
                intérêts intercalaires, assurance, frais). Utilisez l’outil pour comparer des scénarios et préparer un
                échange plus efficace avec un conseiller.
              </p>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-900">Comment fonctionne un prêt relais ?</h2>
              <ul className="mt-2 text-sm text-slate-600 leading-relaxed list-disc pl-5 space-y-1">
                <li>
                  La banque estime la <strong>valeur de votre bien actuel</strong> et applique souvent une{" "}
                  <strong>décote</strong> (prudence).
                </li>
                <li>
                  Elle retire le <strong>capital restant dû</strong> pour déterminer la base de calcul du relais.
                </li>
                <li>
                  Le budget global combine souvent : <strong>relais</strong> + <strong>nouveau prêt</strong> +{" "}
                  <strong>apport</strong>.
                </li>
                <li>
                  Selon la formule, vous payez des <strong>intérêts intercalaires</strong> (mensuels) jusqu’à la vente.
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Exemple rapide</h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Exemple indicatif : si votre bien vaut <strong>400 000 €</strong> et qu’il reste <strong>120 000 €</strong>{" "}
                de crédit, la banque peut avancer un relais calculé sur une base décotée (ex : 70% à 80% de la valeur),
                puis compléter avec un nouveau prêt selon votre capacité. La simulation sert à comparer vos hypothèses
                (prix de vente, durée, taux, apport).
              </p>
            </div>

            <p className="text-xs text-slate-500">
              Note : chaque banque a ses règles internes (décote, durée, franchise, assurance). L’outil donne un ordre de
              grandeur utile pour arbitrer.
            </p>
          </section>

          {/* FAQ */}
          <section id="faq" className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-50 to-white" />
            <div className="p-6 sm:p-8">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.7rem] sm:text-xs font-semibold uppercase tracking-[0.22em] text-slate-600">
                    FAQ
                  </p>
                  <h2 className="text-lg sm:text-xl font-semibold text-slate-900 mt-1">
                    Questions fréquentes sur le prêt relais
                  </h2>
                  <p className="text-sm text-slate-600 mt-2 max-w-3xl">
                    Des réponses rapides pour comprendre le relais, le budget total et les hypothèses.
                  </p>
                </div>

                <span className="hidden sm:inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-slate-600">
                  lokt.fr
                </span>
              </div>

              <div className="mt-6 grid gap-3">
                {faqData.map((f) => (
                  <FaqItem key={f.q} q={f.q} a={<>{f.a}</>} />
                ))}
              </div>

              <p className="mt-6 text-xs text-slate-500">
                Une question ? Écrivez-nous à{" "}
                <a className="underline" href="mailto:contact@lokt.fr">
                  contact@lokt.fr
                </a>
                .
              </p>
            </div>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}

