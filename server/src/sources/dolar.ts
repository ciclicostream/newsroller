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
    const casas: DolarCasa[] = await withVariacion(
      items.map((i) => ({
        casa: i.casa,
        nombre: i.nombre,
        compra: i.compra ?? null,
        venta: i.venta ?? null,
        fecha: i.fechaActualizacion,
      })),
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
