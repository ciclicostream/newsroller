import type { DataSource } from "./types.js";
import { dolarSource } from "./dolar.js";
import { datosGobSource } from "./datosgob.js";
import { cammesaSource } from "./cammesa.js";
import { tickerSource } from "./ticker.js";

// Lista única de fuentes. Agregar una nueva = sumarla acá.
export const sources: DataSource[] = [dolarSource, datosGobSource, cammesaSource, tickerSource];

export function getSource(id: string): DataSource | undefined {
  return sources.find((s) => s.id === id);
}
