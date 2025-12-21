// components/landlord/DashboardShell.tsx
import React, { useEffect, useMemo, useState } from "react";
import { SidebarNav, LandlordSectionKey } from "./SidebarNav";

import { SectionDashboard } from "./sections/SectionDashboard";
import { SectionBiens } from "./sections/SectionBiens";
import { SectionLocataires } from "./sections/SectionLocataires";
import { SectionBaux } from "./sections/SectionBaux";
import { SectionLoyers } from "./sections/SectionLoyers";
import { SectionQuittances } from "./sections/SectionQuittances";
import { SectionFinance } from "./sections/SectionFinance";
import { SectionEtatDesLieux } from "./sections/SectionEtatDesLieux";
import { SectionInventaire } from "./sections/SectionInventaire";
import { SectionDeclaration } from "./sections/SectionDeclaration";

export function DashboardShell(props: any) {
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

  useEffect(() => {
    console.log("[DashboardShell] active =", active);
  }, [active]);

  const onChangeTab = (k: LandlordSectionKey) => {
    console.log("[DashboardShell] onChangeTab", { from: active, to: k });
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
            alerts={alerts}
            activeLeases={activeLeases}
            propertyById={propertyById}
            tenantById={tenantById}
          />
        );

      case "biens":
        return <SectionBiens userId={userId} properties={properties} photos={photos} onRefresh={refresh} />;

      case "locataires":
        return <SectionLocataires userId={userId} tenants={tenants} leases={leases} properties={properties} onRefresh={refresh} />;

      case "baux":
        return <SectionBaux userId={userId} leases={leases} properties={properties} tenants={tenants} onRefresh={refresh} />;

      case "loyers":
        return <SectionLoyers payments={payments} leases={leases} propertyById={propertyById} tenantById={tenantById} />;

      case "quittances":
        return (
          <SectionQuittances
            userId={userId}
            userEmail={userEmail}
            landlord={landlord}
            receipts={receipts}
            leases={leases}
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
        return <SectionInventaire />;

      case "declaration":
        // ✅ FIX: SectionDeclaration requires userId
        return <SectionDeclaration userId={userId} />;

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
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <SidebarNav active={active} onChange={onChangeTab} healthScore={healthScore} overLimit={overLimit} />
        <section className="min-w-0 space-y-4">{content}</section>
      </div>
    </div>
  );
}
