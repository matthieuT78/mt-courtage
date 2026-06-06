// components/landlord/DashboardShell.tsx
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowUpRightIcon, Bars3Icon, CheckCircleIcon, LockClosedIcon, SparklesIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { SidebarNav, LandlordSectionKey } from "./SidebarNav";

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
import { SectionSimulateursBailleur } from "./sections/SectionSimulateursBailleur";
import { usePermissions } from "../PermissionProvider";
import { getBillingPlan } from "../../lib/billingPlans";
import { planAllowsLandlord, planAllowsPerformance } from "../../lib/permissions";

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

export function DashboardShell(props: any) {
  const router = useRouter();
  const { loading: permissionsLoading, plan, maxActiveProperties } = usePermissions();
  const [active, setActive] = useState<LandlordSectionKey>("dashboard");
  const [messagingTenantId, setMessagingTenantId] = useState<string | null>(null);
  const [departureTenantId, setDepartureTenantId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
  const occupancyRate = props?.occupancyRate;
  const alerts = props?.alerts;
  const activeLeases = Array.isArray(props?.activeLeases) ? props.activeLeases : [];

  const healthScore = Number(props?.healthScore || 0);
  const overLimit = !!props?.overLimit;
  const activePropertiesCount = properties.filter((property: any) => String(property?.status || "").toLowerCase() !== "archived").length;
  const propertyLimitLabel = maxActiveProperties >= 999999 ? "illimité" : `${maxActiveProperties} logement${maxActiveProperties > 1 ? "s" : ""}`;
  const isFreePlan = plan === "calc_full";
  const planLabel = getBillingPlan(plan)?.name || plan;
  const canUsePaidLandlordTools = planAllowsLandlord(plan);
  const canUsePerformance = planAllowsPerformance(plan);

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
    const validTabs: LandlordSectionKey[] = [
      "dashboard",
      "biens",
      "locataires",
      "baux",
      "messagerie",
      "alertes",
      "quittances",
      "finance",
      "performance",
      "simulateurs",
      "etat_des_lieux",
      "inventaire",
      "declaration",
    ];
    if (validTabs.includes(tab as LandlordSectionKey)) setActive(tab as LandlordSectionKey);
  }, [router.query.tab]);

  const onChangeTab = (k: LandlordSectionKey) => {
    setActive(k);
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen]);

  const lockedSection = useMemo<LockedSectionConfig | null>(() => {
    if (permissionsLoading) return null;
    if (active === "simulateurs" && !canUsePaidLandlordTools) {
      return {
        eyebrow: "Fonctionnalité Starter",
        title: "Simulateurs bailleur réservés au plan Starter",
        desc:
          "Ces simulateurs aident à arbitrer les décisions de gestion : LMNP, location meublée, révision IRL et louer ou vendre. Ils complètent la gestion gratuite avec des calculs orientés décision.",
        requiredPlan: "Starter",
        href: "/mon-compte/abonnement?source=simulateurs-bailleur",
        cta: "Upgrade vers Starter",
        features: ["Simulateurs LMNP et arbitrages meublé / nu", "Révision de loyer IRL", "Aide à la décision louer ou vendre", "Jusqu’à 3 logements actifs"],
      };
    }
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
    return null;
  }, [active, canUsePaidLandlordTools, canUsePerformance, permissionsLoading]);

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
            occupancyRate={occupancyRate}
            healthScore={healthScore}
            alerts={alerts}
            activeLeases={activeLeases}
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

      case "simulateurs":
        return <SectionSimulateursBailleur plan={plan} />;

      case "etat_des_lieux":
        return <SectionEtatDesLieux userId={userId} leases={leases} properties={properties} tenants={tenants} onRefresh={refresh} />;

      case "inventaire":
        return <SectionInventaire userId={userId} properties={properties} />;

      case "declaration":
        return <SectionDeclaration userId={userId} properties={properties} />;

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
    occupancyRate,
    alerts,
    activeLeases,
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="sticky top-3 z-30 mb-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 shadow-md shadow-slate-900/10"
          aria-label="Ouvrir le menu de l’espace bailleur"
          aria-expanded={mobileMenuOpen}
          aria-controls="landlord-mobile-menu"
        >
          <Bars3Icon className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>

      <div
        className={
          "fixed inset-0 z-50 lg:hidden " +
          (mobileMenuOpen ? "pointer-events-auto" : "pointer-events-none")
        }
        aria-hidden={!mobileMenuOpen}
      >
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className={
            "absolute inset-0 bg-slate-950/35 transition-opacity duration-300 " +
            (mobileMenuOpen ? "opacity-100" : "opacity-0")
          }
          aria-label="Fermer le menu"
          tabIndex={mobileMenuOpen ? 0 : -1}
        />
        <div
          id="landlord-mobile-menu"
          className={
            "absolute inset-y-0 left-0 w-[min(88vw,320px)] overflow-y-auto bg-white p-3 shadow-2xl transition-transform duration-300 ease-out " +
            (mobileMenuOpen ? "translate-x-0" : "-translate-x-full")
          }
          role="dialog"
          aria-modal="true"
          aria-label="Navigation de l’espace bailleur"
        >
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
              aria-label="Fermer le menu"
            >
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <SidebarNav active={active} onChange={onChangeTab} healthScore={healthScore} overLimit={overLimit} />
        </div>
      </div>

      {!permissionsLoading ? (
        <div className="mb-4 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
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
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <SidebarNav active={active} onChange={onChangeTab} healthScore={healthScore} overLimit={overLimit} className="hidden lg:block" />
        <section className="min-w-0 space-y-4">{content}</section>
      </div>
    </div>
  );
}
