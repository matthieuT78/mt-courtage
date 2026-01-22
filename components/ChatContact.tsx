// components/ContactChat.tsx
import { useEffect, useMemo, useState } from "react";

type Cat = "bug" | "suggestion" | "partenariat" | "autre";
const CAT_LABEL: Record<Cat, string> = {
  bug: "Bug",
  suggestion: "Suggestion",
  partenariat: "Partenariat",
  autre: "Autre",
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
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Cat>("suggestion");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [hp, setHp] = useState(""); // honeypot
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);

  const page = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.pathname;
  }, []);

  // pré-remplissage “utile”
  useEffect(() => {
    if (!open) return;
    if (!message) {
      setMessage(
        category === "bug"
          ? `Bonjour,\n\nJ'ai rencontré un bug sur la page ${page} :\n- Étapes pour reproduire :\n- Résultat observé :\n- Résultat attendu :\n\nMerci !`
          : category === "suggestion"
          ? `Bonjour,\n\nSuggestion d'amélioration sur ${page} :\n\n`
          : category === "partenariat"
          ? `Bonjour,\n\nJe vous contacte pour un partenariat :\n- Société / profil :\n- Proposition :\n- Contact :\n\n`
          : `Bonjour,\n\nJe vous contacte au sujet de :\n\n`
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category]);

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
        }),
      });

      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.error || "send_failed");

      setStatus("✅ Message envoyé. Merci !");
      setCooldownUntil(Date.now() + 12_000); // 12s anti-spam simple
      // option : fermer après envoi
      // setOpen(false);
    } catch (e: any) {
      setStatus("❌ Impossible d’envoyer : " + (e?.message || "erreur"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[90]">
      {/* bouton flottant (premium) */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le chat de contact lokt.fr"
          className="
            relative group
            h-14 w-14 sm:h-16 sm:w-16
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
              h-7 w-7 rounded-2xl
              bg-white/85 backdrop-blur
              border border-white/60
              shadow-sm
              flex items-center justify-center
              overflow-hidden
            "
            aria-hidden
          >
            <img src="/apple-touch-icon.png" alt="" className="h-5 w-5 object-contain" />
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
        <div className="w-[92vw] max-w-sm overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Contact lokt.fr</p>
              <p className="text-[0.75rem] text-slate-500">Une réponse manuelle — pas de spam.</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-700 hover:shadow-sm"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>

          <div className="p-4 space-y-3">
            {/* quick buttons */}
            <div className="flex flex-wrap gap-2">
              {(["bug", "suggestion", "partenariat", "autre"] as Cat[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setCategory(c);
                    setStatus(null);
                    setMessage(""); // force le pré-remplissage
                  }}
                  className={
                    "rounded-full px-3 py-1 text-[0.75rem] font-semibold border transition " +
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
                Obligatoire — utilisé uniquement pour vous répondre.
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
                Catégorie : <span className="font-semibold">{CAT_LABEL[category]}</span> · Page :{" "}
                <span className="font-semibold">{page || "-"}</span>
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
