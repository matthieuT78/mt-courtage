import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import type { DepartmentChoroplethEntry } from "../lib/cityPriceData";

const GEO_URL = "/geo/france-departements.geojson";

// Dégradé à 6 paliers (quantiles plutôt que linéaire : la distribution des
// prix par département est très asymétrique — Paris/PACA écraseraient le
// reste de l'échelle avec un dégradé linéaire).
const COLOR_SCALE = ["#eef1fb", "#d7ddf7", "#b9c3f0", "#9aa8e8", "#7b8ee0", "#635bff"];

function formatPrice(n: number | null) {
  if (n == null) return "—";
  return `${Math.round(n).toLocaleString("fr-FR")} €/m²`;
}

export default function DepartmentChoropleth({ departments }: { departments: DepartmentChoroplethEntry[] }) {
  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);

  const byCode = useMemo(() => new Map(departments.map((d) => [d.code, d])), [departments]);

  const thresholds = useMemo(() => {
    const prices = departments.map((d) => d.priceM2).filter((p): p is number => p != null).sort((a, b) => a - b);
    if (prices.length === 0) return [];
    const q = (p: number) => prices[Math.min(prices.length - 1, Math.floor(p * prices.length))];
    return [q(1 / 6), q(2 / 6), q(3 / 6), q(4 / 6), q(5 / 6)];
  }, [departments]);

  function colorFor(price: number | null): string {
    if (price == null || thresholds.length === 0) return "#f1f5f9";
    const idx = thresholds.findIndex((t) => price <= t);
    return COLOR_SCALE[idx === -1 ? COLOR_SCALE.length - 1 : idx];
  }

  const hoveredDept = hovered ? byCode.get(hovered) : null;

  return (
    <div className="relative w-full">
      <ComposableMap
        projection="geoConicConformal"
        projectionConfig={{ center: [2.6, 46.6], scale: 3200 }}
        width={800}
        height={620}
        style={{ width: "100%", height: "auto" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const dept = byCode.get(geo.properties.code);
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={colorFor(dept?.priceM2 ?? null)}
                  stroke="#fff"
                  strokeWidth={0.6}
                  onMouseEnter={() => setHovered(geo.properties.code)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => dept && router.push(`/prix-m2/departement/${dept.slug}`)}
                  className={dept ? "cursor-pointer" : undefined}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none", stroke: "#635bff", strokeWidth: 1.5 },
                    pressed: { outline: "none" },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>
      {hoveredDept && (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
          {hoveredDept.name} — {formatPrice(hoveredDept.priceM2)}
        </div>
      )}
      <div className="mt-3 flex items-center justify-center gap-1.5 text-[0.65rem] text-slate-400">
        <span>Moins cher</span>
        {COLOR_SCALE.map((c, i) => (
          <span key={i} className="h-3 w-6 rounded-sm" style={{ backgroundColor: c }} />
        ))}
        <span>Plus cher</span>
      </div>
    </div>
  );
}
