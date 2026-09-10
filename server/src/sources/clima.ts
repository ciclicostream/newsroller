import { env } from "../config/env.js";
import { fetchJson, type DataSource } from "./types.js";

interface ClimaPayload {
  city: string;
  tempC: number | null;
  code: number | null;
  desc: string;
}

interface OpenMeteoResp {
  current?: { temperature_2m?: number; weather_code?: number };
}

// Descripción corta según código WMO.
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

// Clima actual vía Open-Meteo (gratis, sin API key). Default: Buenos Aires.
export const climaSource: DataSource<ClimaPayload> = {
  id: "clima",
  label: "Clima (Open-Meteo)",
  intervalMs: env.climaMs,
  async fetch() {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${env.climaLat}&longitude=${env.climaLon}` +
      `&current=temperature_2m,weather_code&timezone=America/Argentina/Buenos_Aires`;
    const res = await fetchJson<OpenMeteoResp>(url);
    const tempC = res.current?.temperature_2m ?? null;
    const code = res.current?.weather_code ?? null;
    return { city: env.climaCity, tempC: tempC != null ? Math.round(tempC) : null, code, desc: wmoDesc(code) };
  },
};
