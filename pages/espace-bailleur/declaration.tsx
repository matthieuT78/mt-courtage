// pages/espace-bailleur/declaration.tsx
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import AppHeader from "../../components/AppHeader";
import AppFooter from "../../components/AppFooter";
import { supabase } from "../../lib/supabaseClient";

type TaxMode = "lmnp" | "nue" | "";
type Regime = "micro" | "reel" | "";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export default function DeclarationPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Config
  const [taxMode, setTaxMode] = useState<TaxMode>("");
  const [regime, setRegime] = useState<Regime>("");
  const [year, setYear] = useState<number>(new Date().getFullYear());

  // Data (à brancher sur tes tables : leases / payments / expenses / projects etc.)
  const [grossIncome, setGrossIncome] = useState<number>(0);
  const [deductibleExpenses, setDeductibleExpenses] = useState<number>(0);

  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auth minimal
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!supabase) throw new Error("Auth indisponible.");
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!mounted) return;
        setUserId(data.user?.id ?? null);
      } catch {
        if (!mounted) return;
        setUserId(null);
      } finally {
        if (mounted) setChecking(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const isLoggedIn = !!userId;

  const suggested = useMemo(() => {
    // Heuristique V1 (à améliorer)
    if (!taxMode) return null;
    if (taxMode === "lmnp") {
      // Sans amortissements : si dépenses “fortes”, réel a du sens
      const ratio = grossIncome > 0 ? deductibleExpenses / grossIncome : 0;
      return ratio > 0.25 ? "reel" : "micro";
    }
    if (taxMode === "nue") {
      const ratio = grossIncome > 0 ? deductibleExpenses / grossIncome : 0;
      return ratio > 0.20 ? "reel" : "micro";
    }
    return null;
  }, [taxMode, grossIncome, deductibleExpenses]);

  const savePreferences = async () => {
    setError(null);
    setInfo(null);
    if (!supabase || !userId) return;

    setSaving(true);
    try {
      const payload = {
        id: userId,
        updated_at: new Date().toISOString(),
        // tu peux créer des colonnes dédiées, ou stocker en JSON dans profiles si tu préfères
        // ici je mets en "user_metadata" possible aussi, mais mieux dans profiles.
      };

      const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (error) throw error;

      setInfo("Préférences enregistrées ✅");
    } catch (e: any) {
      setError(e?.message || "Impossible d’enregistrer.");
    } finally {
      setSaving(false);
    }
  };

  const goLogin = () => router.push(`/mon-compte?mode=login&redirect=${encodeURIComponent("/espace-bailleur/declaration")}`);

  const brandBg = "bg-gradient-to-r from-indigo-700 to-cyan-500";
  const brandText = "text-white";

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-100">
        <AppHeader />
        <div className="h-1 w-full bg-gradient-to-r from-sky-600 via-sky-500 to-cyan-400" />
        <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-slate-500">Chargement…</div>
        <AppFooter />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-100">
        <AppHeader />
        <div className="h-1 w-full bg-gradient-to-r from-sky-600 via-sky-500 to-cyan-400" />
        <main className="mx-auto max-w-5xl px-4 py-10">
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 max-w-xl">
            <div className={cx("h-1.5 w-full rounded-full mb-4", brandBg)} />
            <h1 className="text-lg font-semibold text-slate-900">Aide à la déclaration</h1>
            <p className="mt-1 text-sm text-slate-600">
              Connectez-vous pour accéder à votre dossier fiscal (LMNP, location nue, etc.).
            </p>
            <button
              onClick={goLogin}
              className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Me connecter
            </button>
            <p className="mt-3 text-xs text-slate-500">
              * Izimo fournit une aide à la saisie et à l’organisation. Ce n’est pas un conseil fiscal.
            </p>
          </div>
        </main>
        <AppFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <AppHeader />
      <div className="h-1 w-full bg-gradient-to-r from-sky-600 via-sky-500 to-cyan-400" />

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className={cx("h-1.5 w-full", brandBg)} />
          <div className="p-6">
            <p className="text-[0.7rem] uppercase tracking-[0.2em] text-slate-500">Boîte à outils</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">Aide à la déclaration</h1>
            <p className="mt-2 text-sm text-slate-600 max-w-3xl">
              Choisis ton régime (LMNP, location nue…), retrouve les chiffres clés et exporte un dossier clair.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              * Izimo fournit une aide à la saisie et à l’organisation. Ce n’est pas un conseil fiscal.
            </p>
          </div>
        </section>

        {/* Configuration */}
        <section className="grid gap-4 lg:grid-cols-[1fr,1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-900">1) Configuration</h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-slate-700">Type de location</label>
                <select
                  value={taxMode}
                  onChange={(e) => setTaxMode(e.target.value as TaxMode)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">— Choisir —</option>
                  <option value="lmnp">LMNP (meublé)</option>
                  <option value="nue">Location nue</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-700">Année</label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value || String(new Date().getFullYear()), 10))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-3 space-y-1">
              <label className="text-xs text-slate-700">Régime</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setRegime("micro")}
                  className={cx(
                    "rounded-full px-4 py-2 text-xs font-semibold border",
                    regime === "micro" ? cx(brandBg, brandText, "border-transparent") : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                  )}
                >
                  Micro
                </button>
                <button
                  type="button"
                  onClick={() => setRegime("reel")}
                  className={cx(
                    "rounded-full px-4 py-2 text-xs font-semibold border",
                    regime === "reel" ? cx(brandBg, brandText, "border-transparent") : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                  )}
                >
                  Réel
                </button>

                {suggested ? (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    Suggestion Izimo : <span className="ml-1 font-semibold">{suggested === "micro" ? "Micro" : "Réel"}</span>
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={savePreferences}
                disabled={saving}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
              {info ? <p className="text-sm text-emerald-700">{info}</p> : null}
              {error ? <p className="text-sm text-red-700">{error}</p> : null}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-900">2) Chiffres clés (V1)</h2>
            <p className="mt-2 text-sm text-slate-600">
              Branche ici tes données : loyers encaissés, charges déductibles, intérêts, assurances…
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">Recettes brutes</p>
                <input
                  type="number"
                  value={grossIncome}
                  onChange={(e) => setGrossIncome(parseFloat(e.target.value || "0"))}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">Charges déductibles</p>
                <input
                  type="number"
                  value={deductibleExpenses}
                  onChange={(e) => setDeductibleExpenses(parseFloat(e.target.value || "0"))}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-900">Lecture rapide</p>
              <p className="mt-1 text-sm text-slate-600">
                Ratio charges / recettes :{" "}
                <span className="font-semibold">
                  {grossIncome > 0 ? Math.round((deductibleExpenses / grossIncome) * 100) : 0} %
                </span>
              </p>
              <p className="mt-2 text-xs text-slate-500">
                (À compléter : intérêts d’emprunt, assurance emprunteur, frais de gestion, travaux…)
              </p>
            </div>
          </div>
        </section>

        {/* Checklist + Exports */}
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-900">3) Checklist déclaration</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {[
                "Loyers encaissés (année fiscale) + justificatifs",
                "Taxe foncière + appels de charges copro",
                "Assurances (PNO, GLI, etc.)",
                "Intérêts d’emprunt + assurance emprunteur",
                "Travaux (nature + date + factures)",
                "Frais de gestion / conciergerie / comptable",
                "Relevés bancaires (si besoin de recoupement)",
              ].map((x) => (
                <li key={x} className="flex gap-2">
                  <span>•</span>
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-900">4) Exports</h2>
            <p className="mt-2 text-sm text-slate-600">
              Génère un dossier “déclaration” clair (PDF / CSV). (À implémenter ensuite.)
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                onClick={() => alert("TODO: export PDF")}
              >
                Export PDF (dossier)
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                onClick={() => alert("TODO: export CSV")}
              >
                Export CSV (charges)
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Bonus : export “comptable” LMNP réel (catégories + totaux + pièces jointes).
            </p>
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}
