// components/landlord/DashboardShell.tsx
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  ArrowUpRightIcon,
  CheckCircleIcon,
  LockClosedIcon,
  MoonIcon,
  SparklesIcon,
  SunIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { SidebarNav, LandlordSectionKey } from "./SidebarNav";
import { supabase } from "../../lib/supabaseClient";
import {
  DEFAULT_LANDLORD_NAV_ORDER,
  LANDLORD_NAV_ITEMS,
  getLandlordNavItems,
  normalizeLandlordNavOrder,
} from "./navigation";

import { SectionDashboard } from "./sections/SectionDashboard";
import { SectionBiens } from "./sections/SectionBiens";
import { SectionLocataires } from "./sections/SectionLocataires";
import { SectionBaux } from "./sections/SectionBaux";
import { SectionMessagerie } from "./sections/SectionMessagerie";
import { SectionAlertes } from "./sections/SectionAlertes";
import { SectionQuittances } from "./sections/SectionQuittances";
import { SectionFinance } from "./sections/SectionFinance";
import { SectionPerformance } from "./sections/SectionPerformance";
import { SectionEtatDesLieux } from "./sections/SectionEtatDesLieux";
import { SectionInventaire } from "./sections/SectionInventaire";
import { SectionDeclaration } from "./sections/SectionDeclaration";
import { SectionOutils } from "./sections/SectionOutils";
import { SectionParametres } from "./sections/SectionParametres";
import { SectionDocumentsTemplates } from "./sections/SectionDocumentsTemplates";
import { SectionDossierBail } from "./sections/SectionDossierBail";
import { usePermissions } from "../PermissionProvider";
import { getBillingPlan } from "../../lib/billingPlans";
import { planAllowsPerformance, planAllowsTools, planAllowsDocumentSharing } from "../../lib/permissions";

type LockedSectionConfig = {
  eyebrow: string;
  title: string;
  desc: string;
  requiredPlan: "Starter" | "Essentiel";
  href: string;
  cta: string;
  features: string[];
};

function LockedPremiumSection({ config }: { config: LockedSectionConfig }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="h-1.5 bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8]" />
      <div className="grid gap-0 lg:grid-cols-[1fr,340px]">
        <div className="p-6 sm:p-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#635bff]/20 bg-[#635bff]/5 px-3 py-1 text-xs font-semibold text-[#4f46e5]">
            <LockClosedIcon className="h-4 w-4" aria-hidden="true" />
            {config.eyebrow}
          </div>

          <h2 className="mt-4 max-w-2xl text-2xl font-semibold leading-tight text-slate-950">{config.title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{config.desc}</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {config.features.map((feature) => (
              <div key={feature} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <p className="text-sm leading-5 text-slate-700">{feature}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="border-t border-slate-200 bg-[#f6f9fc] p-6 lg:border-l lg:border-t-0">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <SparklesIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="mt-4 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Plan requis</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">{config.requiredPlan}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Votre compte gratuit reste disponible pour le tableau de bord, biens, locataires, baux, quittances manuelles et finance de base.
            </p>
            <Link
              href={config.href}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {config.cta}
              <ArrowUpRightIcon className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}

function MobileBottomNav({
  active,
  onChange,
  moreOpen,
  setMoreOpen,
  navOrder,
}: {
  active: LandlordSectionKey;
  onChange: (k: LandlordSectionKey) => void;
  moreOpen: boolean;
  setMoreOpen: (open: boolean) => void;
  navOrder: LandlordSectionKey[];
}) {
  const orderedItems = getLandlordNavItems(navOrder);
  const items = orderedItems.slice(0, 4);
  const moreItems = orderedItems.slice(4);
  const moreIsActive = moreItems.some((item) => item.key === active);
  const go = (key: LandlordSectionKey) => {
    setMoreOpen(false);
    onChange(key);
  };

  return (
    <>
      <div
        className={
          "fixed inset-0 z-40 bg-slate-950/25 transition-opacity lg:hidden " +
          (moreOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0")
        }
        onClick={() => setMoreOpen(false)}
        aria-hidden={!moreOpen}
      />
      <div
        className={
          "fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-50 mx-auto max-w-md rounded-[1.75rem] border border-slate-200 bg-white p-3 shadow-[0_24px_70px_rgba(15,23,42,0.22)] transition-all duration-200 lg:hidden " +
          (moreOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0")
        }
      >
        <div className="mb-2 flex items-center justify-between px-1">
          <div>
            <p className="text-sm font-semibold text-slate-950">Plus</p>
            <p className="text-xs text-slate-500">Toutes les sections bailleur</p>
          </div>
          <button
            type="button"
            onClick={() => setMoreOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500"
            aria-label="Fermer"
          >
            <XMarkIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {moreItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === active;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => go(item.key)}
                className={
                  "flex min-h-[78px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 text-center text-[0.72rem] font-semibold transition " +
                  (isActive
                    ? "border-[#635bff]/20 bg-[#eef2ff] text-[#4f46e5]"
                    : "border-slate-200 bg-slate-50 text-slate-700")
                }
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="leading-tight">{item.shortLabel || item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-1.5 shadow-[0_-18px_45px_rgba(15,23,42,0.12)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === active;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onChange(item.key)}
                className={
                  "flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[0.68rem] font-semibold transition " +
                  (isActive
                    ? "bg-[#eef2ff] text-[#4f46e5]"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900")
                }
              >
                <span
                  className={
                    "flex h-7 w-7 items-center justify-center rounded-xl transition " +
                    (isActive ? "bg-gradient-to-br from-[#635bff] to-[#00b7ff] text-white shadow-sm" : "bg-transparent")
                  }
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="leading-none">{item.shortLabel || item.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(!moreOpen)}
            className={
              "flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[0.68rem] font-semibold transition " +
              (moreIsActive || moreOpen
                ? "bg-[#eef2ff] text-[#4f46e5]"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900")
            }
          >
            <span
              className={
                "flex h-7 w-7 items-center justify-center rounded-xl text-lg leading-none transition " +
                (moreIsActive || moreOpen ? "bg-gradient-to-br from-[#635bff] to-[#00b7ff] text-white shadow-sm" : "bg-transparent")
              }
            >
              ···
            </span>
            <span className="leading-none">Plus</span>
          </button>
        </div>
      </nav>
    </>
  );
}

export function DashboardShell(props: any) {
  const router = useRouter();
  const { loading: permissionsLoading, plan, maxActiveProperties } = usePermissions();
  const [active, setActive] = useState<LandlordSectionKey>("dashboard");
  const [messagingTenantId, setMessagingTenantId] = useState<string | null>(null);
  const [departureTenantId, setDepartureTenantId] = useState<string | null>(null);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [navOrder, setNavOrder] = useState<LandlordSectionKey[]>(DEFAULT_LANDLORD_NAV_ORDER);

  const isDark = !!props?.isDark;
  const onToggleDark = props?.onToggleDark as (() => void) | undefined;

  const userId: string = props?.user?.id || "";
  const userEmail: string | undefined = props?.user?.email;

  const properties = Array.isArray(props?.properties) ? props.properties : [];
  const propertyFinance = Array.isArray(props?.propertyFinance) ? props.propertyFinance : [];
  const tenants = Array.isArray(props?.tenants) ? props.tenants : [];
  const leases = Array.isArray(props?.leases) ? props.leases : [];
  const payments = Array.isArray(props?.payments) ? props.payments : [];
  const receipts = Array.isArray(props?.receipts) ? props.receipts : [];
  const photos = Array.isArray(props?.photos) ? props.photos : [];

  const propertyById = props?.propertyById instanceof Map ? props.propertyById : new Map();
  const tenantById = props?.tenantById instanceof Map ? props.tenantById : new Map();

  const refresh = props?.refresh;
  const landlord = props?.landlord;

  const monthRange = props?.monthRange;
  const monthlyExpected = props?.monthlyExpected;
  const monthlyPaid = props?.monthlyPaid;
  const lateCount = props?.lateCount;
  const depositTotal = props?.depositTotal;
  const alerts = props?.alerts;
  const activeLeases = Array.isArray(props?.activeLeases) ? props.activeLeases : [];

  const healthScore = Number(props?.healthScore || 0);
  const overLimit = !!props?.overLimit;
  const activePropertiesCount = properties.filter((property: any) => String(property?.status || "").toLowerCase() !== "archived").length;
  const propertyLimitLabel = maxActiveProperties >= 999999 ? "illimité" : `${maxActiveProperties} logement${maxActiveProperties > 1 ? "s" : ""}`;
  const isFreePlan = plan === "calc_full";
  const planLabel = getBillingPlan(plan)?.name || plan;
  const canUsePerformance = planAllowsPerformance(plan);
  const canUseTools = planAllowsTools(plan);
  const canShareDocuments = planAllowsDocumentSharing(plan);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    const storageKey = `landlord_nav_order:${userId}`;

    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) setNavOrder(normalizeLandlordNavOrder(JSON.parse(stored)));
    } catch {
      // L'ordre par défaut reste disponible.
    }

    (async () => {
      if (!supabase) return;
      try {
        const { data, error } = await supabase
          .from("app_settings")
          .select("value_json")
          .eq("key", storageKey)
          .maybeSingle();
        if (error || !mounted) return;
        const order = (data?.value_json as any)?.order;
        if (order) {
          const clean = normalizeLandlordNavOrder(order);
          setNavOrder(clean);
          try {
            window.localStorage.setItem(storageKey, JSON.stringify(clean));
          } catch {
            // ignore
          }
        }
      } catch {
        // La préférence locale suffit si la table/policy n'est pas encore disponible.
      }
    })();

    return () => {
      mounted = false;
    };
  }, [userId]);

  const rentFeedback = useMemo(() => {
    const result = typeof router.query.rentResult === "string" ? router.query.rentResult : "";
    if (!result) return null;
    const month = typeof router.query.month === "string" ? router.query.month : "";
    const amount = typeof router.query.amount === "string" ? Number(router.query.amount || 0) : null;
    const suffix = month ? ` (${month})` : "";

    if (result === "paid_full") {
      return {
        tone: "emerald" as const,
        title: `Loyer encaissé${suffix}`,
        desc:
          router.query.email === "sent"
            ? "Le paiement complet a été enregistré. La quittance a été générée et envoyée au locataire."
            : "Le paiement complet a été enregistré. La quittance est prête, mais l’email n’a pas été envoyé automatiquement.",
      };
    }
    if (result === "partial") {
      return {
        tone: "amber" as const,
        title: `Paiement incomplet enregistré${suffix}`,
        desc: `Le montant reçu${amount != null && Number.isFinite(amount) ? ` (${amount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })})` : ""} a été ajouté au suivi. La quittance reste bloquée jusqu’au règlement complet, avec relance possible depuis Quittances.`,
      };
    }
    if (result === "unpaid") {
      return {
        tone: "red" as const,
        title: `Loyer non payé${suffix}`,
        desc: "Aucun encaissement n’a été ajouté. Le paiement reste à traiter et vous pouvez relancer le locataire depuis Quittances.",
      };
    }
    return {
      tone: "red" as const,
      title: "Action non prise en compte",
      desc: typeof router.query.reason === "string" ? router.query.reason : "Le lien est peut-être expiré ou déjà utilisé.",
    };
  }, [router.query]);

  useEffect(() => {
    const tab = typeof router.query.tab === "string" ? router.query.tab : "";
    if (tab === "simulateurs") {
      setActive("outils");
      return;
    }
    const validTabs: LandlordSectionKey[] = [...DEFAULT_LANDLORD_NAV_ORDER];
    if (validTabs.includes(tab as LandlordSectionKey)) setActive(tab as LandlordSectionKey);
  }, [router.query.tab]);

  const onChangeTab = (k: LandlordSectionKey) => {
    setActive(k);
    setMobileMoreOpen(false);
  };

  const lockedSection = useMemo<LockedSectionConfig | null>(() => {
    if (permissionsLoading) return null;
    if (active === "performance" && !canUsePerformance) {
      return {
        eyebrow: "Fonctionnalité Essentiel",
        title: "Pilotage performance réservé au plan Essentiel",
        desc:
          "La section Performance transforme vos données de loyers, charges et crédit en lecture de rentabilité par logement, cash-flow et plan d’action priorisé.",
        requiredPlan: "Essentiel",
        href: "/mon-compte/abonnement?source=performance",
        cta: "Upgrade vers Essentiel",
        features: ["Rentabilité et cash-flow par logement", "Analyse des charges et du crédit", "Actions prioritaires pour améliorer la gestion", "Jusqu’à 10 logements actifs"],
      };
    }
    if (active === "declaration" && !canUsePerformance) {
      return {
        eyebrow: "Fonctionnalité Essentiel",
        title: "Aide à la déclaration réservée au plan Essentiel",
        desc:
          "Cette section prépare un dossier exploitable : import Finance, comparaison micro/réel, checklist de justificatifs et export pour votre comptable.",
        requiredPlan: "Essentiel",
        href: "/mon-compte/abonnement?source=declaration",
        cta: "Upgrade vers Essentiel",
        features: ["Import des recettes et charges depuis Finance", "Comparaison indicative micro / réel", "Checklist justificatifs", "Export de synthèse"],
      };
    }
    if (active === "outils" && !canUseTools) {
      return {
        eyebrow: "Fonctionnalité Essentiel",
        title: "Boîte à outils bailleur réservée au plan Essentiel",
        desc:
          "Les outils avancés traitent les cas métier qui demandent de l’historique, des justificatifs et des calculs de répartition : eau, charges, TEOM, régularisation et simulateurs bailleur.",
        requiredPlan: "Essentiel",
        href: "/mon-compte/abonnement?source=outils",
        cta: "Upgrade vers Essentiel",
        features: ["Répartition de facture d’eau au prorata des relevés", "Répartition des charges par tantièmes", "TEOM et régularisation locative", "Simulateurs bailleur intégrés"],
      };
    }
    if (active === "dossier_bail" && !canShareDocuments) {
      return {
        eyebrow: "Fonctionnalité Starter",
        title: "Dossier bail réservé au plan Starter",
        desc:
          "Le Dossier bail centralise pour chaque location le statut du contrat, des états des lieux et des quittances — avec le suivi du partage locataire et des accusés de réception.",
        requiredPlan: "Starter",
        href: "/mon-compte/abonnement?source=dossier-bail",
        cta: "Passer au plan Starter",
        features: [
          "Vue consolidée bail / EDL / quittances par location",
          "Partage du bail avec le locataire par email",
          "Accusé de réception locataire horodaté",
          "Portail locataire activé (quittances, bail, EDL accessibles en ligne)",
        ],
      };
    }
    return null;
  }, [active, canUsePerformance, canUseTools, canShareDocuments, permissionsLoading]);

  const content = useMemo(() => {
    if (!userId) {
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Chargement utilisateur… (userId manquant)
        </div>
      );
    }

    if (lockedSection) return <LockedPremiumSection config={lockedSection} />;

    switch (active) {
      case "dashboard":
        return (
          <SectionDashboard
            userId={userId}
            onGo={setActive}
            propertiesCount={properties.length}
            properties={properties}
            propertyFinance={propertyFinance}
            tenantsCount={tenants.length}
            leasesCount={leases.length}
            monthRange={monthRange}
            monthlyExpected={monthlyExpected}
            monthlyPaid={monthlyPaid}
            lateCount={lateCount}
            depositTotal={depositTotal}
            healthScore={healthScore}
            alerts={alerts}
            activeLeases={activeLeases}
            leases={leases}
            payments={payments}
            receipts={receipts}
            propertyById={propertyById}
            tenantById={tenantById}
            onPrepareDeparture={(tenantId) => {
              setDepartureTenantId(tenantId);
              setActive("locataires");
            }}
          />
        );

      case "biens":
        return <SectionBiens userId={userId} properties={properties} leases={leases} tenants={tenants} photos={photos} onRefresh={refresh} />;

      case "locataires":
        return (
          <SectionLocataires
            userId={userId}
            tenants={tenants}
            leases={leases}
            properties={properties}
            onRefresh={refresh}
            initialDepartureTenantId={departureTenantId}
            onDepartureOpened={() => setDepartureTenantId(null)}
            onOpenExitInventory={() => setActive("etat_des_lieux")}
            onContactTenant={(tenantId) => {
              setMessagingTenantId(tenantId);
              setActive("messagerie");
            }}
          />
        );

      case "baux":
        return (
          <SectionBaux
            userId={userId}
            userEmail={userEmail}
            leases={leases}
            properties={properties}
            tenants={tenants}
            payments={payments}
            receipts={receipts}
            onRefresh={refresh}
            canShareWithTenant={canShareDocuments}
            onPrepareDeparture={(tenantId) => {
              setDepartureTenantId(tenantId);
              setActive("locataires");
            }}
          />
        );

      case "quittances":
        return (
          <SectionQuittances
            userId={userId}
            userEmail={userEmail}
            landlord={landlord}
            receipts={receipts}
            leases={leases}
            payments={payments} // ✅ AJOUT (important pour Payé / À payer / Retards)
            propertyById={propertyById}
            tenantById={tenantById}
            onRefresh={refresh}
          />
        );

      case "messagerie":
        return <SectionMessagerie initialTenantId={messagingTenantId} onTenantSelected={() => setMessagingTenantId(null)} />;

      case "alertes":
        return <SectionAlertes userId={userId} plan={plan} />;

      case "finance":
        return (
          <SectionFinance
            userId={userId}
            leases={leases}
            payments={payments}
            receipts={receipts}
            propertyById={propertyById}
            onRefresh={refresh}
          />
        );

      case "performance":
        return <SectionPerformance userId={userId} leases={leases} payments={payments} propertyById={propertyById} />;

      case "outils":
        return <SectionOutils userId={userId} properties={properties} leases={leases} plan={plan} onRefresh={refresh} />;

      case "dossier_bail":
        return <SectionDossierBail userId={userId} leases={leases} properties={properties} tenants={tenants} />;

      case "etat_des_lieux":
        return <SectionEtatDesLieux userId={userId} leases={leases} properties={properties} tenants={tenants} onRefresh={refresh} onNavigateToBaux={() => setActive("baux")} />;

      case "inventaire":
        return <SectionInventaire userId={userId} properties={properties} />;

      case "documents":
        return <SectionDocumentsTemplates userId={userId} userEmail={userEmail} properties={properties} tenants={tenants} leases={leases} />;

      case "declaration":
        return <SectionDeclaration userId={userId} properties={properties} />;

      case "parametres":
        return <SectionParametres userId={userId} navOrder={navOrder} onNavOrderChange={setNavOrder} />;

      default:
        return (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Onglet inconnu : <span className="font-mono">{String(active)}</span>
        </div>
      );
    }
  }, [
    active,
    departureTenantId,
    messagingTenantId,
    plan,
    lockedSection,
    userId,
    userEmail,
    properties,
    propertyFinance,
    tenants,
    leases,
    payments,
    receipts,
    photos,
    propertyById,
    tenantById,
    refresh,
    landlord,
    monthRange,
    monthlyExpected,
    monthlyPaid,
    lateCount,
    depositTotal,
    alerts,
    activeLeases,
    navOrder,
  ]);

  const activeLabel = LANDLORD_NAV_ITEMS[active]?.label || "Espace bailleur";

  return (
    <div>
      {/* ── Mobile sticky header (hidden on desktop) ─────────── */}
      <div className="sticky top-0 z-30 mb-3 border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-semibold lowercase tracking-[0.2em] text-slate-500">lokt.fr</p>
            <p className="truncate text-base font-semibold text-slate-950">{activeLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[#635bff]/20 bg-[#635bff]/5 px-2.5 py-1 text-[0.68rem] font-semibold text-[#4f46e5]">
              Santé {healthScore}
            </span>
            {onToggleDark && (
              <button
                type="button"
                onClick={onToggleDark}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                  isDark
                    ? "bg-[#635bff]/15 text-[#9b96ff]"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                aria-label={isDark ? "Mode clair" : "Mode sombre"}
              >
                {isDark ? (
                  <SunIcon className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <MoonIcon className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Desktop sidebar — position:fixed, jamais scrollable ─ */}
      <aside className="fixed bottom-0 left-0 top-[4.5rem] z-20 hidden w-[280px] overflow-hidden p-3 lg:block">
        <SidebarNav
          active={active}
          onChange={onChangeTab}
          healthScore={healthScore}
          overLimit={overLimit}
          navOrder={navOrder}
          isDark={isDark}
          onToggleDark={onToggleDark}
        />
      </aside>

      {/* ── Contenu principal — décalé à droite du sidebar ────── */}
      <div className="lg:pl-[280px]">
        <div className="px-3 pb-24 pt-2 sm:px-4 sm:pb-24 sm:pt-4 lg:px-6 lg:py-6 lg:pb-10">

          {/* Subscription / plan banner */}
          {!permissionsLoading ? (
            <div className="mb-4 hidden overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm sm:block">
              <div className="h-1 w-full bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8]" />
              <div className="p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                      {isFreePlan ? "Offre gratuite" : `Abonnement ${planLabel}`}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {isFreePlan
                        ? "1 logement actif inclus gratuitement"
                        : `Votre plan permet ${propertyLimitLabel} actif${maxActiveProperties > 1 ? "s" : ""}.`}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Logements actifs : {activePropertiesCount}
                      {maxActiveProperties < 999999 ? ` / ${maxActiveProperties}` : ""}. Les fonctionnalités premium, comme l’aide à la déclaration, sont réservées aux abonnements payants.
                    </p>
                  </div>
                  {isFreePlan && activePropertiesCount >= 1 ? (
                    <a
                      href="/mon-compte/abonnement"
                      className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      Débloquer plusieurs logements
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {/* Rent feedback banner */}
          {rentFeedback ? (
            <div
              className={
                "mb-4 rounded-3xl border p-4 shadow-sm " +
                (rentFeedback.tone === "emerald"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                  : rentFeedback.tone === "amber"
                  ? "border-amber-200 bg-amber-50 text-amber-950"
                  : "border-red-200 bg-red-50 text-red-900")
              }
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold">{rentFeedback.title}</p>
                  <p className="mt-1 text-sm opacity-90">{rentFeedback.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => router.replace("/espace-bailleur?tab=quittances", undefined, { shallow: true })}
                  className="self-start rounded-full border border-current/20 bg-white/70 px-3 py-1.5 text-xs font-semibold hover:bg-white md:self-auto"
                >
                  Masquer
                </button>
              </div>
            </div>
          ) : null}

          <section className="min-w-0 space-y-4">{content}</section>
        </div>
      </div>

      {/* ── Mobile bottom nav ─────────────────────────────────── */}
      <MobileBottomNav
        active={active}
        onChange={onChangeTab}
        moreOpen={mobileMoreOpen}
        setMoreOpen={setMobileMoreOpen}
        navOrder={navOrder}
      />
    </div>
  );
}
