import type { NextApiRequest, NextApiResponse } from "next";

export type WeatherAlert = {
  propertyId: string;
  propertyLabel: string;
  city: string;
  icon: string;
  type: string;
  message: string;
  tip: string;
  severity: "medium" | "high";
  day: "today" | "tomorrow" | "in2days";
};

type PropertyInput = {
  id: string;
  label: string | null;
  city: string | null;
  postal_code: string | null;
};

type DayForecast = {
  weather_code: number;
  temp_min: number;
  wind_speed: number;
  precipitation: number;
};

// Permanent cache: city key → coords (cities don't move)
const geocodeCache = new Map<string, { lat: number; lon: number } | null>();

// 2-hour cache: "lat,lon" → forecast
const forecastCache = new Map<string, { ts: number; days: DayForecast[] }>();
const FORECAST_TTL = 2 * 60 * 60 * 1000;

async function geocodeCity(
  city: string,
  postalCode?: string | null
): Promise<{ lat: number; lon: number } | null> {
  const key = `${(postalCode || "").trim()}|${city.trim()}`.toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;

  const q = [postalCode, city].filter(Boolean).join(" ");
  try {
    const res = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&type=municipality&limit=1`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) { geocodeCache.set(key, null); return null; }
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) { geocodeCache.set(key, null); return null; }
    const [lon, lat] = feature.geometry.coordinates as [number, number];
    const coords = { lat, lon };
    geocodeCache.set(key, coords);
    return coords;
  } catch {
    geocodeCache.set(key, null);
    return null;
  }
}

async function fetchForecast(lat: number, lon: number): Promise<DayForecast[]> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = forecastCache.get(key);
  if (cached && Date.now() - cached.ts < FORECAST_TTL) return cached.days;

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&daily=weather_code,temperature_2m_min,wind_speed_10m_max,precipitation_sum` +
      `&forecast_days=3&timezone=Europe%2FParis`;

    const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!res.ok) return [];
    const data = await res.json();

    const d = data.daily;
    const days: DayForecast[] = (d.time || []).map((_: string, i: number) => ({
      weather_code: d.weather_code?.[i] ?? 0,
      temp_min: d.temperature_2m_min?.[i] ?? 20,
      wind_speed: d.wind_speed_10m_max?.[i] ?? 0,
      precipitation: d.precipitation_sum?.[i] ?? 0,
    }));

    forecastCache.set(key, { ts: Date.now(), days });
    return days;
  } catch {
    return [];
  }
}

type DayLabel = "today" | "tomorrow" | "in2days";

function analyzeDay(
  day: DayForecast,
  label: DayLabel
): Omit<WeatherAlert, "propertyId" | "propertyLabel" | "city"> | null {
  const wc = day.weather_code;
  const ws = Math.round(day.wind_speed);
  const p = Math.round(day.precipitation);
  const t = Math.round(day.temp_min);

  // High severity
  if (wc >= 95)
    return { icon: "⚡", type: "orage", message: "Orage", tip: "Vérifiez volets et gouttières", severity: "high", day: label };
  if (ws >= 80)
    return { icon: "💨", type: "vent", message: `Vent violent ${ws} km/h`, tip: "Risque tuiles, ardoises, antennes", severity: "high", day: label };
  if (t <= -5)
    return { icon: "🧊", type: "gel", message: `Gel intense ${t}°C`, tip: "Risque gel des canalisations", severity: "high", day: label };
  if (p >= 50)
    return { icon: "🌊", type: "pluie", message: `Fortes pluies ${p} mm`, tip: "Risque infiltrations, cave", severity: "high", day: label };

  // Medium severity
  if (wc >= 71 && wc <= 77)
    return { icon: "❄️", type: "neige", message: "Neige prévue", tip: "Risque poids sur toiture", severity: "medium", day: label };
  if (ws >= 60)
    return { icon: "💨", type: "vent", message: `Vent fort ${ws} km/h`, tip: "Surveillez volets et toiture", severity: "medium", day: label };
  if (t <= 0)
    return { icon: "❄️", type: "gel", message: `Gel prévu ${t}°C`, tip: "Informez les locataires", severity: "medium", day: label };
  if (p >= 30)
    return { icon: "🌧️", type: "pluie", message: `Pluies ${p} mm`, tip: "Vérifiez gouttières et sous-sol", severity: "medium", day: label };

  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const properties: PropertyInput[] = Array.isArray(req.body?.properties)
    ? req.body.properties
    : [];

  const active = properties.filter((p) => p.city?.trim());
  if (!active.length) return res.status(200).json({ alerts: [] });

  // Deduplicate by city so one geocode+forecast call serves multiple properties
  const byCity = new Map<string, PropertyInput[]>();
  for (const p of active) {
    const key = p.city!.trim().toLowerCase();
    if (!byCity.has(key)) byCity.set(key, []);
    byCity.get(key)!.push(p);
  }

  const alerts: WeatherAlert[] = [];
  const DAY_LABELS: DayLabel[] = ["today", "tomorrow", "in2days"];

  await Promise.allSettled(
    Array.from(byCity.entries()).map(async ([, props]) => {
      const { city, postal_code } = props[0];
      const coords = await geocodeCity(city!, postal_code);
      if (!coords) return;

      const forecast = await fetchForecast(coords.lat, coords.lon);

      for (const prop of props) {
        // Pick the most severe/earliest alert across 3 days
        for (let i = 0; i < Math.min(3, forecast.length); i++) {
          const alert = analyzeDay(forecast[i], DAY_LABELS[i]);
          if (alert) {
            alerts.push({
              propertyId: prop.id,
              propertyLabel: prop.label || city!,
              city: city!,
              ...alert,
            });
            break;
          }
        }
      }
    })
  );

  // High severity first, then by day order
  alerts.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "high" ? -1 : 1;
    return DAY_LABELS.indexOf(a.day) - DAY_LABELS.indexOf(b.day);
  });

  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=600");
  return res.status(200).json({ alerts });
}
