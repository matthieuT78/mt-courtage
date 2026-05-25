// components/landlord/DashboardShell.tsx
import React, { useMemo, useState } from "react";
import { SidebarNav, LandlordSectionKey } from "./SidebarNav";

import { SectionDashboard } from "./sections/SectionDashboard";
import { SectionBiens } from "./sections/SectionBiens";
import { SectionLocataires } from "./sections/SectionLocataires";
import { SectionBaux } from "./sections/SectionBaux";
import { SectionQuittances } from "./sections/SectionQuittances";
import { SectionFinance } from "./sections/SectionFinance";
import { SectionEtatDesLieux } from "./sections/SectionEtatDesLieux";
import { SectionInventaire } from "./sections/SectionInventaire";
import { SectionDeclaration } from "./sections/SectionDeclaration";
import { usePermissions } from "../PermissionProvider";

export function DashboardShell(props: any) {
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

  const onChangeTab = (k: LandlordSectionKey) => {
    setActive(k);
  };

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
    <div className="max-w-7xl mx-auto px-4 py-6">
      {!permissionsLoading ? (
        <div className="mb-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
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
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Débloquer plusieurs logements
              </a>
            ) : null}
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
