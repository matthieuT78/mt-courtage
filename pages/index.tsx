// pages/index.tsx
import Head from "next/head";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import { supabase } from "../lib/supabaseClient";
import { firstNameFromUser } from "../lib/userDisplay";

type SimpleUser = {
  email?: string;
  user_metadata?: { full_name?: string; first_name?: string; given_name?: string };
};

// ✅ JSON-LD SAFE (évite crash si schéma malformé)
function JsonLd({ data }: { data: any }) {
  const items = Array.isArray(data) ? data : [data];
  const safeItems = items.filter(
    (x) => x && typeof x === "object" && typeof x["@context"] === "string" && x["@context"].length > 0
  );

  return (
    <>
      {safeItems.map((schema, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
    </>
  );
}

function Icon({
  name,
  className = "h-6 w-6",
}: {
  name: "loan" | "bridge" | "yield" | "portfolio" | "sale" | "bailleur" | "spark" | "shield" | "bank" | "wand" | "x";
  className?: string;
}) {
  const common = "fill-none stroke-current stroke-[1.7]";
  switch (name) {
    case "loan":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path className={common} d="M6 8h12M7 12h10M8 16h8" strokeLinecap="round" />
          <path
            className={common}
            d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v11A3.5 3.5 0 0 1 15.5 21h-7A3.5 3.5 0 0 1 5 17.5v-11Z"
          />
        </svg>
      );
    case "bridge":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path className={common} d="M3 18h18" strokeLinecap="round" />
          <path className={common} d="M5 18V10a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v8" />
          <path className={common} d="M8 12h8" strokeLinecap="round" />
        </svg>
      );
    case "yield":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path className={common} d="M4 19V5" strokeLinecap="round" />
          <path className={common} d="M4 19h16" strokeLinecap="round" />
          <path className={common} d="M7 15l3-4 3 2 4-6" strokeLinecap="round" strokeLinejoin="round" />
          <path className={common} d="M17 7h3v3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "portfolio":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path className={common} d="M9 7V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1" />
          <path
            className={common}
            d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8Z"
          />
          <path className={common} d="M4 12h16" strokeLinecap="round" />
        </svg>
      );
    case "sale":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path className={common} d="M20 13V7a2 2 0 0 0-2-2h-6L4 13l7 7 9-9Z" strokeLinejoin="round" />
          <path className={common} d="M15.5 9.5h.01" strokeLinecap="round" />
        </svg>
      );
    case "bailleur":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path className={common} d="M4 20V9l8-5 8 5v11" strokeLinejoin="round" />
          <path className={common} d="M9 20v-6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6" strokeLinejoin="round" />
        </svg>
      );
    case "spark":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path
            className={common}
            d="M12 2l1.6 6.1L20 10l-6.4 1.9L12 18l-1.6-6.1L4 10l6.4-1.9L12 2Z"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path
            className={common}
            d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4Z"
            strokeLinejoin="round"
          />
          <path className={common} d="M9 12l2 2 4-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "bank":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path className={common} d="M4 10h16" strokeLinecap="round" />
          <path className={common} d="M6 10v8M10 10v8M14 10v8M18 10v8" strokeLinecap="round" />
          <path className={common} d="M3 20h18" strokeLinecap="round" />
          <path className={common} d="M12 3 3.5 8h17L12 3Z" strokeLinejoin="round" />
        </svg>
      );
    case "wand":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path className={common} d="M4 20 15 9" strokeLinecap="round" />
          <path className={common} d="M12 6l6 6" strokeLinecap="round" />
          <path className={common} d="M16 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z" strokeLinejoin="round" />
        </svg>
      );
    case "x":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path className={common} d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
        </svg>
      );
  }
}

/**
 * Mini-illustrations “fintech sticker” pour les tuiles.
 */
function Sticker({
  kind,
  className = "h-12 w-12",
}: {
  kind: "calc" | "loan" | "bridge" | "yield" | "portfolio" | "sale" | "bailleur";
  className?: string;
}) {
  const map: Record<string, { g1: string; g2: string }> = {
    calc: { g1: "#0f172a", g2: "#4f46e5" },
    loan: { g1: "#2563eb", g2: "#06b6d4" },
    bridge: { g1: "#06b6d4", g2: "#4f46e5" },
    yield: { g1: "#10b981", g2: "#06b6d4" },
    portfolio: { g1: "#8b5cf6", g2: "#22c55e" },
    sale: { g1: "#f59e0b", g2: "#ef4444" },
    bailleur: { g1: "#0f172a", g2: "#64748b" },
  };
  const c = map[kind];

  return (
    <div className={`relative ${className}`} aria-hidden>
      <svg viewBox="0 0 64 64" className="h-full w-full drop-shadow-sm">
        <defs>
          <linearGradient id={`g-${kind}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={c.g1} />
            <stop offset="1" stopColor={c.g2} />
          </linearGradient>
        </defs>

        <path
          d="M20 6h24a14 14 0 0 1 14 14v24a14 14 0 0 1-14 14H20A14 14 0 0 1 6 44V20A14 14 0 0 1 20 6Z"
          fill={`url(#g-${kind})`}
          opacity="0.95"
        />
        <path
          d="M20 6h24a14 14 0 0 1 14 14v24a14 14 0 0 1-14 14H20A14 14 0 0 1 6 44V20A14 14 0 0 1 20 6Z"
          fill="none"
          stroke="rgba(255,255,255,0.65)"
          strokeWidth="2"
        />

        <path
          d="M18 18c8-8 18-10 28-6"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="5"
          strokeLinecap="round"
        />

        {kind === "calc" ? (
          <>
            <rect x="18" y="14" width="28" height="36" rx="7" fill="rgba(255,255,255,0.92)" />
            <rect x="23" y="20" width="18" height="7" rx="2" fill="rgba(15,23,42,0.22)" />
            <circle cx="25" cy="34" r="2.2" fill="rgba(15,23,42,0.55)" />
            <circle cx="32" cy="34" r="2.2" fill="rgba(15,23,42,0.55)" />
            <circle cx="39" cy="34" r="2.2" fill="rgba(15,23,42,0.55)" />
            <circle cx="25" cy="42" r="2.2" fill="rgba(15,23,42,0.55)" />
            <circle cx="32" cy="42" r="2.2" fill="rgba(15,23,42,0.55)" />
            <path d="M39 40v4M37 42h4" stroke="rgba(15,23,42,0.58)" strokeWidth="2.6" strokeLinecap="round" />
          </>
        ) : kind === "loan" ? (
          <>
            <path d="M18 27h28" stroke="rgba(255,255,255,0.92)" strokeWidth="4" strokeLinecap="round" />
            <path d="M21 27v17M28 27v17M36 27v17M43 27v17" stroke="rgba(255,255,255,0.9)" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M17 47h30" stroke="rgba(255,255,255,0.92)" strokeWidth="4" strokeLinecap="round" />
            <path d="M32 14 18 23h28L32 14Z" fill="rgba(255,255,255,0.9)" />
            <path d="M32 19v5" stroke="rgba(15,23,42,0.42)" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M26 35h12" stroke="rgba(15,23,42,0.25)" strokeWidth="2.5" strokeLinecap="round" />
          </>
        ) : kind === "bridge" ? (
          <>
            <path d="M18 40h28" stroke="rgba(255,255,255,0.92)" strokeWidth="4.5" strokeLinecap="round" />
            <path
              d="M20 40V30a8 8 0 0 1 8-8h8a8 8 0 0 1 8 8v10"
              fill="none"
              stroke="rgba(255,255,255,0.92)"
              strokeWidth="4"
              strokeLinejoin="round"
            />
            <path d="M28 32h8" stroke="rgba(15,23,42,0.35)" strokeWidth="3" strokeLinecap="round" />
          </>
        ) : kind === "yield" ? (
          <>
            <path d="M20 44V20" stroke="rgba(255,255,255,0.9)" strokeWidth="4" strokeLinecap="round" />
            <path d="M20 44h26" stroke="rgba(255,255,255,0.9)" strokeWidth="4" strokeLinecap="round" />
            <path
              d="M24 38l7-10 6 4 7-12"
              fill="none"
              stroke="rgba(15,23,42,0.55)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="44" cy="20" r="3.2" fill="rgba(255,255,255,0.9)" />
          </>
        ) : kind === "portfolio" ? (
          <>
            <rect x="16" y="24" width="32" height="24" rx="7" fill="rgba(255,255,255,0.92)" />
            <path
              d="M22 24v-2a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v2"
              fill="none"
              stroke="rgba(15,23,42,0.7)"
              strokeWidth="3"
            />
            <path d="M16 34h32" stroke="rgba(15,23,42,0.28)" strokeWidth="3" />
          </>
        ) : kind === "sale" ? (
          <>
            <path d="M46 28V22a4 4 0 0 0-4-4H30L18 30l12 12 16-16Z" fill="rgba(255,255,255,0.92)" />
            <circle cx="38" cy="26" r="3" fill="rgba(15,23,42,0.28)" />
            <path d="M22 36l6 6" stroke="rgba(15,23,42,0.22)" strokeWidth="4" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path
              d="M18 44V28l14-9 14 9v16"
              fill="none"
              stroke="rgba(255,255,255,0.92)"
              strokeWidth="4"
              strokeLinejoin="round"
            />
            <path
              d="M27 44V34a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v10"
              fill="none"
              stroke="rgba(255,255,255,0.92)"
              strokeWidth="4"
              strokeLinejoin="round"
            />
          </>
        )}
      </svg>

      <div className="pointer-events-none absolute -bottom-1 -right-1 h-5 w-5 rounded-br-2xl bg-white/50 blur-[0.5px]" />
    </div>
  );
}

function StatPill({
  label,
  value,
  icon,
  delayClass = "",
}: {
  label: string;
  value: string;
  icon: "spark" | "shield" | "bank" | "wand";
  delayClass?: string;
}) {
  return (
    <div
      className={`anim-fadeUp ${delayClass} rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 shadow-sm backdrop-blur`}
    >
      <div className="flex items-center gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-2 text-slate-900">
          <Icon name={icon} className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <p className="text-sm font-semibold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: ReactNode }) {
  return (
    <details className="group rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <summary className="cursor-pointer list-none font-semibold text-slate-950 flex items-center justify-between">
        <span className="pr-6">{q}</span>
        <span className="text-slate-400 group-open:rotate-180 transition">▾</span>
      </summary>
      <div className="mt-3 text-sm text-slate-600 leading-relaxed">{a}</div>
    </details>
  );
}

/**
 * Modal “Choisir une calculette” (ouverte par le CTA principal)
 */
function ToolPickerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const items: Array<{
    title: string;
    oneLiner: string;
    href: string;
    icon: "loan" | "bridge" | "yield" | "portfolio" | "sale";
    badge?: string;
  }> = [
    // ✅ badge "Gratuit" supprimé
    { title: "Capacité d’emprunt", oneLiner: "Budget & mensualité en 2 min.", href: "/capacite", icon: "loan" },
    { title: "Prêt relais", oneLiner: "Acheter avant de vendre.", href: "/pret-relais", icon: "bridge" },
    { title: "Rentabilité locative", oneLiner: "Cash-flow & rendement.", href: "/investissement", icon: "yield" },
    { title: "Parc immobilier", oneLiner: "Vision consolidée multi-biens.", href: "/parc-immobilier", icon: "portfolio" },
    { title: "Plus-value immobilière", oneLiner: "Estimer le cash net.", href: "/plus-value-vente-immobiliere", icon: "sale" },
  ];

  return (
    <div className="fixed inset-0 z-[80]">
      <button aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2">
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 1) 1px, transparent 0)",
              backgroundSize: "22px 22px",
            }}
          />
          <div className="relative p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="rounded-[2rem] border border-white/60 bg-white/88 p-6 shadow-2xl shadow-slate-900/10 backdrop-blur sm:p-8">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Démarrer</p>
                <h3 className="mt-1 text-lg sm:text-xl font-semibold text-slate-900">Choisir une calculette</h3>
                <p className="mt-1 text-sm text-slate-600">Sélectionnez l’outil adapté à votre situation.</p>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 rounded-full border border-slate-200 bg-white p-2 text-slate-700 hover:shadow-sm"
                aria-label="Fermer la fenêtre"
              >
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {items.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={onClose as any}
                  className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 hover:shadow-sm"
                >
                  <Sticker kind={it.icon} className="h-11 w-11" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{it.title}</p>
                      {it.badge ? (
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[0.65rem] font-semibold text-slate-700">
                          {it.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600">{it.oneLiner}</p>
                  </div>
                  <span className="text-slate-400 transition group-hover:translate-x-0.5">→</span>
                </Link>
              ))}
            </div>

            <div className="mt-5 text-xs text-slate-500">
              Astuce : commencez par la capacité d’emprunt si vous ne savez pas par où démarrer.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchSession = async () => {
      try {
        if (!supabase) return;
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!isMounted) return;
        setUser(data.session?.user ?? null);
      } catch (e) {
        console.error("Erreur récupération session (home)", e);
      }
    };

    fetchSession();

    const {
      data: { subscription },
    } =
      supabase?.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) return;
        setUser(session?.user ?? null);
      }) ?? { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      isMounted = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  const isLoggedIn = !!user;
  const displayName = useMemo(() => firstNameFromUser(user), [user]);

  // SEO
  const siteUrl = "https://lokt.fr";
  const pageUrl = `${siteUrl}/`;

  const title =
    "Gestion locative gratuite et simulateurs immobiliers | lokt.fr";
  const description =
    "lokt.fr aide les propriétaires à gérer gratuitement un logement locatif et à simuler leurs projets immobiliers : baux, quittances, états des lieux, loyers, finance, capacité d’emprunt et rentabilité.";
  const ogImage = `${siteUrl}/lokt-logo.jpg`;

  const faqData = useMemo(
    () => [
      {
        q: "À quoi sert l’espace bailleur lokt.fr ?",
        a: "L’espace bailleur aide un propriétaire à centraliser sa gestion locative : bien, bail, locataire, loyers, quittances, états des lieux, inventaire, finance et alertes importantes.",
      },
      {
        q: "Est-ce que lokt.fr est gratuit ?",
        a: "Oui. Vous pouvez gérer gratuitement un premier logement actif et utiliser les simulateurs immobiliers. Aucune carte bancaire n’est demandée pour démarrer.",
      },
      {
        q: "Puis-je générer des quittances de loyer avec lokt.fr ?",
        a: "Oui. L’outil permet de suivre les paiements, générer des quittances PDF, les archiver et préparer un workflow d’envoi au locataire depuis l’espace bailleur.",
      },
      {
        q: "L’outil remplace-t-il un contrat de location signé ?",
        a: "Non. lokt.fr sert à gérer et suivre la location au quotidien. Le contrat de location reste un document juridique distinct, signé par les parties avec les annexes nécessaires.",
      },
      {
        q: "Est-ce adapté à un propriétaire avec un seul bien ?",
        a: "Oui. La logique produit est pensée pour être utile dès le premier logement : bail, locataire, quittances, état des lieux, inventaire et suivi financier simple.",
      },
      {
        q: "Quels simulateurs immobiliers sont disponibles ?",
        a: "lokt.fr propose des simulateurs pour la capacité d’emprunt, le prêt relais, la rentabilité locative, la plus-value immobilière et l’analyse d’un parc immobilier.",
      },
      {
        q: "Les résultats des simulateurs sont-ils fiables ?",
        a: "Les résultats sont indicatifs. Ils reposent sur les hypothèses saisies et servent à comparer des scénarios de manière cohérente, pas à fournir une promesse bancaire ou fiscale.",
      },
      {
        q: "Dois-je créer un compte ?",
        a: "Les simulateurs peuvent être utilisés librement. Un compte est nécessaire pour accéder à l’espace bailleur et retrouver votre gestion locative.",
      },
      {
        q: "Que faites-vous de mes données ?",
        a: "Les données saisies servent à faire fonctionner le service et à retrouver vos informations. Aucune donnée personnelle n’est vendue à des tiers.",
      },
      {
        q: "Comment vous contacter ?",
        a: "Vous pouvez nous écrire à contact@lokt.fr. Nous répondons manuellement.",
      },
    ],
    []
  );

    const jsonLd = useMemo(() => {
    const webSite = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "lokt.fr",
      url: siteUrl,
    };

    const organization = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "lokt.fr",
      url: siteUrl,
      logo: ogImage,
      email: "contact@lokt.fr",
    };

    const softwareApplication = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "lokt.fr - Outil de gestion locative",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: `${siteUrl}/outil-gestion-locative`,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
        description: "Outil gratuit pour gérer un premier logement locatif.",
      },
    };

    const faqPage = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqData.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: String(f.a),
        },
      })),
    };

    return [webSite, organization, softwareApplication, faqPage];
  }, [faqData, ogImage, siteUrl]);

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
        <meta property="og:image:alt" content="lokt.fr — gestion locative gratuite et simulateurs immobiliers" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />

        <JsonLd data={jsonLd} />

        {/* Animations HERO (fade + micro-translation) */}
        <style jsx global>{`
          @media (prefers-reduced-motion: reduce) {
            .anim-fadeUp {
              animation: none !important;
              transform: none !important;
              opacity: 1 !important;
            }
          }

          @keyframes fadeUp {
            0% {
              opacity: 0;
              transform: translate3d(0, 10px, 0);
            }
            100% {
              opacity: 1;
              transform: translate3d(0, 0, 0);
            }
          }

          .anim-fadeUp {
            opacity: 0;
            animation: fadeUp 700ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
            will-change: transform, opacity;
          }

          .d-0 {
            animation-delay: 0ms;
          }
          .d-1 {
            animation-delay: 80ms;
          }
          .d-2 {
            animation-delay: 160ms;
          }
          .d-3 {
            animation-delay: 240ms;
          }
          .d-4 {
            animation-delay: 320ms;
          }
          .d-5 {
            animation-delay: 400ms;
          }
          .d-6 {
            animation-delay: 480ms;
          }
        `}</style>
      </Head>

      <AppHeader />

      <ToolPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} />

      <main className="flex-1 bg-[#f6f9fc] text-slate-950">
        <section className="relative overflow-hidden px-4 pb-16 pt-14 sm:pb-24 sm:pt-20">
          <div aria-hidden className="absolute inset-x-0 top-0 h-[560px] -skew-y-6 bg-gradient-to-br from-[#635bff] via-[#00d4ff] to-[#00e5a8] origin-top-left" />
          <div aria-hidden className="absolute inset-x-0 top-0 h-[560px] -skew-y-6 bg-[linear-gradient(120deg,rgba(255,255,255,.72)_0%,transparent_34%),linear-gradient(75deg,transparent_54%,rgba(255,184,0,.44)_100%)] origin-top-left" />
          <div aria-hidden className="absolute left-0 top-0 h-full w-full bg-gradient-to-r from-[#635bff]/70 via-[#00b8e8]/35 to-transparent lg:w-[68%]" />

          <div className="relative mx-auto max-w-6xl">
            <div className="grid gap-10 lg:grid-cols-[0.92fr,1.08fr] lg:items-center">
              <div>
                <div className="anim-fadeUp d-0 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[0.72rem] font-semibold text-slate-700 shadow-sm backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Deux outils pour décider et gérer
                </div>

                <h1 className="anim-fadeUp d-1 mt-6 max-w-3xl text-4xl font-semibold leading-[1.02] tracking-tight text-white sm:text-6xl">
                  {isLoggedIn && displayName ? `Bonjour ${displayName}.` : "Simuler un projet. Gérer une location."}
                </h1>

                <p className="anim-fadeUp d-2 mt-6 max-w-xl text-base leading-7 text-white/90 sm:text-lg">
                  lokt.fr réunit les calculettes pour décider avant d’acheter, vendre ou investir, et un espace bailleur pour piloter le logement une fois loué.
                </p>

                <div className="anim-fadeUp d-3 mt-8 flex flex-wrap items-center gap-3">
                  {isLoggedIn ? (
                    <Link href="/espace-bailleur" className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 hover:bg-slate-800">
                      Accéder à l’espace bailleur →
                    </Link>
                  ) : (
                    <Link href="/mon-compte?mode=register&redirect=/espace-bailleur" className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 hover:bg-slate-800">
                      Créer mon espace bailleur gratuit →
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="inline-flex items-center justify-center rounded-full bg-white/90 px-5 py-2.5 text-sm font-semibold text-[#3f37c9] shadow-sm backdrop-blur hover:bg-white"
                  >
                    Lancer une simulation →
                  </button>
                </div>
              </div>

              <div className="anim-fadeUp d-4">
                <div className="relative rounded-[2rem] bg-white/35 p-2 shadow-2xl shadow-slate-900/20 backdrop-blur">
                  <div className="overflow-hidden rounded-[1.55rem] border border-white/60 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                        <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[0.68rem] font-semibold text-slate-600">Vue d’ensemble lokt.fr</span>
                    </div>

                    <div className="p-4 sm:p-6">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#635bff]">Calculette</p>
                              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Capacité d’emprunt</h2>
                              <p className="mt-1 text-xs leading-5 text-slate-500">Combien emprunter et quelle mensualité prévoir.</p>
                            </div>
                            <Sticker kind="loan" className="h-11 w-11 shrink-0" />
                          </div>
                          <div className="mt-4 grid gap-2">
                            {[
                              ["Mensualité max", "1 470 €"],
                              ["Emprunt possible", "302 000 €"],
                              ["Budget achat", "327 000 €"],
                            ].map(([label, value]) => (
                              <div key={label} className="flex items-center justify-between rounded-2xl bg-white px-3 py-2">
                                <span className="text-xs text-slate-500">{label}</span>
                                <span className="text-sm font-semibold text-slate-950">{value}</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-4">
                            <div className="flex items-center justify-between text-[0.68rem] font-semibold text-slate-500">
                              <span>Taux d’effort</span>
                              <span>35 %</span>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                              <div className="h-full w-[70%] rounded-full bg-gradient-to-r from-[#635bff] to-[#00d4ff]" />
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-emerald-700">Espace bailleur</p>
                              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Cockpit mensuel</h2>
                              <p className="mt-1 text-xs leading-5 text-slate-500">Loyers, quittances, bail et finance au même endroit.</p>
                            </div>
                            <Sticker kind="bailleur" className="h-11 w-11 shrink-0" />
                          </div>
                          <div className="mt-4 grid gap-2">
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2">
                              <p className="text-xs font-semibold text-amber-950">2 loyers attendus</p>
                              <p className="mt-0.5 text-[0.68rem] text-amber-800">1 complet, 1 incomplet à relancer</p>
                            </div>
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                              <p className="text-xs font-semibold text-emerald-950">3 quittances suivies</p>
                              <p className="mt-0.5 text-[0.68rem] text-emerald-800">PDF, archive et email locataire</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-[0.68rem] text-slate-500">Finance</p>
                                <p className="mt-1 text-sm font-semibold text-slate-950">+1 840 €</p>
                              </div>
                              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2">
                                <p className="text-[0.68rem] text-sky-700">Bail</p>
                                <p className="mt-1 text-sm font-semibold text-sky-950">À surveiller</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-[1.35rem] border border-slate-200 bg-white p-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                          {[
                            ["Décider", "Capacité, rentabilité, prêt relais."],
                            ["Gérer", "Baux, loyers, quittances, relances."],
                            ["Archiver", "PDF, états des lieux, inventaire."],
                          ].map(([titleStep, textStep]) => (
                            <div key={titleStep} className="rounded-2xl bg-slate-50 px-3 py-3">
                              <p className="text-sm font-semibold text-slate-950">{titleStep}</p>
                              <p className="mt-1 text-xs leading-5 text-slate-500">{textStep}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-6xl space-y-6">
            <div className="grid gap-5 lg:grid-cols-2">
              <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <Sticker kind="bailleur" className="h-14 w-14" />
                <p className="mt-5 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Outil bailleur</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Gérer un bien en location</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Bail, locataire, loyers, quittances PDF, relances, état des lieux, inventaire, finance et alertes restent reliés au bon logement.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  {isLoggedIn ? (
                    <Link href="/espace-bailleur" className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                      Accéder à l’espace bailleur →
                    </Link>
                  ) : (
                    <>
                      <Link href="/mon-compte?mode=register&redirect=/espace-bailleur" className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                        Créer mon espace bailleur gratuit →
                      </Link>
                      <Link href="/mon-compte?mode=login&redirect=/espace-bailleur" className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                        J’ai déjà un compte
                      </Link>
                    </>
                  )}
                </div>
              </article>

              <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <Sticker kind="calc" className="h-14 w-14" />
                <p className="mt-5 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-cyan-600">Projet immobilier</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Combien puis-je emprunter ?</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Calculez une mensualité réaliste, votre capacité d’emprunt et le budget d’achat possible avant de visiter ou de négocier.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button type="button" onClick={() => setPickerOpen(true)} className="rounded-full bg-[#635bff] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#524bd8]">
                    Choisir une simulation →
                  </button>
                  <Link href="/calculettes" className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                    Voir les calculettes
                  </Link>
                </div>
              </article>
            </div>

            <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
              <div className="grid gap-0 lg:grid-cols-[0.9fr,1.1fr]">
                <div className="p-6 sm:p-8">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Workflow</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Un système lisible pour ne rien oublier.</h2>
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    lokt.fr suit le cycle réel d’un propriétaire : créer le logement, rattacher un bail, encaisser le loyer,
                    générer la quittance, suivre la finance et garder les preuves.
                  </p>
                </div>
                <div className="grid gap-3 bg-slate-50 p-6 sm:grid-cols-3 sm:p-8">
                  {[
                    ["01", "Structurer", "Bien, bail, locataire, montants."],
                    ["02", "Encaisser", "Paiement reçu, incomplet ou absent."],
                    ["03", "Archiver", "Quittances, finance, historique."],
                  ].map(([step, titleStep, textStep]) => (
                    <div key={step} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">{step}</p>
                      <h3 className="mt-3 text-lg font-semibold text-slate-950">{titleStep}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{textStep}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="grid gap-8 lg:grid-cols-[1fr,420px] lg:items-center">
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Tarifs</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                    Gratuit pour commencer, payant quand l’automatisation remplace du travail manuel.
                  </h2>
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    Un logement actif gratuit. Starter ajoute les automatismes utiles. Essentiel ajoute le pilotage,
                    les exports et l’aide à la déclaration.
                  </p>
                </div>
                <div className="grid gap-3">
                  {[
                    ["Gratuit", "1 logement actif", "0 €"],
                    ["Starter", "Quittances automatiques · jusqu’à 3 logements", "4,90 € / mois"],
                    ["Essentiel", "Pilotage & déclaration · jusqu’à 10 logements", "9,90 € / mois"],
                  ].map(([plan, desc, price]) => (
                    <div key={plan} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{plan}</p>
                        <p className="mt-1 text-xs text-slate-500">{desc}</p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-slate-900">{price}</p>
                    </div>
                  ))}
                  <Link href="/tarifs" className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                    Voir les tarifs →
                  </Link>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 text-slate-950 shadow-sm sm:p-8">
              <h2 className="text-2xl font-semibold tracking-tight">Gestion locative gratuite et simulateurs immobiliers</h2>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
                lokt.fr regroupe un outil de gestion locative gratuit pour propriétaires bailleurs et des simulateurs immobiliers gratuits.
                L’espace bailleur permet de suivre un logement, un bail, un locataire, les loyers, les quittances, les états des lieux,
                l’inventaire et la finance. Il est particulièrement utile en location meublée / LMNP, avec inventaire, suivi des recettes et préparation des informations de déclaration.
                Les calculettes servent à préparer les décisions.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  ["/gestion-locative-lmnp", "Gestion locative LMNP"],
                  ["/outil-gestion-locative", "Outil de gestion locative gratuit"],
                  ["/quittances-loyer", "Quittance de loyer"],
                  ["/etats-des-lieux-documents", "État des lieux"],
                  ["/capacite", "Capacité d’emprunt"],
                  ["/investissement", "Rentabilité locative"],
                  ["/pret-relais", "Prêt relais"],
                  ["/parc-immobilier", "Parc immobilier"],
                ].map(([href, label]) => (
                  <Link key={href} href={href} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    {label} →
                  </Link>
                ))}
              </div>
            </section>

            <section id="faq" className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6 sm:p-8">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">FAQ</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Questions fréquentes</h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  Des réponses rapides sur l’espace bailleur, les quittances, les simulateurs et la gestion des données.
                </p>
              </div>

              <div className="mt-6 grid gap-3">
                {faqData.map((f) => (
                  <FaqItem
                    key={f.q}
                    q={f.q}
                    a={
                      <>
                        {String(f.a).includes("contact@lokt.fr") ? (
                          <>
                            {String(f.a).split("contact@lokt.fr")[0]}
                            <a className="underline" href="mailto:contact@lokt.fr">
                              contact@lokt.fr
                            </a>
                            {String(f.a).split("contact@lokt.fr")[1] ?? ""}
                          </>
                        ) : (
                          f.a
                        )}
                      </>
                    }
                  />
                ))}
              </div>
            </section>
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}
