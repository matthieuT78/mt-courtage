import { useRef, useState } from "react";

const TOOLTIP_WIDTH = 288; // doit matcher w-72 ci-dessous
const EDGE_MARGIN = 12;

// Bulle d'aide contextuelle (icône "i") utilisée par les 6 calculettes.
// Mesure la position de l'icône au survol/focus pour éviter que la bulle
// ne déborde de l'écran quand le champ est proche du bord gauche ou droit
// — avant ça, elle était toujours centrée sur l'icône sans tenir compte
// du viewport, ce qui tronquait le texte hors écran sur les champs en
// bord de colonne (ex: calculette plus-value immobilière).
export default function InfoBadge({ text }: { text: string }) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [align, setAlign] = useState<"center" | "left" | "right">("center");

  const measure = () => {
    const el = triggerRef.current;
    if (!el || typeof window === "undefined") return;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const half = TOOLTIP_WIDTH / 2;
    if (centerX - half < EDGE_MARGIN) setAlign("left");
    else if (centerX + half > window.innerWidth - EDGE_MARGIN) setAlign("right");
    else setAlign("center");
  };

  const positionClass =
    align === "left" ? "left-0" : align === "right" ? "right-0" : "left-1/2 -translate-x-1/2";

  return (
    <span
      ref={triggerRef}
      onMouseEnter={measure}
      onFocus={measure}
      className="relative inline-flex items-center group ml-1 align-middle"
    >
      <span
        tabIndex={0}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[0.6rem] font-semibold text-slate-500 cursor-help"
      >
        i
      </span>
      <span
        className={`pointer-events-none absolute top-[125%] z-20 hidden w-72 max-w-[calc(100vw-1.5rem)] rounded-md bg-slate-900 px-3 py-2 text-[0.7rem] text-white shadow-lg group-hover:block group-focus-within:block ${positionClass}`}
      >
        {text}
      </span>
    </span>
  );
}
