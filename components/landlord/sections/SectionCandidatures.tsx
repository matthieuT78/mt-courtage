import { useEffect, useState } from "react";
import {
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
  BookOpenIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardDocumentIcon,
  DevicePhoneMobileIcon,
  EnvelopeIcon,
  LockClosedIcon,
  MegaphoneIcon,
  PlusIcon,
  ShareIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrashIcon,
  UserGroupIcon,
  UserPlusIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../../lib/supabaseClient";
import { SectionTitle } from "../UiBits";
import type { LandlordSectionKey } from "../navigation";

type Props = {
  userId: string;
  onNavigate?: (section: LandlordSectionKey) => void;
  onNavigateDeep?: (section: LandlordSectionKey, link: { openCreate?: boolean; prefillTenantId?: string; prefillPropertyId?: string; prefillCandidatureEmail?: string }) => void;
  onRefresh?: () => void;
};

type Candidature = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  professional_situation: string | null;
  employer_name: string | null;
  net_monthly_income: number | null;
  has_guarantor: boolean;
  guarantor_type: string | null;
  visale_number: string | null;
  guarantor_first_name: string | null;
  guarantor_last_name: string | null;
  guarantor_income: number | null;
  docs_identity: boolean;
  docs_payslips: boolean;
  docs_tax: boolean;
  docs_address: boolean;
  docs_identity_path: string | null;
  docs_tax_path: string | null;
  docs_address_path: string | null;
  docs_payslip_1_path: string | null;
  docs_payslip_2_path: string | null;
  docs_payslip_3_path: string | null;
  guarantor_docs_identity: boolean;
  guarantor_docs_payslips: boolean;
  guarantor_docs_tax: boolean;
  guarantor_docs_identity_path: string | null;
  guarantor_docs_tax_path: string | null;
  guarantor_docs_payslip_1_path: string | null;
  guarantor_docs_payslip_2_path: string | null;
  guarantor_docs_payslip_3_path: string | null;
  status: string;
  submitted_at: string | null;
  landlord_note: string | null;
};

type Listing = {
  id: string;
  token: string;
  title: string;
  address: string | null;
  rent_amount: number;
  charges_amount: number;
  property_type: string;
  surface_m2: number | null;
  income_ratio: number;
  status: string;
  created_at: string;
  property_id?: string | null;
  candidatures: Candidature[];
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  submitted: { label: "En attente", color: "bg-amber-100 text-amber-800" },
  accepted: { label: "Retenu", color: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Refusé", color: "bg-red-100 text-red-700" },
  waitlist: { label: "Liste d'attente", color: "bg-slate-100 text-slate-600" },
  converted: { label: "Converti en locataire", color: "bg-indigo-100 text-indigo-700" },
};

const SITUATION_LABELS: Record<string, string> = {
  CDI: "CDI",
  CDI_essai: "CDI (essai)",
  CDD: "CDD",
  fonctionnaire: "Fonctionnaire",
  independant: "Indépendant",
  etudiant: "Étudiant",
  retraite: "Retraité",
  autre: "Autre",
};

const euro = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

// ── Scoring ──────────────────────────────────────────────────────────────────

const SITUATION_SCORE: Record<string, number> = {
  fonctionnaire: 30, CDI: 25, retraite: 24,
  CDI_essai: 18, CDD: 14, independant: 10,
  etudiant: 6, autre: 5,
};

// Source unique de vérité pour le détail du score — utilisée à la fois pour le
// score global (scoreProfile) et pour l'affichage du détail (ScoreBreakdown),
// pour ne jamais afficher deux calculs différents pour le même dossier.
function computeScoreBreakdown(c: Candidature, listing: Listing) {
  const totalRent = listing.rent_amount + listing.charges_amount;
  const required = totalRent * listing.income_ratio;
  const candidateIncome = c.net_monthly_income ?? 0;

  // Un garant individuel n'apporte un vrai crédit financier que si son identité et sa
  // fiche de paie sont fournies — sinon son revenu déclaré n'est qu'une affirmation non
  // vérifiée et ne doit pas gonfler le score. Le Visale, lui, ne demande aucune pièce de
  // revenu par construction (garantie Action Logement), donc pas de vérification à faire.
  const guarantorDocsVerified = Boolean(c.guarantor_docs_identity && c.guarantor_docs_payslips);

  // Revenus : 40 pts — ratio = revenu de référence / seuil requis, donc ratio=1 = seuil exact atteint.
  // Avec un garant individuel vérifié, son revenu couvre aussi le loyer : on retient le
  // plus favorable des deux plutôt que le seul revenu du candidat (sinon un étudiant sans
  // revenu propre mais avec un garant solide tombe artificiellement à 0, alors que son
  // dossier est en réalité bien couvert). Le Visale garantit le paiement par Action
  // Logement en cas de défaut : on considère le seuil requis comme atteint (ratio 1),
  // sans le surestimer au niveau d'un revenu élevé prouvé.
  let referenceIncome = candidateIncome;
  if (c.has_guarantor && c.guarantor_type === "individual" && c.guarantor_income && guarantorDocsVerified) {
    referenceIncome = Math.max(candidateIncome, c.guarantor_income);
  } else if (c.has_guarantor && c.guarantor_type === "visale") {
    referenceIncome = Math.max(candidateIncome, required);
  }
  const ratio = required > 0 ? referenceIncome / required : 0;
  const incomeScore =
    ratio >= 1.5 ? 40 : ratio >= 1.25 ? 35 : ratio >= 1.0 ? 28 :
    ratio >= 0.85 ? 18 : ratio >= 0.67 ? 8 : 0;

  // Stabilité pro : 30 pts
  const situScore = SITUATION_SCORE[c.professional_situation ?? ""] ?? 0;

  // Dossier : 20 pts (5 par doc)
  const docs = [c.docs_identity, c.docs_payslips, c.docs_tax, c.docs_address];
  const docsScore = docs.filter(Boolean).length * 5;

  // Garant : 10 pts bonus — présence d'un second recours juridique, indépendamment
  // de son revenu déjà pris en compte ci-dessus dans le score revenus.
  const guarantorScore = c.has_guarantor ? 10 : 0;

  // Le dossier n'est vraiment "complet" que si les pièces du garant individuel
  // déclaré sont aussi là — sinon la moitié du dossier reste non vérifiée.
  const isFullyComplete =
    docsScore === 20 && (!c.has_guarantor || c.guarantor_type !== "individual" || guarantorDocsVerified);

  return { incomeScore, situScore, docsScore, guarantorScore, referenceIncome, required, isFullyComplete };
}

function scoreProfile(c: Candidature, listing: Listing): number {
  const { incomeScore, situScore, docsScore, guarantorScore } = computeScoreBreakdown(c, listing);
  return Math.min(100, incomeScore + situScore + docsScore + guarantorScore);
}

function profileBadge(score: number): { label: string; color: string; dot: string; bubble: string; bar: string } {
  if (score >= 72) return { label: "Profil solide",     color: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500", bubble: "bg-emerald-500", bar: "bg-emerald-500" };
  if (score >= 48) return { label: "Profil acceptable", color: "bg-amber-100 text-amber-800",    dot: "bg-amber-400",   bubble: "bg-amber-400",   bar: "bg-amber-400"   };
  return             { label: "Profil risqué",     color: "bg-red-100 text-red-700",       dot: "bg-red-400",     bubble: "bg-red-500",     bar: "bg-red-500"     };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getHeaders() {
  const { data } = await supabase!.auth.getSession();
  const token = data.session?.access_token;
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

// ── DocsCompleteness ──────────────────────────────────────────────────────────

async function openCandidatureDocument(candidatureId: string, field: string) {
  try {
    const res = await fetch("/api/candidature/document-url", {
      method: "POST",
      headers: await getHeaders(),
      body: JSON.stringify({ candidatureId, field }),
    });
    const json = await res.json();
    if (!res.ok || !json.signedUrl) throw new Error(json.error || "Ouverture impossible.");
    window.open(json.signedUrl, "_blank", "noopener,noreferrer");
  } catch (e: any) {
    alert(e.message || "Impossible d'ouvrir le document.");
  }
}

function DocsCompleteness({ c, guarantor = false }: { c: Candidature; guarantor?: boolean }) {
  const docs = guarantor
    ? [
        { key: "guarantor_docs_identity", label: "CNI garant", path: c.guarantor_docs_identity_path, openField: "guarantor_docs_identity" },
        { key: "guarantor_docs_payslips", label: "Fiche de paie garant", path: c.guarantor_docs_payslip_1_path, openField: "guarantor_docs_payslip_1" },
        { key: "guarantor_docs_tax", label: "Avis impo. garant", path: c.guarantor_docs_tax_path, openField: "guarantor_docs_tax" },
      ]
    : [
        { key: "docs_identity", label: "CNI", path: c.docs_identity_path, openField: "docs_identity" },
        { key: "docs_payslips", label: "Fiche de paie", path: c.docs_payslip_1_path, openField: "docs_payslip_1" },
        { key: "docs_tax", label: "Avis impo.", path: c.docs_tax_path, openField: "docs_tax" },
        { key: "docs_address", label: "Justif. domicile", path: c.docs_address_path, openField: "docs_address" },
      ];
  const done = docs.filter((d) => c[d.key as keyof Candidature]).length;
  return (
    <div className="flex flex-wrap gap-1">
      {docs.map((d) => {
        const provided = !!c[d.key as keyof Candidature];
        const viewable = provided && !!d.path;
        const commonClass = `rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium ${
          provided ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
        }`;
        return viewable ? (
          <button
            key={d.key}
            type="button"
            onClick={(e) => { e.stopPropagation(); openCandidatureDocument(c.id, d.openField); }}
            className={`${commonClass} underline decoration-dotted underline-offset-2 hover:bg-emerald-200`}
            title="Voir le document"
          >
            {d.label}
          </button>
        ) : (
          <span key={d.key} className={commonClass}>
            {d.label}
          </span>
        );
      })}
      <span className="text-[0.65rem] text-slate-400 ml-1 self-center">{done}/{docs.length}</span>
    </div>
  );
}

// ── SynthesisPanel ────────────────────────────────────────────────────────────

function SynthesisPanel({ candidatures, listing }: { candidatures: Candidature[]; listing: Listing }) {
  const submitted = candidatures.filter((c) => c.status === "submitted");
  if (submitted.length < 2) return null;

  const scored = submitted
    .map((c) => ({ c, score: scoreProfile(c, listing) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const badge = profileBadge(best.score);
  const bestBreakdown = computeScoreBreakdown(best.c, listing);
  const ratio = bestBreakdown.referenceIncome > 0 && bestBreakdown.required > 0
    ? (bestBreakdown.referenceIncome / bestBreakdown.required).toFixed(1)
    : null;

  const reasons: string[] = [];
  if (best.c.professional_situation) {
    reasons.push(SITUATION_LABELS[best.c.professional_situation] ?? best.c.professional_situation);
  }
  if (ratio) reasons.push(`revenus à ${ratio}× le seuil`);
  if (bestBreakdown.isFullyComplete) reasons.push("dossier complet");
  if (best.c.has_guarantor) reasons.push("avec garant");

  const isClose = scored.length >= 2 && scored[0].score - scored[1].score <= 8;

  return (
    <div className="rounded-xl border border-[#635bff]/20 bg-[#635bff]/5 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <SparklesIcon className="h-4 w-4 text-[#635bff]" />
        <p className="text-xs font-semibold text-[#635bff] uppercase tracking-wider">Analyse lokt</p>
      </div>
      <p className="text-sm text-slate-800">
        Sur <strong>{submitted.length} dossiers</strong>, le profil le plus sécurisé est{" "}
        <strong>{best.c.first_name} {best.c.last_name}</strong>
        {reasons.length > 0 && (
          <> — {reasons.join(", ")}</>
        )}.
        {" "}Score : <strong>{best.score}/100</strong>.
      </p>
      {isClose && (
        <p className="text-xs text-slate-500">
          Attention : {scored[1].c.first_name} {scored[1].c.last_name} est proche ({scored[1].score}/100) — les deux profils sont comparables.
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        {scored.map(({ c, score }, i) => {
          const b = profileBadge(score);
          return (
            <div key={c.id} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1">
              <span className="text-xs font-semibold text-slate-500">#{i + 1}</span>
              <span className="text-xs font-medium text-slate-800">{c.first_name} {c.last_name}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold ${b.color}`}>{score}/100</span>
            </div>
          );
        })}
      </div>
      <p className="text-[0.65rem] text-slate-400 border-t border-[#635bff]/10 pt-2 mt-1">
        L'analyse lokt est un outil d'aide à la décision basé sur les informations <em>déclarées</em> par les candidats. Elle ne constitue pas une garantie de solvabilité ni un avis juridique. La décision finale vous appartient.
      </p>
    </div>
  );
}

// ── SharePanel ────────────────────────────────────────────────────────────────

function SharePanel({ listing, copied, onCopy }: {
  listing: Listing;
  copied: string | null;
  onCopy: (token: string) => void;
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://lokt.fr";
  const url = `${origin}/candidature/${listing.token}`;
  const totalRent = listing.rent_amount + listing.charges_amount;
  const subject = encodeURIComponent(`Dossier de candidature — ${listing.title}`);
  const body = encodeURIComponent(
    `Bonjour,\n\nJe vous invite à déposer votre dossier de candidature en ligne pour le logement suivant :\n\n${listing.title} — ${euro(totalRent)} charges comprises / mois\n\nLien de candidature :\n${url}\n\nBonne journée.`
  );
  const smsBody = encodeURIComponent(`Candidature pour "${listing.title}" (${euro(totalRent)} cc/mois) : ${url}`);

  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lien à partager</p>
          <p className="mt-0.5 truncate font-mono text-sm text-slate-700">{url}</p>
        </div>
        <button
          type="button"
          onClick={() => onCopy(listing.token)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          {copied === listing.token ? (
            <><CheckCircleIcon className="h-4 w-4 text-emerald-500" />Copié !</>
          ) : (
            <><ClipboardDocumentIcon className="h-4 w-4" />Copier</>
          )}
        </button>
        <a
          href={`/candidature/${listing.token}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          Voir
        </a>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-400">Envoyer par :</span>
        <a
          href={`mailto:?subject=${subject}&body=${body}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <EnvelopeIcon className="h-3.5 w-3.5" />
          Email
        </a>
        <a
          href={`sms:?body=${smsBody}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <DevicePhoneMobileIcon className="h-3.5 w-3.5" />
          SMS
        </a>
        {canShare && (
          <button
            type="button"
            onClick={() => navigator.share({ title: `Candidature — ${listing.title}`, url }).catch(() => {})}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#635bff]/30 bg-[#635bff]/5 px-3 py-1.5 text-xs font-semibold text-[#635bff] hover:bg-[#635bff]/10"
          >
            <ShareIcon className="h-3.5 w-3.5" />
            Partager
          </button>
        )}
      </div>
    </div>
  );
}

// ── WorkflowOnboarding ────────────────────────────────────────────────────────

const STEPS = [
  {
    n: "01",
    icon: MegaphoneIcon,
    title: "Créez une annonce",
    desc: "Renseignez le logement, le loyer et le ratio de revenus souhaité. Un lien unique est généré instantanément.",
  },
  {
    n: "02",
    icon: ShareIcon,
    title: "Partagez le lien",
    desc: "Envoyez-le par email, SMS ou copiez-le dans votre annonce LeBonCoin. Aucune inscription requise pour les candidats.",
  },
  {
    n: "03",
    icon: UserGroupIcon,
    title: "Recevez les dossiers",
    desc: "Les candidats remplissent leur dossier à leur rythme. Vous voyez qui a postulé et l'état de chaque dossier en temps réel.",
  },
  {
    n: "04",
    icon: SparklesIcon,
    title: "Comparez et choisissez",
    desc: "Chaque profil est scoré automatiquement (revenus, stabilité, garant). Retenez le meilleur et convertissez-le en locataire.",
  },
];

function WorkflowOnboarding({ onStart }: { onStart: () => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-slate-100 bg-gradient-to-r from-[#635bff]/5 via-white to-white px-6 py-5">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#635bff]">Comment ça marche</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">Dossier de candidature numérique</h2>
        <p className="mt-1 text-sm text-slate-500">
          Un lien, des dossiers structurés, un scoring automatique — tout en moins de 2 minutes.
        </p>
      </div>

      {/* Steps */}
      <div className="grid gap-2 p-3 sm:grid-cols-4">
        {STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <div key={step.n} className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-white">
                <Icon className="h-4 w-4 text-slate-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                <p className="mt-0.5 text-xs leading-4 text-slate-500">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
        {[
          { icon: ShieldCheckIcon, label: "RGPD — données supprimées automatiquement" },
          { icon: CheckCircleIcon, label: "Scoring transparent, sans IA" },
        ].map(({ icon: Icon, label }) => (
          <span key={label} className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            <Icon className="h-3.5 w-3.5 shrink-0 text-slate-300" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── SectionCandidatures ───────────────────────────────────────────────────────

export function SectionCandidatures({ userId, onNavigate, onNavigateDeep, onRefresh }: Props) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeListing, setActiveListing] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeConfirm, setCloseConfirm] = useState<string | null>(null);
  const [closeResult, setCloseResult] = useState<{ listingId: string; deleted: number } | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convertResult, setConvertResult] = useState<{ candidatureId: string; tenantName: string; alreadyExists: boolean; tenantId: string | null; propertyId: string | null } | null>(null);
  const [manualTenantDraft, setManualTenantDraft] = useState<{ listingId: string; firstName: string; lastName: string; email: string; phone: string } | null>(null);
  const [manualTenantSaving, setManualTenantSaving] = useState(false);
  const [manualTenantErr, setManualTenantErr] = useState<string | null>(null);
  const [manualTenantResult, setManualTenantResult] = useState<{ listingId: string; tenantId: string; tenantName: string; propertyId: string | null } | null>(null);

  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [expandedArchive, setExpandedArchive] = useState<string | null>(null);
  const [activeLeasePropIds, setActiveLeasePropIds] = useState<Set<string>>(new Set());

  const [form, setForm] = useState({
    title: "", address: "", rent_amount: "", charges_amount: "",
    property_type: "vide", surface_m2: "", income_ratio: "3", property_id: "",
  });
  const setF = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  type PropertyLite = { id: string; label: string | null; address_line1: string | null; postal_code: string | null; city: string | null; surface_m2: number | null; status?: string | null };
  const [properties, setProperties] = useState<PropertyLite[]>([]);
  const [vacantIds, setVacantIds] = useState<Set<string>>(new Set());
  const [propsLoaded, setPropsLoaded] = useState(false);

  useEffect(() => {
    if (!showCreate || propsLoaded || !supabase) return;
    (async () => {
      const [propsRes, leasesRes] = await Promise.all([
        supabase.from("properties").select("id,label,address_line1,postal_code,city,surface_m2,status").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("leases").select("property_id").eq("user_id", userId).eq("status", "active"),
      ]);
      const occupied = new Set<string>((leasesRes.data || []).map((l: any) => l.property_id).filter(Boolean));
      const nonArchived = (propsRes.data || []).filter((p: any) => String(p.status || "").toLowerCase() !== "archived");
      setVacantIds(new Set(nonArchived.map((p: any) => p.id).filter((id: string) => !occupied.has(id))));
      setProperties(nonArchived);
      setPropsLoaded(true);
    })();
  }, [showCreate]);

  async function load() {
    try {
      const headers = await getHeaders();
      const [listRes, leasesRes] = await Promise.all([
        fetch("/api/candidature/list", { headers }).then(async (r) => ({ ok: r.ok, data: await r.json() })),
        supabase
          ? supabase.from("leases").select("property_id").eq("user_id", userId).in("status", ["active", "signed"])
          : Promise.resolve({ data: [] as any[] }),
      ]);
      if (!listRes.ok) {
        setLoadErr(listRes.data.error ?? "Erreur lors du chargement.");
      } else if (listRes.data.listings) {
        setListings(listRes.data.listings);
        const firstActive = listRes.data.listings.find((l: Listing) => l.status === "active");
        if (!activeListing && firstActive) setActiveListing(firstActive.id);
      }
      setActiveLeasePropIds(new Set<string>((leasesRes.data || []).map((l: any) => l.property_id).filter(Boolean)));
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function selectProperty(p: PropertyLite | null) {
    if (!p) {
      setForm((f) => ({ ...f, property_id: "", address: "", surface_m2: "" }));
      return;
    }
    const parts = [p.address_line1, [p.postal_code, p.city].filter(Boolean).join(" ")].filter(Boolean);
    setForm((f) => ({
      ...f,
      property_id: p.id,
      address: parts.join(", "),
      surface_m2: p.surface_m2 != null ? String(p.surface_m2) : f.surface_m2,
    }));
  }

  async function createListing() {
    const rentAmount = parseFloat(form.rent_amount);
    const chargesAmount = parseFloat(form.charges_amount || "0");
    const surfaceM2 = form.surface_m2 ? parseFloat(form.surface_m2) : null;
    if (!form.title || !form.rent_amount || !Number.isFinite(rentAmount) || rentAmount <= 0) {
      setCreateErr("Titre et loyer (montant positif) requis.");
      return;
    }
    if (!Number.isFinite(chargesAmount) || chargesAmount < 0) {
      setCreateErr("Les charges ne peuvent pas être négatives.");
      return;
    }
    if (surfaceM2 != null && (!Number.isFinite(surfaceM2) || surfaceM2 <= 0)) {
      setCreateErr("Surface invalide.");
      return;
    }
    setCreating(true);
    setCreateErr(null);
    const headers = await getHeaders();
    const res = await fetch("/api/candidature/create-listing", {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...form,
        rent_amount: rentAmount,
        charges_amount: chargesAmount,
        surface_m2: surfaceM2,
        income_ratio: parseFloat(form.income_ratio || "3"),
        property_id: form.property_id || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) { setCreateErr(json.error); setCreating(false); return; }
    setShowCreate(false);
    setCreating(false);
    setForm({ title: "", address: "", rent_amount: "", charges_amount: "", property_type: "vide", surface_m2: "", income_ratio: "3", property_id: "" });
    await load();
    setActiveListing(json.listing.id);
  }

  async function closeListing(listing_id: string) {
    setClosingId(listing_id);
    setCloseConfirm(null);
    const headers = await getHeaders();
    const res = await fetch("/api/candidature/close-listing", {
      method: "POST", headers,
      body: JSON.stringify({ listing_id }),
    });
    const json = await res.json();
    setClosingId(null);
    if (res.ok) {
      setCloseResult({ listingId: listing_id, deleted: json.deleted_count });
      await load();
    }
  }

  async function saveManualTenant() {
    if (!manualTenantDraft) return;
    const firstName = manualTenantDraft.firstName.trim();
    const lastName = manualTenantDraft.lastName.trim();
    if (!firstName && !lastName) {
      setManualTenantErr("Indiquez au moins un nom ou un prénom.");
      return;
    }
    setManualTenantSaving(true);
    setManualTenantErr(null);

    const { data: tenant, error } = await supabase
      .from("tenants")
      .insert({
        user_id: userId,
        first_name: firstName || null,
        last_name: lastName || null,
        email: manualTenantDraft.email.trim() || null,
        phone: manualTenantDraft.phone.trim() || null,
      })
      .select("*")
      .single();

    if (error || !tenant) {
      setManualTenantErr(error?.message || "Création du locataire échouée.");
      setManualTenantSaving(false);
      return;
    }

    const listing = listings.find((l) => l.id === manualTenantDraft.listingId);
    const headers = await getHeaders();
    const res = await fetch("/api/candidature/close-listing", {
      method: "POST", headers,
      body: JSON.stringify({ listing_id: manualTenantDraft.listingId }),
    });
    const json = await res.json();
    setManualTenantSaving(false);

    if (!res.ok) {
      setManualTenantErr(json.error || "Locataire créé mais la clôture de l'annonce a échoué.");
      return;
    }

    setCloseResult({ listingId: manualTenantDraft.listingId, deleted: json.deleted_count });
    await onRefresh?.();
    await load();
    setManualTenantResult({
      listingId: manualTenantDraft.listingId,
      tenantId: tenant.id,
      tenantName: `${firstName} ${lastName}`.trim(),
      propertyId: listing?.property_id ?? null,
    });
    setManualTenantDraft(null);
  }

  async function convertToTenant(candidature_id: string, tenantName: string, propertyId?: string | null) {
    setConvertingId(candidature_id);
    const headers = await getHeaders();
    const res = await fetch("/api/candidature/convert-to-tenant", {
      method: "POST", headers,
      body: JSON.stringify({ candidature_id }),
    });
    const json = await res.json();
    setConvertingId(null);
    if (res.ok) {
      // Le nouveau locataire doit être présent dans `tenants` (props du cockpit)
      // AVANT d'afficher "Créer le bail" — sinon le menu déroulant du bail ne
      // trouve pas encore cet id et paraît vide, alors que le préremplissage
      // interne est en fait correct (bug déjà rencontré).
      await onRefresh?.();
      await load();
      setConvertResult({ candidatureId: candidature_id, tenantName, alreadyExists: json.already_exists, tenantId: json.tenant?.id ?? null, propertyId: propertyId ?? null });
    }
  }

  function navigateToBailCreate(c: Candidature, propertyId?: string | null) {
    const tid = convertResult?.candidatureId === c.id ? convertResult?.tenantId ?? undefined : undefined;
    if (onNavigateDeep) {
      onNavigateDeep("baux", {
        openCreate: true,
        prefillPropertyId: propertyId ?? undefined,
        prefillTenantId: tid,
        prefillCandidatureEmail: c.email ?? undefined,
      });
    } else {
      onNavigate?.("baux");
    }
  }

  async function updateStatus(candidature_id: string, status: string) {
    setUpdatingId(candidature_id);
    const headers = await getHeaders();
    await fetch("/api/candidature/update-status", {
      method: "POST", headers,
      body: JSON.stringify({ candidature_id, status }),
    });
    await load();
    setUpdatingId(null);
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/candidature/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const activeListings = listings.filter((l) => l.status === "active");
  const closedListings = listings.filter((l) => l.status !== "active");
  const currentListing = listings.find((l) => l.id === activeListing);
  const isClosed = currentListing?.status !== "active";
  const hasConverted = currentListing?.candidatures.some((c) => c.status === "converted") ?? false;
  const submitted = currentListing?.candidatures.filter((c) => c.status === "submitted") ?? [];
  const others = currentListing?.candidatures.filter((c) => c.status !== "submitted") ?? [];

  const inp = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#635bff] focus:outline-none focus:ring-1 focus:ring-[#635bff]/30";

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-4 border-slate-200 border-t-[#635bff]" /></div>;
  }

  if (loadErr) {
    return (
      <div className="space-y-5">
        <SectionTitle title="Dossiers de candidature" desc="Partagez un lien, les candidats déposent leur dossier en ligne et joignent leurs justificatifs." />
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Erreur de chargement :</strong> {loadErr}
          {loadErr.includes("does not exist") && (
            <p className="mt-1 text-xs text-red-500">La migration SQL n'a pas encore été appliquée dans Supabase. Exécutez le fichier <code>supabase/migrations/20260628100000_candidatures.sql</code> dans l'éditeur SQL de votre projet Supabase.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <SectionTitle
          title="Dossiers de candidature"
          desc="Partagez un lien, les candidats déposent leur dossier en ligne et joignent leurs justificatifs."
        />
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#635bff] px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <PlusIcon className="h-4 w-4" />
          Nouvelle annonce
        </button>
      </div>

      {/* Formulaire de création */}
      {showCreate && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-950">Créer une annonce de candidature</h2>
          {createErr && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{createErr}</p>}

          {/* Property picker */}
          {properties.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">Bien concerné</p>
              <div className="flex flex-wrap gap-2">
                {[...properties].sort((a, b) => (vacantIds.has(b.id) ? 1 : 0) - (vacantIds.has(a.id) ? 1 : 0)).map((p) => {
                  const vacant = vacantIds.has(p.id);
                  const selected = form.property_id === p.id;
                  const name = p.label || p.city || "Bien";
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectProperty(selected ? null : p)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                        selected
                          ? "border-[#635bff] bg-[#635bff]/10 text-[#635bff]"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {name}
                      {vacant && (
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[0.6rem] font-bold text-emerald-700">Vacant</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {form.property_id && (
                <p className="text-[0.68rem] text-slate-400">Adresse et surface pré-remplies depuis la fiche bien.</p>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-xs font-semibold text-slate-700 sm:col-span-2">
              Titre de l'annonce
              <input className={inp} value={form.title} onChange={(e) => setF("title", e.target.value)} placeholder="Studio 25m² Paris 11e — Disponible juillet 2026" />
            </label>
            <label className="block space-y-1 text-xs font-semibold text-slate-700 sm:col-span-2">
              Adresse
              <input className={inp} value={form.address} onChange={(e) => setF("address", e.target.value)} placeholder="12 rue des Lilas, 75011 Paris" />
            </label>
            <label className="block space-y-1 text-xs font-semibold text-slate-700">
              Loyer HC (€)
              <input type="number" className={inp} value={form.rent_amount} onChange={(e) => setF("rent_amount", e.target.value)} placeholder="900" />
            </label>
            <label className="block space-y-1 text-xs font-semibold text-slate-700">
              Charges (€)
              <input type="number" className={inp} value={form.charges_amount} onChange={(e) => setF("charges_amount", e.target.value)} placeholder="50" />
            </label>
            <label className="block space-y-1 text-xs font-semibold text-slate-700">
              Type
              <select className={inp} value={form.property_type} onChange={(e) => setF("property_type", e.target.value)}>
                <option value="vide">Location vide</option>
                <option value="meuble">Location meublée</option>
              </select>
            </label>
            <label className="block space-y-1 text-xs font-semibold text-slate-700">
              Surface (m²)
              <input type="number" className={inp} value={form.surface_m2} onChange={(e) => setF("surface_m2", e.target.value)} placeholder="25" />
            </label>
            <label className="block space-y-1 text-xs font-semibold text-slate-700">
              Ratio revenus requis
              <select className={inp} value={form.income_ratio} onChange={(e) => setF("income_ratio", e.target.value)}>
                <option value="2.5">2,5× le loyer CC</option>
                <option value="3">3× le loyer CC (standard)</option>
                <option value="3.5">3,5× le loyer CC</option>
                <option value="4">4× le loyer CC</option>
              </select>
            </label>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => { setShowCreate(false); setForm({ title: "", address: "", rent_amount: "", charges_amount: "", property_type: "vide", surface_m2: "", income_ratio: "3", property_id: "" }); setPropsLoaded(false); }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Annuler
            </button>
            <button type="button" onClick={createListing} disabled={creating} className="rounded-xl bg-[#635bff] px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {creating ? "Création…" : "Créer l'annonce"}
            </button>
          </div>
        </div>
      )}

      {/* ── Onboarding : visible uniquement sans annonce active ── */}
      {activeListings.length === 0 && !showCreate && (
        <WorkflowOnboarding onStart={() => setShowCreate(true)} />
      )}

      {/* ── Annonces actives : 2 colonnes ── */}
      {activeListings.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-[280px,1fr]">
          {/* Liste */}
          <div className="space-y-2">
            {activeListings.map((l) => {
              const total = l.candidatures.length;
              const waiting = l.candidatures.filter((c) => c.status === "submitted").length;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setActiveListing(l.id)}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    l.id === activeListing
                      ? "border-[#635bff]/40 bg-[#635bff]/5 shadow-sm"
                      : "border-slate-200 bg-white hover:border-[#635bff]/20"
                  }`}
                >
                  <p className="truncate text-sm font-semibold text-slate-950">{l.title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {euro(l.rent_amount + l.charges_amount)} cc · {l.property_type === "meuble" ? "Meublé" : "Vide"}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-slate-500">{total} candidat{total !== 1 ? "s" : ""}</span>
                    {waiting > 0 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-700">
                        {waiting} à traiter
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Détail */}
          {currentListing ? (
            <div className="space-y-4">

              {/* Bannière clôture réussie */}
              {closeResult?.listingId === currentListing.id && (
                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <CheckCircleIcon className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Annonce clôturée</p>
                    <p className="text-xs mt-0.5">
                      {closeResult.deleted} dossier{closeResult.deleted > 1 ? "s" : ""} supprimé{closeResult.deleted > 1 ? "s" : ""} (refusés + brouillons) — données personnelles effacées conformément au RGPD.
                    </p>
                  </div>
                </div>
              )}

              {/* Bannière création locataire hors annonce réussie */}
              {manualTenantResult?.listingId === currentListing.id && (
                <div className="flex items-start gap-3 rounded-xl border border-[#635bff]/20 bg-[#635bff]/5 p-4 text-sm">
                  <UserPlusIcon className="h-5 w-5 shrink-0 mt-0.5 text-[#635bff]" />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{manualTenantResult.tenantName} ajouté à vos locataires</p>
                    <p className="text-xs text-slate-500 mt-0.5">Le candidat n'est jamais passé par lokt — l'annonce a été clôturée directement.</p>
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          const tid = manualTenantResult.tenantId;
                          const pid = manualTenantResult.propertyId ?? undefined;
                          setManualTenantResult(null);
                          if (onNavigateDeep) onNavigateDeep("baux", { openCreate: true, prefillTenantId: tid, prefillPropertyId: pid });
                          else onNavigate?.("baux");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        Créer le bail
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Bannière conversion locataire réussie */}
              {convertResult && (
                <div className="flex items-start gap-3 rounded-xl border border-[#635bff]/20 bg-[#635bff]/5 p-4 text-sm">
                  <UserPlusIcon className="h-5 w-5 shrink-0 mt-0.5 text-[#635bff]" />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">
                      {convertResult.alreadyExists
                        ? `${convertResult.tenantName} existe déjà dans vos locataires`
                        : `${convertResult.tenantName} ajouté à vos locataires`}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">Utilisez le bouton ci-dessous pour créer le bail, ou clôturez l'annonce.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => { setConvertResult(null); setCloseConfirm(currentListing?.id ?? null); }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        <LockClosedIcon className="h-3.5 w-3.5" />
                        Clôturer l'annonce
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal de confirmation clôture */}
              {closeConfirm === currentListing.id && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <TrashIcon className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-900">Clôturer cette annonce ?</p>
                      <p className="text-xs text-red-700 mt-1">
                        Cette action supprimera définitivement les données personnelles de tous les candidats <strong>refusés, en liste d'attente et brouillons</strong>. Les candidats retenus ne sont pas affectés. Action irréversible.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCloseConfirm(null)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      disabled={closingId === currentListing.id}
                      onClick={() => closeListing(currentListing.id)}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {closingId === currentListing.id ? "Suppression…" : "Confirmer la clôture"}
                    </button>
                  </div>
                </div>
              )}

              {isClosed ? (
                /* ── Vue annonce clôturée ── */
                <>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    <LockClosedIcon className="h-4 w-4 shrink-0" />
                    <div>
                      <span className="font-semibold text-slate-700">Annonce clôturée</span>
                      <span className="ml-2">· Les données des candidats non retenus ont été supprimées (RGPD).</span>
                    </div>
                  </div>
                  {others.filter((c) => c.status === "accepted" || c.status === "converted").length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                      <div className="border-b border-slate-100 px-5 py-3">
                        <p className="text-sm font-semibold text-slate-950">Candidat retenu</p>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {others.filter((c) => c.status === "accepted" || c.status === "converted").map((c) => (
                          <CandidatureRow
                            key={c.id}
                            c={c}
                            listing={currentListing}
                            updating={false}
                            converting={convertingId === c.id}
                            hasBail={!!(currentListing.property_id && activeLeasePropIds.has(currentListing.property_id))}
                            onUpdateStatus={() => {}}
                            onConvert={() => convertToTenant(c.id, `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(), currentListing.property_id)}
                            onCreateBail={() => navigateToBailCreate(c, currentListing.property_id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {currentListing.candidatures.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">Aucun dossier conservé.</p>
                  )}
                </>
              ) : (
                /* ── Vue annonce active ── */
                <>
                  <SharePanel listing={currentListing} copied={copied} onCopy={copyLink} />

                  <SynthesisPanel candidatures={currentListing.candidatures} listing={currentListing} />

                  {submitted.length > 0 && (
                    <a
                      href="/guides/choisir-son-locataire"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm transition hover:border-indigo-200 hover:bg-indigo-100"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
                        <BookOpenIcon className="h-4 w-4 text-indigo-600" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-indigo-900">Guide : choisir son locataire</p>
                        <p className="text-xs text-indigo-500">Critères légaux, vérification des pièces, taux d'effort, garant, GLI — lire le guide</p>
                      </div>
                      <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0 text-indigo-400" />
                    </a>
                  )}

                  {submitted.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                      <div className="border-b border-slate-100 px-5 py-3">
                        <p className="text-sm font-semibold text-slate-950">À traiter ({submitted.length})</p>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {submitted
                          .slice()
                          .sort((a, b) => scoreProfile(b, currentListing) - scoreProfile(a, currentListing))
                          .map((c) => (
                            <CandidatureRow
                              key={c.id}
                              c={c}
                              listing={currentListing}
                              updating={updatingId === c.id}
                              converting={convertingId === c.id}
                              hasBail={!!(currentListing.property_id && activeLeasePropIds.has(currentListing.property_id))}
                              onUpdateStatus={(status) => updateStatus(c.id, status)}
                              onConvert={() => convertToTenant(c.id, `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(), currentListing.property_id)}
                              onCreateBail={() => navigateToBailCreate(c, currentListing.property_id)}
                            />
                          ))}
                      </div>
                    </div>
                  )}

                  {others.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                      <div className="border-b border-slate-100 px-5 py-3">
                        <p className="text-sm font-semibold text-slate-950">Traités ({others.length})</p>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {others.map((c) => (
                          <CandidatureRow
                            key={c.id}
                            c={c}
                            listing={currentListing}
                            updating={updatingId === c.id}
                            converting={convertingId === c.id}
                            hasBail={!!(currentListing.property_id && activeLeasePropIds.has(currentListing.property_id))}
                            onUpdateStatus={(status) => updateStatus(c.id, status)}
                            onConvert={() => convertToTenant(c.id, `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(), currentListing.property_id)}
                            onCreateBail={() => navigateToBailCreate(c, currentListing.property_id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {currentListing.candidatures.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
                      <p className="text-sm text-slate-400">Aucun dossier reçu pour l'instant.</p>
                      <p className="mt-1 text-xs text-slate-400">Partagez le lien ci-dessus aux candidats.</p>
                    </div>
                  )}

                  {closeConfirm !== currentListing.id && closeResult?.listingId !== currentListing.id && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {hasConverted && !convertResult ? (
                        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex-1">
                          <LockClosedIcon className="h-4 w-4 shrink-0 text-amber-600" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-amber-900">Candidat converti en locataire</p>
                            <p className="text-xs text-amber-700">Pensez à clôturer l'annonce pour effacer les données des autres candidats (RGPD).</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCloseConfirm(currentListing.id)}
                            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition"
                          >
                            Clôturer
                          </button>
                        </div>
                      ) : manualTenantDraft?.listingId === currentListing.id ? (
                        <div className="w-full rounded-xl border border-indigo-200 bg-indigo-50 p-3 space-y-3">
                          <p className="text-xs font-semibold text-slate-900">Locataire trouvé hors lokt</p>
                          <p className="text-xs text-slate-600">
                            Le locataire retenu n'a pas candidaté via le lien (pas digital, envoi rapide des pièces...). Créez-le directement : il sera ajouté à vos locataires et l'annonce sera clôturée (données des autres candidats supprimées, RGPD).
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block space-y-1 text-xs font-semibold text-slate-700">
                              Prénom
                              <input
                                value={manualTenantDraft.firstName}
                                onChange={(e) => setManualTenantDraft((d) => (d ? { ...d, firstName: e.target.value } : d))}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
                              />
                            </label>
                            <label className="block space-y-1 text-xs font-semibold text-slate-700">
                              Nom
                              <input
                                value={manualTenantDraft.lastName}
                                onChange={(e) => setManualTenantDraft((d) => (d ? { ...d, lastName: e.target.value } : d))}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
                              />
                            </label>
                            <label className="block space-y-1 text-xs font-semibold text-slate-700">
                              Email
                              <input
                                type="email"
                                value={manualTenantDraft.email}
                                onChange={(e) => setManualTenantDraft((d) => (d ? { ...d, email: e.target.value } : d))}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
                              />
                            </label>
                            <label className="block space-y-1 text-xs font-semibold text-slate-700">
                              Téléphone
                              <input
                                value={manualTenantDraft.phone}
                                onChange={(e) => setManualTenantDraft((d) => (d ? { ...d, phone: e.target.value } : d))}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
                              />
                            </label>
                          </div>
                          {manualTenantErr && <p className="text-xs font-semibold text-red-600">{manualTenantErr}</p>}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={manualTenantSaving}
                              onClick={saveManualTenant}
                              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                            >
                              {manualTenantSaving ? "Création…" : "Créer le locataire et clôturer l'annonce"}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setManualTenantDraft(null); setManualTenantErr(null); }}
                              className="rounded-lg border px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-white"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => { setManualTenantErr(null); setManualTenantDraft({ listingId: currentListing.id, firstName: "", lastName: "", email: "", phone: "" }); }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 transition"
                          >
                            <UserPlusIcon className="h-3.5 w-3.5" />
                            Créer un locataire hors annonce
                          </button>
                          <div className="ml-auto">
                            <button
                              type="button"
                              onClick={() => setCloseConfirm(currentListing.id)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition"
                            >
                              <LockClosedIcon className="h-3.5 w-3.5" />
                              Clôturer l'annonce et supprimer les données
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <UserGroupIcon className="h-8 w-8 text-slate-200" />
              <p className="mt-3 text-sm font-medium text-slate-400">Sélectionnez une annonce</p>
            </div>
          )}
        </div>
      )}

      {/* ── Archives : accordion séparé, détail inline ── */}
      {closedListings.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-3.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition"
          >
            <span className="flex items-center gap-2">
              <LockClosedIcon className="h-4 w-4 text-slate-400" />
              Annonces clôturées ({closedListings.length})
            </span>
            {showArchived ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
          </button>

          {showArchived && (
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {closedListings.map((l) => {
                const isOpen = expandedArchive === l.id;
                const accepted = l.candidatures.filter((c) => c.status === "accepted" || c.status === "converted");
                return (
                  <div key={l.id}>
                    <button
                      type="button"
                      onClick={() => setExpandedArchive(isOpen ? null : l.id)}
                      className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50 transition"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{l.title}</p>
                        <p className="text-xs text-slate-400">
                          {euro(l.rent_amount + l.charges_amount)} cc · {l.property_type === "meuble" ? "Meublé" : "Vide"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {accepted.length > 0 && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-700">
                            {accepted.length} retenu{accepted.length > 1 ? "s" : ""}
                          </span>
                        )}
                        {isOpen ? <ChevronUpIcon className="h-4 w-4 text-slate-400" /> : <ChevronDownIcon className="h-4 w-4 text-slate-400" />}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-100 bg-slate-50/60 px-5 pb-5 pt-4 space-y-4">
                        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                          <LockClosedIcon className="h-4 w-4 shrink-0 text-slate-400" />
                          <span>
                            <span className="font-semibold text-slate-700">Annonce clôturée</span>
                            {" · "}Les données des candidats non retenus ont été supprimées (RGPD).
                          </span>
                        </div>

                        {accepted.length > 0 ? (
                          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                            <div className="border-b border-slate-100 px-5 py-3">
                              <p className="text-sm font-semibold text-slate-950">
                                Candidat{accepted.length > 1 ? "s" : ""} retenu{accepted.length > 1 ? "s" : ""}
                              </p>
                            </div>
                            <div className="divide-y divide-slate-100">
                              {accepted.map((c) => (
                                <CandidatureRow
                                  key={c.id}
                                  c={c}
                                  listing={l}
                                  updating={false}
                                  converting={convertingId === c.id}
                                  hasBail={!!(l.property_id && activeLeasePropIds.has(l.property_id))}
                                  onUpdateStatus={() => {}}
                                  onConvert={() => convertToTenant(c.id, `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(), l.property_id)}
                                  onCreateBail={() => navigateToBailCreate(c, l.property_id)}
                                />
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 text-center py-2">Aucun dossier conservé.</p>
                        )}

                        {convertResult && accepted.some((c) => c.id === convertResult.candidatureId) && (
                          <div className="flex items-start gap-3 rounded-xl border border-[#635bff]/20 bg-[#635bff]/5 p-4 text-sm">
                            <UserPlusIcon className="h-5 w-5 shrink-0 mt-0.5 text-[#635bff]" />
                            <div className="flex-1">
                              <p className="font-semibold text-slate-900">
                                {convertResult.alreadyExists
                                  ? `${convertResult.tenantName} existe déjà dans vos locataires`
                                  : `${convertResult.tenantName} ajouté à vos locataires`}
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  const tid = convertResult?.tenantId ?? undefined;
                                  const pid = convertResult?.propertyId ?? undefined;
                                  setConvertResult(null);
                                  if (onNavigateDeep && (tid || pid)) {
                                    onNavigateDeep("baux", { openCreate: true, prefillTenantId: tid, prefillPropertyId: pid });
                                  } else {
                                    onNavigate?.("baux");
                                  }
                                }}
                                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#635bff] px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                              >
                                Créer le bail <ArrowRightIcon className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── CandidatureRow ────────────────────────────────────────────────────────────

const SITUATION_SHORT: Record<string, string> = {
  CDI: "CDI", CDI_essai: "CDI*", CDD: "CDD",
  fonctionnaire: "Fonct.", independant: "Indép.",
  etudiant: "Étud.", retraite: "Retraité", autre: "Autre",
};

function CandidatureRow({ c, listing, updating, converting, hasBail, onUpdateStatus, onConvert, onCreateBail }: {
  c: Candidature;
  listing: Listing;
  updating: boolean;
  converting: boolean;
  hasBail?: boolean;
  onUpdateStatus: (status: string) => void;
  onConvert: () => void;
  onCreateBail?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const totalRent = listing.rent_amount + listing.charges_amount;
  const requiredIncome = totalRent * listing.income_ratio;
  const income = c.net_monthly_income ?? 0;
  const ratio = requiredIncome > 0 ? income / requiredIncome : 0;
  const isEligible = income >= requiredIncome;
  const docsCount = [c.docs_identity, c.docs_payslips, c.docs_tax, c.docs_address].filter(Boolean).length;
  const score = scoreProfile(c, listing);
  const badge = profileBadge(score);
  const statusInfo = STATUS_LABELS[c.status] ?? { label: c.status, color: "bg-slate-100 text-slate-500" };

  return (
    <div className="px-5 py-4 space-y-3">

      {/* ── Score + nom ── */}
      <div className="flex items-start gap-3.5">
        {/* Bulle score lokt */}
        <div className={`flex h-[52px] w-[52px] shrink-0 flex-col items-center justify-center rounded-2xl shadow-sm ${badge.bubble}`}>
          <span className="text-[1.2rem] font-extrabold leading-none text-white">{score}</span>
          <span className="text-[0.5rem] font-semibold uppercase tracking-wider text-white/70">/100</span>
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-semibold text-slate-950">{c.first_name} {c.last_name}</p>
            <span className={`rounded-full px-2 py-0.5 text-[0.62rem] font-semibold ${badge.color}`}>{badge.label}</span>
            <span className={`rounded-full px-2 py-0.5 text-[0.62rem] font-semibold ${statusInfo.color}`}>{statusInfo.label}</span>
            {c.has_guarantor && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[0.62rem] font-semibold text-indigo-700">
                <ShieldCheckIcon className="h-3 w-3" />
                Garant
              </span>
            )}
          </div>
          {/* Barre de score */}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full transition-all ${badge.bar}`} style={{ width: `${score}%` }} />
          </div>
        </div>
      </div>

      {/* ── 3 indicateurs clés ── */}
      <div className="grid grid-cols-3 gap-2">
        <div className={`rounded-xl border p-2.5 text-center ${isEligible ? "border-emerald-100 bg-emerald-50" : income > 0 ? "border-red-100 bg-red-50" : "border-slate-100 bg-slate-50"}`}>
          <p className={`text-base font-extrabold leading-none ${isEligible ? "text-emerald-700" : income > 0 ? "text-red-600" : "text-slate-400"}`}>
            {ratio > 0 ? `${ratio.toFixed(1)}×` : "—"}
          </p>
          <p className={`mt-0.5 text-[0.58rem] font-semibold uppercase tracking-wide ${isEligible ? "text-emerald-500" : income > 0 ? "text-red-400" : "text-slate-400"}`}>
            vs seuil
          </p>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-center">
          <p className="text-sm font-extrabold leading-none text-slate-800">
            {c.professional_situation ? (SITUATION_SHORT[c.professional_situation] ?? "—") : "—"}
          </p>
          <p className="mt-0.5 text-[0.58rem] font-semibold uppercase tracking-wide text-slate-400">Situation</p>
        </div>

        <div className={`rounded-xl border p-2.5 text-center ${docsCount === 4 ? "border-emerald-100 bg-emerald-50" : docsCount >= 2 ? "border-amber-100 bg-amber-50" : "border-slate-100 bg-slate-50"}`}>
          <p className={`text-base font-extrabold leading-none ${docsCount === 4 ? "text-emerald-700" : docsCount >= 2 ? "text-amber-700" : "text-slate-400"}`}>
            {docsCount}/4
          </p>
          <p className={`mt-0.5 text-[0.58rem] font-semibold uppercase tracking-wide ${docsCount === 4 ? "text-emerald-500" : docsCount >= 2 ? "text-amber-500" : "text-slate-400"}`}>Docs</p>
        </div>
      </div>

      {/* ── Accordéon dossier complet ── */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
      >
        {expanded ? <ChevronUpIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />}
        {expanded ? "Réduire" : "Voir le dossier complet"}
      </button>

      {expanded && (
        <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 text-xs">
          <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {c.email && <Detail label="Email" value={c.email} />}
            {c.phone && <Detail label="Téléphone" value={c.phone} />}
            {c.birth_date && <Detail label="Date de naissance" value={formatDate(c.birth_date) ?? ""} />}
            {c.submitted_at && <Detail label="Déposé le" value={formatDate(c.submitted_at) ?? ""} />}
            {c.employer_name && <Detail label="Employeur" value={c.employer_name} />}
            {income > 0 && <Detail label="Revenus nets" value={`${income.toLocaleString("fr-FR")} €/mois`} />}
            {c.has_guarantor && c.guarantor_type === "visale" && (
              <Detail label="Garantie" value={`Visale${c.visale_number ? ` — ${c.visale_number}` : ""}`} />
            )}
            {c.has_guarantor && c.guarantor_type !== "visale" && (
              <>
                <Detail label="Garant" value={[c.guarantor_first_name, c.guarantor_last_name].filter(Boolean).join(" ") || "—"} />
                {c.guarantor_income && <Detail label="Revenus garant" value={`${c.guarantor_income.toLocaleString("fr-FR")} €/mois`} />}
              </>
            )}
          </div>
          <DocsCompleteness c={c} />
          {c.has_guarantor && c.guarantor_type !== "visale" && <DocsCompleteness c={c} guarantor />}
          <div className="border-t border-slate-200 pt-2">
            <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">Détail du score lokt</p>
            <ScoreBreakdown c={c} listing={listing} />
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      {c.status === "submitted" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={updating} onClick={() => onUpdateStatus("accepted")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
            <CheckCircleIcon className="h-3.5 w-3.5" />Retenir
          </button>
          <button type="button" disabled={updating} onClick={() => onUpdateStatus("waitlist")}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            Liste d'attente
          </button>
          <button type="button" disabled={updating} onClick={() => onUpdateStatus("rejected")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50">
            <XCircleIcon className="h-3.5 w-3.5" />Refuser
          </button>
        </div>
      )}

      {c.status === "accepted" && (
        <button type="button" disabled={converting} onClick={onConvert}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#635bff]/30 bg-[#635bff]/5 px-3 py-1.5 text-xs font-semibold text-[#635bff] hover:bg-[#635bff]/10 disabled:opacity-50">
          <UserPlusIcon className="h-3.5 w-3.5" />
          {converting ? "Création…" : "Convertir en locataire"}
        </button>
      )}

      {c.status === "converted" && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-xs text-indigo-600">
            <UserPlusIcon className="h-3.5 w-3.5" />Locataire créé
          </span>
          {hasBail ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircleIcon className="h-3.5 w-3.5" />Bail créé
            </span>
          ) : onCreateBail && (
            <button type="button" onClick={onCreateBail}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#635bff] px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
              Créer le bail <ArrowRightIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-400">{label} : </span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}

function ScoreBreakdown({ c, listing }: { c: Candidature; listing: Listing }) {
  const { incomeScore, situScore, docsScore, guarantorScore } = computeScoreBreakdown(c, listing);

  const items = [
    { label: "Revenus", score: incomeScore, max: 40 },
    { label: "Stabilité pro", score: situScore, max: 30 },
    { label: "Dossier", score: docsScore, max: 20 },
    { label: "Garant", score: guarantorScore, max: 10 },
  ];

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map(({ label, score, max }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className="text-slate-500">{label}</span>
          <span className="font-semibold text-slate-800">{score}/{max}</span>
          <div className="h-1.5 w-12 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#635bff]"
              style={{ width: `${(score / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
