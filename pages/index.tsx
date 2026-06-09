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
    <details className="group rounded-2xl border border-slate-200 bg-white/95 px-5 py-4 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-semibold text-slate-950">
        <span className="leading-snug">{q}</span>
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition group-open:rotate-45 group-open:bg-slate-950 group-open:text-white">
          +
        </span>
      </summary>
      <div className="mt-3 border-t border-slate-100 pt-3 text-sm leading-6 text-slate-600">{a}</div>
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

  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>("[data-scroll-reveal]"));
    if (!items.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
    );

    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
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
        q: "À quoi sert vraiment l’espace bailleur lokt.fr ?",
        a: "L’espace bailleur sert à garder une vision claire de votre location : biens, locataires, baux, loyers, quittances, documents, inventaire, état des lieux et points à traiter. L’objectif n’est pas de multiplier les écrans, mais de savoir quoi faire, quand le faire, et de conserver une trace propre des actions importantes.",
      },
      {
        q: "Est-ce que lokt.fr est gratuit pour démarrer ?",
        a: "Oui. Vous pouvez commencer sans carte bancaire, utiliser les simulateurs et gérer un premier logement actif. Les offres payantes servent à ouvrir plus de capacité, plus d’outils et des fonctions avancées pour les bailleurs qui veulent structurer davantage leur gestion.",
      },
      {
        q: "Puis-je gérer uniquement les quittances, sans utiliser tout le reste ?",
        a: "Oui. Un propriétaire peut très bien utiliser lokt.fr seulement pour suivre les paiements et produire ses quittances. Les autres modules restent disponibles si vous en avez besoin, mais l’outil est pensé pour éviter les alertes inutiles lorsque votre workflow est plus simple.",
      },
      {
        q: "Quand une quittance de loyer doit-elle être générée ?",
        a: "Une quittance se remet au locataire lorsque le loyer et les charges dus pour la période ont été payés. Si le paiement n’est que partiel, on parle plutôt de reçu. Dans lokt.fr, la logique consiste donc à confirmer le paiement avant de produire une quittance propre et archivée.",
      },
      {
        q: "Est-ce adapté à un propriétaire avec un seul bien ?",
        a: "Oui. C’est même un cas d’usage important : un seul bien peut déjà impliquer un bail, un dépôt de garantie, un état des lieux, des quittances, des relances, des travaux et des documents à conserver. lokt.fr aide à ne pas tout gérer dans des emails, des fichiers éparpillés ou un tableur oublié.",
      },
      {
        q: "L’outil remplace-t-il un bail ou un conseil juridique ?",
        a: "Non. lokt.fr est un outil de gestion, de suivi et d’aide à la décision. Un bail reste un document juridique signé entre les parties, avec les annexes nécessaires. Pour une situation litigieuse, complexe ou sensible, il faut se rapprocher d’un professionnel compétent.",
      },
      {
        q: "Quels simulateurs immobiliers sont disponibles ?",
        a: "Vous pouvez estimer une capacité d’emprunt, analyser une rentabilité locative, simuler un prêt relais, calculer une plus-value immobilière et suivre une vision consolidée d’un parc. Ces simulateurs servent à comparer des scénarios avant d’agir, pas seulement à obtenir un chiffre isolé.",
      },
      {
        q: "Les résultats des simulateurs sont-ils contractuels ?",
        a: "Non. Les résultats sont indicatifs et dépendent des hypothèses saisies : revenus, charges, taux, loyers, fiscalité, prix d’achat ou de revente. Ils permettent de cadrer une réflexion et d’éviter les angles morts, mais ne remplacent pas une offre bancaire, un calcul notarial ou un avis fiscal personnalisé.",
      },
      {
        q: "Dois-je créer un compte pour utiliser le site ?",
        a: "Les simulateurs publics peuvent être utilisés librement. Un compte devient nécessaire dès que vous voulez sauvegarder une gestion locative, retrouver vos biens, suivre des baux, archiver des documents ou revenir sur vos informations dans le temps.",
      },
      {
        q: "Comment sont traitées mes données ?",
        a: "Les données saisies servent à faire fonctionner le service et à vous permettre de retrouver votre gestion. Elles ne sont pas vendues à des tiers. Pour un bailleur, ces informations sont sensibles par nature : identité du locataire, documents, loyers, paiements et historique doivent rester organisés et protégés.",
      },
      {
        q: "Puis-je utiliser lokt.fr pour un logement meublé, un LMNP ou une location nue ?",
        a: "Oui. Les workflows de suivi locatif restent utiles dans ces cas : bail, quittances, inventaire, état des lieux, documents et suivi des paiements. Certaines règles métier diffèrent selon le type de location ; les pages guides permettent de préciser les points importants avant de traiter un cas particulier.",
      },
      {
        q: "Comment vous contacter si mon cas n’entre pas dans les écrans prévus ?",
        a: "Vous pouvez nous écrire à contact@lokt.fr. Les retours terrain sont utiles, notamment lorsqu’un bailleur gère un cas hybride : un seul module utilisé, plusieurs lots, un locataire sortant, une régularisation ou un historique à reconstituer.",
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

            .lokt-public-hero-flow {
              animation: none !important;
            }

            .lokt-public-hero-sheen {
              animation: none !important;
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
        <section className="lokt-public-hero relative overflow-hidden px-4 pb-10 pt-8 sm:pb-16 sm:pt-14">
          <div aria-hidden className="lokt-public-hero-band lokt-public-hero-flow absolute -left-[8%] top-[-8%] w-[116%] -skew-y-6 origin-top-left" />
          <div aria-hidden className="lokt-public-hero-band absolute inset-x-0 top-0 -skew-y-6 origin-top-left bg-[linear-gradient(120deg,rgba(255,255,255,.48)_0%,transparent_34%),linear-gradient(75deg,transparent_54%,rgba(255,184,0,.34)_100%)]" />
          <div aria-hidden className="lokt-public-hero-band absolute left-0 top-0 w-full bg-gradient-to-r from-[#635bff]/55 via-[#00b8e8]/20 to-transparent lg:w-[68%]" />
          <div aria-hidden className="lokt-public-hero-band lokt-public-hero-sheen pointer-events-none absolute -left-1/4 top-[-8%] w-[150%] -skew-y-6 bg-[linear-gradient(112deg,transparent_18%,rgba(255,255,255,.34)_42%,rgba(255,215,120,.3)_55%,transparent_76%)]" />

          <div className="relative mx-auto max-w-7xl">
            <div className="grid gap-7 sm:gap-10 lg:grid-cols-[0.88fr,1.12fr] lg:items-center">
              <div>
                <div className="anim-fadeUp d-0 inline-flex items-center gap-2 rounded-full bg-white/82 px-3 py-1 text-[0.72rem] font-semibold text-slate-700 shadow-sm backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Simulateurs immobiliers + gestion locative
                </div>

                <h1 className="anim-fadeUp d-1 mt-5 max-w-3xl text-[2.55rem] font-semibold leading-[0.96] tracking-tight text-white sm:mt-6 sm:text-6xl">
                  {isLoggedIn && displayName
                    ? `Bonjour ${displayName}. Votre gestion vous attend.`
                    : "Simulez votre projet. Gérez votre location."}
                </h1>

                <p className="anim-fadeUp d-2 mt-5 max-w-xl text-[0.98rem] leading-7 text-white/90 sm:mt-6 sm:text-lg">
                  lokt.fr aide les propriétaires à estimer un achat immobilier, suivre leurs loyers, produire les quittances et garder une gestion claire au même endroit.
                </p>

                <div className="anim-fadeUp d-3 mt-7 grid gap-3 sm:mt-8 sm:flex sm:flex-wrap sm:items-center">
                  {isLoggedIn ? (
                    <Link href="/espace-bailleur" className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 hover:bg-slate-800 sm:w-auto">
                      Accéder à l’espace bailleur →
                    </Link>
                  ) : (
                    <Link href="/mon-compte?mode=register&redirect=/espace-bailleur" className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 hover:bg-slate-800 sm:w-auto">
                      Créer mon espace gratuit →
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-white/90 px-5 py-2.5 text-sm font-semibold text-[#3f37c9] shadow-sm backdrop-blur hover:bg-white sm:w-auto"
                  >
                    Lancer une simulation →
                  </button>
                </div>
              </div>

              <div className="anim-fadeUp d-4">
                <div className="relative rounded-[1.5rem] bg-white/35 p-1.5 shadow-xl shadow-slate-900/15 backdrop-blur sm:rounded-[2rem] sm:p-2 sm:shadow-2xl sm:shadow-slate-900/20">
                  <div className="overflow-hidden rounded-[1.25rem] border border-white/60 bg-white sm:rounded-[1.55rem]">
                    <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5 sm:px-4 sm:py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#ff5f57] sm:h-2.5 sm:w-2.5" />
                        <span className="h-2 w-2 rounded-full bg-[#ffbd2e] sm:h-2.5 sm:w-2.5" />
                        <span className="h-2 w-2 rounded-full bg-[#28c840] sm:h-2.5 sm:w-2.5" />
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[0.68rem] font-semibold text-slate-600">Cockpit bailleur</span>
                    </div>

                    <div className="p-3 sm:p-6">
                      <div className="grid gap-3 lg:grid-cols-[1.1fr,0.9fr] sm:gap-4">
                        <div className="rounded-[1.1rem] border border-slate-200 bg-slate-50 p-3 sm:rounded-[1.35rem] sm:p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#635bff]">Ce mois-ci</p>
                              <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950 sm:text-xl">3 actions utiles, pas 12 menus</h2>
                              <p className="mt-1 text-xs leading-5 text-slate-500">L’écran pousse ce qui mérite vraiment une décision.</p>
                            </div>
                            <Sticker kind="bailleur" className="h-10 w-10 shrink-0 sm:h-11 sm:w-11" />
                          </div>
                          <div className="mt-3 grid gap-2 sm:mt-4">
                            {[
                              ["Loyer attendu", "Appartement T2", "780 €"],
                              ["Quittance prête", "Paiement confirmé", "PDF"],
                              ["Facture d’eau", "Répartition à valider", "4 lots"],
                            ].map(([label, detail, value]) => (
                              <div key={label} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2">
                                <div className="min-w-0">
                                  <span className="block text-xs font-semibold text-slate-950">{label}</span>
                                  <span className="block truncate text-[0.68rem] text-slate-500">{detail}</span>
                                </div>
                                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-[1.1rem] border border-slate-200 bg-white p-3 sm:rounded-[1.35rem] sm:p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-emerald-700">Finance</p>
                              <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950 sm:text-xl">Solde locatif</h2>
                              <p className="mt-1 text-xs leading-5 text-slate-500">Les décisions validées peuvent alimenter le suivi.</p>
                            </div>
                            <Sticker kind="yield" className="h-10 w-10 shrink-0 sm:h-11 sm:w-11" />
                          </div>
                          <div className="mt-3 grid gap-2 sm:mt-4">
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                              <p className="text-xs font-semibold text-emerald-950">Encaissements</p>
                              <p className="mt-0.5 text-lg font-semibold text-emerald-950">+1 840 €</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-[0.68rem] text-slate-500">Charges</p>
                                <p className="mt-1 text-sm font-semibold text-slate-950">-214 €</p>
                              </div>
                              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2">
                                <p className="text-[0.68rem] text-sky-700">À valider</p>
                                <p className="mt-1 text-sm font-semibold text-sky-950">2 lignes</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 rounded-[1.35rem] border border-slate-200 bg-white p-4 sm:mt-4">
                        <div className="grid gap-3 sm:grid-cols-4">
                          {[
                            ["Décider", "Simulateurs"],
                            ["Encaisser", "Loyers"],
                            ["Justifier", "Outils"],
                            ["Archiver", "Documents"],
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

        <section className="border-b border-slate-200 bg-white px-4 py-14 sm:py-20">
          <div className="mx-auto max-w-7xl">
            <div data-scroll-reveal className="grid gap-6 lg:grid-cols-[0.78fr,1.22fr] lg:items-end">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Choisir son chemin</p>
                <h2 className="mt-3 max-w-xl text-3xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-4xl">
                  Un site qui s’adapte au moment où vous êtes.
                </h2>
              </div>
              <p className="max-w-3xl text-sm leading-7 text-slate-600">
                Un propriétaire ne cherche pas toujours la même chose : parfois il compare un achat, parfois il doit envoyer une quittance,
                parfois il doit justifier une charge. L’accueil met chaque besoin au bon endroit.
              </p>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {[
                ["Je veux gérer un bien", "Créer le logement, suivre le bail, confirmer les paiements et générer les quittances.", "/espace-bailleur", "bailleur" as const],
                ["Je veux tester un projet", "Capacité, rentabilité, prêt relais, plus-value : vérifier les ordres de grandeur avant d’agir.", "/calculettes", "calc" as const],
                ["Je veux régulariser proprement", "Calculer eau, charges, TEOM ou solde locatif, puis importer en finance après validation.", "/tarifs", "yield" as const],
              ].map(([titleStep, textStep, href, icon]) => (
                <Link
                  key={String(titleStep)}
                  href={String(href)}
                  data-scroll-reveal
                  className="group flex min-h-[250px] flex-col rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/70"
                >
                  <Sticker kind={icon as "calc" | "bailleur" | "yield"} className="h-14 w-14" />
                  <h3 className="mt-7 text-2xl font-semibold tracking-tight text-slate-950">{titleStep}</h3>
                  <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">{textStep}</p>
                  <span className="mt-6 text-sm font-semibold text-slate-950 transition group-hover:translate-x-1">Ouvrir →</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-950 px-4 py-14 text-white sm:py-20">
          <div className="mx-auto max-w-7xl">
            <div data-scroll-reveal className="max-w-2xl">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-cyan-300">Workflow bailleur</p>
              <h2 className="mt-3 max-w-3xl font-semibold leading-tight">
                <span className="block text-3xl text-white sm:text-4xl">Le parcours complet, sans rupture.</span>
                <span className="mt-1 block text-2xl text-cyan-300 sm:text-3xl">De la décision au justificatif.</span>
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                lokt.fr suit le cycle réel du propriétaire : décider, mettre en location, encaisser, répartir, archiver et préparer la finance.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-5">
              {[
                ["01", "Acheter", "Simuler budget, relais et rentabilité."],
                ["02", "Louer", "Poser bien, bail, locataire et documents."],
                ["03", "Encaisser", "Suivre paiements, retards et quittances."],
                ["04", "Régulariser", "Calculer eau, charges, TEOM et soldes."],
                ["05", "Archiver", "Conserver PDF, preuves et finance."],
              ].map(([step, titleStep, textStep]) => (
                <div key={step} data-scroll-reveal className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                  <p className="text-3xl font-semibold leading-none text-cyan-300/80">{step}</p>
                  <h3 className="mt-5 text-lg font-semibold text-white">{titleStep}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{textStep}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white px-4 py-14 sm:py-20">
          <div className="mx-auto max-w-7xl">
            <div data-scroll-reveal className="grid gap-8 lg:grid-cols-[0.92fr,1.08fr] lg:items-end">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-emerald-700">Boîte à outils Essentiel</p>
                <h2 className="mt-3 max-w-3xl font-semibold leading-tight text-slate-950">
                  <span className="block text-3xl sm:text-4xl">Les calculs que les bailleurs repoussent.</span>
                  <span className="mt-1 block text-2xl text-emerald-700 sm:text-3xl">Préparés, justifiés, prêts à suivre.</span>
                </h2>
              </div>
              <div className="rounded-[1.55rem] border border-emerald-100 bg-emerald-50/70 p-5">
                <p className="text-sm font-semibold text-emerald-950">Ce qui change avec Essentiel</p>
                <p className="mt-2 text-sm leading-7 text-emerald-900/80">
                  Chaque outil guide la saisie, garde les justificatifs, produit une synthèse lisible et propose l’écriture finance uniquement après validation.
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-4">
              {[
                {
                  title: "Facture d’eau",
                  badge: "Multi-compteurs",
                  text: "Dispatcher une facture générale entre les occupants, avec relevés, photos et historique par période.",
                  label: "À facturer",
                  output: "Montant dû par occupant",
                  tone: "from-cyan-500 to-emerald-400",
                },
                {
                  title: "Charges",
                  badge: "Tantièmes & lots",
                  text: "Transformer un montant global en quote-part claire par lot, même quand tous les lots ne sont pas concernés.",
                  label: "À répartir",
                  output: "Répartition défendable",
                  tone: "from-violet-500 to-sky-400",
                },
                {
                  title: "TEOM",
                  badge: "Taxe récupérable",
                  text: "Isoler la taxe d’ordures ménagères, appliquer le prorata d’occupation et documenter ce qui est récupérable.",
                  label: "À récupérer",
                  output: "Montant à récupérer",
                  tone: "from-emerald-600 to-teal-300",
                },
                {
                  title: "Régularisation",
                  badge: "Solde locatif",
                  text: "Comparer les provisions versées aux dépenses réelles pour savoir quoi demander ou rembourser.",
                  label: "À régulariser",
                  output: "Solde à payer ou rendre",
                  tone: "from-indigo-500 to-cyan-400",
                },
              ].map((tool) => (
                <div
                  key={tool.title}
                  data-scroll-reveal
                  className="group overflow-hidden rounded-[1.55rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-200/70"
                >
                  <div className={`h-1.5 bg-gradient-to-r ${tool.tone}`} />
                  <div className="flex min-h-[270px] flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xl font-semibold tracking-tight text-slate-950">{tool.title}</p>
                      <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[0.68rem] font-semibold text-slate-600">
                        {tool.badge}
                      </span>
                    </div>
                    <p className="mt-4 flex-1 text-sm leading-7 text-slate-600">{tool.text}</p>
                    <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-500">{tool.label}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">{tool.output}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div data-scroll-reveal className="mt-5 flex flex-col gap-3 rounded-[1.55rem] border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-3xl text-sm leading-6 text-slate-600">
                Les résultats restent vérifiables : formule visible, période indiquée, pièces jointes conservées et import finance déclenché seulement si vous validez.
              </p>
              <Link href="/tarifs" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                Voir l’offre Essentiel →
              </Link>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-[#f8fafc] px-4 py-14 sm:py-20">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.92fr,1.08fr] lg:items-center">
            <div data-scroll-reveal>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Tarifs</p>
              <h2 className="mt-3 max-w-2xl font-semibold leading-tight text-slate-950">
                <span className="block text-3xl sm:text-4xl">Le bon niveau selon votre gestion.</span>
                <span className="mt-1 block text-2xl text-[#635bff] sm:text-3xl">Gratuit, automatisé ou piloté.</span>
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-600">
                Gratuit permet de démarrer. Starter automatise le quotidien. Essentiel ajoute la finance avancée, la déclaration
                et les outils métier réservés aux bailleurs qui veulent justifier leurs calculs.
              </p>
            </div>
            <div data-scroll-reveal className="grid gap-3">
              {[
                ["Gratuit", "1 logement actif, gestion manuelle", "0 €"],
                ["Starter", "Quittances automatiques, alertes, jusqu’à 3 logements", "4,90 € / mois"],
                ["Essentiel", "Finance, déclaration, outils bailleur, jusqu’à 10 logements", "9,90 € / mois"],
              ].map(([plan, desc, price], index) => (
                <div key={plan} className={`grid gap-3 rounded-3xl border p-5 sm:grid-cols-[1fr,auto] sm:items-center ${index === 2 ? "border-[#635bff]/25 bg-white shadow-xl shadow-[#635bff]/10" : "border-slate-200 bg-white"}`}>
                  <div>
                    <p className="text-base font-semibold text-slate-950">{plan}</p>
                    <p className="mt-1 text-sm text-slate-500">{desc}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-950">{price}</p>
                </div>
              ))}
              <Link href="/tarifs" className="mt-2 inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 sm:justify-self-start">
                Comparer les offres →
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-[#edf7f8] px-4 py-12 sm:py-16">
          <div data-scroll-reveal className="mx-auto max-w-7xl">
            <div className="grid gap-6 lg:grid-cols-[0.8fr,1.2fr] lg:items-end">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-teal-700">Guides utiles</p>
                <h2 className="mt-3 max-w-3xl font-semibold leading-tight text-slate-950">
                  <span className="block text-[1.75rem] sm:text-3xl">Des ressources pour comprendre avant d’agir.</span>
                </h2>
              </div>
              <p className="max-w-3xl text-sm leading-7 text-slate-600">
                Les pages guides structurent les sujets de gestion locative et les simulateurs publics. Elles servent de porte d’entrée SEO,
                mais aussi de documentation simple pour le bailleur.
              </p>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["/gestion-locative-lmnp", "Gestion locative LMNP"],
                ["/outil-gestion-locative", "Outil de gestion locative"],
                ["/modele-quittance-loyer-pdf", "Quittance de loyer"],
                ["/etats-des-lieux-documents", "État des lieux"],
                ["/capacite", "Capacité d’emprunt"],
                ["/investissement", "Rentabilité locative"],
                ["/pret-relais", "Prêt relais"],
                ["/parc-immobilier", "Parc immobilier"],
              ].map(([href, label]) => (
                <Link key={href} href={href} className="rounded-2xl border border-teal-100 bg-white/72 px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-white">
                  {label} →
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="bg-slate-100 px-4 py-14 sm:py-20">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr,1.2fr] lg:items-start">
            <div className="lg:sticky lg:top-24">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">FAQ</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Aide à choisir</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                Une FAQ organisée par usage : démarrer, gérer, simuler, protéger les données et comprendre ce que l’outil ne remplace pas.
              </p>
              <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-950">À retenir</p>
                <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-600">
                  <p>lokt.fr peut être utilisé module par module : quittance seule, bail + quittance, état des lieux, simulateurs ou suivi complet.</p>
                  <p>Les simulateurs donnent une base de décision, tandis que l’espace bailleur sert à suivre les actions et documents dans le temps.</p>
                </div>
                <Link href="/guides" className="mt-4 inline-flex text-sm font-semibold text-slate-950 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-900">
                  Voir les guides bailleurs →
                </Link>
              </div>
            </div>

            <div className="grid gap-5">
              {[
                ["Démarrer", faqData.slice(0, 3)],
                ["Gestion locative", faqData.slice(3, 6)],
                ["Simulateurs", faqData.slice(6, 8)],
                ["Compte et données", faqData.slice(8)],
              ].map(([groupLabel, items]) => (
                <div key={String(groupLabel)} className="rounded-[1.55rem] border border-slate-200 bg-white/55 p-3 shadow-sm">
                  <p className="px-2 pb-2 pt-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">{String(groupLabel)}</p>
                  <div className="grid gap-3">
                    {(items as typeof faqData).map((f) => (
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
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}
