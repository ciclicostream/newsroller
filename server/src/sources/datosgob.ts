import type { DatosGobPayload, SerieValor } from "@newsroller/shared";
import { env } from "../config/env.js";
import { fetchJson, type DataSource } from "./types.js";

// Series verificadas contra apis.datos.gob.ar (mensuales, vigentes 2026).
interface SerieDef {
  key: string;
  id: string;
  label: string;
  unit: string;
}

const DEFAULT_SERIES: SerieDef[] = [
  { key: "ipc", id: "148.3_INIVELNAL_DICI_M_26", label: "IPC nacional (índice, base dic 2016)", unit: "índice" },
  { key: "salarios", id: "149.1_TL_INDIIOS_OCTU_0_21", label: "Índice de salarios (nivel general)", unit: "índice" },
  { key: "energia", id: "38.3_EE_1994_M_17", label: "Ventas de energía eléctrica (mercado interno)", unit: "GWh" },
  { key: "petroleo", id: "365.3_PRODUCCION_SA__35", label: "Producción de petróleo crudo (YPF)", unit: "m³" },
];

// Permite override por env: DATOSGOB_SERIES=key:id,key:id
function resolveSeries(): SerieDef[] {
  if (!env.datosGobSeries) return DEFAULT_SERIES;
  const overrides = new Map<string, string>();
  for (const pair of env.datosGobSeries.split(",")) {
    const [key, id] = pair.split(":").map((s) => s.trim());
    if (key && id) overrides.set(key, id);
  }
  return DEFAULT_SERIES.map((s) => (overrides.has(s.key) ? { ...s, id: overrides.get(s.key)! } : s));
}

interface SeriesApiResponse {
  data: [string, number | null][];
}

const pct = (a: number, b: number): number | null =>
  b === 0 || b == null ? null : Math.round(((a / b - 1) * 100) * 100) / 100;

async function fetchSerie(def: SerieDef): Promise<SerieValor> {
  const url = `https://apis.datos.gob.ar/series/api/series/?ids=${def.id}&limit=13&sort=desc&format=json`;
  try {
    const res = await fetchJson<SeriesApiResponse>(url);
    const rows = (res.data ?? []).filter((r) => r[1] != null) as [string, number][];
    if (!rows.length) {
      return { key: def.key, id: def.id, label: def.label, unit: def.unit, latest: null, momPct: null, yoyPct: null };
    }
    const [date, value] = rows[0]!;
    const prev = rows[1]?.[1];
    const yearAgo = rows[12]?.[1];
    return {
      key: def.key,
      id: def.id,
      label: def.label,
      unit: def.unit,
      latest: { date, value },
      momPct: prev != null ? pct(value, prev) : null,
      yoyPct: yearAgo != null ? pct(value, yearAgo) : null,
    };
  } catch {
    // Una serie caída no debe tumbar al resto.
    return { key: def.key, id: def.id, label: def.label, unit: def.unit, latest: null, momPct: null, yoyPct: null };
  }
}

// datos.gob.ar (INDEC / Energía) — sin API key. IPC, salarios, energía, petróleo.
export const datosGobSource: DataSource<DatosGobPayload> = {
  id: "datosgob",
  label: "datos.gob.ar (IPC, salarios, energía)",
  intervalMs: env.pollDatosGobMs,
  async fetch() {
    const series = await Promise.all(resolveSeries().map(fetchSerie));
    return { series };
  },
};
