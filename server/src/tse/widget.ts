import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { BR_CANDIDATES, type ElectionLive } from "@newsroller/shared";
import type { TseCollector } from "./collector.js";
import { buildElectionLive } from "./live.js";

// Datos para el widget embebible de la web ("Brasil Vota"): lo mismo que la placa, más la ETAPA ya calculada.
// La etapa sale del horario de votación y de lo que informa el TSE; un archivo de override permite forzarla a mano.
export type WidgetPhase = "pre" | "apertura" | "cierre" | "resultados" | "preliminar" | "definitivo";
export const WIDGET_PHASE_LABEL: Record<WidgetPhase, string> = {
  pre: "Elecciones el domingo 4 de octubre",
  apertura: "Se abren los comicios",
  cierre: "Se cierran las urnas",
  resultados: "Primeros resultados",
  preliminar: "Conteo preliminar",
  definitivo: "Ganador definitivo",
};

export interface WidgetOverride { winner?: string; phase?: WidgetPhase }

/** server/.tse-data/widget.json → {"winner":"Luiz Inácio Lula da Silva"} y/o {"phase":"cierre"}. Se lee en cada pedido (editable sin reiniciar). */
export function readOverride(dataDir: string): WidgetOverride {
  const f = path.join(dataDir, "widget.json");
  try { return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as WidgetOverride) : {}; } catch { return {}; }
}

export interface WidgetCfg { opensAt: number; closesAt: number }
export const widgetCfg = (): WidgetCfg => ({
  opensAt: Date.parse(process.env.TSE_ABRE?.trim() || "2026-10-04T08:00:00-03:00"),
  closesAt: Date.parse(process.env.TSE_CIERRA?.trim() || "2026-10-04T17:00:00-03:00"),
});

export function derivePhase(live: ElectionLive, now: number, cfg: WidgetCfg, ov: WidgetOverride): WidgetPhase {
  if (ov.phase) return ov.phase;
  if (ov.winner) return "definitivo";
  if (live.available && live.counted_pct > 0) {
    if (live.outcome !== "open") return live.totalized_final ? "definitivo" : "preliminar";
    return "resultados";
  }
  if (now < cfg.opensAt) return "pre";
  if (now < cfg.closesAt) return "apertura";
  return "cierre";
}

export function buildWidget(c: TseCollector, ov: WidgetOverride, now = Date.now(), cfg = widgetCfg()) {
  const live = buildElectionLive(c);
  const phase = derivePhase(live, now, cfg, ov);
  const outcome = ov.winner ? "winner" : live.outcome;
  return {
    // En primera vuelta con balotaje no hay "ganador": el cierre se llama "resultado definitivo".
    phase, phase_label: phase === "definitivo" && outcome === "runoff" ? "Resultado definitivo" : WIDGET_PHASE_LABEL[phase], winner_override: ov.winner ?? null,
    outcome, available: live.available, round: live.round, counted_pct: live.counted_pct,
    updated_at: live.updated_at, fetched_at: live.fetched_at,
    // `version` cambia con cada dato nuevo o cambio de etapa: el widget lo usa para avisar "información actualizada".
    version: [live.updated_at, live.counted_pct, phase, ov.winner ?? ""].join("|"),
    candidates: live.candidates, states: live.states, cities: live.cities, abroad: live.abroad,
    // Antes de que haya resultados se muestran los candidatos precargados (sin cifras).
    preload: BR_CANDIDATES.map((x) => ({ name: x.name, party: x.party, color: x.color, photo_url: x.photo_url })),
    source: live.source,
  };
}
