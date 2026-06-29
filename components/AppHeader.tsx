// components/AppHeader.tsx
import Link from "next/link";
import { useRouter } from "next/router";
import {
  ArrowTrendingUpIcon,
  BanknotesIcon,
  BookOpenIcon,
  BuildingOffice2Icon,
  CalculatorIcon,
  ChartBarIcon,
  ChevronDownIcon,
  HomeModernIcon,
  MapPinIcon,
  ScaleIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { useAuthUser } from "../hooks/useAuthUser";
import { useTenantAuthUser } from "../hooks/useTenantAuthUser";
import { GUIDE_CATEGORIES, getGuidesByCategory } from "../lib/guides";

/**
 * ✅ LOKT V1 (landing-first)
 * - Header minimal : Logo + pages clés.
 *
 * Quand tu passeras à la V2 SaaS : tu pourras remettre la logique auth/nav.
 */

type NavLink = {
  href: string;
  label: string;
  external?: boolean;
};

const CALCULATOR_LINKS = [
  { href: "/capacite", label: "Capacité d'emprunt", description: "Déterminer votre budget d'achat", icon: BanknotesIcon },
  { href: "/pret-relais", label: "Prêt relais", description: "Acheter avant d'avoir vendu", icon: HomeModernIcon },
  { href: "/investissement", label: "Rentabilité locative", description: "Comparer rendement et cash-flow", icon: ArrowTrendingUpIcon },
  { href: "/plus-value-vente-immobiliere", label: "Plus-value immobilière", description: "Estimer votre cash net vendeur", icon: ChartBarIcon },
  { href: "/acheter-ou-louer", label: "Acheter ou louer ?", description: "RP, locatif ou attendre — la bonne stratégie", icon: ScaleIcon },
  { href: "/parc-immobilier", label: "Parc immobilier", description: "Consolider vos biens locatifs", icon: BuildingOffice2Icon },
];

export default function AppHeader({ staticMode = false }: { staticMode?: boolean }) {
  const router = useRouter();
  const { checking: authChecking, isLoggedIn } = useAuthUser();
  const { checking: tenantChecking, isLoggedIn: isTenantLoggedIn } = useTenantAuthUser();
  void staticMode;

  // ✅ Toggle simple : V1 landing
  const LOKT_V1_LANDING = true;

  // Liens minimalistes V1
  const v1Links: NavLink[] = [
    { href: "/calculettes", label: "Calculettes" },
    { href: "/outil-gestion-locative", label: "Outil bailleur" },
    { href: "/guides", label: "Guides" },
    { href: "/tarifs", label: "Tarifs" },
    { href: "/#faq", label: "FAQ" },
    { href: "mailto:contact@lokt.fr", label: "Contact", external: true },
  ];
  const navLinks =
    authChecking || isLoggedIn
      ? v1Links.filter((link) => link.href !== "/outil-gestion-locative")
      : v1Links;

  const isActive = (href: string) => {
    if (href.startsWith("/#")) return false;
    if (href === "/") return router.pathname === "/";
    return router.pathname === href || router.pathname.startsWith(href + "/");
  };

  // 🎨 Brand lokt.fr (accent global)
  const brandBg = "bg-gradient-to-r from-indigo-700 to-cyan-500";
  const brandText = "text-white";
  const brandHover = "hover:opacity-95";

  // Header V1 : minimal
  if (LOKT_V1_LANDING) {
    return (
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Brand */}
            <Link href="/" className="flex items-center gap-3">
              <img
                src="/LOKT_LOGO.jpg"
                alt="lokt.fr"
                className="h-7 w-auto object-contain sm:h-10 md:h-11"
              />
              <span className="hidden sm:inline text-xs font-semibold tracking-wide text-slate-600">
                Simuler • Décider • Optimiser
              </span>
            </Link>

            {/* Minimal links */}
            <nav className="flex items-center gap-1.5">
              {navLinks.map((l) =>
                l.href === "/calculettes" ? (
                  <div key={l.label} className="group relative hidden md:block">
                    <Link
                      href={l.href}
                      className={
                        "inline-flex items-center gap-1 rounded-full px-3 py-2 text-[0.8rem] font-semibold transition " +
                        (isActive(l.href) ? `${brandBg} ${brandText} ${brandHover}` : "text-slate-700 hover:bg-slate-100")
                      }
                    >
                      {l.label}
                      <ChevronDownIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                    <div className="invisible absolute left-1/2 top-full z-50 w-[520px] -translate-x-1/2 pt-3 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                      <div className="border border-slate-200 bg-white p-3 shadow-xl">
                        <div className="grid gap-1">
                          {CALCULATOR_LINKS.map((calculator) => {
                            const Icon = calculator.icon;
                            return (
                              <Link key={calculator.href} href={calculator.href} className="group/item flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-50 via-cyan-50 to-emerald-50 text-indigo-700">
                                  <Icon className="h-5 w-5" />
                                </span>
                                <span>
                                  <span className="block text-xs font-bold text-slate-900 group-hover/item:text-indigo-700">{calculator.label}</span>
                                  <span className="mt-0.5 block text-[0.7rem] text-slate-500">{calculator.description}</span>
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                        <Link href="/calculettes" className="mt-2 flex items-center gap-2 border-t border-slate-200 px-3 pt-3 text-xs font-bold text-slate-950 hover:text-indigo-700">
                          <CalculatorIcon className="h-4 w-4" />
                          Voir toutes les calculettes →
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : l.href === "/guides" ? (
                  <div key={l.label} className="group relative hidden md:block">
                    <Link
                      href={l.href}
                      className={
                        "inline-flex items-center gap-1 rounded-full px-3 py-2 text-[0.8rem] font-semibold transition " +
                        (isActive(l.href) ? `${brandBg} ${brandText} ${brandHover}` : "text-slate-700 hover:bg-slate-100")
                      }
                    >
                      {l.label}
                      <ChevronDownIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                    <div className="invisible absolute left-1/2 top-full z-50 w-[680px] -translate-x-1/2 pt-3 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                      <div className="grid grid-cols-2 gap-x-5 gap-y-4 border border-slate-200 bg-white p-4 shadow-xl">
                        {GUIDE_CATEGORIES.map((category) => (
                          <div key={category.key}>
                            <Link href={`/guides#${category.key}`} className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-indigo-700 hover:underline">
                              {category.label}
                            </Link>
                            <div className="mt-2 space-y-1">
                              {getGuidesByCategory(category.key).map((guide) => (
                                <Link key={guide.slug} href={`/guides/${guide.slug}`} className="block py-0.5 text-xs font-semibold leading-4 text-slate-700 hover:text-indigo-700">
                                  {guide.shortTitle}
                                </Link>
                              ))}
                            </div>
                          </div>
                        ))}
                        <div className="col-span-2 flex items-center justify-between border-t border-slate-200 pt-3">
                          <Link href="/rendement-locatif" className="text-xs font-semibold text-slate-500 hover:text-indigo-700">
                            Rendement locatif par ville →
                          </Link>
                          <Link href="/guides" className="text-xs font-bold text-slate-950 hover:text-indigo-700">
                            Voir tous les guides →
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ) :
                l.external ? (
                  <a
                    key={l.label}
                    href={l.href}
                    className="hidden rounded-full px-3 py-2 text-[0.8rem] font-semibold text-slate-700 hover:bg-slate-100 xl:inline-flex"
                  >
                    {l.label}
                  </a>
                ) : (
                  <Link
                    key={l.label}
                    href={l.href}
                    className={
                      "hidden rounded-full px-3 py-2 text-[0.8rem] font-semibold transition md:inline-flex " +
                      (isActive(l.href)
                        ? `${brandBg} ${brandText} ${brandHover}`
                        : "text-slate-700 hover:bg-slate-100")
                    }
                  >
                    {l.label}
                  </Link>
                )
              )}

              <Link
                href="/calculettes"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 sm:h-10 sm:w-10 md:hidden"
                title="Calculettes immobilières"
                aria-label="Calculettes immobilières"
              >
                <CalculatorIcon className="h-5 w-5" />
              </Link>

              <Link
                href="/guides"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 sm:h-10 sm:w-10 md:hidden"
                title="Guides du bailleur"
                aria-label="Guides du bailleur"
              >
                <BookOpenIcon className="h-5 w-5" />
              </Link>

              {authChecking ? (
                <>
                  <span className="hidden h-10 w-28 rounded-full bg-slate-100 sm:inline-flex" aria-hidden="true" />
                  <span className="h-9 w-9 rounded-full bg-slate-100 sm:hidden" aria-hidden="true" />
                </>
              ) : isLoggedIn ? (
                <>
                  <Link
                    href="/mon-compte"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 sm:hidden"
                    title="Mon compte"
                    aria-label="Mon compte"
                  >
                    <UserCircleIcon className="h-5 w-5" />
                  </Link>
                  <Link
                    href="/mon-compte"
                    className="hidden rounded-full border border-slate-200 bg-white px-3 py-2 text-[0.8rem] font-semibold text-slate-700 hover:bg-slate-50 sm:inline-flex"
                  >
                    Mon compte
                  </Link>
                  <Link
                    href="/espace-bailleur"
                    className={`inline-flex min-h-9 items-center justify-center gap-1 rounded-full px-2.5 py-2 text-[0.76rem] font-semibold shadow-sm sm:min-h-10 sm:gap-1.5 sm:px-3 sm:text-[0.8rem] ${brandBg} ${brandText} ${brandHover}`}
                    title="Espace bailleur"
                    aria-label="Espace bailleur"
                  >
                    <BuildingOffice2Icon className="h-4 w-4 sm:hidden" aria-hidden="true" />
                    <span className="sm:hidden">Bailleur</span>
                    <span className="hidden sm:inline">Espace bailleur</span>
                  </Link>
                </>
              ) : isTenantLoggedIn ? (
                <Link
                  href="/espace-locataire"
                  className={`inline-flex min-h-9 items-center justify-center gap-1 rounded-full px-2.5 py-2 text-[0.76rem] font-semibold shadow-sm sm:min-h-10 sm:gap-1.5 sm:px-3 sm:text-[0.8rem] ${brandBg} ${brandText} ${brandHover}`}
                  title="Espace locataire"
                  aria-label="Espace locataire"
                >
                  <HomeModernIcon className="h-4 w-4 sm:hidden" aria-hidden="true" />
                  <span className="sm:hidden">Mon espace</span>
                  <span className="hidden sm:inline">Espace locataire</span>
                </Link>
              ) : (
                <>
                  <Link
                    href="/mon-compte?mode=login"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 sm:hidden"
                    title="Se connecter"
                    aria-label="Se connecter"
                  >
                    <UserCircleIcon className="h-5 w-5" />
                  </Link>
                  <Link
                    href="/mon-compte?mode=login"
                    className="hidden min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-[0.8rem] font-semibold text-slate-800 hover:bg-slate-50 sm:inline-flex"
                  >
                    Se connecter
                  </Link>
                  <Link
                    href="/mon-compte?mode=register&redirect=/espace-bailleur"
                    className={`inline-flex min-h-9 items-center justify-center gap-1 rounded-full px-2.5 py-2 text-[0.76rem] font-semibold shadow-sm sm:min-h-10 sm:gap-1.5 sm:px-3 sm:text-[0.8rem] ${brandBg} ${brandText} ${brandHover}`}
                    title="Créer un compte bailleur"
                    aria-label="Créer un compte bailleur"
                  >
                    <BuildingOffice2Icon className="h-4 w-4 sm:hidden" aria-hidden="true" />
                    <span className="sm:hidden">Bailleur</span>
                    <span className="hidden sm:inline">Créer un compte gratuit</span>
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>
    );
  }

  // (Réservé V2 si tu veux réactiver un header SaaS plus tard)
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/LOKT_LOGO.jpg"
              alt="lokt.fr"
              className="h-10 md:h-11 w-auto object-contain"
            />
            <span className="hidden sm:inline text-xs font-semibold tracking-wide text-slate-600">
              Simuler • Décider • Optimiser
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
