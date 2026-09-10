import type { DolarPayload, DolarCasa } from "@newsroller/shared";
import { env } from "../config/env.js";
import { fetchJson, type DataSource } from "./types.js";

interface DolarApiItem {
  casa: string;
  nombre: string;
  compra: number | null;
  venta: number | null;
  fechaActualizacion: string;
}

// dolarapi.com — sin API key. Oficial, blue, bolsa (MEP), CCL, tarjeta, mayorista, cripto.
export const dolarSource: DataSource<DolarPayload> = {
  id: "dolar",
  label: "Dólar (dolarapi.com)",
  intervalMs: env.pollDolarMs,
  async fetch() {
    const items = await fetchJson<DolarApiItem[]>("https://dolarapi.com/v1/dolares");
    const casas: DolarCasa[] = items.map((i) => ({
      casa: i.casa,
      nombre: i.nombre,
      compra: i.compra ?? null,
      venta: i.venta ?? null,
      fecha: i.fechaActualizacion,
    }));
    const updatedAt =
      casas
        .map((c) => c.fecha)
        .filter(Boolean)
        .sort()
        .at(-1) ?? new Date().toISOString();
    return { casas, updatedAt };
  },
};
