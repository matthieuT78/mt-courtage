import type React from "react";
import {
  ArchiveBoxIcon,
  BanknotesIcon,
  BellAlertIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentCheckIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  FolderOpenIcon,
  HomeIcon,
  ReceiptPercentIcon,
  Squares2X2Icon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";

export type LandlordSectionKey =
  | "dashboard"
  | "locataires"
  | "biens"
  | "baux"
  | "messagerie"
  | "alertes"
  | "etat_des_lieux"
  | "quittances"
  | "finance"
  | "performance"
  | "outils"
  | "inventaire"
  | "documents"
  | "candidatures"
  | "parametres";

export type LandlordNavItem = {
  key: LandlordSectionKey;
  label: string;
  shortLabel?: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

export const DEFAULT_LANDLORD_NAV_ORDER: LandlordSectionKey[] = [
  "dashboard",
  "candidatures",
  "locataires",
  "biens",
  "baux",
  "documents",
  "quittances",
  "finance",
  "performance",
  "outils",
  "etat_des_lieux",
  "messagerie",
  "alertes",
  "inventaire",
  "parametres",
];

export const LANDLORD_NAV_ITEMS: Record<LandlordSectionKey, LandlordNavItem> = {
  dashboard: { key: "dashboard", label: "Accueil", icon: Squares2X2Icon },
  candidatures: { key: "candidatures", label: "Candidatures", icon: FolderOpenIcon },
  locataires: { key: "locataires", label: "Locataires", icon: UserGroupIcon },
  biens: { key: "biens", label: "Logements", shortLabel: "Biens", icon: HomeIcon },
  baux: { key: "baux", label: "Locations", shortLabel: "Locations", icon: DocumentTextIcon },
  quittances: { key: "quittances", label: "Quittances", icon: ReceiptPercentIcon },
  finance: { key: "finance", label: "Finance", icon: BanknotesIcon },
  performance: { key: "performance", label: "Performance", icon: ChartBarIcon },
  outils: { key: "outils", label: "Boîte à outils", shortLabel: "Outils", icon: WrenchScrewdriverIcon },
  etat_des_lieux: { key: "etat_des_lieux", label: "États des lieux", icon: ClipboardDocumentCheckIcon },
  messagerie: { key: "messagerie", label: "Messages", icon: ChatBubbleLeftRightIcon },
  alertes: { key: "alertes", label: "Alertes", icon: BellAlertIcon },
  inventaire: { key: "inventaire", label: "Inventaires", icon: ArchiveBoxIcon },
  parametres: { key: "parametres", label: "Paramètres", icon: Cog6ToothIcon },
  documents: { key: "documents", label: "Documents & Modèles", icon: DocumentTextIcon },
};

export function normalizeLandlordNavOrder(input: unknown): LandlordSectionKey[] {
  const raw = Array.isArray(input) ? input : [];
  const known = new Set(DEFAULT_LANDLORD_NAV_ORDER);
  const ordered = raw.filter((key): key is LandlordSectionKey => typeof key === "string" && known.has(key as LandlordSectionKey));
  const missing = DEFAULT_LANDLORD_NAV_ORDER.filter((key) => !ordered.includes(key));
  return [...ordered, ...missing];
}

export function getLandlordNavItems(order: LandlordSectionKey[] = DEFAULT_LANDLORD_NAV_ORDER): LandlordNavItem[] {
  return normalizeLandlordNavOrder(order).map((key) => LANDLORD_NAV_ITEMS[key]).filter(Boolean);
}
