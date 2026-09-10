import type { CammesaPayload } from "@newsroller/shared";
import { env } from "../config/env.js";
import { fetchJson, type DataSource } from "./types.js";

// Muestras cada 5 min del día. No todas traen todos los campos.
interface CammesaSample {
  fecha: string;
  demHoy?: number | null;
  demAyer?: number | null;
  demSemanaAnt?: number | null;
  demPrevista?: number | null;
  tempHoy?: number | null;
}

const lastWith = <K extends keyof CammesaSample>(arr: CammesaSample[], key: K): number | null => {
  for (let i = arr.length - 1; i >= 0; i--) {
    const v = arr[i]?.[key];
    if (typeof v === "number") return v;
  }
  return null;
};

// CAMMESA — demanda del SADI en vivo. Sin API key oficial (endpoint público).
export const cammesaSource: DataSource<CammesaPayload> = {
  id: "cammesa",
  label: "CAMMESA (demanda eléctrica SADI)",
  intervalMs: env.pollCammesaMs,
  async fetch() {
    const url = `https://api.cammesa.com/demanda-svc/demanda/ObtieneDemandaYTemperaturaRegion?id_region=${env.cammesaRegion}`;
    const rows = await fetchJson<CammesaSample[]>(url);
    const withDem = rows.filter((r) => typeof r.demHoy === "number");
    const last = withDem.at(-1);
    const maxHoy = withDem.reduce((m, r) => Math.max(m, r.demHoy ?? 0), 0) || null;
    return {
      region: env.cammesaRegion,
      fecha: last?.fecha ?? new Date().toISOString(),
      demActual: last?.demHoy ?? null,
      demPrevista: lastWith(rows, "demPrevista"),
      demAyer: last?.demAyer ?? null,
      demSemanaAnt: last?.demSemanaAnt ?? null,
      maxHoy,
      temp: lastWith(rows, "tempHoy"),
    };
  },
};
