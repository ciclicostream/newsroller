import { env } from "../config/env.js";
import { fetchJson, type DataSource } from "./types.js";

interface DiaPronostico {
  date: string;      // YYYY-MM-DD
  code: number | null;
  max: number | null;
  min: number | null;
  desc: string;
}

interface ClimaCiudad {
  city: string;
  province: string;
  lat: number;
  lon: number;
  tempC: number | null;
  code: number | null;
  desc: string;
  days: DiaPronostico[];   // hoy + próximos 2 días
}

interface ClimaPayload {
  // Compat con el elemento "weather" legacy (primera ciudad = CABA).
  city: string;
  tempC: number | null;
  code: number | null;
  desc: string;
  // Nuevo: todas las capitales + pronóstico.
  cities: ClimaCiudad[];
  updatedAt: string;
}

interface OpenMeteoResp {
  current?: { temperature_2m?: number; weather_code?: number };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
  };
}

// Capitales de las provincias argentinas + CABA (CABA primera = compat weather legacy).
const CAPITALES: { city: string; province: string; lat: number; lon: number }[] = [
  { city: "Buenos Aires", province: "CABA", lat: -34.6037, lon: -58.3816 },
  { city: "La Plata", province: "Buenos Aires", lat: -34.9215, lon: -57.9545 },
  { city: "Córdoba", province: "Córdoba", lat: -31.4201, lon: -64.1888 },
  { city: "Corrientes", province: "Corrientes", lat: -27.4692, lon: -58.8306 },
  { city: "Formosa", province: "Formosa", lat: -26.1858, lon: -58.1756 },
  { city: "La Rioja", province: "La Rioja", lat: -29.4111, lon: -66.8507 },
  { city: "Mendoza", province: "Mendoza", lat: -32.8895, lon: -68.8458 },
  { city: "Neuquén", province: "Neuquén", lat: -38.9516, lon: -68.0591 },
  { city: "Paraná", province: "Entre Ríos", lat: -31.7319, lon: -60.5238 },
  { city: "Posadas", province: "Misiones", lat: -27.3671, lon: -55.8961 },
  { city: "Rawson", province: "Chubut", lat: -43.3002, lon: -65.1023 },
  { city: "Resistencia", province: "Chaco", lat: -27.4514, lon: -58.9867 },
  { city: "Río Gallegos", province: "Santa Cruz", lat: -51.6230, lon: -69.2168 },
  { city: "San Fernando del Valle de Catamarca", province: "Catamarca", lat: -28.4696, lon: -65.7852 },
  { city: "San Miguel de Tucumán", province: "Tucumán", lat: -26.8083, lon: -65.2176 },
  { city: "San Salvador de Jujuy", province: "Jujuy", lat: -24.1858, lon: -65.2995 },
  { city: "San Juan", province: "San Juan", lat: -31.5375, lon: -68.5364 },
  { city: "San Luis", province: "San Luis", lat: -33.2950, lon: -66.3356 },
  { city: "Salta", province: "Salta", lat: -24.7859, lon: -65.4117 },
  { city: "Santa Fe", province: "Santa Fe", lat: -31.6333, lon: -60.7000 },
  { city: "Santa Rosa", province: "La Pampa", lat: -36.6167, lon: -64.2833 },
  { city: "Santiago del Estero", province: "Santiago del Estero", lat: -27.7951, lon: -64.2615 },
  { city: "Ushuaia", province: "Tierra del Fuego", lat: -54.8019, lon: -68.3030 },
  { city: "Viedma", province: "Río Negro", lat: -40.8135, lon: -62.9967 },
];

function wmoDesc(code: number | null): string {
  if (code == null) return "";
  if (code === 0) return "Despejado";
  if (code <= 2) return "Parcialmente nublado";
  if (code === 3) return "Nublado";
  if (code <= 48) return "Niebla";
  if (code <= 67) return "Lluvia";
  if (code <= 77) return "Nieve";
  if (code <= 82) return "Chaparrones";
  if (code <= 99) return "Tormenta";
  return "";
}

const r = (n: number | null | undefined): number | null => (n != null ? Math.round(n) : null);

// Clima de todas las capitales provinciales vía Open-Meteo (una sola llamada multi-coordenada).
export const climaSource: DataSource<ClimaPayload> = {
  id: "clima",
  label: "Clima capitales (Open-Meteo)",
  intervalMs: env.climaMs,
  async fetch() {
    const lats = CAPITALES.map((c) => c.lat).join(",");
    const lons = CAPITALES.map((c) => c.lon).join(",");
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
      `&current=temperature_2m,weather_code` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
      `&forecast_days=3&timezone=America/Argentina/Buenos_Aires`;

    const raw = await fetchJson<OpenMeteoResp | OpenMeteoResp[]>(url);
    const arr = Array.isArray(raw) ? raw : [raw];

    const cities: ClimaCiudad[] = CAPITALES.map((cap, i) => {
      const resp = arr[i] ?? {};
      const code = resp.current?.weather_code ?? null;
      const d = resp.daily ?? {};
      const days: DiaPronostico[] = (d.time ?? []).map((date, j) => {
        const dc = d.weather_code?.[j] ?? null;
        return { date, code: dc, max: r(d.temperature_2m_max?.[j]), min: r(d.temperature_2m_min?.[j]), desc: wmoDesc(dc) };
      });
      return {
        city: cap.city,
        province: cap.province,
        lat: cap.lat,
        lon: cap.lon,
        tempC: r(resp.current?.temperature_2m),
        code,
        desc: wmoDesc(code),
        days,
      };
    });

    const first = cities[0]!;
    return {
      city: first.city,
      tempC: first.tempC,
      code: first.code,
      desc: first.desc,
      cities,
      updatedAt: new Date().toISOString(),
    };
  },
};
