import { API_BASE } from "./scene";
import { isLiveOutput } from "./telemetry";
import { ORIENTATION } from "./orientation";

// Medición de fluidez del output al aire. Cuenta el tiempo entre cuadros (requestAnimationFrame) y lo agrupa
// por lo que está al aire en ese momento (tipo de contenido). Cada minuto manda un resumen al server
// (/api/output/perf). Sólo corre en el output real (OBS/vMix): no en el monitor del panel ni en previews.
//
// Qué se puede leer del resumen:
//  - medianMs ≈ 16.7 → la fuente de navegador corre a 60 fps; ≈ 33 → corre a 30 fps (config de OBS/vMix).
//  - drops / stutters / freezes → cuadros que tardaron >1.5×, >3× y >6× el cuadro nominal (mediana):
//    saltos de uno, de varios y congelamientos. Si se concentran en un tipo de contenido, ese contenido es caro.
//  - longTasks → el hilo principal estuvo bloqueado (JS/diseño), distinto de un problema de pintado.

const BIN_MS = 2;
const BINS = 100; // 0–200 ms; lo que pase de 200 cae en el último
const FLUSH_MS = 60_000;

interface Bucket { frames: number; sumMs: number; maxMs: number; bins: number[]; longTasks: number; longTaskMs: number }
const newBucket = (): Bucket => ({ frames: 0, sumMs: 0, maxMs: 0, bins: new Array(BINS).fill(0), longTasks: 0, longTaskMs: 0 });

let buckets = new Map<string, Bucket>();
let label = "idle";
let started = false;
let lastT = 0;
let sentMeta = false;
const clientId = Math.random().toString(36).slice(2, 10);
const bootAt = Date.now();

const bucketOf = (l: string): Bucket => {
  let b = buckets.get(l);
  if (!b) { b = newBucket(); buckets.set(l, b); }
  return b;
};

// Qué contenido está al aire ahora (lo actualiza Output).
export function setPerfLabel(l: string): void { label = l || "idle"; }

function frame(t: number): void {
  requestAnimationFrame(frame);
  if (lastT && !document.hidden) {
    const d = t - lastT;
    if (d < 1000) { // más que eso = pestaña suspendida, no un cuadro lento
      const b = bucketOf(label);
      b.frames++;
      b.sumMs += d;
      if (d > b.maxMs) b.maxMs = d;
      b.bins[Math.min(BINS - 1, Math.floor(d / BIN_MS))]!++;
    }
  }
  lastT = t;
}

const quantile = (bins: number[], total: number, q: number): number => {
  let acc = 0;
  const target = total * q;
  for (let i = 0; i < bins.length; i++) { acc += bins[i]!; if (acc >= target) return (i + 0.5) * BIN_MS; }
  return BINS * BIN_MS;
};

function summarize(b: Bucket) {
  const median = quantile(b.bins, b.frames, 0.5);
  const over = (k: number) => { let n = 0; for (let i = 0; i < b.bins.length; i++) if (i * BIN_MS >= median * k) n += b.bins[i]!; return n; };
  return {
    frames: b.frames,
    avgMs: +(b.sumMs / b.frames).toFixed(1),
    medianMs: +median.toFixed(1),
    p95Ms: +quantile(b.bins, b.frames, 0.95).toFixed(1),
    p99Ms: +quantile(b.bins, b.frames, 0.99).toFixed(1),
    maxMs: +b.maxMs.toFixed(0),
    drops: over(1.5),
    stutters: over(3),
    freezes: over(6),
    longTasks: b.longTasks,
    longTaskMs: Math.round(b.longTaskMs),
  };
}

function flush(): void {
  const prev = buckets;
  buckets = new Map();
  const by: Record<string, ReturnType<typeof summarize>> = {};
  for (const [l, b] of prev) if (b.frames >= 30) by[l] = summarize(b);
  if (!Object.keys(by).length) return;
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  const body: Record<string, unknown> = {
    client: clientId,
    orientation: ORIENTATION,
    uptimeMin: Math.round((Date.now() - bootAt) / 60_000),
    heapMb: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
    labels: by,
  };
  if (!sentMeta) { sentMeta = true; body.ua = navigator.userAgent; body.screen = `${innerWidth}x${innerHeight}@${devicePixelRatio}`; }
  void fetch(`${API_BASE}/api/output/perf`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true }).catch(() => {});
}

export function startPerf(): void {
  if (started || !isLiveOutput()) return;
  started = true;
  requestAnimationFrame(frame);
  try {
    new PerformanceObserver((list) => {
      const b = bucketOf(label);
      for (const e of list.getEntries()) { b.longTasks++; b.longTaskMs += e.duration; }
    }).observe({ entryTypes: ["longtask"] });
  } catch { /* navegador sin longtask */ }
  setInterval(flush, FLUSH_MS);
}
