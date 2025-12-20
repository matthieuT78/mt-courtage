// components/landlord/RepairResponsibilityGuide.tsx
import React, { useMemo, useState } from "react";

type Side = "locataire" | "proprietaire" | "depend";
type Rule = {
  id: string;
  title: string;
  keywords: string[];
  category:
    | "Électricité"
    | "Plomberie"
    | "Chauffage"
    | "Serrurerie"
    | "Menuiseries"
    | "Peinture"
    | "Ventilation"
    | "Extérieurs"
    | "Divers";
  side: Side;
  why: string;
  exceptions?: string[];
  tips?: string[];
};

const SIDE_LABEL: Record<Side, string> = {
  locataire: "Locataire",
  proprietaire: "Propriétaire",
  depend: "Ça dépend",
};

const SIDE_TONE: Record<Side, { border: string; bg: string; text: string }> = {
  locataire: { border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-900" },
  proprietaire: { border: "border-indigo-200", bg: "bg-indigo-50", text: "text-indigo-900" },
  depend: { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-900" },
};

const RULES: Rule[] = [
  {
    id: "ampoules",
    title: "Ampoules / néons / piles détecteur",
    keywords: ["ampoule", "ampoules", "néon", "neon", "pile", "détecteur", "detecteur", "dét",
      "d.a.a.f", "daaf"],
    category: "Électricité",
    side: "locataire",
    why: "Entretien courant et remplacements de consommables.",
    exceptions: ["Si l’installation est défectueuse (douille/prise/interrupteur), c’est plutôt propriétaire."],
    tips: ["Note l’emplacement exact (ex: “plafonnier séjour”)."],
  },
  {
    id: "prises-interrupteurs",
    title: "Prises / interrupteurs (défaillance)",
    keywords: ["prise", "prises", "interrupteur", "interrupteurs", "disjoncte", "disjoncteur"],
    category: "Électricité",
    side: "proprietaire",
    why: "Éléments de l’installation électrique (hors simple remplacement d’ampoule).",
    exceptions: ["Si casse volontaire / mauvaise utilisation avérée : locataire."],
  },
  {
    id: "joints-silicone",
    title: "Joints (douche/lavabo) & silicone",
    keywords: ["joint", "joints", "silicone", "moisi", "mousse", "calcaire"],
    category: "Plomberie",
    side: "locataire",
    why: "Entretien courant (joints, nettoyage, prévention moisissures).",
    exceptions: ["Si infiltration due à défaut structurel/plomberie encastrée : propriétaire."],
  },
  {
    id: "robinet-fuite",
    title: "Robinet qui fuit",
    keywords: ["robinet", "fuite", "goutte", "mitigeur", "mousseur"],
    category: "Plomberie",
    side: "depend",
    why: "Petite pièce (joint/mousseur) = entretien courant, mais robinet vétuste/HS = propriétaire.",
    exceptions: [
      "Joint/mousseur/serrage : locataire.",
      "Robinet/mécanisme HS par vétusté : propriétaire.",
      "Casse : responsable de la casse.",
    ],
    tips: ["Ajoute une photo + “depuis quand” + “débit approximatif”."],
  },
  {
    id: "debouchage",
    title: "Débouchage évier/lavabo/douche",
    keywords: ["bouchon", "deboucher", "déboucher", "canalisation", "siphon", "evier", "évier"],
    category: "Plomberie",
    side: "locataire",
    why: "Bouchon lié à l’usage (cheveux, graisses) = entretien courant.",
    exceptions: ["Si canalisation principale/colonne commune : plutôt propriétaire/copro."],
  },
  {
    id: "chasse-eau",
    title: "Chasse d’eau / WC",
    keywords: ["wc", "toilette", "chasse", "flotteur", "réservoir", "reservoir"],
    category: "Plomberie",
    side: "depend",
    why: "Petites pièces souvent entretien courant, remplacement complet si vétusté.",
    exceptions: [
      "Flotteur/joint accessible : souvent locataire.",
      "Mécanisme complet/vétusté : propriétaire.",
    ],
  },
  {
    id: "chaudiere-entretien",
    title: "Chaudière individuelle : entretien annuel",
    keywords: ["chaudiere", "chaudière", "entretien", "ramonage", "gaz", "contrat"],
    category: "Chauffage",
    side: "locataire",
    why: "Entretien courant des équipements individuels (si prévu).",
    exceptions: ["Panne/remplacement dû à vétusté : propriétaire."],
  },
  {
    id: "ballon-eau-chaude",
    title: "Ballon d’eau chaude (remplacement)",
    keywords: ["ballon", "cumulus", "eau chaude", "chauffe-eau", "chauffe eau"],
    category: "Chauffage",
    side: "proprietaire",
    why: "Gros équipement (remplacement/panne structurelle).",
    exceptions: ["Manque d’entretien évident (entartrage extrême) peut être discuté selon cas."],
  },
  {
    id: "serrure-bloquee",
    title: "Serrure bloquée / clé cassée",
    keywords: ["serrure", "cle", "clé", "cylindre", "barillet", "porte", "verrou"],
    category: "Serrurerie",
    side: "depend",
    why: "La cause fait la responsabilité.",
    exceptions: [
      "Clé perdue/cassée : locataire.",
      "Serrure vétuste : propriétaire.",
      "Dégradation : responsable de la dégradation.",
    ],
  },
  {
    id: "vitre-cassee",
    title: "Vitre cassée",
    keywords: ["vitre", "fenetre", "fenêtre", "double vitrage", "bris"],
    category: "Menuiseries",
    side: "depend",
    why: "Casse = souvent locataire ; défaut/vétusté = propriétaire.",
    exceptions: ["Fissure “spontanée”/défaut : propriétaire."],
  },
  {
    id: "peinture-usure",
    title: "Peinture usée / jaunie (vétusté)",
    keywords: ["peinture", "murs", "mur", "jauni", "vétusté", "vetuste", "usure", "salissure"],
    category: "Peinture",
    side: "proprietaire",
    why: "Usure normale = vétusté (à la charge du propriétaire).",
    exceptions: ["Dégradations anormales (trous, tags, gros dégâts) : locataire."],
  },
  {
    id: "vmc",
    title: "VMC / bouches d’aération",
    keywords: ["vmc", "aeration", "aération", "bouche", "grille", "ventilation"],
    category: "Ventilation",
    side: "depend",
    why: "Nettoyage courant = locataire ; panne système = propriétaire.",
    exceptions: ["Bouche/grille encrassée : locataire.", "Moteur VMC HS : propriétaire."],
  },
];

type Props = {
  compact?: boolean; // version encart
  initialQuery?: string;
  onPick?: (rule: Rule) => void; // optionnel: si tu veux réagir au clic
  title?: string;
};

export function RepairResponsibilityGuide({
  compact = false,
  initialQuery = "",
  onPick,
  title = "Qui paie quoi ? (locataire vs propriétaire)",
}: Props) {
  const [q, setQ] = useState(initialQuery);
  const [cat, setCat] = useState<string>("Toutes");
  const [side, setSide] = useState<Side | "all">("all");

  const categories = useMemo(() => {
    const s = new Set(RULES.map((r) => r.category));
    return ["Toutes", ...Array.from(s)];
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return RULES.filter((r) => {
      const matchQ =
        !qq ||
        r.title.toLowerCase().includes(qq) ||
        r.keywords.some((k) => k.toLowerCase().includes(qq)) ||
        r.why.toLowerCase().includes(qq);
      const matchCat = cat === "Toutes" || r.category === cat;
      const matchSide = side === "all" || r.side === side;
      return matchQ && matchCat && matchSide;
    });
  }, [q, cat, side]);

  return (
    <div className={"rounded-2xl border border-slate-200 bg-white shadow-sm " + (compact ? "p-4" : "p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Guide</p>
          <p className={"font-semibold text-slate-900 " + (compact ? "text-sm" : "text-base")}>{title}</p>
          <p className={"mt-1 text-slate-600 " + (compact ? "text-xs" : "text-[0.85rem]")}>
            Règle simple : <span className="font-semibold">entretien courant</span> = locataire •{" "}
            <span className="font-semibold">vétusté / gros travaux</span> = propriétaire •{" "}
            <span className="font-semibold">casse</span> = responsable.
          </p>
        </div>
      </div>

      <div className={"mt-3 grid gap-2 " + (compact ? "grid-cols-1" : "sm:grid-cols-3")}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          placeholder='Rechercher : "ampoule", "robinet", "chaudière"...'
        />
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={side}
          onChange={(e) => setSide(e.target.value as any)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">Tous</option>
          <option value="locataire">Locataire</option>
          <option value="proprietaire">Propriétaire</option>
          <option value="depend">Ça dépend</option>
        </select>
      </div>

      <div className="mt-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
            Aucun résultat. Essaie un mot-clé : “ampoule”, “joint”, “serrure”…
          </div>
        ) : (
          filtered.map((r) => {
            const tone = SIDE_TONE[r.side];
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onPick?.(r)}
                className={"w-full text-left rounded-xl border px-3 py-3 transition " + tone.border + " " + tone.bg}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={"text-sm font-semibold " + tone.text}>
                      {r.title}{" "}
                      <span className="text-slate-500 text-xs">• {r.category}</span>
                    </p>
                    <p className="mt-1 text-[0.85rem] text-slate-800">{r.why}</p>
                    {r.exceptions?.length ? (
                      <ul className="mt-2 list-disc pl-5 text-[0.8rem] text-slate-700 space-y-1">
                        {r.exceptions.slice(0, compact ? 1 : 3).map((x, idx) => (
                          <li key={idx}>{x}</li>
                        ))}
                      </ul>
                    ) : null}
                    {r.tips?.length && !compact ? (
                      <p className="mt-2 text-[0.75rem] text-slate-600">
                        Astuce : <span className="font-semibold">{r.tips[0]}</span>
                      </p>
                    ) : null}
                  </div>

                  <div className="shrink-0">
                    <span className={"inline-flex items-center rounded-full px-2.5 py-1 text-[0.7rem] font-semibold border " + tone.border + " " + tone.text}>
                      {SIDE_LABEL[r.side]}
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      <p className="mt-3 text-[0.72rem] text-slate-500">
        Note : guide informatif. La responsabilité peut dépendre du bail, de la vétusté, de la preuve, et du contexte.
      </p>
    </div>
  );
}
