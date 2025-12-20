// pages/etats-des-lieux-documents.tsx
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";

type SimpleUser = { id: string; email?: string };

type PropertyRow = {
  id: string;
  user_id: string;
  label: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  created_at?: string;
  updated_at?: string;
};

type TenantRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};

type Tab = "modeles" | "checklist" | "documents";

type ChecklistCategory =
  | "général"
  | "entrée"
  | "séjour"
  | "cuisine"
  | "chambre"
  | "sdb"
  | "wc"
  | "annexes"
  | "compteurs";

type ChecklistItem = {
  id: string;
  category: ChecklistCategory;
  label: string;
  checked: boolean;
  note: string;
};

type DocKind =
  | "Pièce d'identité"
  | "Contrat de travail"
  | "3 dernières fiches de paie"
  | "Avis d'imposition"
  | "Justificatif de domicile"
  | "Attestation employeur"
  | "Garant (pièces)"
  | "Autre";

type StoredDoc = {
  id: string;
  property_id: string | null;
  tenant_id: string | null;
  kind: DocKind;
  title: string;
  status: "à demander" | "reçu" | "validé";
  notes: string;
  created_at: string;
};

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function addr(p: PropertyRow) {
  const parts = [
    p.address_line1,
    p.address_line2,
    [p.postal_code, p.city].filter(Boolean).join(" "),
    p.country,
  ].filter(Boolean);
  return parts.join(", ");
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function printChecklist(title: string, items: ChecklistItem[], meta: { property?: string; tenant?: string }) {
  const grouped = items.reduce<Record<string, ChecklistItem[]>>((acc, it) => {
    acc[it.category] = acc[it.category] || [];
    acc[it.category].push(it);
    return acc;
  }, {});
  const html = `
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; }
        h1 { font-size: 18px; margin: 0 0 8px; }
        .meta { color: #555; font-size: 12px; margin-bottom: 16px; }
        h2 { margin-top: 16px; font-size: 14px; }
        ul { padding-left: 18px; }
        li { margin: 6px 0; }
        .note { color: #666; font-size: 12px; margin-left: 6px; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="meta">
        ${meta.property ? `Bien : ${meta.property}<br/>` : ""}
        ${meta.tenant ? `Locataire : ${meta.tenant}<br/>` : ""}
        Généré le ${new Date().toLocaleString("fr-FR")}
      </div>
      ${Object.keys(grouped)
        .map(
          (cat) => `
        <h2>${cat.toUpperCase()}</h2>
        <ul>
          ${grouped[cat]
            .map(
              (it) =>
                `<li>${it.checked ? "☑" : "☐"} ${it.label}${it.note ? `<span class="note">— ${it.note}</span>` : ""}</li>`
            )
            .join("")}
        </ul>
      `
        )
        .join("")}
    </body>
  </html>`;
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

/** Helper : force le bon type ChecklistCategory (évite category: string) */
function ci(category: ChecklistCategory, label: string): ChecklistItem {
  return { id: uid("c"), category, label, checked: false, note: "" };
}

function baseChecklistFor(typeBien: string): ChecklistItem[] {
  const common: ChecklistItem[] = [
    ci("général", "État général du logement (propreté, odeurs, humidité)"),
    ci("compteurs", "Relevé compteur électricité"),
    ci("compteurs", "Relevé compteur eau"),
    ci("compteurs", "Relevé compteur gaz (si applicable)"),
    ci("entrée", "Porte d’entrée (serrure, clés)"),
    ci("entrée", "Interphone / badge"),
    ci("annexes", "Cave / parking / box (si applicable)"),
  ];

  // ✅ IMPORTANT : typé ChecklistItem[] (sinon category devient string)
  const studio: ChecklistItem[] = [
    ci("séjour", "Murs / plafonds / sols"),
    ci("séjour", "Fenêtres / volets / rideaux"),
    ci("séjour", "Chauffage / radiateurs"),
    ci("cuisine", "Plaques / hotte / four (si présent)"),
    ci("cuisine", "Réfrigérateur / congélateur (si présent)"),
    ci("cuisine", "Évier / robinetterie / évacuation"),
    ci("sdb", "Douche/baignoire (joints, évacuation)"),
    ci("sdb", "Lavabo / miroir / rangements"),
    ci("wc", "WC (chasse d’eau, abattant)"),
  ];

  const t2: ChecklistItem[] = [
    ...studio,
    ci("chambre", "Chambre : murs / plafonds / sols"),
    ci("chambre", "Chambre : fenêtres / volets"),
  ];

  const maison: ChecklistItem[] = [
    ...t2,
    ci("annexes", "Extérieurs : jardin / terrasse"),
    ci("annexes", "Portail / clôture (si applicable)"),
  ];

  const map: Record<string, ChecklistItem[]> = {
    studio: [...common, ...studio],
    t1: [...common, ...studio],
    t2: [...common, ...t2],
    t3: [...common, ...t2, ci("chambre", "Chambre 2 : état général")],
    maison: [...common, ...maison],
  };

  return map[typeBien] || [...common, ...studio];
}

function storageKey(userId: string) {
  return `mt_docs_${userId}`;
}

export default function EtatsDesLieuxDocumentsPage() {
  const router = useRouter();

  // Auth
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<SimpleUser | null>(null);

  // Data (properties / tenants)
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // UI
  const tabFromUrl = (router.query.tab as string) || "modeles";
  const [tab, setTab] = useState<Tab>(
    (["modeles", "checklist", "documents"] as Tab[]).includes(tabFromUrl as Tab) ? (tabFromUrl as Tab) : "modeles"
  );

  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");

  // Checklist
  const [typeBien, setTypeBien] = useState<string>("studio");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => baseChecklistFor("studio"));

  // Documents (MVP localStorage)
  const [docs, setDocs] = useState<StoredDoc[]>([]);
  const [docKind, setDocKind] = useState<DocKind>("Pièce d'identité");
  const [docTitle, setDocTitle] = useState<string>("Pièce d'identité");
  const [docStatus, setDocStatus] = useState<StoredDoc["status"]>("à demander");
  const [docNotes, setDocNotes] = useState<string>("");

  const selectedProperty = useMemo(
    () => properties.find((p) => p.id === selectedPropertyId) || null,
    [properties, selectedPropertyId]
  );
  const selectedTenant = useMemo(
    () => tenants.find((t) => t.id === selectedTenantId) || null,
    [tenants, selectedTenantId]
  );

  const requireAuthRedirect = "/mon-compte?mode=login&redirect=/etats-des-lieux-documents";

  const setTabInUrl = (next: Tab) => {
    setTab(next);
    router.push({ pathname: "/etats-des-lieux-documents", query: { tab: next } }, undefined, { shallow: true });
  };

  // Auth load
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const u = data.session?.user;
        if (!mounted) return;
        setUser(u ? { id: u.id, email: u.email ?? undefined } : null);
      } finally {
        if (mounted) setChecking(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email ?? undefined } : null);
      setChecking(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Load properties + tenants
  useEffect(() => {
    if (!user?.id) return;

    (async () => {
      try {
        setLoadingData(true);
        setDataError(null);

        const [pRes, tRes] = await Promise.all([
          supabase.from("properties").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
          supabase.from("tenants").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        ]);

        if (pRes.error) throw pRes.error;
        if (tRes.error) throw tRes.error;

        setProperties((pRes.data || []) as PropertyRow[]);
        setTenants((tRes.data || []) as TenantRow[]);
      } catch (e: any) {
        setDataError(e?.message || "Impossible de charger vos biens/locataires.");
      } finally {
        setLoadingData(false);
      }
    })();
  }, [user?.id]);

  // Load docs from localStorage (per user)
  useEffect(() => {
    if (!user?.id) return;
    try {
      const raw = localStorage.getItem(storageKey(user.id));
      if (raw) setDocs(JSON.parse(raw));
      else setDocs([]);
    } catch {
      setDocs([]);
    }
  }, [user?.id]);

  // Persist docs
  useEffect(() => {
    if (!user?.id) return;
    try {
      localStorage.setItem(storageKey(user.id), JSON.stringify(docs));
    } catch {
      // ignore
    }
  }, [docs, user?.id]);

  // Checklist regenerate when type changes
  useEffect(() => {
    setChecklist(baseChecklistFor(typeBien));
  }, [typeBien]);

  const filteredDocs = useMemo(() => {
    return docs.filter((d) => {
      const okProp = selectedPropertyId ? d.property_id === selectedPropertyId : true;
      const okTenant = selectedTenantId ? d.tenant_id === selectedTenantId : true;
      return okProp && okTenant;
    });
  }, [docs, selectedPropertyId, selectedTenantId]);

  const addDoc = () => {
    if (!user?.id) return;
    const d: StoredDoc = {
      id: uid("doc"),
      property_id: selectedPropertyId || null,
      tenant_id: selectedTenantId || null,
      kind: docKind,
      title: docTitle || docKind,
      status: docStatus,
      notes: docNotes || "",
      created_at: new Date().toISOString(),
    };
    setDocs((prev) => [d, ...prev]);
    setDocNotes("");
  };

  const updateDoc = (id: string, patch: Partial<StoredDoc>) => {
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const removeDoc = (id: string) => {
    const ok = window.confirm("Supprimer ce document de la liste ?");
    if (!ok) return;
    setDocs((prev) => prev.filter((d) => d.id !== id));
  };

  const exportChecklistText = () => {
    const title = `Checklist état des lieux (${typeBien})`;
    const lines: string[] = [];
    lines.push(title);
    lines.push(`Généré le ${new Date().toLocaleString("fr-FR")}`);
    if (selectedProperty) lines.push(`Bien : ${selectedProperty.label || "Sans titre"} — ${addr(selectedProperty)}`);
    if (selectedTenant) lines.push(`Locataire : ${selectedTenant.full_name || "—"} (${selectedTenant.email || "—"})`);
    lines.push("");
    checklist.forEach((it) => {
      lines.push(`${it.checked ? "[x]" : "[ ]"} [${it.category}] ${it.label}${it.note ? ` — ${it.note}` : ""}`);
    });
    downloadTextFile("checklist-etat-des-lieux.txt", lines.join("\n"));
  };

  // -------------------------
  // UI: not logged in
  // -------------------------
  if (!checking && !user) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-100">
        <AppHeader />
        <main className="flex-1 px-4 py-6">
          <div className="max-w-xl mx-auto rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-emerald-600">États des lieux & documents</p>
            <h1 className="text-lg font-semibold text-slate-900">Connectez-vous pour accéder à l’outil</h1>
            <p className="text-sm text-slate-600">
              Vous pourrez générer vos checklists, télécharger des modèles et centraliser les pièces locataires.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push(requireAuthRedirect)}
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Me connecter
              </button>
              <button
                type="button"
                onClick={() => router.push("/mon-compte?mode=register&redirect=/etats-des-lieux-documents")}
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Créer un compte
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // -------------------------
  // UI: main
  // -------------------------
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-6xl mx-auto space-y-5">
          {/* Header */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-2">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-emerald-600">États des lieux & documents</p>
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
              Modèles + checklist personnalisable + centralisation des pièces.
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl">
              MVP : checklist + gestion de la liste de documents. Branchement Supabase Storage + table “documents”
              ensuite pour stocker les fichiers en base.
            </p>

            {dataError && (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {dataError}
              </div>
            )}
          </section>

          {/* Controls */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
              <div className="flex flex-wrap gap-2">
                {([
                  ["modeles", "Modèles"],
                  ["checklist", "Checklist"],
                  ["documents", "Documents locataire"],
                ] as const).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTabInUrl(k)}
                    className={
                      "rounded-full px-4 py-2 text-xs font-semibold border " +
                      (tab === k
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50")
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <label className="block text-[0.7rem] text-slate-600 mb-1">Bien (optionnel)</label>
                  <select
                    value={selectedPropertyId}
                    onChange={(e) => setSelectedPropertyId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    disabled={loadingData}
                  >
                    <option value="">— Tous mes biens —</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {(p.label || "Bien") + (addr(p) ? ` — ${addr(p)}` : "")}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-[0.7rem] text-slate-500">
                    {properties.length === 0 ? (
                      <>
                        Aucun bien trouvé. Ajoute-en dans ton espace bailleur.{" "}
                        <Link className="underline" href="/mon-compte?tab=bailleur">
                          Ouvrir l’espace bailleur
                        </Link>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="flex-1">
                  <label className="block text-[0.7rem] text-slate-600 mb-1">Locataire (optionnel)</label>
                  <select
                    value={selectedTenantId}
                    onChange={(e) => setSelectedTenantId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    disabled={loadingData}
                  >
                    <option value="">— Tous mes locataires —</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {(t.full_name || "Locataire") + (t.email ? ` — ${t.email}` : "")}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-[0.7rem] text-slate-500">
                    {tenants.length === 0 ? (
                      <>
                        Aucun locataire trouvé. Ajoute-en dans ton espace bailleur.{" "}
                        <Link className="underline" href="/mon-compte?tab=bailleur">
                          Ouvrir l’espace bailleur
                        </Link>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Content */}
          {tab === "modeles" ? (
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Modèles</p>
                <h2 className="text-lg font-semibold text-slate-900">États des lieux entrée / sortie</h2>
                <p className="text-sm text-slate-600 mt-1">
                  MVP : modèles en “texte” + impression. Ensuite on branchera de vrais PDF (templates) si tu veux.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {/* Entrée */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <p className="text-sm font-semibold text-slate-900">Modèle – Entrée</p>
                  <p className="text-xs text-slate-600">Génère un document d’état des lieux d’entrée à compléter + imprimer.</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const title = "État des lieux – Entrée";
                        const content = [
                          title,
                          `Date : ${new Date().toLocaleDateString("fr-FR")}`,
                          selectedProperty
                            ? `Bien : ${selectedProperty.label || "Sans titre"} — ${addr(selectedProperty)}`
                            : "Bien : __________________________",
                          selectedTenant
                            ? `Locataire : ${selectedTenant.full_name || ""} (${selectedTenant.email || ""})`
                            : "Locataire : ______________________",
                          "",
                          "1) Compteurs (relevés) :",
                          "- Électricité : ________",
                          "- Eau : ________",
                          "- Gaz : ________",
                          "",
                          "2) Clés remises :",
                          "- Nombre de clés : ________",
                          "- Badges : ________",
                          "",
                          "3) Observations par pièce :",
                          "- Entrée : __________________________",
                          "- Séjour : __________________________",
                          "- Cuisine : _________________________",
                          "- Chambre(s) : ______________________",
                          "- Salle de bain : ___________________",
                          "- WC : ______________________________",
                          "",
                          "Signatures :",
                          "Bailleur : _________________________",
                          "Locataire : ________________________",
                        ].join("\n");

                        downloadTextFile("etat-des-lieux-entree.txt", content);
                      }}
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      Télécharger (.txt)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const metaProp = selectedProperty
                          ? `${selectedProperty.label || "Bien"} — ${addr(selectedProperty)}`
                          : "";
                        const metaTenant = selectedTenant
                          ? `${selectedTenant.full_name || "Locataire"} (${selectedTenant.email || "—"})`
                          : "";
                        printChecklist("Checklist EDL – Entrée", baseChecklistFor(typeBien), {
                          property: metaProp,
                          tenant: metaTenant,
                        });
                      }}
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      Imprimer une checklist
                    </button>
                  </div>
                </div>

                {/* Sortie */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <p className="text-sm font-semibold text-slate-900">Modèle – Sortie</p>
                  <p className="text-xs text-slate-600">
                    Génère un document d’état des lieux de sortie (comparatif + restitution dépôt).
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const title = "État des lieux – Sortie";
                        const content = [
                          title,
                          `Date : ${new Date().toLocaleDateString("fr-FR")}`,
                          selectedProperty
                            ? `Bien : ${selectedProperty.label || "Sans titre"} — ${addr(selectedProperty)}`
                            : "Bien : __________________________",
                          selectedTenant
                            ? `Locataire : ${selectedTenant.full_name || ""} (${selectedTenant.email || ""})`
                            : "Locataire : ______________________",
                          "",
                          "1) Compteurs (relevés finaux) :",
                          "- Électricité : ________",
                          "- Eau : ________",
                          "- Gaz : ________",
                          "",
                          "2) Restitution des clés :",
                          "- Nombre de clés : ________",
                          "- Badges : ________",
                          "",
                          "3) Dégradations constatées / comparatif entrée :",
                          "- _______________________________",
                          "- _______________________________",
                          "",
                          "4) Dépôt de garantie :",
                          "- Montant : ________",
                          "- Retenue (si applicable) : ________",
                          "- Reste à restituer : ________",
                          "",
                          "Signatures :",
                          "Bailleur : _________________________",
                          "Locataire : ________________________",
                        ].join("\n");

                        downloadTextFile("etat-des-lieux-sortie.txt", content);
                      }}
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      Télécharger (.txt)
                    </button>
                    <Link
                      href="/mon-compte?tab=bailleur"
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      Gérer mes biens/locataires
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          ) : tab === "checklist" ? (
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <div>
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Checklist</p>
                  <h2 className="text-lg font-semibold text-slate-900">Checklist personnalisable par type de bien</h2>
                  <p className="text-sm text-slate-600 mt-1">Coche, ajoute des notes, puis export (.txt) ou impression.</p>
                </div>

                <div className="flex gap-2 items-end">
                  <div>
                    <label className="block text-[0.7rem] text-slate-600 mb-1">Type de bien</label>
                    <select
                      value={typeBien}
                      onChange={(e) => setTypeBien(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="studio">Studio / T1</option>
                      <option value="t2">T2</option>
                      <option value="t3">T3</option>
                      <option value="maison">Maison</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => setChecklist(baseChecklistFor(typeBien))}
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Réinitialiser
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={exportChecklistText}
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Exporter (.txt)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const metaProp = selectedProperty ? `${selectedProperty.label || "Bien"} — ${addr(selectedProperty)}` : "";
                    const metaTenant = selectedTenant
                      ? `${selectedTenant.full_name || "Locataire"} (${selectedTenant.email || "—"})`
                      : "";
                    printChecklist(`Checklist EDL (${typeBien})`, checklist, { property: metaProp, tenant: metaTenant });
                  }}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Imprimer
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                {checklist.map((it) => (
                  <div key={it.id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <label className="flex items-start gap-2 text-sm text-slate-800">
                        <input
                          type="checkbox"
                          checked={it.checked}
                          onChange={(e) =>
                            setChecklist((prev) =>
                              prev.map((x) => (x.id === it.id ? { ...x, checked: e.target.checked } : x))
                            )
                          }
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                        />
                        <span>
                          <span className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-400">{it.category}</span>
                          <br />
                          <span className="font-medium">{it.label}</span>
                        </span>
                      </label>

                      <button
                        type="button"
                        onClick={() => setChecklist((prev) => prev.filter((x) => x.id !== it.id))}
                        className="text-[0.7rem] font-semibold text-red-600 hover:underline"
                      >
                        Supprimer
                      </button>
                    </div>

                    <div className="mt-2">
                      <input
                        value={it.note}
                        onChange={(e) =>
                          setChecklist((prev) => prev.map((x) => (x.id === it.id ? { ...x, note: e.target.value } : x)))
                        }
                        placeholder="Note (ex: rayure, tâche, fissure, photo prise...)"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                ))}

                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-600 mb-2">Ajouter un point personnalisé</p>
                  <AddChecklistItem
                    onAdd={(label) => {
                      // ✅ category bien typée
                      const item: ChecklistItem = { id: uid("c"), category: "général", label, checked: false, note: "" };
                      setChecklist((prev) => [item, ...prev]);
                    }}
                  />
                </div>
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">Documents locataire</p>
                <h2 className="text-lg font-semibold text-slate-900">Centralisation des pièces (MVP)</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Pour l’instant : liste & statuts stockés en local (par utilisateur). Ensuite : upload fichiers via Supabase
                  Storage + table.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr,1.2fr]">
                {/* Left: add */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <p className="text-sm font-semibold text-slate-900">Ajouter / suivre un document</p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-600">Type</label>
                      <select
                        value={docKind}
                        onChange={(e) => {
                          const v = e.target.value as DocKind;
                          setDocKind(v);
                          if (!docTitle || docTitle === docKind) setDocTitle(v);
                        }}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        {([
                          "Pièce d'identité",
                          "Contrat de travail",
                          "3 dernières fiches de paie",
                          "Avis d'imposition",
                          "Justificatif de domicile",
                          "Attestation employeur",
                          "Garant (pièces)",
                          "Autre",
                        ] as DocKind[]).map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[0.7rem] text-slate-600">Statut</label>
                      <select
                        value={docStatus}
                        onChange={(e) => setDocStatus(e.target.value as StoredDoc["status"])}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="à demander">À demander</option>
                        <option value="reçu">Reçu</option>
                        <option value="validé">Validé</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-600">Titre (optionnel)</label>
                    <input
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      placeholder="Ex : CNI recto/verso"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[0.7rem] text-slate-600">Notes</label>
                    <textarea
                      value={docNotes}
                      onChange={(e) => setDocNotes(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      placeholder="Ex : manquant, illisible, à relancer..."
                    />
                  </div>

                  <button
                    type="button"
                    onClick={addDoc}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Ajouter à la liste
                  </button>

                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[0.75rem] text-amber-800">
                    Upload de fichiers : on le branche juste après (Storage + table). Là c’est une “to-do list” structurée.
                  </div>
                </div>

                {/* Right: list */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">Documents ({filteredDocs.length})</p>
                    <button
                      type="button"
                      onClick={() => {
                        const ok = window.confirm("Vider la liste filtrée ?");
                        if (!ok) return;
                        const ids = new Set(filteredDocs.map((d) => d.id));
                        setDocs((prev) => prev.filter((d) => !ids.has(d.id)));
                      }}
                      className="text-[0.75rem] font-semibold text-red-600 hover:underline"
                    >
                      Vider la liste
                    </button>
                  </div>

                  {filteredDocs.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-[0.8rem] text-slate-600">
                      Aucun document dans ce contexte. Sélectionne un bien/locataire, puis ajoute les documents à demander.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredDocs.map((d) => (
                        <div key={d.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{d.title}</p>
                              <p className="text-[0.75rem] text-slate-500">
                                {d.kind} • Ajouté le {new Date(d.created_at).toLocaleDateString("fr-FR")}
                              </p>
                              {d.notes ? <p className="mt-1 text-[0.8rem] text-slate-700">{d.notes}</p> : null}
                            </div>

                            <button
                              type="button"
                              onClick={() => removeDoc(d.id)}
                              className="text-[0.75rem] font-semibold text-red-600 hover:underline"
                            >
                              Supprimer
                            </button>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2 items-center">
                            <span
                              className={
                                "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold " +
                                (d.status === "validé"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : d.status === "reçu"
                                  ? "border-sky-200 bg-sky-50 text-sky-700"
                                  : "border-amber-200 bg-amber-50 text-amber-800")
                              }
                            >
                              {d.status}
                            </span>

                            <select
                              value={d.status}
                              onChange={(e) => updateDoc(d.id, { status: e.target.value as StoredDoc["status"] })}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                            >
                              <option value="à demander">À demander</option>
                              <option value="reçu">Reçu</option>
                              <option value="validé">Validé</option>
                            </select>

                            <input
                              value={d.notes}
                              onChange={(e) => updateDoc(d.id, { notes: e.target.value })}
                              placeholder="Note rapide…"
                              className="flex-1 min-w-[220px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Footer actions */}
          <div className="text-right">
            <a href="/outils-proprietaire" className="text-[0.75rem] text-slate-500 underline underline-offset-2">
              ← Retour à la boîte à outils propriétaire
            </a>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>© {new Date().getFullYear()} MT Courtage &amp; Investissement – Outils pour propriétaires et investisseurs.</p>
        <p className="mt-1">
          Contact :{" "}
          <a href="mailto:mtcourtage@gmail.com" className="underline">
            mtcourtage@gmail.com
          </a>
        </p>
      </footer>
    </div>
  );
}

function AddChecklistItem({ onAdd }: { onAdd: (label: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ex : état des plinthes, joints silicone, VMC..."
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      />
      <button
        type="button"
        onClick={() => {
          const v = value.trim();
          if (!v) return;
          onAdd(v);
          setValue("");
        }}
        className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
      >
        Ajouter
      </button>
    </div>
  );
}
