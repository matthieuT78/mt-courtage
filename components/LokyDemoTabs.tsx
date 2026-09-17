// components/LokyDemoTabs.tsx
// Démo Loky interactive à onglets — extrait de pages/index.tsx (section
// "Loky sous les projecteurs") pour être réutilisable sur les pages produit
// (outil-gestion-locative, gestion-locative-lmnp) sans dupliquer ~150 lignes
// de state/JSX/CSS ni toucher à index.tsx (page à fort trafic, déjà stable).
import { useEffect, useRef, useState, type ComponentType, type ReactNode, type SVGProps } from "react";

export type LokyDemo = {
  id: string;
  tab: string;
  title: ReactNode;
  description: string;
  speedNote: string;
  capabilities: { icon: ComponentType<SVGProps<SVGSVGElement>>; text: string }[];
  userMessage: string;
  lokyIntro: string;
  dataLines: string[];
  lokyFollowup?: string;
  userConfirm: string;
  resultBadge: string;
};

export default function LokyDemoTabs({ demos, bottomChips }: { demos: LokyDemo[]; bottomChips?: string[] }) {
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState<"left" | "right">("right");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [indicator, setIndicator] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  function select(i: number) {
    setDirection(i > active ? "right" : "left");
    setActive(i);
  }

  useEffect(() => {
    function measure() {
      const el = tabRefs.current[active];
      if (el) setIndicator({ left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active]);

  const demo = demos[active];

  return (
    <div>
      <style jsx global>{`
        @keyframes lokyTabsSlideFromRight {
          0% { opacity: 0; transform: translate3d(28px, 0, 0); }
          100% { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        @keyframes lokyTabsSlideFromLeft {
          0% { opacity: 0; transform: translate3d(-28px, 0, 0); }
          100% { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        .loky-tabs-slide-right {
          animation: lokyTabsSlideFromRight 420ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
        .loky-tabs-slide-left {
          animation: lokyTabsSlideFromLeft 420ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .loky-tabs-slide-right,
          .loky-tabs-slide-left {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
        <div className="relative flex flex-wrap items-center justify-center gap-1 border-b border-slate-100 bg-slate-50 p-3">
          {indicator && (
            <span
              aria-hidden
              className="absolute rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 shadow-lg shadow-indigo-500/30 transition-all duration-300 ease-out"
              style={{ left: indicator.left, top: indicator.top, width: indicator.width, height: indicator.height }}
            />
          )}
          {demos.map((d, i) => (
            <button
              key={d.id}
              ref={(el) => { tabRefs.current[i] = el; }}
              type="button"
              onClick={() => select(i)}
              className={
                "relative z-10 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-300 sm:text-sm " +
                (active === i ? "scale-110 text-white" : "scale-100 text-slate-500 hover:text-slate-900")
              }
            >
              {d.tab}
            </button>
          ))}
        </div>

        <div
          key={demo.id}
          className={
            "grid gap-6 p-6 sm:p-9 lg:grid-cols-[0.95fr,1.05fr] lg:items-center " +
            (direction === "right" ? "loky-tabs-slide-right" : "loky-tabs-slide-left")
          }
        >
          <div className="text-left">
            <h3 className="text-xl font-semibold text-slate-950 sm:text-2xl">{demo.title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">{demo.description}</p>
            <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
              <span className="mt-0.5 text-[#635bff]">⚡</span>
              <p className="text-xs leading-5 text-indigo-900">{demo.speedNote}</p>
            </div>

            <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {demo.capabilities.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[#635bff]">
                    <Icon className="h-4 w-4" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <div className="overflow-hidden rounded-2xl bg-[#211a45] shadow-xl shadow-black/30">
            <div className="flex items-center gap-2 border-b border-white/10 bg-black/20 px-4 py-3">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
              </div>
              <div className="ml-1.5 flex items-center gap-1.5 text-xs font-medium text-white/50">
                <img src="/loky-avatar.png" alt="" className="h-4 w-4 rounded object-cover" />
                Loky · Assistant IA lokt.fr
              </div>
            </div>

            <div className="space-y-4 p-5 sm:p-6">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm">
                  {demo.userMessage}
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <img src="/loky-avatar.png" alt="Loky" className="mt-0.5 h-9 w-9 shrink-0 rounded-xl object-cover shadow-sm" />
                <div className="max-w-[85%] space-y-2.5 rounded-2xl rounded-tl-md bg-gradient-to-br from-indigo-600 to-cyan-500 px-4 py-3.5 text-sm text-white shadow-sm">
                  <p>{demo.lokyIntro}</p>
                  <div className="space-y-1.5 rounded-xl bg-white/15 p-3 text-xs">
                    {demo.dataLines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                  {demo.lokyFollowup && <p className="text-white/80">{demo.lokyFollowup}</p>}
                </div>
              </div>

              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm">
                  {demo.userConfirm}
                </div>
              </div>

              <div className="flex items-center gap-2 pl-[46px]">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
                  {demo.resultBadge}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {bottomChips && bottomChips.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
          {bottomChips.map((label) => (
            <span key={label} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600">
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
