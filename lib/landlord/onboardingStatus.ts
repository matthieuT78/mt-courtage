import type { Lease, Property, PropertyFinance, Tenant } from "./types";
import type { LandlordSectionKey } from "../../components/landlord/SidebarNav";
import type { Profile } from "../../hooks/useProfile";
import { isLandlordProfileComplete } from "./profileCompletion";

// Source unique de vérité pour "où en est l'utilisateur dans la mise en route ?" —
// utilisée à la fois par la checklist du cockpit (SectionDashboard) et par
// l'assistant de mise en route obligatoire, pour ne jamais afficher deux
// définitions divergentes de "c'est fait" pour le même utilisateur.

export function hasFinanceSetup(finance?: PropertyFinance | null): boolean {
  if (!finance) return false;
  return Number(finance.purchase_price || 0) > 0 && Number(finance.loan_rate_percent || 0) > 0;
}

export type OnboardingStep = {
  key: LandlordSectionKey | "profil";
  label: string;
  done: boolean;
  desc?: string | null;
};

export type OnboardingStatusInput = {
  properties: Property[] | null | undefined;
  tenantById: Map<string, Tenant>;
  activeLeases: Lease[] | null | undefined;
  propertyFinance: PropertyFinance[] | null | undefined;
  profile: Profile | null | undefined;
  profileLoaded: boolean;
};

export type OnboardingStatus = {
  steps: OnboardingStep[];
  doneCount: number;
  percent: number;
  next: OnboardingStep | null;
  headline: string;
  sub: string;
  cta: { key: OnboardingStep["key"]; label: string } | null;
  financeIncompletePropertyId?: string;
  // Les 4 étapes essentielles, hors Finance — c'est ce qui détermine si
  // l'assistant de mise en route obligatoire doit s'afficher.
  mandatoryStepsComplete: boolean;
};

export function computeOnboardingStatus({
  properties,
  tenantById,
  activeLeases,
  propertyFinance,
  profile,
  profileLoaded,
}: OnboardingStatusInput): OnboardingStatus {
  const managedProperties = (properties || []).filter(
    (property) => String((property as any)?.status || "").toLowerCase() !== "archived"
  );
  const managedTenants = Array.from(tenantById.values()).filter((tenant) => !(tenant as any)?.archived_at);
  const workflowLeases = (activeLeases || []).filter(
    (lease) => String(lease.status || "active").toLowerCase() === "active"
  );

  const hasProperty = managedProperties.length > 0;
  const hasTenant = managedTenants.length > 0;
  const hasLease = workflowLeases.length > 0;
  // Une seule location active suffit à valider cette étape — c'est un guide de
  // première prise en main, pas un objectif "100% du portefeuille loué". Un
  // bailleur avec plusieurs biens dont certains restent volontairement vacants
  // ne doit pas voir cette étape (et donc toute la mise en route) rester
  // bloquée indéfiniment.
  const leaseWorkflowReady = hasLease;
  const financeByProperty = new Map((propertyFinance || []).map((row) => [row.property_id, row]));
  const financeConfigured =
    hasProperty && managedProperties.every((property) => hasFinanceSetup(financeByProperty.get(property.id)));
  const financeIncompletePropertyId = managedProperties.find(
    (property) => !hasFinanceSetup(financeByProperty.get(property.id))
  )?.id;
  const bailEdlDelegated = managedProperties.some((p) =>
    Array.isArray((p as any).delegated_services) && (p as any).delegated_services.includes("bail_edl")
  );
  const leaseStepLabel = "Créer une location";
  const leaseStepDesc = bailEdlDelegated
    ? "Renseignez les infos de la location (loyer, dates) pour le suivi financier — même si le bail est géré par l'agence."
    : null;

  // Profil complet = nom + adresse minimale. On attend le chargement avant de signaler incomplet.
  const profileComplete = !profileLoaded ? true : isLandlordProfileComplete(profile);

  const steps: OnboardingStep[] = [
    { key: "profil", label: "Compléter mon profil", done: profileComplete },
    { key: "biens" as LandlordSectionKey, label: "Créer un bien", done: hasProperty },
    { key: "locataires" as LandlordSectionKey, label: "Créer un locataire", done: hasTenant },
    { key: "baux" as LandlordSectionKey, label: leaseStepLabel, done: leaseWorkflowReady, desc: leaseStepDesc },
    { key: "finance" as LandlordSectionKey, label: "Configurer la finance", done: financeConfigured },
  ];

  const doneCount = steps.filter((step) => step.done).length;
  const percent = Math.round((doneCount / steps.length) * 100);
  const next = !profileComplete
    ? steps[0]
    : !hasProperty
    ? steps[1]
    : !hasTenant
    ? steps[2]
    : !leaseWorkflowReady
    ? steps[3]
    : !financeConfigured
    ? steps[4]
    : null;

  const headline =
    percent === 100
      ? "Mise en route terminée"
      : next?.key === "profil"
      ? "Commencez par votre profil bailleur"
      : next?.key === "finance"
      ? "Dernière étape : fiabiliser les calculs"
      : percent >= 50
      ? "Plus qu'une étape avant votre premier workflow complet"
      : percent >= 25
      ? "Bien joué, on continue"
      : "Démarrons en 2 minutes";

  const sub =
    percent === 100
      ? "Vous pouvez maintenant gérer loyers, quittances, états des lieux et suivi financier."
      : next?.key === "profil"
      ? "Votre nom et adresse sont requis pour les quittances, baux et états des lieux."
      : next?.key === "biens"
      ? "Commencez par créer un bien : adresse, libellé et informations utiles."
      : next?.key === "locataires"
      ? "Ajoutez le locataire : nom, email, téléphone et notes utiles."
      : next?.key === "baux"
      ? "Créez la location : elle relie le bien, le locataire, le loyer et les quittances."
      : "Complétez le socle Finance du bien : prix d'achat et taux du crédit. Les autres charges pourront être ajoutées ensuite.";

  const cta = next ? { key: next.key, label: next.label } : null;
  const mandatoryStepsComplete = profileComplete && hasProperty && hasTenant && leaseWorkflowReady;

  return { steps, doneCount, percent, next, headline, sub, cta, financeIncompletePropertyId, mandatoryStepsComplete };
}
