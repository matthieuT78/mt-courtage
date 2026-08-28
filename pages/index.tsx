// pages/index.tsx
import Head from "next/head";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import ReviewsSection from "../components/ReviewsSection";
import { supabase } from "../lib/supabaseClient";
import { firstNameFromUser } from "../lib/userDisplay";
import { useScrollReveal } from "../hooks/useScrollReveal";

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
    icon: "loan" | "bridge" | "yield" | "portfolio" | "sale" | "bailleur";
    badge?: string;
  }> = [
    // ✅ badge "Gratuit" supprimé
    { title: "Capacité d’emprunt", oneLiner: "Budget & mensualité en 2 min.", href: "/capacite", icon: "loan" },
    { title: "Prêt relais", oneLiner: "Acheter avant de vendre.", href: "/pret-relais", icon: "bridge" },
    { title: "Rentabilité locative", oneLiner: "Cash-flow & rendement.", href: "/investissement", icon: "yield" },
    { title: "Parc immobilier", oneLiner: "Vision consolidée multi-biens.", href: "/parc-immobilier", icon: "portfolio" },
    { title: "Plus-value immobilière", oneLiner: "Estimer le cash net.", href: "/plus-value-vente-immobiliere", icon: "sale" },
    { title: "Acheter ou louer", oneLiner: "Comparer les deux scénarios.", href: "/acheter-ou-louer", icon: "bailleur" },
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
                <p className="mt-1 text-sm text-slate-600">Sélectionnez l’outil adapté à votre situation. Gratuit, sans compte.</p>
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

  // Si un lien d'invitation locataire atterrit ici par erreur (mauvaise config Supabase redirect),
  // le renvoyer vers la bonne page avant que le token soit perdu
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash.includes("type=invite") || hash.includes("type=recovery")) {
      window.location.replace("/espace-locataire/connexion" + hash);
    }
  }, []);

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

  useScrollReveal();

  const isLoggedIn = !!user;
  const displayName = useMemo(() => firstNameFromUser(user), [user]);

  // SEO
  const siteUrl = "https://lokt.fr";
  const pageUrl = `${siteUrl}/`;

  const title =
    "lokt.fr : gestion locative gratuite et simulateurs";
  const description =
    "Gérez vos locations sans agence : quittances, baux et finance automatisés. Simulez rentabilité et capacité d’emprunt. Gratuit, sans limite de durée.";
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

    // Pas de bloc Organization ici : _app.tsx en injecte déjà un globalement
    // (toutes pages) — un second bloc sur la home créerait un schema dupliqué.
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

    return [webSite, softwareApplication, faqPage];
  }, [faqData, siteUrl]);

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
        <section className="lokt-public-hero relative overflow-hidden bg-[#07040f] px-4 pb-10 pt-8 sm:pb-16 sm:pt-14">
          {/* Conic gradient rotatif */}
          <div aria-hidden className="lokt-hero-spin" />
          {/* Fondu bas vers la page */}
          <div aria-hidden className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-[#f6f9fc]" />

          <div className="relative mx-auto max-w-7xl">
            <div className="grid gap-7 sm:gap-10 lg:grid-cols-[0.88fr,1.12fr] lg:items-center">
              <div>
                <div className="anim-fadeUp d-0 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[0.72rem] font-semibold text-slate-700 shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Simulateurs immobiliers + gestion locative
                </div>

                <h1 className="anim-fadeUp d-1 mt-5 max-w-3xl text-[2.55rem] font-semibold leading-[0.96] tracking-tight text-white sm:mt-6 sm:text-6xl">
                  {isLoggedIn && displayName
                    ? `Bonjour ${displayName}. Votre gestion vous attend.`
                    : "Gestion locative gratuite et simulateurs immobiliers."}
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

                {!isLoggedIn && (
                  <p className="anim-fadeUp d-3 mt-3 text-xs text-white/70">
                    Gratuit pour 1 logement, sans limite de durée.
                  </p>
                )}
              </div>

              <div className="anim-fadeUp d-4">
                <div className="relative rounded-[1.5rem] overflow-hidden shadow-2xl shadow-black/30 sm:rounded-[2rem] ring-1 ring-white/10">
                  <img
                    src="/cockpit-bailleur-lokt.png"
                    alt="Cockpit bailleur lokt.fr — tableau de bord gestion locative"
                    className="w-full h-auto block"
                    loading="eager"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── DEUX PRODUITS ───────────────────────────────────────── */}
        <section className="border-b border-slate-200 bg-white px-4 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12">
              <p data-scroll-reveal className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">La plateforme</p>
              <h2 data-scroll-reveal data-reveal-delay="100" className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Deux outils. Une seule plateforme.
              </h2>
              <p data-scroll-reveal data-reveal-delay="200" className="mt-3 max-w-xl text-sm leading-7 text-slate-600">
                lokt.fr combine un espace de gestion locative complet et une suite de simulateurs immobiliers. Vous pouvez utiliser l’un, l’autre, ou les deux.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {/* Espace bailleur */}
              <div data-scroll-reveal data-reveal-delay="0" className="flex flex-col rounded-[1.75rem] bg-slate-950 p-8 text-white">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-cyan-300">Espace bailleur</p>
                <h3 className="mt-2 text-2xl font-semibold">Gérez vos locations de A à Z</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">Baux, loyers, quittances, alertes, relances, messagerie, EDL, signature électronique, documents et finance — au même endroit.</p>
                <ul className="mt-6 flex-1 space-y-3">
                  {[
                    ["Loky, assistant IA", "Décrivez ce que vous voulez faire, il s'en occupe"],
                    ["Candidatures en ligne", "Lien unique, dossiers scorés automatiquement, RGPD géré"],
                    ["Quittances automatiques", "Loyer confirmé → PDF généré → envoyé au locataire"],
                    ["Alertes & relances", "IRL, retards, baux expirants — zéro oubli"],
                    ["Messagerie locataire", "Historique complet des échanges dans le dossier"],
                    ["Portail locataire", "Documents en ligne, accusé de réception horodaté"],
                    ["Finance & déclaration", "Cash-flow, charges, exports et aide fiscale"],
                    ["États des lieux", "Entrée, sortie, inventaire avec photos"],
                  ].map(([title, desc]) => (
                    <li key={title} className="flex items-start gap-3">
                      <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cyan-400/20 text-[0.6rem] font-bold text-cyan-300">✓</span>
                      <div>
                        <p className="text-sm font-semibold text-white">{title}</p>
                        <p className="text-xs text-slate-400">{desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <Link href="/espace-bailleur" className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-full bg-white text-sm font-semibold text-slate-950 hover:bg-slate-100 sm:w-auto sm:px-6">
                  Ouvrir l’espace bailleur →
                </Link>
              </div>

              {/* Simulateurs */}
              <div data-scroll-reveal data-reveal-delay="120" className="flex flex-col rounded-[1.75rem] border border-[#635bff]/20 bg-white p-8">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#635bff]">Simulateurs immobiliers</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-950">Décidez avant d’agir</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">6 calculettes pour investisseurs et propriétaires. Gratuits, sans compte, résultats instantanés avec score de viabilité.</p>

                <div className="mt-6 flex-1 grid gap-2">
                  {[
                    ["/capacite", "Capacité d’emprunt", "Budget, mensualité, taux d’endettement", "loan" as const],
                    ["/investissement", "Rentabilité locative", "Cash-flow, rendement brut et net", "yield" as const],
                    ["/pret-relais", "Prêt relais", "Acheter avant de vendre", "bridge" as const],
                    ["/plus-value-vente-immobiliere", "Plus-value immobilière", "Cash net estimé après impôt", "sale" as const],
                    ["/parc-immobilier", "Parc immobilier", "Vision consolidée multi-biens", "portfolio" as const],
                    ["/acheter-ou-louer", "Acheter ou louer", "Comparer les deux scénarios", "bailleur" as const],
                  ].map(([href, name, desc, icon]) => (
                    <Link key={href} href={String(href)} className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-[#635bff]/30 hover:bg-[#635bff]/5">
                      <Sticker kind={icon as "loan" | "bridge" | "yield" | "portfolio" | "sale" | "bailleur"} className="h-9 w-9 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-950">{name}</p>
                        <p className="text-[0.68rem] text-slate-500">{desc}</p>
                      </div>
                      <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#635bff]">→</span>
                    </Link>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[#635bff]/20 bg-gradient-to-r from-[#635bff]/8 to-[#00d4ff]/8 px-4 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#635bff] to-[#00d4ff] text-sm font-bold text-white">
                    78
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Score lokt.fr inclus</p>
                    <p className="text-xs text-slate-500">Un score de 0 à 100 qui résume la viabilité de chaque projet</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── ESPACE BAILLEUR — FONCTIONNALITÉS ───────────────────── */}
        <section className="border-b border-slate-200 bg-[#f6f9fc] px-4 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12">
              <p data-scroll-reveal className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Espace bailleur — fonctionnalités</p>
              <h2 data-scroll-reveal data-reveal-delay="100" className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Ce que lokt.fr fait à votre place.
              </h2>
              <p data-scroll-reveal data-reveal-delay="200" className="mt-3 max-w-xl text-sm leading-7 text-slate-600">
                Pas un tableur. Pas un dossier de mails. Un outil qui suit le cycle locatif et vous pousse ce qui mérite une action.
              </p>
            </div>

            {/* Loky — assistant IA, tuile pleine largeur en tête de section */}
            <div data-scroll-reveal data-reveal-delay="0" className="mb-5 overflow-hidden rounded-[1.75rem] border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-7 shadow-sm">
              <div className="grid gap-8 lg:grid-cols-[1fr,1.1fr] lg:items-center">
                <div>
                  <div className="flex items-center gap-3">
                    <img src="/loky-avatar.png" alt="Loky" className="h-11 w-11 shrink-0 rounded-2xl object-cover shadow-sm" />
                    <div>
                      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-indigo-600">Nouveau · Assistant IA</span>
                      <h3 className="text-lg font-semibold text-slate-950">Loky fait la gestion à ta place</h3>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    Décris ce que tu veux en une phrase — Loky retrouve le bon bien, le bon locataire, résume l'action et te demande de confirmer avant de créer quoi que ce soit. Comme un assistant humain, mais disponible tout de suite.
                  </p>
                  <ul className="mt-4 space-y-1.5">
                    {[
                      "« Crée un bail pour Julien » → bail préparé, confirmation en un clic",
                      "« Marie a payé son loyer » → paiement confirmé, quittance générée automatiquement",
                      "« Je cherche un locataire » → annonce publiée pour recevoir des candidatures",
                      "Toujours une confirmation avant d'écrire quoi que ce soit sur votre compte",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="mt-0.5 text-indigo-600">✓</span> {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    <Link href="/tarifs" className="inline-flex h-9 items-center justify-center rounded-full bg-gradient-to-r from-indigo-700 to-cyan-500 px-5 text-xs font-semibold text-white hover:opacity-90 transition">
                      Inclus dans tous les plans payants, dès 6,90 €/mois →
                    </Link>
                  </div>
                </div>

                {/* Flow visuel */}
                <div className="space-y-2.5">
                  {[
                    { step: "01", label: "Tu écris ce que tu veux", sub: "« Crée un bail pour Julien, loyer 750€ »", color: "bg-slate-100 text-slate-600" },
                    { step: "02", label: "Loky retrouve tes données", sub: "Bien, locataire, lot — résolus automatiquement", color: "bg-sky-100 text-sky-700" },
                    { step: "03", label: "Il résume l'action prévue", sub: "Bien · Locataire · Loyer · Date de début", color: "bg-violet-100 text-violet-700" },
                    { step: "04", label: "Tu confirmes, c'est fait", sub: "Bail créé + prochaines étapes proposées", color: "bg-indigo-100 text-indigo-700" },
                  ].map(({ step, label, sub, color }) => (
                    <div key={step} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${color}`}>{step}</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{label}</p>
                        <p className="text-xs text-slate-500">{sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.1fr,0.9fr]">
              {/* Quittances auto — grande tuile gauche */}
              <div data-scroll-reveal data-reveal-delay="0" className="flex flex-col rounded-[1.75rem] border border-slate-200 bg-white p-7 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100">
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-emerald-700 stroke-[1.8]" aria-hidden>
                      <circle cx="12" cy="12" r="9" />
                      <path d="M8.5 12.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-emerald-700">Automatique</span>
                    <h3 className="text-lg font-semibold text-slate-950">Quittances de loyer</h3>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  Vous confirmez le paiement en un clic. La quittance PDF est générée, numérotée, archivée et envoyée au locataire automatiquement. Zéro saisie manuelle, zéro oubli.
                </p>
                <div className="mt-6 flex-1 space-y-2.5">
                  {[
                    { n: "1", label: "Loyer attendu", sub: "T2 Centre · 780 €", chip: "bg-slate-100 text-slate-600" },
                    { n: "2", label: "Paiement reçu", sub: "Virement confirmé le 3 juin", chip: "bg-sky-100 text-sky-700" },
                    { n: "3", label: "Quittance générée", sub: "PDF archivé · Envoi automatique", chip: "bg-violet-100 text-violet-700" },
                    { n: "✓", label: "Locataire notifié", sub: "Email + portail en ligne", chip: "bg-emerald-100 text-emerald-700" },
                  ].map(({ n, label, sub, chip }) => (
                    <div key={label} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${chip}`}>{n}</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{label}</p>
                        <p className="text-xs text-slate-500">{sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-xs text-emerald-700">Disponible en plan <span className="font-semibold">lokt·one</span></p>
                  <Link href="/tarifs" className="text-xs font-semibold text-emerald-800 underline underline-offset-2">6,90 € / mois →</Link>
                </div>
              </div>

              {/* Colonne droite : alertes + messagerie + portail */}
              <div className="flex flex-col gap-5">
                {/* Alertes & relances */}
                <div data-scroll-reveal data-reveal-delay="100" className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100">
                      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-amber-700 stroke-[1.8]" aria-hidden>
                        <path d="M12 3a6 6 0 0 0-6 6v3.5l-1.5 2v.5h15v-.5L18 12.5V9a6 6 0 0 0-6-6z" strokeLinejoin="round"/>
                        <path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div>
                      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-amber-700">Proactif</span>
                      <h3 className="text-base font-semibold text-slate-950">Alertes & relances</h3>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">lokt.fr surveille vos baux et vous pousse une action avant que ça devienne urgent.</p>
                  <div className="mt-4 space-y-2">
                    {[
                      ["🔴", "Loyer en retard · J+3", "Relance auto envoyée"],
                      ["🟡", "Révision IRL dans 12 j", "Bail T2 Centre"],
                      ["🟠", "Bail expire dans 45 j", "Appartement B · À renouveler"],
                      ["🔵", "EDL sortie à planifier", "Départ prévu fin juillet"],
                    ].map(([dot, title, sub]) => (
                      <div key={title} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
                        <span className="text-sm">{dot}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900">{title}</p>
                          <p className="text-[0.65rem] text-slate-500">{sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Messagerie + Portail */}
                <div data-scroll-reveal data-reveal-delay="200" className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100">
                        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-indigo-700 stroke-[1.8]" aria-hidden>
                          <rect x="3" y="5" width="18" height="14" rx="2"/>
                          <path d="M3 7l9 6 9-6" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <h3 className="mt-3 text-sm font-semibold text-slate-950">Messagerie</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Échangez directement avec votre locataire. Historique dans le dossier.</p>
                      <div className="mt-3 space-y-1.5">
                        <div className="rounded-xl bg-indigo-50 px-3 py-1.5 text-[0.68rem] text-indigo-700">← Quittance reçue, merci</div>
                        <div className="rounded-xl bg-slate-100 px-3 py-1.5 text-right text-[0.68rem] text-slate-600">Intervention le 14 →</div>
                      </div>
                    </div>
                    <div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#635bff]/10">
                        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-[#635bff] stroke-[1.8]" aria-hidden>
                          <path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinejoin="round"/>
                          <path d="M2 17l10 5 10-5" strokeLinecap="round"/>
                          <path d="M2 12l10 5 10-5" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <h3 className="mt-3 text-sm font-semibold text-slate-950">Portail locataire</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Bail, quittances, EDL et signatures électroniques accessibles en ligne. Accusé de réception horodaté.</p>
                      <div className="mt-3 rounded-xl border border-[#635bff]/20 bg-[#635bff]/5 px-3 py-2">
                        <p className="text-[0.65rem] font-semibold text-[#635bff]">Portail actif ✓</p>
                        <p className="text-[0.6rem] text-slate-500">3 documents partagés · Vu le 12 juin</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Candidatures — tuile pleine largeur */}
            <div data-scroll-reveal data-reveal-delay="0" className="mt-5 overflow-hidden rounded-[1.75rem] border border-[#635bff]/20 bg-gradient-to-br from-[#635bff]/5 via-white to-[#00d4ff]/5 p-7 shadow-sm">
              <div className="grid gap-8 lg:grid-cols-[1fr,1.1fr] lg:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#635bff]/10">
                      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-[#635bff] stroke-[1.8]" aria-hidden>
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round"/>
                      </svg>
                    </span>
                    <div>
                      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#635bff]">Différenciant</span>
                      <h3 className="text-lg font-semibold text-slate-950">Candidatures en ligne & scoring automatique</h3>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    Partagez un lien unique sur vos annonces. Les candidats postulent sans créer de compte. Vous recevez des dossiers scorés automatiquement — ratio loyer/revenu, type de contrat, garant — et choisissez le bon profil en quelques minutes.
                  </p>
                  <ul className="mt-4 space-y-1.5">
                    {[
                      "Lien dédié par annonce — aucune saisie manuelle",
                      "Agenda de visite intégré — le candidat réserve un créneau",
                      "Scoring automatique : revenus, stabilité, garant",
                      "Données des candidats non retenus supprimées (RGPD)",
                      "Dossier retenu pré-remplit le bail automatiquement",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-slate-700">
                        <span className="text-[#635bff]">✓</span> {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 flex items-center gap-3">
                    <Link href="/tarifs" className="inline-flex h-9 items-center justify-center rounded-full bg-[#635bff] px-5 text-xs font-semibold text-white hover:opacity-90 transition">
                      Disponible en lokt·one · 6,90 €/mois
                    </Link>
                  </div>
                </div>

                {/* Flow visuel */}
                <div className="space-y-2.5">
                  {[
                    { step: "01", label: "Annonce publiée", sub: "Lien lokt.fr partagé sur SeLoger, LeBonCoin…", color: "bg-slate-100 text-slate-600" },
                    { step: "02", label: "Candidat postule", sub: "Dossier rempli en ligne, sans créer de compte", color: "bg-sky-100 text-sky-700" },
                    { step: "03", label: "Score calculé", sub: "Ratio loyer/revenu · CDI/CDD/TNS · Garant ✓", color: "bg-violet-100 text-violet-700" },
                    { step: "04", label: "Vous choisissez", sub: "Profils comparés côte à côte · Bail pré-rempli", color: "bg-[#635bff]/10 text-[#635bff]" },
                  ].map(({ step, label, sub, color }) => (
                    <div key={step} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${color}`}>{step}</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{label}</p>
                        <p className="text-xs text-slate-500">{sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bail & EDL — signature électronique */}
            <div data-scroll-reveal data-reveal-delay="0" className="mt-5 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-7 shadow-sm">
              <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#635bff]/10">
                      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-[#635bff] stroke-[1.8]" aria-hidden>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round"/>
                        <polyline points="14,2 14,8 20,8" strokeLinejoin="round"/>
                        <path d="M9 12h6M9 16h4" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div>
                      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#635bff]">Intégré</span>
                      <h3 className="text-lg font-semibold text-slate-950">Bail & état des lieux numériques</h3>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    Rédigez votre contrat de bail ou réalisez votre état des lieux dans lokt.fr, puis envoyez les liens de signature par email. Bailleur et locataire signent chacun depuis leur téléphone. Le PDF certifié est archivé automatiquement.
                  </p>
                  <ul className="mt-4 space-y-1.5">
                    {[
                      "Contrat de bail généré selon le type de location",
                      "État des lieux d'entrée et de sortie avec photos",
                      "Signature électronique simple conforme eIDAS",
                      "PDF certifié archivé — audit trail et hash SHA-256",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-slate-700">
                        <span className="text-[#635bff]">✓</span> {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    <Link href="/espace-bailleur" className="inline-flex h-9 items-center justify-center rounded-full bg-[#635bff] px-5 text-xs font-semibold text-white hover:opacity-90 transition">
                      Gratuit, sur tous les plans →
                    </Link>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {[
                    { step: "01", label: "PDF généré dans lokt.fr", sub: "Bail ou EDL selon le type de location", color: "bg-slate-100 text-slate-600" },
                    { step: "02", label: "Liens envoyés par email", sub: "Un lien unique pour le bailleur, un pour le locataire", color: "bg-sky-100 text-sky-700" },
                    { step: "03", label: "Chacun signe depuis son écran", sub: "Sans compte lokt.fr · Mobile ou ordinateur", color: "bg-violet-100 text-violet-700" },
                    { step: "04", label: "PDF certifié archivé", sub: "Page de certificat · Hash SHA-256 · eIDAS Art. 3(10)", color: "bg-[#635bff]/10 text-[#635bff]" },
                  ].map(({ step, label, sub, color }) => (
                    <div key={step} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${color}`}>{step}</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{label}</p>
                        <p className="text-xs text-slate-500">{sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div data-scroll-reveal className="mt-5 flex flex-col gap-3 rounded-[1.75rem] border border-slate-200 bg-white px-6 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">Gratuit pour 1 logement — bail, état des lieux et signature électronique inclus. lokt·one débloque quittances auto, candidatures et portail locataire.</p>
              <Link href="/espace-bailleur" className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800">
                Essayer l’espace bailleur →
              </Link>
            </div>
          </div>
        </section>

        {/* ─── SCREENSHOTS ─────────────────────────────────────────── */}
        <section className="border-b border-slate-200 bg-white px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10">
              <p data-scroll-reveal className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">L'outil en vrai</p>
              <h2 data-scroll-reveal data-reveal-delay="100" className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Pas un tableur. Un cockpit.
              </h2>
              <p data-scroll-reveal data-reveal-delay="200" className="mt-3 max-w-xl text-sm leading-7 text-slate-600">
                Voici deux vues de l'espace bailleur — les loyers du mois et la finance — telles qu'elles apparaissent dans l'outil.
              </p>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Quittances */}
              <div data-scroll-reveal data-reveal-delay="0">
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-100">
                    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-emerald-700" aria-hidden><path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5z" clipRule="evenodd"/></svg>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Loyers & quittances</p>
                    <p className="text-[0.68rem] text-slate-500">Confirmation, PDF, envoi — tout en un clic</p>
                  </div>
                </div>
                <div className="overflow-hidden rounded-[1rem] border border-slate-200 shadow-xl shadow-slate-900/10 sm:rounded-[1.25rem]">
                  <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                    <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
                    <span className="h-2 w-2 rounded-full bg-[#ffbd2e]" />
                    <span className="h-2 w-2 rounded-full bg-[#28c840]" />
                    <span className="ml-3 rounded-full bg-slate-200 px-3 py-0.5 text-[0.6rem] font-medium text-slate-500">Loyers du mois</span>
                  </div>
                  <img src="/blog/quittance.png" alt="Section loyers et quittances lokt.fr" className="w-full h-auto block" loading="lazy" />
                </div>
              </div>
              {/* Finance */}
              <div data-scroll-reveal data-reveal-delay="120">
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-100">
                    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-indigo-700" aria-hidden><path d="M15.5 2A1.5 1.5 0 0 0 14 3.5v13a1.5 1.5 0 0 0 3 0v-13A1.5 1.5 0 0 0 15.5 2zM9.5 6A1.5 1.5 0 0 0 8 7.5v9a1.5 1.5 0 0 0 3 0v-9A1.5 1.5 0 0 0 9.5 6zM3.5 10A1.5 1.5 0 0 0 2 11.5v5a1.5 1.5 0 0 0 3 0v-5A1.5 1.5 0 0 0 3.5 10z"/></svg>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Finance & trésorerie</p>
                    <p className="text-[0.68rem] text-slate-500">Cash-flow mensuel, dépenses classées, exports</p>
                  </div>
                </div>
                <div className="overflow-hidden rounded-[1rem] border border-slate-200 shadow-xl shadow-slate-900/10 sm:rounded-[1.25rem]">
                  <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                    <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
                    <span className="h-2 w-2 rounded-full bg-[#ffbd2e]" />
                    <span className="h-2 w-2 rounded-full bg-[#28c840]" />
                    <span className="ml-3 rounded-full bg-slate-200 px-3 py-0.5 text-[0.6rem] font-medium text-slate-500">Vue finance</span>
                  </div>
                  <img src="/blog/finance.png" alt="Section finance lokt.fr" className="w-full h-auto block" loading="lazy" />
                </div>
              </div>
            </div>
            <div data-scroll-reveal className="mt-6 flex justify-center">
              <Link href="/espace-bailleur" className="inline-flex h-11 items-center gap-2 rounded-full bg-slate-950 px-6 text-sm font-semibold text-white hover:bg-slate-800">
                Ouvrir l'espace bailleur →
              </Link>
            </div>
          </div>
        </section>

        {/* ─── SIMULATEURS + SCORE ─────────────────────────────────── */}
        <section className="border-b border-slate-200 bg-white px-4 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-12 lg:grid-cols-[1fr,1.1fr] lg:items-start">
              <div>
                <p data-scroll-reveal className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Simulateurs immobiliers</p>
                <h2 data-scroll-reveal data-reveal-delay="100" className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  Six calculettes. Un score de viabilité.
                </h2>
                <p data-scroll-reveal data-reveal-delay="200" className="mt-4 text-sm leading-7 text-slate-600">
                  Chaque simulateur donne un résultat chiffré — et un score lokt.fr de 0 à 100 qui résume si le projet tient la route. Gratuit, sans compte.
                </p>

                {/* Score lokt.fr */}
                <div data-scroll-reveal data-reveal-delay="300" className="mt-7 rounded-[1.55rem] border border-[#635bff]/20 bg-gradient-to-br from-[#635bff]/6 to-[#00d4ff]/6 p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#635bff] to-[#00d4ff] text-xl font-bold text-white shadow-lg shadow-[#635bff]/25">
                      78
                    </div>
                    <div>
                      <p className="text-base font-semibold text-slate-950">Score lokt.fr</p>
                      <p className="mt-0.5 text-sm text-[#635bff] font-medium">Projet viable · Marge de sécurité correcte</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    Le score agrège les paramètres clés — taux d’endettement, rendement net, vacance estimée, effort mensuel — en un indicateur de 0 à 100.
                    En dessous de 50, le projet mérite d’être revu. Au-dessus de 70, il tient la route.
                  </p>
                  <div className="mt-4 flex gap-3">
                    <div className="flex-1 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-center">
                      <p className="text-[0.65rem] font-semibold text-red-700">0 – 49</p>
                      <p className="text-[0.6rem] text-red-600">À revoir</p>
                    </div>
                    <div className="flex-1 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-center">
                      <p className="text-[0.65rem] font-semibold text-amber-700">50 – 69</p>
                      <p className="text-[0.6rem] text-amber-600">Acceptable</p>
                    </div>
                    <div className="flex-1 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-center">
                      <p className="text-[0.65rem] font-semibold text-emerald-700">70 – 100</p>
                      <p className="text-[0.6rem] text-emerald-600">Viable</p>
                    </div>
                  </div>
                </div>

                <button
                  data-scroll-reveal
                  data-reveal-delay="400"
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="mt-6 inline-flex h-11 items-center rounded-full bg-[#635bff] px-6 text-sm font-semibold text-white hover:bg-[#4f46e5]"
                >
                  Choisir un simulateur →
                </button>
              </div>

              <div className="grid gap-3">
                {[
                  { href: "/capacite", icon: "loan" as const, name: "Capacité d’emprunt", desc: "Budget maximum, mensualité et taux d’endettement réels", color: "from-blue-500 to-cyan-400" },
                  { href: "/investissement", icon: "yield" as const, name: "Rentabilité locative", desc: "Cash-flow mensuel, rendement brut, net et net-net", color: "from-emerald-500 to-teal-400" },
                  { href: "/pret-relais", icon: "bridge" as const, name: "Prêt relais", desc: "Financer l’achat avant la vente sans blocage de trésorerie", color: "from-cyan-500 to-blue-400" },
                  { href: "/plus-value-vente-immobiliere", icon: "sale" as const, name: "Plus-value immobilière", desc: "Cash net estimé après impôt sur cession", color: "from-amber-500 to-orange-400" },
                  { href: "/parc-immobilier", icon: "portfolio" as const, name: "Parc immobilier", desc: "Rendement global et performance de l’ensemble de vos biens", color: "from-violet-500 to-purple-400" },
                  { href: "/acheter-ou-louer", icon: "bailleur" as const, name: "Acheter ou louer", desc: "Comparer le coût réel des deux scénarios sur la durée", color: "from-slate-500 to-slate-400" },
                ].map((sim, i) => (
                  <Link key={sim.href} href={sim.href} data-scroll-reveal data-reveal-delay={String(i * 70)} className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${sim.color}`}>
                      <Icon name={sim.icon === "loan" ? "loan" : sim.icon === "yield" ? "yield" : sim.icon === "bridge" ? "bridge" : sim.icon === "sale" ? "sale" : sim.icon === "bailleur" ? "bailleur" : "portfolio"} className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-950">{sim.name}</p>
                      <p className="text-xs leading-5 text-slate-500">{sim.desc}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.6rem] font-semibold text-slate-500">Gratuit</span>
                      <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#635bff]">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-[#f6f9fc] px-4 py-14 sm:py-20">
          <div className="mx-auto max-w-7xl">
            <div data-scroll-reveal className="mb-10">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Tarifs</p>
              <h2 className="mt-3 max-w-2xl font-semibold leading-tight text-slate-950">
                <span className="block text-3xl sm:text-4xl">Gratuit pour gérer.</span>
                <span className="mt-1 block text-2xl text-[#635bff] sm:text-3xl">Payant quand lokt.fr automatise.</span>
              </h2>
            </div>

            <div data-scroll-reveal className="mb-8 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm sm:rounded-[1.75rem]">
              <div className="px-4 py-5 sm:px-6 sm:py-6">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#635bff]">Pourquoi payer un abonnement plutôt qu'une agence ?</p>
                <h3 className="mt-1 text-xl font-semibold leading-tight text-slate-950 sm:text-2xl">0 % de commission sur votre loyer.</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Pour un loyer de 800 €/mois, une agence facture en moyenne 7 à 8 % de frais de gestion courante
                  (encaissement, quittances, relances), souvent complétés par des frais de mise en location. lokt.fr
                  ne prend jamais de commission sur votre loyer : vous payez un abonnement fixe, quel que soit le montant encaissé.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agence (gestion courante)</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">~700 à 800 € / an</p>
                    <p className="mt-1 text-xs text-slate-500">7 à 8 % du loyer annuel, en plus des frais de mise en location facturés à part.</p>
                  </div>
                  <div className="rounded-2xl border border-[#635bff]/30 bg-[#635bff]/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#4f46e5]">lokt·plus, engagement annuel</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">119 € / an</p>
                    <p className="mt-1 text-xs text-slate-600">Soit 2 mois offerts vs 11,90 €/mois sans engagement. Toujours sans commission, quel que soit le loyer encaissé.</p>
                  </div>
                </div>
                <p className="mt-4 text-xs font-semibold text-emerald-700">
                  Soit environ 600 à 700 € d'économie par an sur ce seul poste, pour un logement.
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  Vous hésitez avec un autre logiciel de gestion locative ?{" "}
                  <Link href="/comparatif-logiciel-gestion-locative" className="font-semibold text-[#635bff] underline underline-offset-2 hover:text-[#4f46e5]">
                    Voir le comparatif détaillé →
                  </Link>
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  name: "Gratuit",
                  price: "0 €",
                  cadence: "1 logement actif",
                  desc: "Biens, baux, quittances PDF, états des lieux, finance simple, 4 alertes.",
                  features: ["1 logement actif", "Quittances manuelles", "États des lieux", "Finance simple", "4 alertes essentielles"],
                  cta: "Créer mon espace",
                  href: "/mon-compte?mode=register&redirect=/espace-bailleur",
                  card: "border-emerald-200 bg-white",
                  badge: null as string | null,
                  ctaClass: "bg-emerald-700 text-white hover:bg-emerald-600",
                },
                {
                  name: "lokt·one",
                  price: "6,90 €",
                  cadence: "/ mois · 2 logements",
                  desc: "Automatisation complète + portail locataire + partage de documents.",
                  features: ["Quittances automatiques", "Candidatures en ligne & scoring", "Portail locataire activé", "Toutes les alertes", "Accusé de réception"],
                  cta: "Souscrire",
                  href: "/tarifs",
                  card: "border-[#635bff]/30 bg-white ring-2 ring-[#635bff]/10",
                  badge: "Recommandé" as string | null,
                  ctaClass: "bg-gradient-to-r from-[#635bff] to-[#00d4ff] text-white hover:opacity-90",
                },
                {
                  name: "lokt·plus",
                  price: "11,90 €",
                  cadence: "/ mois · 15 logements",
                  desc: "Pilotage investisseur : rentabilité, outils bailleur, exports, déclaration.",
                  features: ["Performance & cash-flow", "Boîte à outils bailleur", "Aide à la déclaration", "Exports financiers", "15 logements actifs"],
                  cta: "Souscrire",
                  href: "/tarifs",
                  card: "border-slate-200 bg-white",
                  badge: null as string | null,
                  ctaClass: "bg-slate-950 text-white hover:bg-slate-800",
                },
              ].map((plan) => (
                <div key={plan.name} data-scroll-reveal className={`relative flex flex-col rounded-[1.75rem] border p-7 shadow-sm ${plan.card}`}>
                  {plan.badge ? (
                    <span className="absolute right-5 top-5 rounded-full border border-[#635bff]/20 bg-[#635bff]/10 px-2.5 py-0.5 text-[0.68rem] font-semibold text-[#3f37c9]">
                      {plan.badge}
                    </span>
                  ) : null}
                  <p className="text-sm font-semibold text-slate-500">{plan.name}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                    {plan.price} <span className="text-base font-normal text-slate-400">{plan.cadence}</span>
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{plan.desc}</p>
                  <ul className="mt-5 flex-1 space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                        <span className="font-bold text-[#635bff]">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <Link href={plan.href} className={`mt-6 inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold ${plan.ctaClass}`}>
                    {plan.cta} →
                  </Link>
                </div>
              ))}
            </div>

            <p data-scroll-reveal className="mt-6 text-center text-xs text-slate-500">
              Sans engagement · Résiliable à tout moment ·{" "}
              <Link href="/tarifs" className="underline underline-offset-2 hover:text-slate-700">
                Voir le comparatif complet
              </Link>
            </p>
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
                Des explications claires sur les sujets qui reviennent tout le temps — LMNP, quittance de loyer, état des lieux, capacité d’emprunt —
                pour comprendre avant de vous lancer, sans jargon juridique.
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

        <ReviewsSection />

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
