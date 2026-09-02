import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { useRouter } from "next/router";
import { useState } from "react";
import type { MajorCityMarker } from "../lib/cityPriceData";

const GEO_URL = "/geo/france-regions.geojson";

function formatPrice(n: number | null) {
  if (n == null) return "—";
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}

export default function FranceMap({ cities }: { cities: MajorCityMarker[] }) {
  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);

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
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#eef1fb"
                stroke="#c7ccf0"
                strokeWidth={0.7}
                style={{
                  default: { outline: "none" },
                  hover: { outline: "none", fill: "#e0e4fa" },
                  pressed: { outline: "none" },
                }}
              />
            ))
          }
        </Geographies>
        {cities.map((city) => (
          <Marker
            key={city.name}
            coordinates={[city.lon, city.lat]}
            onMouseEnter={() => setHovered(city.name)}
            onMouseLeave={() => setHovered(null)}
            onClick={city.slug ? () => router.push(`/prix-m2/${city.slug}`) : undefined}
            className={city.slug ? "cursor-pointer" : undefined}
          >
            {/* Zone de clic élargie et invisible : le point visuel (r=6) est trop petit pour être facilement cliquable */}
            <circle r={16} fill="transparent" />
            <circle r={6} fill={city.slug ? "#635bff" : "#94a3b8"} stroke="#fff" strokeWidth={2} />
            <text
              textAnchor="middle"
              y={-12}
              className="pointer-events-none select-none"
              style={{ fontSize: 12, fontWeight: 600, fill: "#0f172a" }}
            >
              {city.name}
            </text>
            {hovered === city.name && (
              <text
                textAnchor="middle"
                y={22}
                className="pointer-events-none select-none"
                style={{ fontSize: 11, fontWeight: 600, fill: "#635bff" }}
              >
                {formatPrice(city.priceM2)}/m²
              </text>
            )}
          </Marker>
        ))}
      </ComposableMap>
    </div>
  );
}
