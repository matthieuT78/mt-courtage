// components/TrustpilotStars.tsx
// Rendu générique d'étoiles à remplissage fractionnaire (ex. 4.3/5) — un
// pattern UI standard, pas une reproduction du logo carré vert Trustpilot
// (marque déposée), volontairement évité.
const STAR_PATH = "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";

export default function TrustpilotStars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex" style={{ gap: 2 }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, rating - i)) * 100;
        return (
          <span key={i} className="relative inline-block shrink-0" style={{ width: size, height: size }}>
            <svg viewBox="0 0 24 24" width={size} height={size} className="absolute inset-0 text-slate-300" fill="currentColor" aria-hidden>
              <path d={STAR_PATH} />
            </svg>
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill}%` }}>
              <svg viewBox="0 0 24 24" width={size} height={size} className="text-[#00b67a]" fill="currentColor" aria-hidden>
                <path d={STAR_PATH} />
              </svg>
            </span>
          </span>
        );
      })}
    </span>
  );
}
