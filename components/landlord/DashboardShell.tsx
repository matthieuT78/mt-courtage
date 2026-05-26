// components/landlord/DashboardShell.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { SidebarNav, LandlordSectionKey } from "./SidebarNav";

import { SectionDashboard } from "./sections/SectionDashboard";
import { SectionBiens } from "./sections/SectionBiens";
import { SectionLocataires } from "./sections/SectionLocataires";
import { SectionBaux } from "./sections/SectionBaux";
import { SectionQuittances } from "./sections/SectionQuittances";
import { SectionFinance } from "./sections/SectionFinance";
import { SectionPerformance } from "./sections/SectionPerformance";
import { SectionEtatDesLieux } from "./sections/SectionEtatDesLieux";
import { SectionInventaire } from "./sections/SectionInventaire";
import { SectionDeclaration } from "./sections/SectionDeclaration";
import { SectionSimulateursBailleur } from "./sections/SectionSimulateursBailleur";
import { usePermissions } from "../PermissionProvider";
import { planAllowsLandlord, planAllowsPerformance } from "../../lib/permissions";

export function DashboardShell(props: any) {
  const router = useRouter();
  const { loading: permissionsLoading, plan, maxActiveProperties } = usePermissions();
  const [active, setActive] = useState<LandlordSectionKey>("dashboard");

  const userId: string = props?.user?.id || "";
  const userEmail: string | undefined = props?.user?.email;

  const properties = Array.isArray(props?.properties) ? props.properties : [];
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
    if (k === "simulateurs" && !permissionsLoading && !canUsePaidLandlordTools) {
      router.push("/mon-compte/abonnement?source=simulateurs-bailleur");
      return;
    }
    if (k === "performance" && !permissionsLoading && !canUsePerformance) {
      router.push("/mon-compte/abonnement?source=performance");
      return;
    }
    if (k === "declaration" && !permissionsLoading && !canUsePerformance) {
      router.push("/mon-compte/abonnement?source=declaration");
      return;
    }
    setActive(k);
  };

  useEffect(() => {
    if (active === "simulateurs" && !permissionsLoading && !canUsePaidLandlordTools) {
      router.push("/mon-compte/abonnement?source=simulateurs-bailleur");
    }
    if (active === "performance" && !permissionsLoading && !canUsePerformance) {
      router.push("/mon-compte/abonnement?source=performance");
    }
    if (active === "declaration" && !permissionsLoading && !canUsePerformance) {
      router.push("/mon-compte/abonnement?source=declaration");
    }
  }, [active, canUsePaidLandlordTools, canUsePerformance, permissionsLoading, router]);

  const content = useMemo(() => {
    if (!userId) {
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Chargement utilisateur… (userId manquant)
        </div>
      );
    }

    switch (active) {
      case "dashboard":
        return (
          <SectionDashboard
            userId={userId}
            onGo={setActive}
            propertiesCount={properties.length}
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
          />
        );

      case "biens":
        return <SectionBiens userId={userId} properties={properties} photos={photos} onRefresh={refresh} />;

      case "locataires":
        return <SectionLocataires userId={userId} tenants={tenants} leases={leases} properties={properties} onRefresh={refresh} />;

      case "baux":
        return (
          <SectionBaux
            userId={userId}
            userEmail={userEmail}
            leases={leases}
            properties={properties}
            tenants={tenants}
            onRefresh={refresh}
            onGoToQuittances={() => setActive("quittances")}
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
    plan,
    userId,
    userEmail,
    properties,
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
      {!permissionsLoading ? (
        <div className="mb-4 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="h-1 w-full bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8]" />
          <div className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                {isFreePlan ? "Offre gratuite" : `Abonnement ${plan}`}
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
        <SidebarNav active={active} onChange={onChangeTab} healthScore={healthScore} overLimit={overLimit} />
        <section className="min-w-0 space-y-4">{content}</section>
      </div>
    </div>
  );
}
