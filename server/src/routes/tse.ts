import { Router } from "express";
import type { TseCollector } from "../tse/collector.js";
import { buildElectionLive } from "../tse/live.js";

// API interna de resultados del TSE. La capa de adquisición (server/src/tse) no sabe nada de la presentación:
// esto sólo expone lo que el colector ya guardó. Público y de sólo lectura (lo consume el output / vMix).
export function tseRouter(c: TseCollector): Router {
  const r = Router();
  const stale = (iso: string | null) => (iso ? Math.round((Date.now() - Date.parse(iso)) / 1000) : null);
  const notYet = (res: import("express").Response, what: string) =>
    res.status(503).json({ error: `todavía sin resultados de ${what}`, phase: c.status().phase, http_pause_reason: c.status().http_pause_reason });
  const send = (res: import("express").Response, key: string, what: string) => {
    const s = c.store.get(key);
    if (!s) return notYet(res, what);
    res.json({ ...s.result, age_seconds: stale(s.result.times.fetched_at) });
  };

  r.get("/status", (_req, res) => res.json(c.status()));
  r.get("/last-update", (_req, res) => {
    const br = c.store.get("br")?.result;
    res.json({
      last_update_at: c.store.lastUpdateAt, last_cycle_at: c.status().last_cycle_at,
      brasil: br ? { totalization_time: br.times.totalization_time, file_generated_at: br.times.file_generated_at, idg: br.idg, sections_totalized_pct: br.totalization.percentage } : null,
    });
  });
  r.get("/requests", (_req, res) => res.json({ totals: c.http.totals, log: c.http.log.slice(-100) })); // auditoría de lo pedido al TSE

  // A) nacional · B) por UF · C) por municipio
  r.get("/results/brasil/presidente", (_req, res) => send(res, "br", "Brasil"));
  r.get("/results/uf/:uf/presidente", (req, res) => send(res, `uf:${req.params.uf!.toUpperCase()}`, `la UF ${req.params.uf}`));
  r.get("/results/municipio/:uf/:codigo/presidente", (req, res) => {
    const uf = req.params.uf!.toUpperCase();
    const m = c.municipality(uf, req.params.codigo!);
    if (!m) return res.status(404).json({ error: `municipio ${req.params.codigo} no encontrado en ${uf} (EA12)` });
    send(res, `mun:${uf}:${m.code}`, `${m.name}/${uf}`);
  });
  r.get("/municipios", (req, res) => {
    const uf = typeof req.query.uf === "string" ? req.query.uf.toUpperCase() : null;
    const all = req.query.seguidos === "0";
    const list = all && c.ea12 ? c.ea12.municipalities : c.trackedMunicipalities();
    res.json(list.filter((m) => !uf || m.uf === uf).map((m) => ({ ...m, has_results: !!c.store.get(`mun:${m.uf}:${m.code}`) })));
  });

  // D) Boletim de Urna: sólo bajo demanda (EA16 → EA18). No se descarga el .bu: se informa archivo, hash y estado.
  r.get("/bu/:uf/:municipio/secciones", async (req, res) => res.json(await c.listSections(req.params.uf!, req.params.municipio!)));
  r.get("/bu/:uf/:municipio/:zona/:secao", async (req, res) => {
    const out = await c.bulletin(req.params.uf!, req.params.municipio!, req.params.zona!, req.params.secao!);
    res.status("error" in out ? 502 : 200).json(out);
  });

  // Para la placa de Elecciones en modo auto.
  r.get("/live/br-presidente", (_req, res) => { res.set("Cache-Control", "public, max-age=10"); res.json(buildElectionLive(c)); });
  return r;
}
