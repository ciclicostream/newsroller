import type { DolarPayload, DolarCasa } from "@newsroller/shared";
import { env } from "../config/env.js";
import { fetchJson, type DataSource } from "./types.js";
import { getSupabase } from "../db/supabase.js";

interface DolarApiItem {
  casa: string;
  nombre: string;
  compra: number | null;
  venta: number | null;
  fechaActualizacion: string;
}

// Historial diario por casa (ArgentinaDatos, sin API key). Se cachea porque cada respuesta trae años de
// datos: sólo se guardan los últimos ~120 días y se refresca cada 30 min.
interface HistRow { fecha: string; venta: number | null }
const HIST_TTL_MS = 30 * 60_000;
const histCache = new Map<string, { at: number; rows: HistRow[] }>();
async function historial(casa: string): Promise<HistRow[] | null> {
  const hit = histCache.get(casa);
  if (hit && Date.now() - hit.at < HIST_TTL_MS) return hit.rows;
  try {
    const raw = await fetchJson<{ fecha: string; venta: number | null }[]>(`https://api.argentinadatos.com/v1/cotizaciones/dolares/${encodeURIComponent(casa)}`);
    const rows = raw.filter((r) => r.venta != null).slice(-120).map((r) => ({ fecha: r.fecha, venta: r.venta }));
    histCache.set(casa, { at: Date.now(), rows });
    return rows;
  } catch {
    // Si falla se usa lo último que se tenía (o nada). Se reintenta en el próximo poll (~1 min).
    return hit?.rows ?? null;
  }
}

// Última cotización distinta a `venta`, buscando hacia atrás. `venta` si nunca varió en la ventana.
function ultimaDistinta(rows: HistRow[], venta: number): number {
  for (let i = rows.length - 1; i >= 0; i--) {
    const v = rows[i]!.venta;
    if (v != null && Math.abs(v - venta) > 0.005) return v;
  }
  return venta;
}

const todayStr = () => new Date().toISOString().slice(0, 10);
const yesterdayStr = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

// Guarda el snapshot de HOY (se pisa en cada poll: queda el último valor del día,
// que al día siguiente actúa como "cierre anterior") y trae el snapshot de AYER
// para calcular la variación ▲/▼ de cada casa. Sin Supabase, no hay variación (undefined).
async function withVariacion(casas: DolarCasa[]): Promise<DolarCasa[]> {
  const sb = getSupabase();
  if (!sb) return casas;
  const today = todayStr();
  try {
    await sb.from("dolar_history").upsert(
      casas.map((c) => ({ casa: c.casa, day: today, compra: c.compra, venta: c.venta })),
      { onConflict: "casa,day" },
    );
    const { data: prevRows } = await sb
      .from("dolar_history")
      .select("casa, venta")
      .eq("day", yesterdayStr());
    const prevByCasa = new Map((prevRows ?? []).map((r) => [r.casa, r.venta as number | null]));
    return casas.map((c) => ({ ...c, ventaPrev: prevByCasa.get(c.casa) ?? null }));
  } catch {
    return casas; // el historial es un plus; si falla, la placa igual muestra el valor actual
  }
}

// dolarapi.com — sin API key. Oficial, blue, bolsa (MEP), CCL, tarjeta, mayorista, cripto.
export const dolarSource: DataSource<DolarPayload> = {
  id: "dolar",
  label: "Dólar (dolarapi.com)",
  intervalMs: env.pollDolarMs,
  async fetch() {
    const items = await fetchJson<DolarApiItem[]>("https://dolarapi.com/v1/dolares");
    const conDiaAnterior: DolarCasa[] = await withVariacion(
      items.map((i) => ({
        casa: i.casa,
        nombre: i.nombre,
        compra: i.compra ?? null,
        venta: i.venta ?? null,
        fecha: i.fechaActualizacion,
      })),
    );
    // ▲/▼/= según la última variación real (historial de ArgentinaDatos). Si el historial no está
    // disponible se conserva el cálculo contra el cierre del día anterior (dolar_history).
    const casas: DolarCasa[] = await Promise.all(
      conDiaAnterior.map(async (c) => {
        if (c.venta == null) return c;
        const rows = await historial(c.casa);
        if (rows && rows.length) return { ...c, ventaPrev: ultimaDistinta(rows, c.venta) };
        // Sin historial: el cierre de ayer sólo vale si difiere (si es igual no sabemos cuál fue la
        // última variación, así que no se muestra nada en vez de un "sin cambios" falso).
        return { ...c, ventaPrev: c.ventaPrev != null && Math.abs(c.ventaPrev - c.venta) > 0.005 ? c.ventaPrev : null };
      }),
    );
    const updatedAt =
      casas
        .map((c) => c.fecha)
        .filter(Boolean)
        .sort()
        .at(-1) ?? new Date().toISOString();
    return { casas, updatedAt };
  },
};
