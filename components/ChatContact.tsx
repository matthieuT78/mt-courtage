// components/ChatContact.tsx
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { supabase } from "../lib/supabaseClient";
import { usePermissions } from "./PermissionProvider";

type Cat = "problem" | "unclear" | "idea" | "pro";
const CAT_LABEL: Record<Cat, string> = {
  problem: "J'ai un problème",
  unclear: "Je ne comprends pas",
  idea: "Idée d'amélioration",
  pro: "Contact pro",
};

function safeEmail(s: string) {
  return String(s || "").trim().toLowerCase();
}
function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail(s));
}

export default function ContactChat({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const permissions = usePermissions();
  const [category, setCategory] = useState<Cat>("problem");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [message, setMessage] = useState("");
  const [hp, setHp] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);

  const page = useMemo(() => {
    if (typeof window === "undefined") return "";
    return router.asPath || window.location.pathname;
  }, [router.asPath]);

  const supportTopic = useMemo(() => {
    const p = page.toLowerCase();
    if (p.includes("quittance")) return "quittances ou envoi de PDF";
    if (p.includes("baux")) return "bail, renouvellement ou alerte";
    if (p.includes("finance")) return "finance, loyers ou charges";
    if (p.includes("declaration")) return "aide à la déclaration";
    if (p.includes("etat")) return "état des lieux";
    if (p.includes("mon-compte") || p.includes("abonnement")) return "compte, abonnement ou facture";
    if (p.includes("capacite") || p.includes("investissement") || p.includes("pret-relais") || p.includes("plus-value") || p.includes("parc-immobilier")) return "simulation immobilière";
    return "utilisation de lokt.fr";
  }, [page]);

  const buildTemplate = (cat: Cat) => {
    if (cat === "problem") return `Bonjour,\n\nJ'ai un problème sur ${page || "lokt.fr"} (${supportTopic}) :\n\nCe que je fais :\n\nCe qui se passe :\n\nCe que j'attendais :\n\nMerci.`;
    if (cat === "unclear") return `Bonjour,\n\nJe ne comprends pas cette partie sur ${page || "lokt.fr"} (${supportTopic}) :\n\nMa question :\n\nMerci.`;
    if (cat === "idea") return `Bonjour,\n\nJ'ai une idée d'amélioration pour ${page || "lokt.fr"} :\n\nMon idée :\n\nPourquoi ce serait utile :\n\nMerci.`;
    return `Bonjour,\n\nJe vous contacte pour un sujet professionnel :\n\nSociété / profil :\n\nBesoin :\n\nTéléphone si utile :\n\nMerci.`;
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!mounted || !user) return;
      setUserId(user.id || "");
      if (!email && user.email) setEmail(user.email);
    })().catch(() => {});
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    setMessage(buildTemplate(category));
    setStatus(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category, page]);

  const emailOk = isValidEmail(email);
  const canSend = message.trim().length >= 8 && emailOk && !sending && Date.now() >= cooldownUntil;

  const send = async () => {
    setStatus(null);
    if (Date.now() < cooldownUntil) { setStatus("⏳ Merci d'attendre un instant avant de renvoyer."); return; }
    const e = safeEmail(email);
    if (!isValidEmail(e)) { setStatus("Merci d'indiquer un email valide pour qu'on puisse vous répondre."); return; }
    if (message.trim().length < 8) { setStatus("Merci de détailler un peu (au moins 8 caractères)."); return; }

    setSending(true);
    try {
      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category, email: e, message, page, hp,
          context: {
            url: typeof window !== "undefined" ? window.location.href : "",
            userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "",
            viewport: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "",
            plan: permissions.plan,
            isLoggedIn: permissions.isLoggedIn,
            userId,
          },
        }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.error || "send_failed");
      setStatus("Message reçu. La page et le contexte utile ont été ajoutés pour comprendre plus vite.");
      setCooldownUntil(Date.now() + 12_000);
    } catch (err: any) {
      setStatus("Impossible d'envoyer : " + (err?.message || "erreur"));
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-slate-950/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Aide & contact</p>
            <p className="text-[0.75rem] text-slate-500">Une réponse manuelle, avec la page concernée.</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            aria-label="Fermer"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(100svh-8rem)] space-y-3 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-2">
            {(["problem", "unclear", "idea", "pro"] as Cat[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { setCategory(c); setStatus(null); setMessage(""); }}
                className={
                  "rounded-2xl border px-3 py-2 text-left text-[0.75rem] font-semibold transition " +
                  (category === c ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50")
                }
              >
                {CAT_LABEL[c]}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <label className="text-[0.75rem] font-semibold text-slate-600">Votre email</label>
            <input
              value={email}
              onChange={(e) => { setEmail(e.target.value); setStatus(null); }}
              placeholder="vous@exemple.com"
              className={
                "w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 " +
                (email.length === 0 ? "border-slate-200 focus:ring-emerald-500" : emailOk ? "border-emerald-300 focus:ring-emerald-500" : "border-red-300 focus:ring-red-500")
              }
              inputMode="email"
              autoComplete="email"
            />
            <p className="text-[0.7rem] text-slate-500">
              {permissions.isLoggedIn ? "Prérempli depuis votre compte — utilisé uniquement pour vous répondre." : "Obligatoire — utilisé uniquement pour vous répondre."}
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-[0.75rem] font-semibold text-slate-600">Message</label>
            <textarea
              value={message}
              onChange={(e) => { setMessage(e.target.value); setStatus(null); }}
              rows={6}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <p className="text-[0.7rem] text-slate-500">
              Sujet : <span className="font-semibold">{supportTopic}</span> · Page ajoutée automatiquement.
            </p>
          </div>

          <input value={hp} onChange={(e) => setHp(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" />

          {status && <p className="text-[0.8rem] text-slate-700">{status}</p>}

          <div className="flex items-center justify-between">
            <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-900">
              Annuler
            </button>
            <button
              onClick={send}
              disabled={!canSend}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 hover:opacity-95"
            >
              {sending ? "Envoi..." : "Envoyer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
