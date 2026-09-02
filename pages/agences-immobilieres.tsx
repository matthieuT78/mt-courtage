// pages/agences-immobilieres.tsx
import { useState } from "react";
import Head from "next/head";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import { supabase } from "../lib/supabaseClient";

const AGENTS_COUNT_OPTIONS = ["1 (moi seul)", "2 à 5", "6 à 15", "16 à 50", "50+"];
const DOES_PM_OPTIONS = ["Oui", "Non — uniquement transaction/vente", "Un peu, en complément"];
const MANDATES_COUNT_OPTIONS = ["Moins de 20", "20 à 50", "50 à 150", "150 à 400", "400+"];
const CURRENT_TOOL_OPTIONS = [
  "Aucun outil dédié (papier / Excel)",
  "Logiciel généraliste (Rentila, Gererseul, ImmoFacile...)",
  "Logiciel spécialisé agences (Norma, ICS, Cerofim, Crypto...)",
  "Solution développée en interne",
  "Autre",
];
const BUDGET_OPTIONS = ["Moins de 50 €/mois", "50 à 150 €/mois", "150 à 400 €/mois", "400 €+/mois", "Je ne sais pas encore"];
const INTEREST_OPTIONS = ["Oui, ça m'intéresse", "Peut-être, à voir", "Non, pas pour mon agence"];
const REFERRAL_OPTIONS = ["Oui, ça m'intéresse", "Peut-être, à voir", "Non"];

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function getUtmFromUrl(): Record<string, string> | null {
  if (typeof window === "undefined") return null;
  try {
    const sp = new URLSearchParams(window.location.search);
    const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "msclkid"];
    const utm: Record<string, string> = {};
    for (const k of keys) {
      const v = sp.get(k);
      if (v) utm[k] = v;
    }
    return Object.keys(utm).length ? utm : null;
  } catch {
    return null;
  }
}

export default function AgencesImmobilieresPage() {
  const brandBg = "bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8]";

  const [agencyName, setAgencyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [agentsCount, setAgentsCount] = useState("");
  const [doesPropertyManagement, setDoesPropertyManagement] = useState("");
  const [mandatesCount, setMandatesCount] = useState("");
  const [currentTool, setCurrentTool] = useState("");
  const [painPoints, setPainPoints] = useState("");
  const [expectations, setExpectations] = useState("");
  const [budget, setBudget] = useState("");
  const [interestLevel, setInterestLevel] = useState("");
  const [referralInterest, setReferralInterest] = useState("");
  const [consentContact, setConsentContact] = useState(false);

  const managesRentals = doesPropertyManagement !== "Non — uniquement transaction/vente";
  const notInterested = interestLevel === "Non, pas pour mon agence";

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Merci de renseigner une adresse e-mail valide.");
      return;
    }
    if (!agencyName.trim()) {
      setError("Merci de renseigner le nom de votre agence.");
      return;
    }
    if (!doesPropertyManagement) {
      setError("Merci d'indiquer si vous faites de la gestion locative.");
      return;
    }
    if (!interestLevel) {
      setError("Merci d'indiquer si ce projet vous intéresse.");
      return;
    }
    if (!consentContact) {
      setError("Merci d'accepter d'être recontacté pour qu'on puisse vous répondre.");
      return;
    }
    if (!supabase) {
      setError("Formulaire indisponible pour le moment. Réessayez plus tard.");
      return;
    }

    setSubmitting(true);
    try {
      const utm = getUtmFromUrl();
      const payload = {
        meta: { tool: "agence_immo", version: "v1" },
        input: {
          agencyName: agencyName.trim(),
          agentsCount: agentsCount || null,
          doesPropertyManagement: doesPropertyManagement || null,
          mandatesCount: managesRentals ? mandatesCount || null : null,
          currentTool: managesRentals ? currentTool || null : null,
          painPoints: managesRentals ? painPoints.trim() || null : null,
          expectations: expectations.trim() || null,
          budget: notInterested ? null : budget || null,
          interestLevel: interestLevel || null,
          referralInterest: notInterested ? referralInterest || null : null,
        },
        tracking: {
          source: "agence_immo_landing",
          utm,
          referrer: typeof window !== "undefined" ? document.referrer || null : null,
          path: typeof window !== "undefined" ? window.location.pathname : null,
          createdAtClient: new Date().toISOString(),
        },
        consent: { consent_analysis: true, consent_contact: consentContact },
      };

      const { error: rpcError } = await supabase.rpc("upsert_lead_v1", {
        p_tool: "agence_immo",
        p_email: cleanEmail,
        p_payload: payload,
        p_postal_code: null,
        p_city: null,
        p_phone: phone.trim() || null,
        p_source: "agence_immo_landing",
        p_utm: utm,
        p_lead_age: null,
        p_project_property_kind: null,
        p_project_usage: null,
        p_project_timeline: null,
        p_project_budget_target: null,
      });

      if (rpcError) throw new Error(rpcError.message || "Erreur lors de l'envoi.");
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "Impossible d'envoyer le formulaire. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  const title = "lokt.fr pour les agences immobilières — gestion locative déléguée";
  const description =
    "Un espace agence en préparation : plusieurs agents, gestion pour le compte de vos mandants, reversement des loyers. Dites-nous ce dont vous avez besoin.";

  return (
    <div className="min-h-screen bg-[#f6f9fc] flex flex-col">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow" />
      </Head>
      <AppHeader />

      <main className="flex-1">
        <section className="px-4 py-12 sm:py-16">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[#635bff]">En préparation</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950 sm:text-4xl">
              lokt.fr pour les agences immobilières
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
              On étudie un espace dédié aux agences : plusieurs agents sur un même compte, gestion des mandats de
              location (états des lieux, baux, encaissement, quittances) pour le compte de vos propriétaires, avec
              reversement des loyers en option. Avant de le construire, 5 minutes pour comprendre votre organisation
              actuelle et ce qui vous manque vraiment.
            </p>
          </div>
        </section>

        <section className="px-4 pb-16">
          <div className="max-w-xl mx-auto rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className={`h-1.5 w-full ${brandBg}`} />
            <div className="p-6 sm:p-8">
              {done ? (
                <div className="text-center py-6">
                  <p className="text-lg font-semibold text-slate-900">Merci !</p>
                  <p className="mt-2 text-sm text-slate-600">
                    On revient vers vous rapidement pour en discuter. Si vous voulez ajouter un détail en attendant,
                    répondez simplement à l'e-mail de confirmation.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Nom de l'agence *</label>
                      <input
                        type="text"
                        value={agencyName}
                        onChange={(e) => setAgencyName(e.target.value)}
                        required
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#635bff] focus:outline-none focus:ring-1 focus:ring-[#635bff]/30"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">E-mail professionnel *</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#635bff] focus:outline-none focus:ring-1 focus:ring-[#635bff]/30"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Téléphone</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#635bff] focus:outline-none focus:ring-1 focus:ring-[#635bff]/30"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Nombre d'agents / collaborateurs</label>
                    <select
                      value={agentsCount}
                      onChange={(e) => setAgentsCount(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#635bff] focus:outline-none focus:ring-1 focus:ring-[#635bff]/30"
                    >
                      <option value="">—</option>
                      {AGENTS_COUNT_OPTIONS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Faites-vous de la gestion locative (au-delà de la recherche de locataire) ? *</label>
                    <div className="flex flex-col gap-1.5 pt-1">
                      {DOES_PM_OPTIONS.map((o) => (
                        <label key={o} className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="radio"
                            name="doesPropertyManagement"
                            value={o}
                            checked={doesPropertyManagement === o}
                            onChange={(e) => setDoesPropertyManagement(e.target.value)}
                            required
                            className="h-4 w-4 border-slate-300"
                          />
                          {o}
                        </label>
                      ))}
                    </div>
                  </div>

                  {managesRentals ? (
                    <>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700">Mandats de gestion gérés</label>
                        <select
                          value={mandatesCount}
                          onChange={(e) => setMandatesCount(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#635bff] focus:outline-none focus:ring-1 focus:ring-[#635bff]/30"
                        >
                          <option value="">—</option>
                          {MANDATES_COUNT_OPTIONS.map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700">
                          Quel outil utilisez-vous aujourd'hui pour la gestion locative ?
                        </label>
                        <select
                          value={currentTool}
                          onChange={(e) => setCurrentTool(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#635bff] focus:outline-none focus:ring-1 focus:ring-[#635bff]/30"
                        >
                          <option value="">—</option>
                          {CURRENT_TOOL_OPTIONS.map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700">
                          Qu'est-ce qui vous frustre le plus avec votre solution actuelle (compta mandant, reversement propriétaires, EDL, baux...) ?
                        </label>
                        <textarea
                          value={painPoints}
                          onChange={(e) => setPainPoints(e.target.value)}
                          rows={3}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#635bff] focus:outline-none focus:ring-1 focus:ring-[#635bff]/30"
                        />
                      </div>
                    </>
                  ) : null}

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Qu'attendriez-vous en priorité d'un outil dédié aux agences ?
                    </label>
                    <textarea
                      value={expectations}
                      onChange={(e) => setExpectations(e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#635bff] focus:outline-none focus:ring-1 focus:ring-[#635bff]/30"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Ce projet vous intéresse-t-il pour votre agence ? *</label>
                    <div className="flex flex-col gap-1.5 pt-1">
                      {INTEREST_OPTIONS.map((o) => (
                        <label key={o} className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="radio"
                            name="interestLevel"
                            value={o}
                            checked={interestLevel === o}
                            onChange={(e) => setInterestLevel(e.target.value)}
                            required
                            className="h-4 w-4 border-slate-300"
                          />
                          {o}
                        </label>
                      ))}
                    </div>
                  </div>

                  {notInterested ? (
                    <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <label className="text-xs font-semibold text-slate-700">
                        Pas de souci ! Seriez-vous intéressé(e) pour recommander lokt.fr à vos clients investisseurs, pour
                        qu'ils gèrent eux-mêmes leur location (quittances, états des lieux, suivi des loyers...) ?
                      </label>
                      <div className="flex flex-col gap-1.5 pt-1">
                        {REFERRAL_OPTIONS.map((o) => (
                          <label key={o} className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="radio"
                              name="referralInterest"
                              value={o}
                              checked={referralInterest === o}
                              onChange={(e) => setReferralInterest(e.target.value)}
                              className="h-4 w-4 border-slate-300"
                            />
                            {o}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Budget mensuel envisagé pour un outil dédié
                      </label>
                      <select
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#635bff] focus:outline-none focus:ring-1 focus:ring-[#635bff]/30"
                      >
                        <option value="">—</option>
                        {BUDGET_OPTIONS.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <label className="flex items-start gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={consentContact}
                      onChange={(e) => setConsentContact(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300"
                    />
                    <span>J'accepte d'être recontacté(e) par lokt.fr au sujet de ce projet.</span>
                  </label>

                  {error ? (
                    <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={submitting}
                    className={cx(
                      "w-full rounded-full px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60",
                      brandBg,
                      "hover:opacity-95"
                    )}
                  >
                    {submitting ? "Envoi..." : "Envoyer"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}
