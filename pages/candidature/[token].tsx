import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  CloudArrowUpIcon,
  DocumentArrowUpIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import AppHeader from "../../components/AppHeader";
import AppFooter from "../../components/AppFooter";

type Listing = {
  id: string;
  token: string;
  title: string;
  address: string | null;
  rent_amount: number;
  charges_amount: number;
  property_type: string;
  surface_m2: number | null;
  available_at: string | null;
  income_ratio: number;
};

const euro = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const SITUATIONS = [
  { value: "CDI", label: "CDI" },
  { value: "CDI_essai", label: "CDI (période d'essai)" },
  { value: "CDD", label: "CDD" },
  { value: "fonctionnaire", label: "Fonctionnaire / titulaire" },
  { value: "independant", label: "Indépendant / freelance" },
  { value: "etudiant", label: "Étudiant" },
  { value: "retraite", label: "Retraité" },
  { value: "autre", label: "Autre" },
];

const STORAGE_KEY = (listingToken: string) => `lokt_draft_${listingToken}`;

const REQUIRED_FOR_SUBMIT = [
  "first_name", "last_name", "email", "phone", "birth_date",
  "professional_situation", "net_monthly_income",
  "docs_identity", "docs_payslips",
] as const;

const REQUIRED_LABELS: Record<string, string> = {
  first_name: "Prénom",
  last_name: "Nom",
  email: "Email",
  phone: "Téléphone",
  birth_date: "Date de naissance",
  professional_situation: "Situation professionnelle",
  net_monthly_income: "Revenus nets",
  docs_identity: "Pièce d'identité",
  docs_payslips: "Fiche de paie",
};

function isFilled(form: Record<string, any>, key: string): boolean {
  const v = form[key];
  if (typeof v === "boolean") return v === true;
  return !!v && String(v).trim() !== "";
}

export default function CandidaturePage() {
  const router = useRouter();
  const { token } = router.query;

  const [listing, setListing] = useState<Listing | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [candidatureToken, setCandidatureToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "", birth_date: "",
    professional_situation: "", employer_name: "", net_monthly_income: "",
    has_guarantor: false,
    guarantor_first_name: "", guarantor_last_name: "", guarantor_email: "",
    guarantor_situation: "", guarantor_income: "",
    docs_identity: false, docs_payslips: false, docs_tax: false, docs_address: false,
    consent: false,
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!token || typeof token !== "string") return;
    fetch(`/api/candidature/listing?token=${token}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setLoadError(j.error);
        else setListing(j.listing);
      })
      .catch(() => setLoadError("Impossible de charger l'annonce."));
  }, [token]);

  useEffect(() => {
    if (!token || typeof token !== "string" || draftLoaded) return;
    const stored = localStorage.getItem(STORAGE_KEY(token));
    if (!stored) { setDraftLoaded(true); return; }

    fetch(`/api/candidature/get-draft?token=${stored}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.candidature && j.candidature.status === "draft") {
          const c = j.candidature;
          setCandidatureToken(c.token);
          setForm({
            first_name: c.first_name ?? "",
            last_name: c.last_name ?? "",
            email: c.email ?? "",
            phone: c.phone ?? "",
            birth_date: c.birth_date ?? "",
            professional_situation: c.professional_situation ?? "",
            employer_name: c.employer_name ?? "",
            net_monthly_income: c.net_monthly_income != null ? String(c.net_monthly_income) : "",
            has_guarantor: c.has_guarantor ?? false,
            guarantor_first_name: c.guarantor_first_name ?? "",
            guarantor_last_name: c.guarantor_last_name ?? "",
            guarantor_email: c.guarantor_email ?? "",
            guarantor_situation: c.guarantor_situation ?? "",
            guarantor_income: c.guarantor_income != null ? String(c.guarantor_income) : "",
            docs_identity: c.docs_identity ?? false,
            docs_payslips: c.docs_payslips ?? false,
            docs_tax: c.docs_tax ?? false,
            docs_address: c.docs_address ?? false,
            consent: false,
          });
          setLastSaved(new Date(c.updated_at));
        } else {
          localStorage.removeItem(STORAGE_KEY(token as string));
        }
      })
      .catch(() => {})
      .finally(() => setDraftLoaded(true));
  }, [token, draftLoaded]);

  const totalRent = listing ? listing.rent_amount + listing.charges_amount : 0;
  const requiredIncome = listing ? totalRent * listing.income_ratio : 0;
  const candidateIncome = parseFloat(form.net_monthly_income.replace(",", ".")) || 0;
  const isEligible = candidateIncome >= requiredIncome;

  const missingRequired = REQUIRED_FOR_SUBMIT.filter((k) => !isFilled(form, k));
  const canSubmit = missingRequired.length === 0 && form.consent;

  async function saveDraft() {
    if (!listing) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/candidature/save-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_token: listing.token,
          candidature_token: candidatureToken ?? undefined,
          ...form,
          net_monthly_income: parseFloat(form.net_monthly_income.replace(",", ".")) || null,
          guarantor_income: parseFloat(form.guarantor_income.replace(",", ".")) || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur lors de la sauvegarde.");
      const newToken = json.candidature.token;
      setCandidatureToken(newToken);
      localStorage.setItem(STORAGE_KEY(listing.token), newToken);
      setLastSaved(new Date());
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!listing || !canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/candidature/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_token: listing.token,
          candidature_token: candidatureToken ?? undefined,
          ...form,
          net_monthly_income: parseFloat(form.net_monthly_income.replace(",", ".")) || null,
          guarantor_income: parseFloat(form.guarantor_income.replace(",", ".")) || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur lors de la soumission.");
      if (listing) localStorage.removeItem(STORAGE_KEY(listing.token));
      setDone(true);
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const inp = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-[#635bff] focus:outline-none focus:ring-1 focus:ring-[#635bff]/30";
  const lbl = "block space-y-1.5 text-sm font-medium text-slate-700";
  const req = <span className="text-red-400 ml-0.5">*</span>;

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#f7f7fb] flex flex-col">
        <AppHeader staticMode />
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <div className="max-w-md text-center">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-amber-400" />
            <h1 className="mt-4 text-xl font-semibold text-slate-950">Annonce introuvable</h1>
            <p className="mt-2 text-sm text-slate-500">{loadError}</p>
          </div>
        </main>
        <AppFooter />
      </div>
    );
  }

  if (!listing || !draftLoaded) {
    return (
      <div className="min-h-screen bg-[#f7f7fb] flex flex-col">
        <AppHeader staticMode />
        <main className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#635bff]" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7fb] flex flex-col text-slate-950">
      <Head>
        <title>Dossier de candidature — {listing.title} | lokt.fr</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <AppHeader staticMode />

      <main className="flex-1 px-4 py-8 sm:py-12">
        <div className="mx-auto max-w-2xl space-y-5">

          {/* Carte annonce */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-[#635bff]">Dossier de candidature</p>
            <h1 className="mt-1.5 text-xl font-semibold text-slate-950">{listing.title}</h1>
            {listing.address && <p className="mt-1 text-sm text-slate-500">{listing.address}</p>}
            <div className="mt-4 flex flex-wrap gap-3">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-800">
                {euro(totalRent)} / mois cc
              </span>
              {listing.surface_m2 && (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-600">
                  {listing.surface_m2} m²
                </span>
              )}
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-600">
                {listing.property_type === "meuble" ? "Meublé" : "Vide"}
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Revenus nets mensuels requis :{" "}
              <strong className="text-slate-700">{euro(requiredIncome)}</strong>{" "}
              ({listing.income_ratio}× le loyer charges comprises)
            </p>
          </div>

          {done ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-sm">
              <CheckCircleIcon className="mx-auto h-12 w-12 text-emerald-500" />
              <h2 className="mt-4 text-xl font-semibold text-emerald-950">Dossier envoyé !</h2>
              <p className="mt-2 text-sm text-emerald-800">
                Votre candidature a bien été transmise au bailleur. Vous recevrez une réponse par email.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 space-y-7">

              {lastSaved && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-2.5 text-xs text-emerald-700">
                  <CheckCircleIcon className="h-4 w-4 shrink-0" />
                  Brouillon sauvegardé — vous pouvez fermer cette page et revenir plus tard via le même lien.
                  <span className="ml-auto text-emerald-500">
                    {lastSaved.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )}

              <p className="text-xs text-slate-400">
                Les champs marqués <span className="text-red-400">*</span> sont obligatoires pour envoyer le dossier.
                Vous pouvez sauvegarder un brouillon à tout moment et revenir compléter via le même lien.
              </p>

              {/* 1 — Identité */}
              <section>
                <h2 className="text-base font-semibold text-slate-950">1. Votre identité</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className={lbl}>Prénom {req}
                    <input className={inp} value={form.first_name} onChange={(e) => set("first_name", e.target.value)} placeholder="Marie" />
                  </label>
                  <label className={lbl}>Nom {req}
                    <input className={inp} value={form.last_name} onChange={(e) => set("last_name", e.target.value)} placeholder="DUPONT" />
                  </label>
                  <label className={lbl}>Email {req}
                    <input type="email" className={inp} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="marie@exemple.fr" />
                  </label>
                  <label className={lbl}>Téléphone {req}
                    <input type="tel" className={inp} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="06 12 34 56 78" />
                  </label>
                  <label className={`${lbl} sm:col-span-2`}>Date de naissance {req}
                    <input type="date" className={inp} value={form.birth_date} onChange={(e) => set("birth_date", e.target.value)} />
                  </label>
                </div>
              </section>

              <hr className="border-slate-100" />

              {/* 2 — Situation pro */}
              <section>
                <h2 className="text-base font-semibold text-slate-950">2. Situation professionnelle et revenus</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className={lbl}>Situation {req}
                    <select className={inp} value={form.professional_situation} onChange={(e) => set("professional_situation", e.target.value)}>
                      <option value="">— Sélectionner —</option>
                      {SITUATIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </label>
                  <label className={lbl}>Employeur / établissement
                    <input className={inp} value={form.employer_name} onChange={(e) => set("employer_name", e.target.value)} placeholder="Nom de l'employeur" />
                  </label>
                  <label className={`${lbl} sm:col-span-2`}>Revenus nets mensuels (€) {req}
                    <input
                      className={inp}
                      inputMode="decimal"
                      value={form.net_monthly_income}
                      onChange={(e) => set("net_monthly_income", e.target.value)}
                      placeholder="2 500"
                    />
                    {candidateIncome > 0 && (
                      <span className={`mt-1 block text-xs font-medium ${isEligible ? "text-emerald-600" : "text-amber-600"}`}>
                        {isEligible
                          ? `✓ Revenus suffisants (${listing.income_ratio}× le loyer requis)`
                          : `Revenus inférieurs au critère (${euro(requiredIncome)} requis) — vous pouvez quand même postuler`}
                      </span>
                    )}
                  </label>
                </div>
              </section>

              <hr className="border-slate-100" />

              {/* 3 — Garant */}
              <section>
                <div className="flex items-center gap-3">
                  <input
                    id="has_guarantor"
                    type="checkbox"
                    checked={form.has_guarantor}
                    onChange={(e) => set("has_guarantor", e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#635bff] focus:ring-[#635bff]"
                  />
                  <label htmlFor="has_guarantor" className="text-base font-semibold text-slate-950 cursor-pointer select-none">
                    3. J'ai un garant <span className="text-sm font-normal text-slate-400">(optionnel)</span>
                  </label>
                </div>
                {form.has_guarantor && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className={lbl}>Prénom du garant
                      <input className={inp} value={form.guarantor_first_name} onChange={(e) => set("guarantor_first_name", e.target.value)} />
                    </label>
                    <label className={lbl}>Nom du garant
                      <input className={inp} value={form.guarantor_last_name} onChange={(e) => set("guarantor_last_name", e.target.value)} />
                    </label>
                    <label className={lbl}>Email du garant
                      <input type="email" className={inp} value={form.guarantor_email} onChange={(e) => set("guarantor_email", e.target.value)} />
                    </label>
                    <label className={lbl}>Revenus nets du garant (€/mois)
                      <input inputMode="decimal" className={inp} value={form.guarantor_income} onChange={(e) => set("guarantor_income", e.target.value)} />
                    </label>
                  </div>
                )}
              </section>

              <hr className="border-slate-100" />

              {/* 4 — Documents */}
              <section>
                <h2 className="text-base font-semibold text-slate-950">4. Pièces justificatives</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Joignez les documents demandés. Ils sont transmis au bailleur pour vérification.
                </p>
                <div className="mt-4 grid gap-3">
                  {[
                    { field: "docs_identity", label: "Pièce d'identité", hint: "CNI recto-verso ou passeport", required: true },
                    { field: "docs_payslips", label: "Dernière fiche de paie", hint: "PDF ou photo lisible", required: true },
                    { field: "docs_tax", label: "Avis d'imposition", hint: "Dernier avis disponible (impots.gouv.fr)", required: false },
                    { field: "docs_address", label: "Justificatif de domicile", hint: "Facture ou quittance de moins de 3 mois", required: false },
                  ].map(({ label, hint, field, required }) => {
                    const uploaded = form[field as keyof typeof form] as boolean;
                    return (
                      <label
                        key={field}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
                          uploaded ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white hover:border-[#635bff]/30"
                        }`}
                      >
                        <input
                          type="file"
                          className="sr-only"
                          accept="image/*,application/pdf"
                          onChange={(e) => { if (e.target.files?.[0]) set(field, true); }}
                        />
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${uploaded ? "bg-emerald-100" : "bg-slate-100"}`}>
                          {uploaded
                            ? <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                            : <DocumentArrowUpIcon className="h-5 w-5 text-slate-400" />
                          }
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium ${uploaded ? "text-emerald-800" : "text-slate-800"}`}>
                            {label}{required && <span className="text-red-400 ml-1">*</span>}
                          </p>
                          <p className="text-xs text-slate-400">{uploaded ? "Document joint ✓" : hint}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>

              <hr className="border-slate-100" />

              {/* Actions */}
              <section className="space-y-4">
                {missingRequired.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-xs font-semibold text-amber-800 mb-1.5">Il manque avant envoi :</p>
                    <div className="flex flex-wrap gap-1.5">
                      {missingRequired.map((k) => (
                        <span key={k} className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-medium text-amber-700">
                          {REQUIRED_LABELS[k] ?? k}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={(e) => set("consent", e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#635bff] focus:ring-[#635bff]"
                  />
                  <span className="text-sm text-slate-600">
                    J'accepte que les informations de ce formulaire et les documents joints soient transmis au bailleur dans le cadre de l'étude de ma candidature, conformément à la{" "}
                    <a href="/confidentialite" target="_blank" className="underline hover:text-slate-900">politique de confidentialité</a> de lokt.fr.
                  </span>
                </label>

                {saveError && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">{saveError}</p>}
                {submitError && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{submitError}</p>}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={saveDraft}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    <CloudArrowUpIcon className="h-4 w-4" />
                    {saving ? "Sauvegarde…" : "Sauvegarder le brouillon"}
                  </button>

                  <button
                    type="button"
                    disabled={!canSubmit || submitting}
                    onClick={handleSubmit}
                    title={!canSubmit ? "Complétez les champs requis et cochez le consentement" : undefined}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#635bff] px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? "Envoi en cours…" : "Envoyer mon dossier au bailleur"}
                    {!submitting && <ArrowRightIcon className="h-4 w-4" />}
                  </button>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500 space-y-1">
                  <p><strong className="text-slate-600">Durée de conservation de vos données</strong></p>
                  <p>Si votre candidature n'est pas retenue, vos informations personnelles et documents seront supprimés par le bailleur à la clôture de l'annonce. Les brouillons non soumis sont automatiquement effacés après 30 jours.</p>
                  <p>Vos données ne sont pas utilisées à des fins commerciales et aucun traitement automatisé n'est appliqué à vos documents.</p>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
