// pages/pret-relais.tsx
import type { NextPage } from "next";
import { useEffect, useMemo, useState } from "react";
import AppHeader from "../components/AppHeader";
import { supabase } from "../lib/supabaseClient";

const PRET_RELAIS_STORAGE_KEY = "pret_relais_simulation_v1";

function formatEuro(val: number) {
  if (Number.isNaN(val)) return "-";
  return val.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function formatPct(val: number) {
  if (Number.isNaN(val)) return "-";
  return (
    val.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " %"
  );
}

function InfoBadge({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group ml-1 align-middle">
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[0.6rem] font-semibold text-slate-500 cursor-help">
        i
      </span>
      <span className="pointer-events-none absolute left-1/2 top-[125%] z-20 hidden w-72 -translate-x-1/2 rounded-md bg-slate-900 px-3 py-2 text-[0.7rem] text-white shadow-lg group-hover:block">
        {text}
      </span>
    </span>
  );
}

type ResumeRelais = {
  montantRelais: number;
  mensualiteNouveauMax: number;
  capitalNouveau: number;
  budgetMax: number;
};

const PretRelaisPage: NextPage = () => {
  // --------- Session (pour auto-remplir email / user_id) ----------
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        const s = data.session;
        if (!mounted) return;
        setSessionEmail(s?.user?.email ?? null);
        setSessionUserId(s?.user?.id ?? null);
      } catch {
        if (!mounted) return;
        setSessionEmail(null);
        setSessionUserId(null);
      }
    })();

    const sub =
      supabase?.auth.onAuthStateChange((_evt, session) => {
        setSessionEmail(session?.user?.email ?? null);
        setSessionUserId(session?.user?.id ?? null);
      }) ?? null;

    return () => {
      mounted = false;
      sub?.data?.subscription?.unsubscribe?.();
    };
  }, []);

  // Revenus & charges
  const [revMensuels, setRevMensuels] = useState(4500);
  const [autresMensualites, setAutresMensualites] = useState(0);
  const [tauxEndettement, setTauxEndettement] = useState(35);

  // Bien actuel
  const [valeurBienActuel, setValeurBienActuel] = useState(400000);
  const [crdActuel, setCrdActuel] = useState(200000);
  const [pctRetenu, setPctRetenu] = useState(70);

  // Prêt relais (indicatif)
  const [tauxRelais, setTauxRelais] = useState(4);

  // Nouveau projet
  const [apportPerso, setApportPerso] = useState(30000);
  const [tauxNouveau, setTauxNouveau] = useState(3.5);
  const [dureeNouveau, setDureeNouveau] = useState(25);
  const [prixCible, setPrixCible] = useState(450000);

  const [resume, setResume] = useState<ResumeRelais | null>(null);
  const [texteDetail, setTexteDetail] = useState<string>("");

  // Sauvegarde projet
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // --------- Gate lead (email + consentement) ----------
  const [unlocked, setUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockMsg, setUnlockMsg] = useState<string | null>(null);

  const [leadEmail, setLeadEmail] = useState<string>("");
  const [leadPhone, setLeadPhone] = useState<string>("");
  const [leadPostalCode, setLeadPostalCode] = useState<string>("");
  const [leadCity, setLeadCity] = useState<string>("");

  // Consentement lokt.fr (obligatoire pour stocker et débloquer)
  const [consentLokt, setConsentLokt] = useState<boolean>(false);

  // Pré-remplir email si session
  useEffect(() => {
    if (sessionEmail) setLeadEmail(sessionEmail);
    // ne pas auto-check la case
  }, [sessionEmail]);

  // --------- Calcul : source de vérité ----------
  const computeAll = () => {
    const revenus = revMensuels || 0;
    const autresMens = autresMensualites || 0;
    const endettementMax = (tauxEndettement || 35) / 100;

    const valeur = valeurBienActuel || 0;
    const crd = crdActuel || 0;
    const pct = (pctRetenu || 70) / 100;

    const apport = apportPerso || 0;
    const tNouveauAnnuel = (tauxNouveau || 0) / 100;
    const tNouveauMensuel = tNouveauAnnuel / 12;
    const nMois = (dureeNouveau || 0) * 12;

    if (revenus <= 0 || valeur <= 0 || nMois <= 0) {
      return {
        resume: null as ResumeRelais | null,
        texteDetail:
          "Merci de renseigner des valeurs cohérentes (revenus, bien actuel, durée du nouveau crédit, etc.).",
      };
    }

    // 1) Montant théorique du prêt relais
    const relaisBrut = valeur * pct;
    const montantRelais = Math.max(relaisBrut - crd, 0);

    // 2) Plafond d'endettement (long terme)
    const plafondEndettement = revenus * endettementMax;
    const mensualiteNouveauMax = plafondEndettement - autresMens;

    if (mensualiteNouveauMax <= 0) {
      const msg = [
        [
          "1. Revenus et endettement",
          `Vous avez indiqué un revenu net mensuel de ${formatEuro(
            revenus
          )} et des autres mensualités de crédits de ${formatEuro(autresMens)}.`,
          `Avec un taux d’endettement cible de ${tauxEndettement.toFixed(
            0
          )} %, la charge totale maximale supportable est d’environ ${formatEuro(
            plafondEndettement
          )} par mois.`,
        ].join("\n"),
        [
          "2. Capacité actuelle insuffisante pour un nouveau prêt",
          "En tenant compte de vos autres crédits, il ne reste aucune marge de mensualité disponible pour un nouveau prêt immobilier.",
          "Dans cette configuration, le projet d’achat devra être retravaillé (baisse du prix du bien, augmentation de la durée, hausse de l’apport, remboursement de certains crédits, etc.).",
        ].join("\n"),
        [
          "3. Pistes d’action possibles",
          "• Étudier le remboursement anticipé total ou partiel de certains crédits à la consommation.",
          "• Revoir le prix cible du nouveau bien à la baisse, au moins de façon temporaire.",
          "• Allonger la durée du futur prêt pour réduire la mensualité cible (dans la limite de l’âge et des pratiques bancaires).",
        ].join("\n"),
      ].join("\n\n");

      return { resume: null as ResumeRelais | null, texteDetail: msg };
    }

    // 3) Capital empruntable
    let capitalNouveau = 0;
    if (tNouveauMensuel === 0) {
      capitalNouveau = mensualiteNouveauMax * nMois;
    } else {
      const facteur = Math.pow(1 + tNouveauMensuel, nMois);
      capitalNouveau =
        mensualiteNouveauMax * ((facteur - 1) / (tNouveauMensuel * facteur));
    }

    // 4) Budget max
    const budgetMax = montantRelais + capitalNouveau + apport;

    const message = [
      [
        "1. Revenus et endettement",
        `Vous avez indiqué un revenu net mensuel de ${formatEuro(
          revenus
        )} et des autres mensualités de crédits de ${formatEuro(autresMens)}.`,
        `Avec un taux d’endettement cible de ${tauxEndettement.toFixed(
          0
        )} %, la charge totale maximale supportable est d’environ ${formatEuro(
          plafondEndettement
        )} par mois.`,
      ].join("\n"),
      [
        "2. Estimation du prêt relais",
        `Valeur estimée du bien actuel : ${formatEuro(valeur)}.`,
        `Capital restant dû : ${formatEuro(crd)}.`,
        `Part retenue par la banque : ${pctRetenu.toFixed(0)} %.`,
        `Montant théorique du prêt relais : ${formatEuro(montantRelais)}.`,
        `Au taux indicatif de ${formatPct(
          tauxRelais
        )}, cela donne un ordre d'idée du coût du relais (non intégré dans la capacité ci-dessous).`,
      ].join("\n"),
      [
        "3. Capacité pour le nouveau prêt immobilier",
        `Mensualité disponible estimée : ${formatEuro(mensualiteNouveauMax)}.`,
        `Sur ${dureeNouveau.toFixed(0)} ans à ${formatPct(
          tauxNouveau
        )}, capital empruntable ≈ ${formatEuro(capitalNouveau)}.`,
      ].join("\n"),
      [
        "4. Budget d’achat total estimé",
        `Apport (${formatEuro(apport)}) + relais (${formatEuro(
          montantRelais
        )}) + nouveau prêt (${formatEuro(
          capitalNouveau
        )}) ⇒ budget max ≈ ${formatEuro(budgetMax)}.`,
        prixCible > 0
          ? `Comparaison : votre bien cible est à ${formatEuro(prixCible)}.`
          : "Vous n’avez pas renseigné de prix cible.",
      ]
        .filter(Boolean)
        .join("\n"),
      [
        "5. À garder en tête",
        "Ce calcul reste indicatif : chaque banque applique ses propres règles (assurance, franchise d’intérêts, prise en compte du relais, etc.).",
      ].join("\n"),
    ].join("\n\n");

    return {
      resume: {
        montantRelais,
        mensualiteNouveauMax,
        capitalNouveau,
        budgetMax,
      } as ResumeRelais,
      texteDetail: message,
    };
  };

  // --------- Lead capture : UPSERT leads + INSERT lead_events ----------
  const captureLead = async (params: {
    email: string;
    phone: string;
    postal_code: string;
    city: string;
    from: "unlock_form" | "auto_session";
    consent_lokt: boolean;
    computed: { resume: ResumeRelais; texteDetail: string };
  }) => {
    if (!supabase) return;

    const email = params.email.trim().toLowerCase();
    if (!email) return;

    try {
      // 1) UPSERT lead (1 ligne stable par email+tool)
      const leadUpsert: any = {
        user_id: sessionUserId ?? null,
        tool: "pret-relais",

        consent_analysis: true,
        consent_contact: false,

        // Si tu n'as pas de colonne dédiée, on stocke aussi dans payload
        email,
        phone: params.phone?.trim() || null,
        postal_code: params.postal_code?.trim() || null,
        city: params.city?.trim() || null,

        payload: {
          last_event_at: new Date().toISOString(),
          last_resume: params.computed.resume,
          consent_lokt: params.consent_lokt,
        },

        status: "new",
      };

      const { data: leadRow, error: leadErr } = await supabase
        .from("leads")
        .upsert(leadUpsert, { onConflict: "email,tool" })
        .select("id")
        .single();

      if (leadErr) {
        console.warn("[leads] upsert error:", leadErr);
        return;
      }

      const leadId = leadRow?.id;
      if (!leadId) return;

      // 2) INSERT event (1 ligne par simulation)
      const eventPayload = {
        meta: { tool: "pret-relais", from: params.from, version: "v1_events" },
        input: {
          revMensuels,
          autresMensualites,
          tauxEndettement,
          valeurBienActuel,
          crdActuel,
          pctRetenu,
          tauxRelais,
          apportPerso,
          tauxNouveau,
          dureeNouveau,
          prixCible,
        },
        output: {
          resume: params.computed.resume,
          analyse: params.computed.texteDetail,
        },
        consent: { lokt: params.consent_lokt },
        createdAtClient: new Date().toISOString(),
      };

      const { error: evErr } = await supabase.from("lead_events").insert({
        lead_id: leadId,
        tool: "pret-relais",
        payload: eventPayload,
      });

      if (evErr) console.warn("[lead_events] insert error:", evErr);
    } catch (e) {
      console.warn("[leads/events] capture failed:", e);
    }
  };

  // --------- Actions ----------
  const handleCalculRelais = () => {
    setSaveMessage(null);
    setUnlockMsg(null);

    const computed = computeAll();

    setResume(computed.resume);
    setTexteDetail(computed.texteDetail);

    // recalcul => on rebloque (l'utilisateur a changé les paramètres)
    setUnlocked(false);

    // localStorage (inputs + outputs)
    if (typeof window !== "undefined") {
      const payload = {
        inputs: {
          revMensuels,
          autresMensualites,
          tauxEndettement,
          valeurBienActuel,
          crdActuel,
          pctRetenu,
          tauxRelais,
          apportPerso,
          tauxNouveau,
          dureeNouveau,
          prixCible,
        },
        outputs: computed,
        leadDraft: {
          leadEmail,
          leadPhone,
          leadPostalCode,
          leadCity,
          consentLokt,
        },
      };
      window.localStorage.setItem(PRET_RELAIS_STORAGE_KEY, JSON.stringify(payload));
    }
  };

  const handleUnlock = async () => {
    setUnlockMsg(null);

    if (!texteDetail) {
      setUnlockMsg("Lance d’abord le calcul pour générer l’analyse.");
      return;
    }

    const email = (leadEmail || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setUnlockMsg("Merci de renseigner un e-mail valide.");
      return;
    }

    const computed = computeAll();
    if (!computed.resume) {
      setUnlockMsg("Impossible de débloquer : corrige tes champs et relance le calcul.");
      return;
    }

    setUnlocking(true);
    try {
      await captureLead({
        email,
        phone: leadPhone,
        postal_code: leadPostalCode,
        city: leadCity,
        from: "unlock_form",
        consent_lokt: true,
        computed: { resume: computed.resume, texteDetail: computed.texteDetail },
      });

      setUnlocked(true);
      setUnlockMsg("✅ Analyse débloquée. (Votre simulation est enregistrée.)");
    } finally {
      setUnlocking(false);
    }
  };

  // Restauration localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(PRET_RELAIS_STORAGE_KEY);
    if (!raw) return;

    try {
      const saved = JSON.parse(raw);

      const inp = saved?.inputs ?? {};
      setRevMensuels(inp.revMensuels ?? 4500);
      setAutresMensualites(inp.autresMensualites ?? 0);
      setTauxEndettement(inp.tauxEndettement ?? 35);
      setValeurBienActuel(inp.valeurBienActuel ?? 400000);
      setCrdActuel(inp.crdActuel ?? 200000);
      setPctRetenu(inp.pctRetenu ?? 70);
      setTauxRelais(inp.tauxRelais ?? 4);
      setApportPerso(inp.apportPerso ?? 30000);
      setTauxNouveau(inp.tauxNouveau ?? 3.5);
      setDureeNouveau(inp.dureeNouveau ?? 25);
      setPrixCible(inp.prixCible ?? 450000);

      const ld = saved?.leadDraft ?? {};
      if (!sessionEmail) setLeadEmail(ld.leadEmail ?? "");
      setLeadPhone(ld.leadPhone ?? "");
      setLeadPostalCode(ld.leadPostalCode ?? "");
      setLeadCity(ld.leadCity ?? "");
      setConsentLokt(!!ld.consentLokt);

      // ne pas auto-afficher l'analyse au chargement
      setResume(null);
      setTexteDetail("");
      setUnlocked(false);
      setUnlockMsg(null);
    } catch (e) {
      console.error("Erreur de restauration prêt relais :", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderAnalysisBlocks = (text: string) => {
    if (!text) return null;

    const sections = text
      .split(/\n\s*\n/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    return (
      <div className="space-y-3">
        {sections.map((section: string, idx: number) => {
          const lines = section
            .split("\n")
            .map((l: string) => l.trim())
            .filter((l: string) => l.length > 0);

          if (!lines.length) return null;

          const title = lines[0];
          const body = lines.slice(1);

          return (
            <div
              key={idx}
              className="rounded-xl border border-slate-200 bg-white/80 px-3 py-3"
            >
              <p className="text-[0.75rem] font-semibold text-slate-900 mb-1">
                {title}
              </p>
              {body.map((line: string, i: number) => (
                <p key={i} className="text-[0.8rem] text-slate-700 leading-relaxed">
                  {line}
                </p>
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  const handlePrintPDF = () => {
    if (typeof window !== "undefined") window.print();
  };

  const handleSaveProject = async () => {
    if (!resume || !texteDetail) return;

    setSaving(true);
    setSaveMessage(null);

    try {
      if (!supabase) throw new Error("Supabase non disponible.");

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const session = sessionData?.session;
      if (!session) {
        if (typeof window !== "undefined") {
          window.location.href = "/mon-compte?mode=login&redirect=/pret-relais";
        }
        return;
      }

      const { error } = await supabase.from("projects").insert({
        user_id: session.user.id,
        type: "pret-relais",
        title: "Simulation prêt relais",
        data: {
          inputs: {
            revMensuels,
            autresMensualites,
            tauxEndettement,
            valeurBienActuel,
            crdActuel,
            pctRetenu,
            tauxRelais,
            apportPerso,
            tauxNouveau,
            dureeNouveau,
            prixCible,
          },
          resume,
          analyse: texteDetail,
        },
      });

      if (error) throw error;
      setSaveMessage("✅ Projet sauvegardé dans votre espace.");
    } catch (err: any) {
      setSaveMessage(
        "❌ Erreur lors de la sauvegarde du projet : " +
          (err?.message || "erreur inconnue")
      );
    } finally {
      setSaving(false);
    }
  };

  const hasResult = useMemo(() => !!resume && !!texteDetail, [resume, texteDetail]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <AppHeader />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Formulaire */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-md p-5">
            <p className="uppercase tracking-[0.18em] text-[0.7rem] text-amber-600 mb-1">
              Prêt relais
            </p>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              Quel bien puis-je acheter avec un prêt relais ?
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Renseignez votre situation pour obtenir un budget d&apos;achat maximal
              (prêt relais + nouveau crédit + apport).
            </p>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-700">
                  Revenus nets mensuels du foyer (€)
                </label>
                <input
                  type="number"
                  value={revMensuels}
                  onChange={(e) => setRevMensuels(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-700 flex items-center gap-1">
                  Autres mensualités de crédits (€ / mois)
                  <InfoBadge text="Hors crédit lié au bien actuel : crédit auto, conso, autres emprunts... Cela réduit la marge disponible pour le futur prêt." />
                </label>
                <input
                  type="number"
                  value={autresMensualites}
                  onChange={(e) => setAutresMensualites(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-700">
                  Taux d’endettement cible (%)
                </label>
                <input
                  type="number"
                  value={tauxEndettement}
                  onChange={(e) => setTauxEndettement(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
                <p className="text-xs font-semibold text-slate-700">Bien actuel à vendre</p>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700">
                    Valeur estimée du bien (€)
                  </label>
                  <input
                    type="number"
                    value={valeurBienActuel}
                    onChange={(e) => setValeurBienActuel(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700">
                    Capital restant dû sur ce bien (€)
                  </label>
                  <input
                    type="number"
                    value={crdActuel}
                    onChange={(e) => setCrdActuel(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700 flex items-center gap-1">
                    Pourcentage retenu par la banque (%)
                    <InfoBadge text="Les banques retiennent souvent 60–80 % de la valeur estimée, avant de déduire le capital restant dû, pour déterminer le montant du relais." />
                  </label>
                  <input
                    type="number"
                    value={pctRetenu}
                    onChange={(e) => setPctRetenu(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700">
                    Taux du prêt relais (annuel, en %) – indicatif
                  </label>
                  <input
                    type="number"
                    value={tauxRelais}
                    onChange={(e) => setTauxRelais(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
                <p className="text-xs font-semibold text-slate-700">
                  Nouveau projet immobilier
                </p>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700">
                    Apport personnel prévu (€)
                  </label>
                  <input
                    type="number"
                    value={apportPerso}
                    onChange={(e) => setApportPerso(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-700">
                      Taux du nouveau crédit (annuel, en %)
                    </label>
                    <input
                      type="number"
                      value={tauxNouveau}
                      onChange={(e) => setTauxNouveau(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-700">
                      Durée du nouveau crédit (années)
                    </label>
                    <input
                      type="number"
                      value={dureeNouveau}
                      onChange={(e) => setDureeNouveau(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700">
                    Prix du bien que vous visez (optionnel, pour comparer) (€)
                  </label>
                  <input
                    type="number"
                    value={prixCible}
                    onChange={(e) => setPrixCible(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <button
                onClick={handleCalculRelais}
                className="mt-2 w-full rounded-full bg-gradient-to-r from-amber-500 to-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-300/40 hover:shadow-2xl hover:shadow-amber-300/60 transition-transform active:scale-[0.99]"
              >
                Calculer mon budget d&apos;achat avec prêt relais
              </button>
            </div>
          </section>

          {/* Résultats */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-md p-5">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Résultat de la simulation
                </h2>
                <p className="text-xs text-slate-500">
                  Montant du relais, capacité de prêt et budget d&apos;achat maximal.
                </p>
              </div>

              {resume && (
                <div className="flex flex-col items-end gap-1">
                  <button
                    onClick={handleSaveProject}
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-full border border-emerald-500/80 bg-emerald-500 px-3 py-1.5 text-[0.7rem] font-semibold text-white shadow-sm hover:bg-emerald-400 disabled:opacity-60"
                  >
                    {saving ? "Sauvegarde..." : "Sauvegarder le projet"}
                  </button>
                  <button
                    onClick={handlePrintPDF}
                    className="inline-flex items-center justify-center rounded-full border border-amber-400/80 bg-amber-400 px-3 py-1.5 text-[0.7rem] font-semibold text-slate-900 shadow-sm hover:bg-amber-300 transition-colors"
                  >
                    PDF
                  </button>
                  {saveMessage && (
                    <p className="text-[0.65rem] text-slate-500 text-right max-w-[230px]">
                      {saveMessage}
                    </p>
                  )}
                </div>
              )}
            </div>

            {resume && (
              <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 flex flex-col gap-3">
                <div>
                  <p className="text-[0.7rem] uppercase tracking-[0.18em] text-amber-700 mb-1">
                    Synthèse prêt relais & budget
                  </p>
                  <p className="text-xs text-slate-600">
                    Estimation indicative de votre budget d&apos;achat avec relais.
                  </p>
                </div>
                <div className="flex flex-wrap gap-6">
                  <div>
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Montant du prêt relais
                    </p>
                    <p className="text-lg font-semibold text-slate-900">
                      {formatEuro(resume.montantRelais)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Mensualité max nouveau prêt
                    </p>
                    <p className="text-lg font-semibold text-slate-900">
                      {formatEuro(resume.mensualiteNouveauMax)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Capital nouveau prêt
                    </p>
                    <p className="text-lg font-semibold text-slate-900">
                      {formatEuro(resume.capitalNouveau)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.14em]">
                      Budget d&apos;achat max
                    </p>
                    <p className="text-lg font-semibold text-emerald-700">
                      {formatEuro(resume.budgetMax)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Analyse + Gate */}
            {texteDetail ? (
              <div className="relative rounded-xl bg-slate-50 border border-slate-200 p-4 mb-3">
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 mb-2">
                  Analyse détaillée
                </p>

                {!unlocked ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-900 text-white p-4 relative overflow-hidden">
                    <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-30 blur-3xl bg-cyan-500" />
                    <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full opacity-20 blur-3xl bg-emerald-400" />

                    <div className="relative space-y-3">
                      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-cyan-200">
                        DÉBLOQUER L’ANALYSE
                      </p>
                      <h3 className="text-base font-semibold">
                        Recevez votre analyse et enregistrez votre simulation.
                      </h3>
                      <p className="text-[0.8rem] text-slate-200">
                        On enregistre votre simulation pour vous permettre de la retrouver
                        (et pour améliorer lokt.fr via des statistiques anonymisées).
                      </p>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-xs text-slate-100 font-semibold">
                            Votre e-mail (obligatoire)
                          </label>
                          <input
                            type="email"
                            value={leadEmail}
                            onChange={(e) => setLeadEmail(e.target.value)}
                            placeholder="ex: prenom.nom@gmail.com"
                            className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-300"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-slate-100 font-semibold">
                            Code postal (optionnel)
                          </label>
                          <input
                            type="text"
                            value={leadPostalCode}
                            onChange={(e) => setLeadPostalCode(e.target.value)}
                            placeholder="75008"
                            className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-300"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-slate-100 font-semibold">
                            Ville (optionnel)
                          </label>
                          <input
                            type="text"
                            value={leadCity}
                            onChange={(e) => setLeadCity(e.target.value)}
                            placeholder="Paris"
                            className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-300"
                          />
                        </div>

                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-xs text-slate-100 font-semibold">
                            Téléphone (optionnel)
                          </label>
                          <input
                            type="tel"
                            value={leadPhone}
                            onChange={(e) => setLeadPhone(e.target.value)}
                            placeholder="06 12 34 56 78"
                            className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-300"
                          />
                        </div>

                        <p className="sm:col-span-2 text-[0.7rem] text-slate-300">
                          Vos coordonnées servent à envoyer votre analyse et à retrouver votre simulation.{" "}
                          <a href="/confidentialite" className="underline hover:text-white">En savoir plus sur vos données personnelles</a>.
                        </p>

                        <div className="sm:col-span-2 flex items-end">
                          <button
                            type="button"
                            onClick={handleUnlock}
                            disabled={unlocking}
                            className="w-full inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:opacity-95 disabled:opacity-60"
                          >
                            {unlocking ? "Déblocage..." : "Débloquer l’analyse"}
                          </button>
                        </div>
                      </div>

                      {unlockMsg && (
                        <p className="text-[0.75rem] text-slate-200">{unlockMsg}</p>
                      )}

                      <p className="text-[0.7rem] text-slate-300">
                        Astuce : si tu modifies les champs, relance le calcul (l’analyse se rebloque).
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>{renderAnalysisBlocks(texteDetail)}</div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Renseignez votre situation puis cliquez sur “Calculer mon budget d&apos;achat avec prêt relais”.
              </p>
            )}

            {hasResult && (
              <p className="mt-2 text-[0.7rem] text-slate-500">
                Cette simulation est indicative et ne remplace pas une étude détaillée
                de votre dossier par un courtier ou une banque.
              </p>
            )}
          </section>
        </div>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Rappel : comment fonctionne un prêt relais ?
          </h3>
          <p className="text-[0.8rem] text-slate-600">
            Le prêt relais est un financement transitoire qui vous permet d&apos;acheter un nouveau
            bien avant d&apos;avoir vendu l&apos;ancien.
          </p>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>
          © {new Date().getFullYear()} MT Courtage &amp; Investissement – Simulations indicatives.
        </p>
        <p className="mt-1">
          Contact :{" "}
          <a href="mailto:mtcourtage@gmail.com" className="underline">
            mtcourtage@gmail.com
          </a>
        </p>
      </footer>
    </div>
  );
};

export default PretRelaisPage;
