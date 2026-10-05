import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { NormalizedResult } from "./types.js";
import type { Accompaniment } from "./normalize.js";

// Almacén de resultados: en memoria + espejo en disco (sin migraciones de base de datos).
//  - `latest.json`: último resultado normalizado por ámbito (sobrevive a un reinicio del servidor en plena noche).
//  - `raw/<clave>.json`: último JSON CRUDO recibido de cada ámbito (auditoría).
//  - `audit.ndjson`: una línea por versión nueva recibida (clave, idg, sha256, horas, URL). Nunca se borra.
export interface StoredResult { key: string; result: NormalizedResult; etag: string | null; replaced_at: string }
export type PutOutcome = "new" | "updated" | "unchanged" | "stale" | "regressed" | "frozen";

const votes = (r: NormalizedResult): number => r.totals.counted_total ?? r.totals.valid ?? 0;
const sections = (r: NormalizedResult): number => r.totalization.sections_totalized ?? 0;
const hasData = (r: NormalizedResult): boolean => votes(r) > 0 || sections(r) > 0;
const regressed = (prev: NormalizedResult, next: NormalizedResult): boolean => votes(next) < votes(prev) || sections(next) < sections(prev);

export class TseStore {
  private results = new Map<string, StoredResult>();
  private accomp = new Map<string, { value: Accompaniment; etag: string | null }>();
  private dirty = false;
  lastUpdateAt: string | null = null;
  /** Sellado: los resultados finales salen de `tse-final/latest.json` (verificado contra `seal.json`) y nada los puede cambiar. */
  frozen = false;
  sealError: string | null = null;

  /** Almacén de sólo lectura con los resultados finales sellados. Si el archivo no coincide con el sello queda vacío (y lo dice). */
  static sealed(dir: string): TseStore {
    const st = new TseStore(null);
    st.frozen = true;
    try {
      const raw = readFileSync(path.join(dir, "latest.json"));
      const seal = JSON.parse(readFileSync(path.join(dir, "seal.json"), "utf8")) as { sha256: string };
      const sha = createHash("sha256").update(raw).digest("hex");
      if (sha !== seal.sha256) throw new Error(`latest.json no coincide con el sello (${sha.slice(0, 12)} ≠ ${String(seal.sha256).slice(0, 12)})`);
      const j = JSON.parse(raw.toString("utf8")) as { results: StoredResult[]; last_update_at: string | null };
      for (const r of j.results) st.results.set(r.key, r);
      st.lastUpdateAt = j.last_update_at ?? null;
    } catch (e) {
      st.sealError = e instanceof Error ? e.message : String(e);
      console.error(`[tse] SELLO INVÁLIDO, no se cargan resultados: ${st.sealError}`);
    }
    return st;
  }

  constructor(readonly dir: string | null) {
    if (dir) {
      mkdirSync(path.join(dir, "raw"), { recursive: true });
      const f = path.join(dir, "latest.json");
      if (existsSync(f)) {
        try {
          const j = JSON.parse(readFileSync(f, "utf8")) as { results: StoredResult[]; last_update_at: string | null };
          for (const r of j.results) this.results.set(r.key, r);
          this.lastUpdateAt = j.last_update_at ?? null;
        } catch { /* snapshot corrupto: se reconstruye en el próximo ciclo */ }
      }
    }
  }

  get(key: string): StoredResult | undefined { return this.results.get(key); }
  keys(): string[] { return [...this.results.keys()]; }
  all(): StoredResult[] { return [...this.results.values()]; }

  /**
   * Guarda un resultado. Una actualización posterior REEMPLAZA a la anterior; si llega una generación más vieja que la
   * guardada (ej. un nodo del CDN atrasado) se ignora ("stale"); si el contenido es idéntico (mismo sha256) no cambia nada.
   */
  put(key: string, result: NormalizedResult, rawText: string, etag: string | null): PutOutcome {
    if (this.frozen) return "frozen";
    const prev = this.results.get(key);
    if (prev) {
      if (prev.result.raw_sha256 === result.raw_sha256) return "unchanged";
      const a = prev.result.times.file_generated_at, b = result.times.file_generated_at;
      if (a && b && Date.parse(b) < Date.parse(a)) return "stale";
      // Si el TSE limpia su base (o publica algo vacío), NO pisamos lo que ya tenemos: un resultado con menos secciones
      // totalizadas o menos votos que el guardado es un retroceso, no una actualización. Queda lo último con datos.
      if (hasData(prev.result) && regressed(prev.result, result)) {
        console.warn(`[tse] ${key}: el TSE publicó datos con retroceso (${sections(result)} < ${sections(prev.result)} secciones, ${votes(result)} < ${votes(prev.result)} votos); se conserva la versión guardada`);
        return "regressed";
      }
    }
    const entry: StoredResult = { key, result, etag, replaced_at: new Date().toISOString() };
    this.results.set(key, entry);
    this.lastUpdateAt = entry.replaced_at;
    this.dirty = true;
    if (this.dir) {
      try {
        writeFileSync(path.join(this.dir, "raw", `${key.replace(/[^a-z0-9._-]/gi, "_")}.json`), rawText);
        appendFileSync(path.join(this.dir, "audit.ndjson"), JSON.stringify({
          key, idg: result.idg, sha256: result.raw_sha256, bytes: result.raw_bytes, url: result.source_url,
          fetched_at: result.times.fetched_at, file_generated_at: result.times.file_generated_at,
          source_updated_at: result.times.source_updated_at, totalization_time: result.times.totalization_time,
        }) + "\n");
      } catch (e) { console.error(`[tse] no pude escribir auditoría: ${e instanceof Error ? e.message : e}`); }
    }
    return prev ? "updated" : "new";
  }

  getAccomp(key: string) { return this.accomp.get(key); }
  setAccomp(key: string, value: Accompaniment, etag: string | null): void { this.accomp.set(key, { value, etag }); }

  flush(): void {
    if (this.frozen || !this.dir || !this.dirty) return;
    this.dirty = false;
    try { writeFileSync(path.join(this.dir, "latest.json"), JSON.stringify({ last_update_at: this.lastUpdateAt, results: [...this.results.values()] })); }
    catch (e) { console.error(`[tse] no pude guardar el snapshot: ${e instanceof Error ? e.message : e}`); }
  }
}
