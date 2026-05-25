// components/ContactChat.tsx
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { usePermissions } from "./PermissionProvider";

type Cat = "problem" | "unclear" | "idea" | "pro";
const CAT_LABEL: Record<Cat, string> = {
  problem: "J’ai un problème",
  unclear: "Je ne comprends pas",
  idea: "Idée d’amélioration",
  pro: "Contact pro",
};

function safeEmail(s: string) {
  return String(s || "").trim().toLowerCase();
}
function isValidEmail(s: string) {
  const e = safeEmail(s);
  // validation simple (suffisante côté UI). Le serveur doit aussi valider.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export default function ContactChat() {
  const router = useRouter();
  const permissions = usePermissions();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Cat>("problem");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [message, setMessage] = useState("");
  const [hp, setHp] = useState(""); // honeypot
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
    if (cat === "problem") {
      return `Bonjour,\n\nJ’ai un problème sur ${page || "lokt.fr"} (${supportTopic}) :\n\nCe que je fais :\n\nCe qui se passe :\n\nCe que j’attendais :\n\nMerci.`;
    }
    if (cat === "unclear") {
      return `Bonjour,\n\nJe ne comprends pas cette partie sur ${page || "lokt.fr"} (${supportTopic}) :\n\nMa question :\n\nMerci.`;
    }
    if (cat === "idea") {
      return `Bonjour,\n\nJ’ai une idée d’amélioration pour ${page || "lokt.fr"} :\n\nMon idée :\n\nPourquoi ce serait utile :\n\nMerci.`;
    }
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
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // pré-remplissage “utile”
  useEffect(() => {
    if (!open) return;
    if (!message) {
      setMessage(buildTemplate(category));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category, page]);

  const emailOk = isValidEmail(email);
  const canSend =
    message.trim().length >= 8 &&
    emailOk &&
    !sending &&
    Date.now() >= cooldownUntil;

  const send = async () => {
    setStatus(null);

    if (Date.now() < cooldownUntil) {
      setStatus("⏳ Merci d’attendre un instant avant de renvoyer.");
      return;
    }

    const e = safeEmail(email);
    if (!isValidEmail(e)) {
      setStatus("Merci d’indiquer un email valide pour qu’on puisse vous répondre.");
      return;
    }

    if (message.trim().length < 8) {
      setStatus("Merci de détailler un peu (au moins 8 caractères).");
      return;
    }

    setSending(true);
    try {
      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          email: e,
          message,
          page,
          hp,
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
      setCooldownUntil(Date.now() + 12_000); // 12s anti-spam simple
      // option : fermer après envoi
      // setOpen(false);
    } catch (e: any) {
      setStatus("Impossible d’envoyer : " + (e?.message || "erreur"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-3 right-3 z-[90] sm:bottom-4 sm:right-4">
      {/* bouton flottant (premium) */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le chat de contact lokt.fr"
          className="
            relative group
            h-12 w-12 sm:h-16 sm:w-16
            rounded-full
            bg-gradient-to-br from-cyan-500 to-emerald-500
            shadow-lg shadow-emerald-500/20
            ring-1 ring-white/40
            hover:shadow-xl hover:shadow-emerald-500/25
            active:scale-[0.98]
            transition
            flex items-center justify-center
          "
        >
          {/* halo doux */}
          <span
            aria-hidden
            className="
              absolute -inset-2 rounded-full
              bg-emerald-400/20 blur-xl
              opacity-0 group-hover:opacity-100 transition
            "
          />

          {/* icône question */}
          <svg
            viewBox="0 0 24 24"
            className="relative h-7 w-7 text-white drop-shadow"
            aria-hidden
          >
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4"
            />
            <path
              fill="currentColor"
              d="M12 18.2a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Z"
            />
          </svg>

          {/* mini-logo en badge */}
          <span
            className="
              absolute -top-1 -right-1
              flex h-6 w-6 items-center justify-center overflow-hidden rounded-2xl
              border border-white/70 bg-white/90 shadow-sm backdrop-blur sm:h-7 sm:w-7
            "
            aria-hidden
          >
            <img src="/apple-touch-icon.png" alt="" className="h-4 w-4 object-contain sm:h-5 sm:w-5" />
          </span>

          {/* label desktop */}
          <span
            className="
              hidden sm:block
              absolute right-[calc(100%+12px)] top-1/2 -translate-y-1/2
              whitespace-nowrap
              rounded-full border border-slate-200 bg-white/90 backdrop-blur
              px-3 py-1.5 text-xs font-semibold text-slate-900
              shadow-sm
              opacity-0 translate-x-2
              group-hover:opacity-100 group-hover:translate-x-0
              transition
            "
          >
            Une question ?
          </span>
        </button>
      ) : null}

      {/* fenêtre */}
      {open ? (
        <div className="max-h-[calc(100vh-2rem)] w-[calc(100vw-1.5rem)] max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Aide lokt.fr</p>
              <p className="text-[0.75rem] text-slate-500">Une réponse manuelle, avec la page concernée.</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-700 hover:shadow-sm"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>

          <div className="max-h-[calc(100vh-7rem)] space-y-3 overflow-y-auto p-4">
            {/* quick buttons */}
            <div className="grid grid-cols-2 gap-2">
              {(["problem", "unclear", "idea", "pro"] as Cat[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setCategory(c);
                    setStatus(null);
                    setMessage(""); // force le pré-remplissage
                  }}
                  className={
                    "rounded-2xl border px-3 py-2 text-left text-[0.75rem] font-semibold transition " +
                    (category === c
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50")
                  }
                >
                  {CAT_LABEL[c]}
                </button>
              ))}
            </div>

            {/* email (OBLIGATOIRE) */}
            <div className="space-y-1">
              <label className="text-[0.75rem] text-slate-600 font-semibold">Votre email</label>
              <input
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setStatus(null);
                }}
                placeholder="vous@exemple.com"
                className={
                  "w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 " +
                  (email.length === 0
                    ? "border-slate-200 focus:ring-emerald-500"
                    : emailOk
                    ? "border-emerald-300 focus:ring-emerald-500"
                    : "border-red-300 focus:ring-red-500")
                }
                inputMode="email"
                autoComplete="email"
                aria-invalid={email.length > 0 && !emailOk}
              />
              <p className="text-[0.7rem] text-slate-500">
                {permissions.isLoggedIn ? "Prérempli depuis votre compte — utilisé uniquement pour vous répondre." : "Obligatoire — utilisé uniquement pour vous répondre."}
              </p>
            </div>

            {/* message */}
            <div className="space-y-1">
              <label className="text-[0.75rem] text-slate-600 font-semibold">Message</label>
              <textarea
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setStatus(null);
                }}
                rows={6}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <p className="text-[0.7rem] text-slate-500">
                Sujet : <span className="font-semibold">{supportTopic}</span> · Page ajoutée automatiquement.
              </p>
            </div>

            {/* honeypot hidden */}
            <input
              value={hp}
              onChange={(e) => setHp(e.target.value)}
              className="hidden"
              tabIndex={-1}
              autoComplete="off"
            />

            {status ? <p className="text-[0.8rem] text-slate-700">{status}</p> : null}

            <div className="flex items-center justify-between">
              <button
                onClick={() => setOpen(false)}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                Fermer
              </button>

              <button
                onClick={send}
                disabled={!canSend}
                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-95"
              >
                {sending ? "Envoi..." : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
