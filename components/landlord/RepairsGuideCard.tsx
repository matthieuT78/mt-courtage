import { useMemo, useState } from "react";

type Side = "locataire" | "proprietaire";

type Rule = {
  id: string;
  label: string;
  side: Side;
  details?: string;
  pageHint?: string; // ex: "Entrée", "Cuisine"...
};

const RULES: Rule[] = [
  // Entrée (pages 2-3)
  { id: "r1", label: "Détecteur de fumée", side: "locataire", details: "Entretien (test, dépoussiérage, piles…)", pageHint: "Entrée" },
  { id: "r2", label: "Détecteur de fumée", side: "proprietaire", details: "Remplacement", pageHint: "Entrée" },
  { id: "r3", label: "Serrure / canon", side: "locataire", details: "Graissage + petites pièces", pageHint: "Entrée" },
  { id: "r4", label: "Porte d’entrée", side: "proprietaire", details: "Remplacement (sauf dégradations)", pageHint: "Entrée" },

  // Cuisine (pages 6-7)
  { id: "r5", label: "Évier / évacuation", side: "locataire", details: "Débouchage, joints, colliers", pageHint: "Cuisine" },
  { id: "r6", label: "Robinetterie", side: "locataire", details: "Joints, clapets, presse-étoupe", pageHint: "Cuisine" },
  { id: "r7", label: "Chaudière", side: "locataire", details: "Entretien courant / annuel selon contrat", pageHint: "Cuisine" },
  { id: "r8", label: "Chaudière", side: "proprietaire", details: "Remplacement", pageHint: "Cuisine" },

  // Sanitaires (pages 8-9)
  { id: "r9", label: "WC / chasse d’eau", side: "locataire", details: "Petites réparations, joints, débouchage", pageHint: "Sanitaires" },
  { id: "r10", label: "Ballon d’eau chaude", side: "proprietaire", details: "Remplacement / détartrage", pageHint: "Sanitaires" },

  // Extérieur (pages 10-13)
  { id: "r11", label: "Gouttières / chéneaux", side: "locataire", details: "Dégorgement des conduits", pageHint: "Extérieur" },
  { id: "r12", label: "Arbres / élagage", side: "proprietaire", details: "Selon cas (guide)", pageHint: "Extérieur" },
];

function groupBySide(list: Rule[]) {
  return {
    locataire: list.filter((r) => r.side === "locataire"),
    proprietaire: list.filter((r) => r.side === "proprietaire"),
  };
}

export default function RepairsGuideCard() {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return RULES;
    return RULES.filter((r) => {
      const hay = `${r.label} ${r.details ?? ""} ${r.pageHint ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [q]);

  const grouped = useMemo(() => groupBySide(filtered), [filtered]);

  const pdfHref = "/docs/guide-reparations-locatives.pdf";

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-50" />

      <div className="relative p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
              Référence pratique
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">
              Réparations locatives : qui répare, qui entretient ?
            </h3>
            <p className="mt-1 text-sm text-slate-600 max-w-2xl">
              Recherche rapide (ex : “robinet”, “serrure”, “VMC”, “volet”). Puis ouvre le guide officiel complet si besoin.
            </p>
          </div>

          <div className="shrink-0 flex gap-2">
            <a
              href={pdfHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Ouvrir le guide PDF
            </a>
          </div>
        </div>

        <div className="mt-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un élément (ex : robinet, serrure, chaudière...)"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900/20"
          />
          <p className="mt-2 text-[0.75rem] text-slate-500">
            Source : guide illustré “Votre habitat — Qui répare, qui entretient ?”
          </p>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-900">Locataire</p>
            <div className="mt-2 space-y-2">
              {grouped.locataire.length === 0 ? (
                <p className="text-xs text-slate-500">Aucun résultat.</p>
              ) : (
                grouped.locataire.slice(0, 10).map((r) => (
                  <div key={r.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-sm font-medium text-slate-900">{r.label}</p>
                    {r.details ? <p className="text-xs text-slate-600 mt-0.5">{r.details}</p> : null}
                    {r.pageHint ? <p className="text-[0.7rem] text-slate-400 mt-1">{r.pageHint}</p> : null}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-900">Propriétaire</p>
            <div className="mt-2 space-y-2">
              {grouped.proprietaire.length === 0 ? (
                <p className="text-xs text-slate-500">Aucun résultat.</p>
              ) : (
                grouped.proprietaire.slice(0, 10).map((r) => (
                  <div key={r.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-sm font-medium text-slate-900">{r.label}</p>
                    {r.details ? <p className="text-xs text-slate-600 mt-0.5">{r.details}</p> : null}
                    {r.pageHint ? <p className="text-[0.7rem] text-slate-400 mt-1">{r.pageHint}</p> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-600">
            Astuce : en cas de litige, garde le PDF en pièce jointe dans l’échange (mise en demeure / état des lieux / retenue).
          </p>
        </div>
      </div>
    </section>
  );
}
