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
  kind: "loan" | "bridge" | "yield" | "portfolio" | "sale" | "bailleur";
  className?: string;
}) {
  const map: Record<string, { g1: string; g2: string }> = {
    loan: { g1: "#4f46e5", g2: "#22c55e" },
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

        {kind === "loan" ? (
          <>
            <rect x="18" y="22" width="28" height="22" rx="6" fill="rgba(255,255,255,0.92)" />
            <path d="M22 30h20M22 35h14" stroke="rgba(15,23,42,0.7)" strokeWidth="2.6" strokeLinecap="round" />
            <circle cx="44" cy="36" r="3" fill="rgba(15,23,42,0.22)" />
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

function FintechTile({
  title,
  oneLiner,
  href,
  icon,
  accent,
  badge,
}: {
  title: string;
  oneLiner: string;
  href: string;
  icon: "loan" | "bridge" | "yield" | "portfolio" | "sale" | "bailleur";
  accent: "indigo" | "cyan" | "emerald" | "violet" | "amber" | "slate";
  badge?: string;
}) {
  const accents: Record<string, { halo: string }> = {
    indigo: { halo: "bg-indigo-600/12" },
    cyan: { halo: "bg-cyan-500/12" },
    emerald: { halo: "bg-emerald-500/12" },
    violet: { halo: "bg-violet-500/12" },
    amber: { halo: "bg-amber-500/12" },
    slate: { halo: "bg-slate-900/6" },
  };
  const a = accents[accent];

  return (
    <Link href={href} aria-label={`Ouvrir ${title}`} className="group block h-full">
      <div
        className="
          relative h-full min-h-[168px]
          overflow-hidden rounded-3xl border border-slate-200 bg-white p-6
          shadow-sm transition hover:-translate-y-0.5 hover:shadow-md
        "
      >
        <div
          aria-hidden
          className={`pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full blur-3xl opacity-70 ${a.halo}`}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 1) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-0 h-full w-24 rotate-12 bg-white/40 blur-xl opacity-0 transition duration-500 group-hover:opacity-100 group-hover:translate-x-[520px]"
        />

        {/* Layout: colonne + CTA collé en bas */}
        <div className="relative flex h-full items-start gap-4">
          <div className="shrink-0">
            <Sticker kind={icon} className="h-12 w-12" />
          </div>

          <div className="min-w-0 flex-1 flex h-full flex-col">
            <div className="flex items-center gap-2">
              <p className="text-base font-semibold text-slate-900">{title}</p>
              {badge ? (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[0.65rem] font-semibold text-slate-700">
                  {badge}
                </span>
              ) : null}
            </div>

            {/* 2 lignes max = hauteur identique */}
            <p className="mt-1 text-sm text-slate-600 line-clamp-2">{oneLiner}</p>

            {/* pousse le CTA en bas */}
            <div className="mt-auto pt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              Démarrer <span className="transition group-hover:translate-x-0.5">→</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function FaqItem({ q, a }: { q: string; a: ReactNode }) {
  return (
    <details className="group rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
      <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between">
        <span className="pr-6">{q}</span>
        <span className="text-slate-400 group-open:rotate-180 transition">▾</span>
      </summary>
      <div className="mt-3 text-sm text-slate-700 leading-relaxed">{a}</div>
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
              <div>
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

      <main className="flex-1 px-4 py-10">
        <div className="max-w-6xl mx-auto space-y-10">
          {/* =========================================================
              HERO (recentré + premium minimal + illustration)
          ========================================================== */}
          <section className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-sm">
  <div aria-hidden className="absolute inset-0">
    <div className="absolute -top-44 left-1/2 h-[620px] w-[620px] -translate-x-1/2 rounded-full bg-indigo-600/12 blur-3xl" />
    <div className="absolute -bottom-64 -left-52 h-[620px] w-[620px] rounded-full bg-cyan-400/10 blur-3xl" />
    <div className="absolute top-24 -right-56 h-[620px] w-[620px] rounded-full bg-emerald-300/10 blur-3xl" />
    <div
      className="absolute inset-0 opacity-[0.06]"
      style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 1) 1px, transparent 0)",
        backgroundSize: "22px 22px",
      }}
    />
  </div>

  <div className="relative p-7 sm:p-10">
    <div className="mx-auto max-w-3xl text-center">
      <div className="anim-fadeUp d-0 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-[0.72rem] font-semibold text-slate-700 backdrop-blur">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
        Gestion locative gratuite · simulateurs immobiliers
      </div>

      <h1 className="anim-fadeUp d-1 mt-5 text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 leading-tight">
        {isLoggedIn && displayName ? `Bonjour ${displayName}.` : "Tout devient plus clair pour vos projets immobiliers."}
      </h1>

      <p className="anim-fadeUp d-2 mt-4 text-base text-slate-600">
        Un espace bailleur pour gérer votre location, et des simulateurs pour décider avant d’acheter, vendre ou investir.
      </p>
    </div>

    <div className="anim-fadeUp d-3 mt-8 grid gap-4 lg:grid-cols-2">
      <div className="flex h-full flex-col rounded-[2rem] border border-slate-200 bg-white/85 p-6 shadow-sm backdrop-blur">
        <div className="flex-1">
          <div className="flex items-start gap-4">
            <Sticker kind="loan" className="h-14 w-14" />
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Projet immobilier</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">Simuler avant d’acheter, vendre ou investir</h2>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Capacité d’emprunt, prêt relais, rentabilité locative, parc immobilier et plus-value : comparez vos scénarios avec des résultats lisibles.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
          >
            Lancer une simulation →
          </button>
        </div>
      </div>

      <div className="flex h-full flex-col rounded-[2rem] border border-emerald-200 bg-emerald-50/85 p-6 shadow-sm backdrop-blur">
        <div className="flex-1">
          <div className="flex items-start gap-4">
            <Sticker kind="bailleur" className="h-14 w-14" />
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-emerald-700">Outil bailleur · 1 logement gratuit</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">Gérer un bien en location</h2>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-700">
            Gérez gratuitement un premier logement : bail, locataire, loyers, quittances PDF, envoi automatique, états des lieux, inventaire et finance.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {isLoggedIn ? (
            <Link
              href="/espace-bailleur"
              className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
            >
              Accéder à l’espace bailleur →
            </Link>
          ) : (
            <>
              <Link
                href="/mon-compte?mode=register&redirect=/espace-bailleur"
                className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
              >
                Créer mon compte gratuit →
              </Link>
              <Link href="/mon-compte?mode=login&redirect=/espace-bailleur" className="text-sm font-semibold text-emerald-900 underline decoration-emerald-300">
                J’ai déjà un compte
              </Link>
            </>
          )}
        </div>
      </div>
    </div>

    <div className="mt-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <FintechTile
          title="Capacité d’emprunt"
          oneLiner="Pour connaître votre budget réaliste (mensualité, durée, apport)."
          href="/capacite"
          icon="loan"
          accent="indigo"
        />

        <FintechTile
          title="Prêt relais"
          oneLiner="Si vous achetez avant de vendre : estimer le relais et le risque."
          href="/pret-relais"
          icon="bridge"
          accent="cyan"
        />

        <FintechTile
          title="Rentabilité locative"
          oneLiner="Pour vérifier un investissement (cash-flow, rendement, charges)."
          href="/investissement"
          icon="yield"
          accent="emerald"
        />

        <FintechTile
          title="Parc immobilier"
          oneLiner="Vision consolidée si vous avez plusieurs biens (loyers, crédits, synthèse)."
          href="/parc-immobilier"
          icon="portfolio"
          accent="violet"
        />

        <FintechTile
          title="Plus-value immobilière"
          oneLiner="Si vous vendez : estimer le cash net après frais et impôts."
          href="/plus-value-vente-immobiliere"
          icon="sale"
          accent="amber"
        />
      </div>
    </div>
  </div>
</section>

          {/* =========================================================
              SEO DISCRET + MAILLAGE
          ========================================================== */}
          <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-50 to-cyan-50" />
            <div className="p-7 sm:p-8">
              <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
                Gestion locative gratuite et simulateurs immobiliers : un seul point d’entrée pour propriétaires
              </h2>

              <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-4xl">
                lokt.fr regroupe un <strong>outil de gestion locative gratuit</strong> pour propriétaires bailleurs et des{" "}
                <strong>simulateurs immobiliers gratuits</strong>. L’espace bailleur permet de suivre un logement, un bail, un locataire,
                les loyers, les quittances, les états des lieux, l’inventaire et la finance. Les calculettes servent à préparer les décisions :
                capacité d’emprunt, prêt relais, rentabilité locative, parc immobilier et plus-value.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/outil-gestion-locative" className="text-sm font-semibold underline decoration-slate-300 text-slate-900">
                  Outil de gestion locative gratuit →
                </Link>
                <Link href="/tarifs" className="text-sm font-semibold underline decoration-slate-300 text-slate-900">
                  Tarifs espace bailleur →
                </Link>
                <Link href="/capacite" className="text-sm font-semibold underline decoration-slate-300 text-slate-900">
                  Simulateur de capacité d’emprunt →
                </Link>
                <Link href="/pret-relais" className="text-sm font-semibold underline decoration-slate-300 text-slate-900">
                  Simulateur de prêt relais →
                </Link>
                <Link href="/plus-value-vente-immobiliere" className="text-sm font-semibold underline decoration-slate-300 text-slate-900">
                  Calculette de plus-value immobilière →
                </Link>
                <Link href="/investissement" className="text-sm font-semibold underline decoration-slate-300 text-slate-900">
                  Simulateur de rentabilité locative →
                </Link>
                <Link href="/parc-immobilier" className="text-sm font-semibold underline decoration-slate-300 text-slate-900">
                  Simulateur de parc immobilier →
                </Link>
              </div>
            </div>
          </section>

          {/* =========================================================
              MARKETING (double valeur)
          ========================================================== */}
          <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-50 to-cyan-50" />
            <div className="p-7 sm:p-8">
              <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
                <div className="space-y-4">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Pourquoi lokt.fr</p>

                  <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 leading-tight">
                    Décider plus clairement, puis gérer plus proprement.
                  </h2>

                  <p className="text-sm text-slate-600 max-w-2xl">
                    lokt.fr couvre deux moments clés du propriétaire : la décision immobilière avec les simulateurs, puis la gestion quotidienne
                    avec l’espace bailleur. L’idée est simple : moins de fichiers dispersés, plus de repères utiles.
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-900">Gestion locative</p>
                      <p className="mt-1 text-xs text-slate-600">Baux, locataires, loyers, quittances, états des lieux et inventaire.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-900">Quittances</p>
                      <p className="mt-1 text-xs text-slate-600">PDF, archives, suivi des paiements et envoi au locataire.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-900">Simulations</p>
                      <p className="mt-1 text-xs text-slate-600">Capacité, rentabilité, prêt relais, parc et plus-value.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-900">Pilotage</p>
                      <p className="mt-1 text-xs text-slate-600">Finance, alertes, échéances et vision par logement.</p>
                    </div>
                  </div>

                  {/* ✅ Bouton "Choisir une calculette" supprimé ici */}
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <Link
                      href="/calculettes"
                      className="inline-flex items-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      Voir toutes les calculettes
                    </Link>
                    <Link
                      href="/outil-gestion-locative"
                      className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-5 py-2.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
                    >
                      Découvrir l’outil bailleur
                    </Link>
                    <button
                      type="button"
                      onClick={() => setPickerOpen(true)}
                      className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:opacity-95"
                    >
                      Démarrer →
                    </button>
                    <span className="text-xs text-slate-500">(Conseil : commencez par la capacité)</span>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Aperçu calculette lokt.fr™</p>
                      <p className="text-xs text-slate-600 mt-1">Synthèse claire, pensée “décision”.</p>
                    </div>
                    <span className="shrink-0 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-slate-700">
                      Exemple
                    </span>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <img
                      src="/screenCALCULETTE.png"
                      alt="Capture de la calculette lokt.fr"
                      className="w-full h-auto object-cover"
                      loading="lazy"
                    />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold text-slate-900">Synthèse</p>
                      <p className="mt-1 text-xs text-slate-600">Résultat lisible immédiatement.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold text-slate-900">Leviers</p>
                      <p className="mt-1 text-xs text-slate-600">Comprendre ce qui change vraiment.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* =========================================================
              ESPACE BAILLEUR
          ========================================================== */}
          <section id="espace-bailleur" className="rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="relative bg-gradient-to-r from-indigo-700 to-cyan-500 text-white p-7 sm:p-10 overflow-hidden">
              <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-25 blur-3xl bg-white" />
              <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full opacity-20 blur-3xl bg-indigo-900" />

              <div className="relative grid gap-8 lg:grid-cols-2 lg:items-center">
                <div className="space-y-4">
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-white/80">Outil gratuit · 1 logement actif</p>

                  <div className="space-y-2">
                    <h3 className="text-2xl sm:text-3xl font-semibold leading-tight">
                      Gérez votre location sans tableur dispersé.
                    </h3>

                    <p className="text-sm text-white/90 max-w-2xl">
                      L’espace bailleur lokt.fr vous aide à{" "}
                      <span className="font-semibold">centraliser vos documents</span>,{" "}
                      <span className="font-semibold">suivre vos échéances</span> et{" "}
                      <span className="font-semibold">piloter vos logements</span>. Un premier logement actif est gratuit, avec un parcours clair pour gérer le quotidien.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                      <p className="text-sm font-semibold">Moins de friction</p>
                      <p className="text-xs text-white/85 mt-1">Fin des fichiers éparpillés et des oublis.</p>
                    </div>
                    <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                      <p className="text-sm font-semibold">Suivi lisible</p>
                      <p className="text-xs text-white/85 mt-1">Une vision claire de vos biens et échéances.</p>
                    </div>
                    <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                      <p className="text-sm font-semibold">Gratuit utile</p>
                      <p className="text-xs text-white/85 mt-1">Un premier logement actif sans carte bancaire.</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/20 bg-white/10 p-5">
                    <p className="text-sm font-semibold">Ce que l’outil couvre</p>
                    <ul className="mt-2 space-y-1 text-xs text-white/85">
                      <li>• Centraliser vos documents (quittances, états des lieux, pièces clés)</li>
                      <li>• Générer et envoyer automatiquement les quittances de loyer</li>
                      <li>• Suivre dépôts de garantie et restitutions</li>
                      <li>• Gérer les échéances (rappels, révisions, renouvellements)</li>
                      <li>• Suivre finance, recettes, dépenses, inventaire et alertes métier</li>
                    </ul>

                    <div className="mt-4 pt-4 border-t border-white/15">
                      <p className="text-sm font-semibold">Modèle clair</p>
                      <p className="mt-1 text-xs text-white/85">
                        Vous commencez gratuitement avec un logement actif. Les fonctionnalités avancées restent optionnelles quand le besoin devient concret.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                    <p className="text-sm font-semibold">{isLoggedIn ? "Votre accès gratuit" : "Inscription gratuite"}</p>
                    <p className="text-xs text-white/85 mt-1">
                      {isLoggedIn
                        ? "Vous êtes connecté : vous pouvez accéder à l’espace bailleur et gérer un premier logement gratuitement."
                        : "Créez un compte pour gérer un premier logement gratuitement : bail, locataire, quittances, états des lieux, inventaire et finance."}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {isLoggedIn ? (
                        <Link
                          href="/espace-bailleur"
                          className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-xs font-semibold text-indigo-700 shadow-sm hover:bg-white/90"
                        >
                          Accéder à l’espace bailleur →
                        </Link>
                      ) : (
                        <>
                          <Link
                            href="/mon-compte?mode=register&redirect=/espace-bailleur"
                            className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-xs font-semibold text-indigo-700 shadow-sm hover:bg-white/90"
                          >
                            Créer mon compte gratuit →
                          </Link>
                          <Link
                            href="/mon-compte?mode=login&redirect=/espace-bailleur"
                            className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15"
                          >
                            J’ai déjà un compte
                          </Link>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-[0.75rem] text-white/70">
                    Outil gratuit pour 1 logement actif, pensé pour les propriétaires qui veulent gérer simplement.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="relative rounded-3xl border border-white/20 bg-white/10 p-3 overflow-hidden">
                    <div className="flex items-center justify-between gap-3 px-2 pb-3">
                      <p className="text-sm font-semibold">Aperçu</p>
                      <span className="inline-flex items-center rounded-full bg-white/10 border border-white/20 px-3 py-1 text-[0.7rem] font-semibold">
                        Espace bailleur
                      </span>
                    </div>

                    <img
                      src="/ESPACEBAILLEURSCREENSHOT.png"
                      alt="Aperçu espace bailleur lokt.fr"
                      className="w-full rounded-2xl border border-white/10 shadow-sm object-cover"
                      loading="lazy"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white/10 border border-white/20 p-4">
                      <p className="text-sm font-semibold">Quittances & documents</p>
                      <p className="text-xs text-white/85 mt-1">Génération, archivage, historique.</p>
                    </div>
                    <div className="rounded-2xl bg-white/10 border border-white/20 p-4">
                      <p className="text-sm font-semibold">Dépôts de garantie</p>
                      <p className="text-xs text-white/85 mt-1">Suivi, restitutions et rappels.</p>
                    </div>
                    <div className="rounded-2xl bg-white/10 border border-white/20 p-4">
                      <p className="text-sm font-semibold">États des lieux</p>
                      <p className="text-xs text-white/85 mt-1">Modèles, checklists, organisation.</p>
                    </div>
                    <div className="rounded-2xl bg-white/10 border border-white/20 p-4">
                      <p className="text-sm font-semibold">Templates</p>
                      <p className="text-xs text-white/85 mt-1">Constituer et réutiliser vos modèles.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* =========================================================
              TARIFS
          ========================================================== */}
          <section id="tarifs" className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr,360px] lg:items-center">
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-cyan-700">Tarifs</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">Un logement gratuit, puis des paliers quand lokt.fr vous fait gagner du temps.</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  L’outil reste gratuit pour gérer un premier logement. Starter ajoute l’automatisation des quittances. Essentiel
                  ajoute le pilotage financier, les exports et l’aide à la déclaration.
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">Gratuit</p>
                    <p className="mt-1 text-xs text-slate-600">1 logement actif</p>
                  </div>
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">Starter</p>
                    <p className="mt-1 text-xs text-slate-600">Automatisation · jusqu’à 3 logements</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">Essentiel</p>
                    <p className="mt-1 text-xs text-slate-600">Pilotage & déclaration · jusqu’à 10 logements</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">Logique produit</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Vous testez sans risque. Vous payez quand lokt.fr remplace vraiment du travail manuel : relances, emails, déclaration, finance et
                  pilotage du parc.
                </p>
                <Link
                  href="/tarifs"
                  className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Voir les tarifs →
                </Link>
              </div>
            </div>
          </section>

          {/* =========================================================
              FAQ LARGE
          ========================================================== */}
          <section id="faq" className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-50 to-cyan-50" />
            <div className="p-7 sm:p-8">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.7rem] sm:text-xs font-semibold uppercase tracking-[0.22em] text-slate-600">FAQ</p>
                  <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 mt-1">Questions fréquentes</h2>
                  <p className="text-sm text-slate-600 mt-2 max-w-3xl">
                    Des réponses rapides sur l’espace bailleur, les quittances, les simulateurs et la gestion des données.
                  </p>
                </div>

                <span className="hidden sm:inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[0.7rem] font-semibold text-slate-600">
                  lokt.fr
                </span>
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

              <p className="mt-6 text-xs text-slate-500">
                Vous ne trouvez pas la réponse ? Écrivez-nous à{" "}
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
