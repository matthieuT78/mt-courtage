import { useEffect, useRef, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { supabase } from "../lib/supabaseClient";

const STORAGE_KEY = "lokt:review";
const DELAY_MS = 45_000;
const MIN_ACCOUNT_AGE_DAYS = 7;
const SNOOZE_DAYS = 60;
const MAX_SNOOZES = 2;

type State = "hidden" | "visible" | "submitted" | "snoozed";

function StarIcon({ filled, hovered }: { filled: boolean; hovered: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={
        "h-8 w-8 transition-colors " +
        (filled || hovered ? "text-amber-400" : "text-slate-200")
      }
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function readStorage(): { status: "submitted" | "snoozed" | null; snoozeCount: number; snoozeUntil: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { status: null, snoozeCount: 0, snoozeUntil: 0 };
    return JSON.parse(raw);
  } catch {
    return { status: null, snoozeCount: 0, snoozeUntil: 0 };
  }
}

function writeStorage(patch: object) {
  try {
    const current = readStorage();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {}
}

export function ReviewPrompt({ user }: { user: any }) {
  const [state, setState] = useState<State>("hidden");
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user?.id || !user?.created_at) return;

    // Vérifie l'âge du compte
    const accountAge = (Date.now() - new Date(user.created_at).getTime()) / 86_400_000;
    if (accountAge < MIN_ACCOUNT_AGE_DAYS) return;

    // Vérifie localStorage
    const stored = readStorage();
    if (stored.status === "submitted") return;
    if (stored.status === "snoozed") {
      if (Date.now() < stored.snoozeUntil) return;
      if (stored.snoozeCount >= MAX_SNOOZES) return;
    }

    // Affichage différé
    timerRef.current = setTimeout(() => {
      setState("visible");
      setTimeout(() => setVisible(true), 50);
    }, DELAY_MS);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [user?.id, user?.created_at]);

  const handleSnooze = () => {
    const stored = readStorage();
    const snoozeCount = (stored.snoozeCount || 0) + 1;
    writeStorage({
      status: "snoozed",
      snoozeCount,
      snoozeUntil: Date.now() + SNOOZE_DAYS * 86_400_000,
    });
    setVisible(false);
    setTimeout(() => setState("hidden"), 400);
  };

  const handleSubmit = async () => {
    if (!rating || submitting) return;
    setSubmitting(true);
    try {
      if (!supabase) throw new Error();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      await fetch("/api/reviews/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ rating, comment }),
      });
      writeStorage({ status: "submitted" });
      setState("submitted");
    } catch {
      // silencieux — on ferme quand même
      writeStorage({ status: "submitted" });
      setState("submitted");
    } finally {
      setSubmitting(false);
    }
  };

  if (state === "hidden") return null;

  return (
    <div
      className={
        "fixed bottom-6 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm transition-all duration-300 sm:right-6 " +
        (visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")
      }
    >
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
        {/* Barre colorée */}
        <div className="h-1 bg-gradient-to-r from-[#635bff] via-[#00d4ff] to-[#00e5a8]" />

        {state === "submitted" ? (
          <div className="px-6 py-6 text-center">
            <p className="text-2xl">🙏</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">Merci pour votre retour !</p>
            <p className="mt-1 text-xs text-slate-500">Votre avis nous aide à améliorer lokt.fr.</p>
          </div>
        ) : (
          <div className="px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Vous appréciez lokt.fr ?</p>
                <p className="mt-0.5 text-xs text-slate-500">30 secondes pour nous dire ce que vous en pensez.</p>
              </div>
              <button
                type="button"
                onClick={handleSnooze}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                aria-label="Plus tard"
              >
                <XMarkIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Étoiles */}
            <div className="mt-4 flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHovered(n)}
                  onMouseLeave={() => setHovered(0)}
                  className="transition-transform hover:scale-110 active:scale-95"
                  aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
                >
                  <StarIcon filled={n <= rating} hovered={n <= hovered} />
                </button>
              ))}
            </div>

            {rating > 0 && (
              <div className="mt-4 space-y-3">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Un commentaire ? (optionnel)"
                  rows={2}
                  maxLength={500}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-colors"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 rounded-full bg-slate-900 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-colors"
                  >
                    {submitting ? "Envoi…" : "Envoyer"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSnooze}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Plus tard
                  </button>
                </div>
              </div>
            )}

            {rating === 0 && (
              <button
                type="button"
                onClick={handleSnooze}
                className="mt-3 w-full rounded-full border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Plus tard
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
