import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePermissions } from "../../PermissionProvider";
import { isActivePropertyLike, isActiveTenantLike, isSelectableLeaseLike } from "../../../lib/landlord/archiveFilters";

type PropertyLite = { id: string; label?: string | null; address?: string | null; city?: string | null; status?: string | null };
type TenantLite = { id: string; full_name?: string | null; email?: string | null; status?: string | null; archived_at?: string | null };
type LeaseLite = {
  id: string;
  property_id?: string | null;
  tenant_id?: string | null;
  rent_amount?: number | null;
  charges_amount?: number | null;
  deposit_amount?: number | null;
  start_date?: string | null;
  status?: string | null;
};

type Props = {
  userId: string;
  userEmail?: string | null;
  properties?: PropertyLite[];
  tenants?: TenantLite[];
  leases?: LeaseLite[];
};

type TemplateCategory = "bail" | "garantie" | "courrier" | "gestion" | "fiscal";

type DocumentTemplate = {
  id: string;
  title: string;
  category: TemplateCategory;
  audience: string;
  when: string;
  premium: boolean;
  risk: "Faible" | "Moyen" | "Élevé";
  description: string;
  required: string[];
  sections: string[];
  clauses: string[];
};

const CATEGORIES: Array<{ id: "all" | TemplateCategory; label: string }> = [
  { id: "all", label: "Tous" },
  { id: "bail", label: "Baux" },
  { id: "garantie", label: "Garanties" },
  { id: "courrier", label: "Courriers" },
  { id: "gestion", label: "Gestion" },
  { id: "fiscal", label: "Fiscalité" },
];

const TEMPLATES: DocumentTemplate[] = [
  {
    id: "bail-non-meuble",
    title: "Contrat de location non meublée",
    category: "bail",
    audience: "Résidence principale",
    when: "Location vide longue durée",
    premium: true,
    risk: "Élevé",
    description: "Trame structurée pour préparer un bail d’habitation non meublée avec les annexes à vérifier.",
    required: ["Identité bailleur/locataire", "Adresse du logement", "Surface habitable", "Loyer et charges", "DPE", "Notice d’information"],
    sections: ["Parties", "Désignation du logement", "Durée", "Loyer et charges", "Dépôt de garantie", "Obligations", "Annexes"],
    clauses: [
      "Le logement est loué à usage exclusif de résidence principale.",
      "Le locataire déclare avoir reçu les diagnostics et annexes nécessaires avant signature.",
      "Le dépôt de garantie sera restitué selon les règles applicables après comparaison des états des lieux.",
    ],
  },
  {
    id: "bail-meuble",
    title: "Contrat de location meublée",
    category: "bail",
    audience: "LMNP / résidence principale",
    when: "Appartement meublé",
    premium: true,
    risk: "Élevé",
    description: "Trame de bail meublé avec rappel des meubles obligatoires et inventaire à annexer.",
    required: ["Inventaire mobilier", "Liste équipements obligatoires", "DPE", "Loyer", "Charges", "Dépôt de garantie"],
    sections: ["Parties", "Logement meublé", "Mobilier", "Durée", "Loyer", "Dépôt de garantie", "Annexes"],
    clauses: [
      "Le logement est équipé d’un mobilier suffisant pour permettre au locataire d’y dormir, manger et vivre convenablement.",
      "Un inventaire détaillé du mobilier est annexé au contrat et signé par les parties.",
      "Toute dégradation ou disparition d’un élément inventorié pourra être prise en compte lors de la restitution du dépôt de garantie.",
    ],
  },
  {
    id: "bail-mobilite",
    title: "Bail mobilité",
    category: "bail",
    audience: "Étudiant / mission / formation",
    when: "Location meublée courte durée encadrée",
    premium: true,
    risk: "Élevé",
    description: "Modèle de préparation pour bail mobilité, avec points de vigilance sur l’éligibilité du locataire.",
    required: ["Justificatif d’éligibilité", "Durée prévue", "Inventaire", "Diagnostics", "Motif de mobilité"],
    sections: ["Éligibilité", "Durée", "Logement", "Loyer", "Charges", "Inventaire", "Fin de contrat"],
    clauses: [
      "Le locataire déclare entrer dans l’un des cas ouvrant droit au bail mobilité.",
      "Le bail est conclu pour une durée déterminée et ne peut pas être reconduit comme un bail classique.",
      "Aucun dépôt de garantie n’est prévu pour ce type de bail lorsque la règle applicable l’interdit.",
    ],
  },
  {
    id: "caution-solidaire",
    title: "Acte de caution solidaire",
    category: "garantie",
    audience: "Garant personne physique",
    when: "Avant signature du bail",
    premium: true,
    risk: "Élevé",
    description: "Trame de collecte des informations du garant et points à vérifier avant engagement.",
    required: ["Identité du garant", "Bail concerné", "Montant maximal garanti", "Durée d’engagement", "Signature"],
    sections: ["Garant", "Locataire", "Bail concerné", "Étendue de la garantie", "Durée", "Information du garant"],
    clauses: [
      "Le garant reconnaît avoir pris connaissance de la nature et de l’étendue de son engagement.",
      "L’engagement couvre les loyers, charges, réparations locatives et éventuels frais dans la limite indiquée.",
      "Le garant doit recevoir un exemplaire du bail et de l’acte signé.",
    ],
  },
  {
    id: "inventaire-meuble",
    title: "Inventaire mobilier meublé",
    category: "gestion",
    audience: "LMNP / meublé",
    when: "Entrée et sortie du locataire",
    premium: true,
    risk: "Moyen",
    description: "Trame d’inventaire pour vérifier quantités, état et remplacement des équipements.",
    required: ["Pièce", "Équipement", "Quantité", "État entrée", "État sortie", "Photos si utile"],
    sections: ["Cuisine", "Séjour", "Chambre", "Salle d’eau", "Linge", "Électroménager"],
    clauses: [
      "L’inventaire est établi contradictoirement et signé par les parties.",
      "Les différences constatées à la sortie peuvent justifier une retenue si elles ne relèvent pas de l’usure normale.",
    ],
  },
  {
    id: "relance-loyer",
    title: "Relance amiable de loyer impayé",
    category: "courrier",
    audience: "Locataire",
    when: "Premier retard de paiement",
    premium: true,
    risk: "Moyen",
    description: "Courrier court et factuel pour relancer sans dégrader la relation.",
    required: ["Période impayée", "Montant", "Date d’échéance", "Coordonnées de paiement"],
    sections: ["Rappel de l’échéance", "Montant dû", "Demande de régularisation", "Contact"],
    clauses: [
      "Sauf erreur de notre part, le règlement du loyer indiqué n’apparaît pas encore reçu.",
      "Merci de régulariser la situation ou de revenir vers moi en cas de difficulté.",
    ],
  },
  {
    id: "mise-en-demeure-loyer",
    title: "Mise en demeure pour loyer impayé",
    category: "courrier",
    audience: "Locataire / garant",
    when: "Après relance infructueuse",
    premium: true,
    risk: "Élevé",
    description: "Structure de courrier plus formel avant procédure, à adapter et faire vérifier.",
    required: ["Historique des relances", "Montant exact", "Bail", "Clause résolutoire éventuelle", "Garant"],
    sections: ["Constat de l’impayé", "Mise en demeure", "Délai", "Suites possibles"],
    clauses: [
      "Je vous mets en demeure de procéder au règlement des sommes dues.",
      "À défaut de régularisation, je me réserve la possibilité d’engager les démarches nécessaires.",
    ],
  },
  {
    id: "restitution-depot",
    title: "Restitution du dépôt de garantie",
    category: "gestion",
    audience: "Sortie locataire",
    when: "Après état des lieux de sortie",
    premium: true,
    risk: "Moyen",
    description: "Trame de courrier pour restituer le dépôt ou justifier des retenues.",
    required: ["Dépôt initial", "Date sortie", "État des lieux", "Justificatifs retenues", "RIB locataire"],
    sections: ["Rappel du dépôt", "Comparaison EDL", "Retenues", "Solde restitué", "Justificatifs"],
    clauses: [
      "Après comparaison des états des lieux d’entrée et de sortie, le solde du dépôt de garantie est le suivant.",
      "Les retenues éventuelles sont justifiées par les éléments joints.",
    ],
  },
  {
    id: "revision-loyer",
    title: "Notification de révision du loyer",
    category: "courrier",
    audience: "Locataire",
    when: "À la date prévue au bail",
    premium: true,
    risk: "Moyen",
    description: "Courrier de notification de révision avec rappel des informations à contrôler.",
    required: ["Clause de révision", "Indice de référence", "Ancien loyer", "Nouveau loyer", "Date d’effet"],
    sections: ["Référence du bail", "Indice", "Calcul", "Nouveau montant", "Date d’application"],
    clauses: [
      "Conformément à la clause de révision prévue au bail, le loyer est révisé selon l’indice applicable.",
      "Le nouveau montant s’appliquera à compter de la date indiquée.",
    ],
  },
  {
    id: "checklist-declaration",
    title: "Checklist déclaration bailleur",
    category: "fiscal",
    audience: "LMNP / location nue",
    when: "Préparation fiscale annuelle",
    premium: true,
    risk: "Moyen",
    description: "Liste de pièces à réunir pour préparer la déclaration ou échanger avec son expert-comptable.",
    required: ["Quittances", "Charges", "Intérêts d’emprunt", "Assurance", "Taxe foncière", "Travaux", "Frais de gestion"],
    sections: ["Revenus", "Charges", "Financement", "Travaux", "Pièces justificatives", "Questions ouvertes"],
    clauses: [
      "Ce document est une checklist opérationnelle et ne constitue pas une déclaration fiscale.",
      "Les arbitrages fiscaux doivent être validés avec un professionnel si la situation est complexe.",
    ],
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function riskTone(risk: DocumentTemplate["risk"]) {
  if (risk === "Élevé") return "border-red-200 bg-red-50 text-red-800";
  if (risk === "Moyen") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function buildTemplateMarkdown(params: {
  template: DocumentTemplate;
  property?: PropertyLite | null;
  tenant?: TenantLite | null;
  lease?: LeaseLite | null;
  userEmail?: string | null;
}) {
  const { template, property, tenant, lease, userEmail } = params;
  const totalRent = Number(lease?.rent_amount || 0) + Number(lease?.charges_amount || 0);

  return `# ${template.title}

Document préparatoire généré par lokt.fr

## Contexte

- Bien : ${property?.label || "[Nom du bien]"}
- Adresse / ville : ${property?.address || property?.city || "[Adresse du logement]"}
- Locataire : ${tenant?.full_name || "[Nom du locataire]"}
- Email locataire : ${tenant?.email || "[Email du locataire]"}
- Bailleur : ${userEmail || "[Email / identité bailleur]"}
- Date de début : ${lease?.start_date || "[Date]"}
- Loyer hors charges : ${lease?.rent_amount != null ? `${lease.rent_amount} EUR` : "[Montant]"}
- Charges : ${lease?.charges_amount != null ? `${lease.charges_amount} EUR` : "[Montant]"}
- Total mensuel : ${totalRent > 0 ? `${totalRent} EUR` : "[Montant]"}
- Dépôt de garantie : ${lease?.deposit_amount != null ? `${lease.deposit_amount} EUR` : "[Montant]"}

## Sections à compléter

${template.sections.map((section, index) => `${index + 1}. ${section}`).join("\n")}

## Pièces et informations à vérifier

${template.required.map((item) => `- [ ] ${item}`).join("\n")}

## Clauses / formulations de travail

${template.clauses.map((clause) => `- ${clause}`).join("\n")}

## Points de vigilance

- Vérifier que le modèle correspond bien à la situation réelle.
- Contrôler les règles applicables à la date de signature.
- Faire relire le document par un professionnel en cas d'enjeu élevé.

---

Note : ce modèle est une aide opérationnelle. Il ne constitue pas un conseil juridique, fiscal ou professionnel.
`;
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function SectionDocumentsTemplates({ userEmail, properties, tenants, leases }: Props) {
  const { loading, canUseLandlord } = usePermissions();
  const [category, setCategory] = useState<"all" | TemplateCategory>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(TEMPLATES[0]?.id || "");
  const [leaseId, setLeaseId] = useState("");
  const [ok, setOk] = useState<string | null>(null);

  const safeProperties = Array.isArray(properties) ? properties : [];
  const safeTenants = Array.isArray(tenants) ? tenants : [];
  const safeLeases = Array.isArray(leases) ? leases : [];

  const propertyById = useMemo(() => new Map(safeProperties.map((p) => [p.id, p])), [safeProperties]);
  const tenantById = useMemo(() => new Map(safeTenants.map((t) => [t.id, t])), [safeTenants]);
  const activeProperties = useMemo(() => safeProperties.filter(isActivePropertyLike), [safeProperties]);
  const activeTenants = useMemo(() => safeTenants.filter(isActiveTenantLike), [safeTenants]);
  const activeLeases = useMemo(() => safeLeases.filter(isSelectableLeaseLike), [safeLeases]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TEMPLATES.filter((template) => {
      const matchesCategory = category === "all" || template.category === category;
      const hay = [template.title, template.audience, template.when, template.description, ...template.required, ...template.sections]
        .join(" ")
        .toLowerCase();
      return matchesCategory && (!q || hay.includes(q));
    });
  }, [category, query]);

  const selected = TEMPLATES.find((template) => template.id === selectedId) || filtered[0] || TEMPLATES[0];
  const selectedLease = activeLeases.find((lease) => lease.id === leaseId) || null;
  const selectedProperty = selectedLease?.property_id ? propertyById.get(String(selectedLease.property_id)) || null : activeProperties[0] || null;
  const selectedTenant = selectedLease?.tenant_id ? tenantById.get(String(selectedLease.tenant_id)) || null : activeTenants[0] || null;

  const markdown = selected
    ? buildTemplateMarkdown({
        template: selected,
        property: selectedProperty,
        tenant: selectedTenant,
        lease: selectedLease,
        userEmail,
      })
    : "";

  const locked = !loading && !canUseLandlord;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-cyan-700">Documents premium</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">Templates pour bailleur autonome</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Une bibliothèque de modèles pour préparer les documents courants : baux, garanties, courriers, inventaires et dossier fiscal. Les modèles
            sont des trames de travail à vérifier avant signature ou envoi.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <p className="font-semibold text-slate-900">{TEMPLATES.length} modèles</p>
          <p className="mt-1 text-xs text-slate-600">Baux, courriers, garanties, fiscalité</p>
        </div>
      </div>

      {locked ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Fonction premium</p>
          <p className="mt-1">
            Le plan gratuit garde la gestion manuelle du premier logement. Les templates avancés sont inclus dans les abonnements Starter et Essentiel.
          </p>
          <Link
            href="/mon-compte/abonnement"
            className="mt-3 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Voir les abonnements
          </Link>
        </div>
      ) : null}

      {ok ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{ok}</div> : null}

      <div className={cx("grid gap-4 xl:grid-cols-[360px,1fr]", locked && "opacity-60")}>
        <aside className="space-y-3">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un modèle..."
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm"
            disabled={locked}
          />

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                disabled={locked}
                className={cx(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold",
                  category === cat.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filtered.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedId(template.id)}
                disabled={locked}
                className={cx(
                  "w-full rounded-2xl border p-3 text-left transition",
                  selected?.id === template.id ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-white hover:bg-slate-50"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{template.title}</p>
                  <span className={cx("shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold", riskTone(template.risk))}>
                    {template.risk}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">{template.when}</p>
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          {selected ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">{selected.audience}</p>
                    <h3 className="mt-1 text-xl font-semibold text-slate-950">{selected.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{selected.description}</p>
                  </div>
                  <span className={cx("rounded-full border px-3 py-1 text-xs font-semibold", riskTone(selected.risk))}>
                    Vigilance {selected.risk.toLowerCase()}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">Pré-remplissage</p>
                  <select
                    value={leaseId}
                    onChange={(event) => setLeaseId(event.target.value)}
                    disabled={locked}
                    className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Bien / locataire par défaut</option>
                    {activeLeases.map((lease) => {
                      const property = lease.property_id ? propertyById.get(String(lease.property_id)) : null;
                      const tenant = lease.tenant_id ? tenantById.get(String(lease.tenant_id)) : null;
                      return (
                        <option key={lease.id} value={lease.id}>
                          {property?.label || "Bien"} - {tenant?.full_name || "Locataire"}
                        </option>
                      );
                    })}
                  </select>
                  <p className="mt-2 text-xs text-slate-500">Le modèle exporté reprend les informations disponibles dans lokt.fr.</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">Actions</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => {
                        downloadText(`${selected.id}.md`, markdown);
                        setOk("Modèle téléchargé.");
                      }}
                      className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      Télécharger
                    </button>
                    <button
                      type="button"
                      disabled={locked}
                      onClick={async () => {
                        await navigator.clipboard?.writeText(selected.required.map((item) => `- ${item}`).join("\n"));
                        setOk("Checklist copiée.");
                      }}
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Copier checklist
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">Pièces à réunir</p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-700">
                    {selected.required.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="text-cyan-700">□</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">Structure du document</p>
                  <ol className="mt-3 space-y-2 text-sm text-slate-700">
                    {selected.sections.map((section, index) => (
                      <li key={section}>
                        <span className="font-semibold text-slate-900">{index + 1}.</span> {section}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">Aperçu du modèle</p>
                <pre className="mt-3 max-h-[360px] overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                  {markdown}
                </pre>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">Aucun modèle trouvé.</div>
          )}
        </section>
      </div>
    </div>
  );
}
