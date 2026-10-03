import type { RequestLogEntry } from "./types.js";

// Cliente HTTP "educado" para el TSE. Reglas (documentación y observación 2026):
//  - 100 req/s por IP es el techo duro; excederlo = bloqueo de 10 min (renovado con cada intento). Acá nunca pasamos de 1 cada `minGapMs`.
//  - Muchos 404 seguidos también bloquean la IP → un 404 NO es error (el archivo puede no existir todavía), pero contamos 404 seguidos y pausamos.
//  - 429 / 403 → pausa con backoff exponencial (arranca en 10 min, tope 60).
//  - ETag == idg: se reenvía If-None-Match y un 304 no baja cuerpo.
export interface Validators { etag?: string | null; lastModified?: string | null }
export interface FetchOutcome {
  url: string;
  status: number; // 0: no se hizo (pausa) o falló la red
  ok: boolean; // 200
  notModified: boolean; // 304
  notFound: boolean; // 404
  skipped?: string; // motivo si no se hizo la request
  body?: string;
  etag: string | null;
  lastModified: string | null;
  fetchedAt: string;
  ms: number;
  bytes: number;
}

export interface HttpOptions {
  minGapMs?: number;
  userAgent?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  max404Streak?: number;
  pause404Ms?: number;
  blockPauseMs?: number;
  maxBlockPauseMs?: number;
  logSize?: number;
}

export class TseHttp {
  private readonly minGapMs: number;
  private readonly ua: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly max404Streak: number;
  private readonly pause404Ms: number;
  private readonly blockPauseMs: number;
  private readonly maxBlockPauseMs: number;
  private readonly logSize: number;
  private chain: Promise<unknown> = Promise.resolve();
  private lastAt = 0;

  pausedUntil = 0;
  pauseReason: string | null = null;
  streak404 = 0;
  blockLevel = 0;
  totals = { requests: 0, ok: 0, notModified: 0, notFound: 0, blocked: 0, errors: 0, skipped: 0, bytes: 0 };
  log: RequestLogEntry[] = [];

  constructor(o: HttpOptions = {}) {
    this.minGapMs = o.minGapMs ?? 250;
    this.ua = o.userAgent ?? "NewsRoller-Ciclico/1.0 (resultados electorales)";
    this.fetchImpl = o.fetchImpl ?? fetch;
    this.now = o.now ?? Date.now;
    this.sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.max404Streak = o.max404Streak ?? 3;
    this.pause404Ms = o.pause404Ms ?? 5 * 60_000;
    this.blockPauseMs = o.blockPauseMs ?? 10 * 60_000;
    this.maxBlockPauseMs = o.maxBlockPauseMs ?? 60 * 60_000;
    this.logSize = o.logSize ?? 300;
  }

  get paused(): boolean { return this.now() < this.pausedUntil; }

  /** Serializa todas las requests (una a la vez, separadas por `minGapMs`). */
  get(url: string, v: Validators = {}): Promise<FetchOutcome> {
    const run = this.chain.then(() => this.doGet(url, v));
    this.chain = run.catch(() => undefined);
    return run;
  }

  private record(e: RequestLogEntry): void {
    this.log.push(e);
    if (this.log.length > this.logSize) this.log.splice(0, this.log.length - this.logSize);
  }

  private pause(ms: number, reason: string): void {
    this.pausedUntil = Math.max(this.pausedUntil, this.now() + ms);
    this.pauseReason = reason;
  }

  private async doGet(url: string, v: Validators): Promise<FetchOutcome> {
    const fetchedAt = new Date(this.now()).toISOString();
    const base: FetchOutcome = { url, status: 0, ok: false, notModified: false, notFound: false, etag: null, lastModified: null, fetchedAt, ms: 0, bytes: 0 };
    if (this.paused) {
      this.totals.skipped++;
      const reason = `pausado hasta ${new Date(this.pausedUntil).toISOString()} (${this.pauseReason})`;
      this.record({ at: fetchedAt, url, status: 0, ms: 0, bytes: 0, note: reason });
      return { ...base, skipped: reason };
    }
    const wait = this.lastAt + this.minGapMs - this.now();
    if (wait > 0) await this.sleep(wait);
    this.lastAt = this.now();
    const t0 = this.now();
    const headers: Record<string, string> = { "User-Agent": this.ua, Accept: "application/json" };
    if (v.etag) headers["If-None-Match"] = v.etag;
    else if (v.lastModified) headers["If-Modified-Since"] = v.lastModified;
    this.totals.requests++;
    try {
      const res = await this.fetchImpl(url, { headers });
      const ms = this.now() - t0;
      const out: FetchOutcome = {
        ...base, status: res.status, ms,
        etag: res.headers.get("etag"), lastModified: res.headers.get("last-modified"),
        fetchedAt: new Date(this.now()).toISOString(),
      };
      // Límite de tasa informado por el propio TSE (x-ratelimit-*): si queda poco margen, esperamos el reinicio.
      const remaining = Number(res.headers.get("x-ratelimit-remaining"));
      if (Number.isFinite(remaining) && res.headers.has("x-ratelimit-remaining") && remaining < 50) {
        this.pause(1500, "x-ratelimit-remaining bajo");
      }
      if (res.status === 200) {
        out.body = await res.text();
        out.bytes = Buffer.byteLength(out.body);
        out.ok = true;
        this.streak404 = 0; this.blockLevel = 0; this.pauseReason = null;
        this.totals.ok++; this.totals.bytes += out.bytes;
      } else if (res.status === 304) {
        out.notModified = true;
        this.streak404 = 0;
        this.totals.notModified++;
      } else if (res.status === 404) {
        out.notFound = true;
        this.streak404++;
        this.totals.notFound++;
        if (this.streak404 >= this.max404Streak) this.pause(this.pause404Ms, `${this.streak404} respuestas 404 seguidas`);
      } else if (res.status === 429 || res.status === 403) {
        this.totals.blocked++;
        const ms2 = Math.min(this.maxBlockPauseMs, this.blockPauseMs * 2 ** this.blockLevel);
        this.blockLevel++;
        this.pause(ms2, `HTTP ${res.status}`);
      } else if (res.status >= 500) {
        this.totals.errors++;
        this.pause(60_000, `HTTP ${res.status}`);
      }
      this.record({ at: out.fetchedAt, url, status: res.status, ms, bytes: out.bytes, note: out.notFound ? "404 (puede no existir todavía)" : undefined });
      return out;
    } catch (e) {
      this.totals.errors++;
      this.pause(30_000, `error de red: ${e instanceof Error ? e.message : String(e)}`);
      this.record({ at: fetchedAt, url, status: 0, ms: this.now() - t0, bytes: 0, note: `error de red: ${e instanceof Error ? e.message : e}` });
      return { ...base, ms: this.now() - t0, skipped: `error de red` };
    }
  }
}
