// Fluidez del output al aire (ver apps/output/src/lib/perf.ts). Cada output real manda un resumen por minuto;
// acá se guardan en memoria las últimas 24 h (se pierde al reiniciar el server) y los minutos con problemas
// quedan además en la consola del server, que sí persiste en el hosting.
export interface PerfLabel {
  frames: number; avgMs: number; medianMs: number; p95Ms: number; p99Ms: number; maxMs: number;
  drops: number; stutters: number; freezes: number; longTasks: number; longTaskMs: number;
}
export interface PerfReport {
  at: number; client: string; orientation: "horizontal" | "vertical"; uptimeMin: number; heapMb: number | null;
  ua?: string; screen?: string; labels: Record<string, PerfLabel>;
}

const KEEP_MS = 24 * 3_600_000;
const MAX_REPORTS = 4000;
const reports: PerfReport[] = [];
const meta = new Map<string, { ua?: string; screen?: string }>();

const num = (v: unknown, max = 1e9): number => (typeof v === "number" && Number.isFinite(v) ? Math.min(Math.max(v, 0), max) : 0);

export function recordPerf(b: Record<string, unknown>): boolean {
  if (typeof b.client !== "string" || !b.client || !b.labels || typeof b.labels !== "object") return false;
  const labels: Record<string, PerfLabel> = {};
  for (const [k, raw] of Object.entries(b.labels as Record<string, Record<string, unknown>>).slice(0, 40)) {
    if (!raw || typeof raw !== "object") continue;
    labels[k.slice(0, 40)] = {
      frames: num(raw.frames), avgMs: num(raw.avgMs, 5000), medianMs: num(raw.medianMs, 5000), p95Ms: num(raw.p95Ms, 5000), p99Ms: num(raw.p99Ms, 5000),
      maxMs: num(raw.maxMs, 60000), drops: num(raw.drops), stutters: num(raw.stutters), freezes: num(raw.freezes), longTasks: num(raw.longTasks), longTaskMs: num(raw.longTaskMs),
    };
  }
  if (!Object.keys(labels).length) return false;
  const client = b.client.slice(0, 16);
  if (typeof b.ua === "string") meta.set(client, { ua: b.ua.slice(0, 300), screen: typeof b.screen === "string" ? b.screen.slice(0, 40) : undefined });
  const r: PerfReport = {
    at: Date.now(), client, orientation: b.orientation === "vertical" ? "vertical" : "horizontal",
    uptimeMin: num(b.uptimeMin), heapMb: b.heapMb == null ? null : num(b.heapMb), ...meta.get(client), labels,
  };
  reports.push(r);
  const cutoff = Date.now() - KEEP_MS;
  while (reports.length > MAX_REPORTS || (reports[0] && reports[0].at < cutoff)) reports.shift();
  // Sólo los minutos con problemas llegan a la consola: ≥1% de cuadros con saltos o algún congelamiento.
  for (const [l, v] of Object.entries(labels)) {
    if (v.frames && (v.drops / v.frames >= 0.01 || v.freezes > 0)) {
      console.log(`[fluidez] ${r.orientation} ${client} "${l}": ${v.frames} cuadros, mediana ${v.medianMs}ms, p99 ${v.p99Ms}ms, máx ${v.maxMs}ms, saltos ${v.drops}, tirones ${v.stutters}, congelados ${v.freezes}, tareas largas ${v.longTasks} (${v.longTaskMs}ms), heap ${r.heapMb ?? "?"}MB`);
    }
  }
  return true;
}

// Resumen para leer de un vistazo: por cliente y por tipo de contenido, ponderado por cuadros.
export function perfSummary(sinceMs = KEEP_MS) {
  const from = Date.now() - sinceMs;
  const clients: Record<string, { orientation: string; ua?: string; screen?: string; uptimeMin: number; heapMb: number | null; lastAt: number; labels: Record<string, Record<string, number>> }> = {};
  for (const r of reports) {
    if (r.at < from) continue;
    const c = (clients[r.client] ??= { orientation: r.orientation, ua: r.ua, screen: r.screen, uptimeMin: 0, heapMb: null, lastAt: 0, labels: {} });
    c.uptimeMin = r.uptimeMin; c.heapMb = r.heapMb; c.lastAt = r.at; c.ua = r.ua ?? c.ua; c.screen = r.screen ?? c.screen;
    for (const [l, v] of Object.entries(r.labels)) {
      const a = (c.labels[l] ??= { frames: 0, sumMs: 0, medianW: 0, p99Max: 0, maxMs: 0, drops: 0, stutters: 0, freezes: 0, longTasks: 0 });
      a.frames! += v.frames; a.sumMs! += v.avgMs * v.frames; a.medianW! += v.medianMs * v.frames;
      a.p99Max = Math.max(a.p99Max!, v.p99Ms); a.maxMs = Math.max(a.maxMs!, v.maxMs);
      a.drops! += v.drops; a.stutters! += v.stutters; a.freezes! += v.freezes; a.longTasks! += v.longTasks;
    }
  }
  const out: Record<string, unknown> = {};
  for (const [id, c] of Object.entries(clients)) {
    const labels: Record<string, unknown> = {};
    for (const [l, a] of Object.entries(c.labels)) {
      const f = a.frames!;
      labels[l] = {
        minutos: +(f / 3600).toFixed(1), // aprox. a 60 cuadros/s; sólo orientativo
        fpsPromedio: +(1000 / (a.sumMs! / f)).toFixed(1),
        medianaMs: +(a.medianW! / f).toFixed(1),
        p99Max: a.p99Max, maxMs: a.maxMs,
        saltosPct: +((a.drops! / f) * 100).toFixed(2), tironesPct: +((a.stutters! / f) * 100).toFixed(2), congelados: a.freezes, tareasLargas: a.longTasks,
      };
    }
    out[id] = { orientation: c.orientation, ua: c.ua, screen: c.screen, uptimeMin: c.uptimeMin, heapMb: c.heapMb, ultimoReporte: new Date(c.lastAt).toISOString(), porContenido: labels };
  }
  return out;
}
