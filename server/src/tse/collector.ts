import path from "node:path";
import { catalogUrl, parseCatalog, resolveElection, urls, type Ea11, type ResolvedElection } from "./catalog.js";
import type { TseConfig } from "./config.js";
import { UFS } from "./config.js";
import { TseHttp, type FetchOutcome } from "./http.js";
import { normalizeAccompaniment, normalizeEa12, normalizeEa20, normalizeEa18, sectionsOfMunicipality, type Ea12Index, type MunicipalityInfo } from "./normalize.js";
import { TseStore } from "./store.js";
import type { Geography } from "./types.js";

// Colector. Arquitectura recomendada por el TSE (no se hace polling de miles de URLs):
//   EA11 (ele-c)  → resuelve elección/cargo/plantillas
//   EA14 (Brasil) → qué ámbitos (BR, UFs) cambiaron
//   EA20 BR / UF  → sólo de lo que cambió
//   EA15 (por UF) → qué municipios cambiaron; EA20 municipal sólo de los seguidos que cambiaron (cola con tope por ciclo)
//   EA12          → lista de municipios (código TSE, IBGE, nombre, zonas) — nunca hardcodeada
//   EA16/EA18     → sólo bajo demanda (boletines de urna)
export type CollectorPhase = "apagado" | "esperando-catalogo" | "esperando-publicacion" | "activo" | "pausado";

export interface CollectorStatus {
  phase: CollectorPhase;
  env: string;
  election: Pick<ResolvedElection, "cycle" | "pleito" | "electionId" | "electionName" | "round" | "cargoName" | "date"> | null;
  poll_ms: number;
  last_cycle_at: string | null;
  next_cycle_at: string | null;
  last_update_at: string | null;
  http_paused: boolean;
  http_pause_reason: string | null;
  http_paused_until: string | null;
  requests: TseHttp["totals"];
  streak_404: number;
  pending_municipalities: number;
  tracked_municipalities: number;
  results_stored: number;
  last_error: string | null;
}

const SMALL_SET = 20; // hasta esta cantidad de municipios seguidos se omite el EA15

export class TseCollector {
  readonly http: TseHttp;
  readonly store: TseStore;
  election: ResolvedElection | null = null;
  ea12: Ea12Index | null = null;
  phase: CollectorPhase = "apagado";
  lastError: string | null = null;
  lastCycleAt: string | null = null;
  nextCycleAt: string | null = null;
  private catalogEtag: string | null = null;
  private catalogAt = 0;
  private ea12At = 0;
  private ea12Etag: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private eaMissStreak = 0;
  private tracked: MunicipalityInfo[] = [];
  private pendingMun = new Set<string>(); // "SP:71072" pendientes de EA20
  private munSig = new Map<string, string>(); // última firma de EA15 aplicada, por municipio
  private ea15Etag = new Map<string, string>();

  constructor(readonly cfg: TseConfig, http?: TseHttp, store?: TseStore) {
    this.http = http ?? new TseHttp({ minGapMs: cfg.minGapMs, userAgent: cfg.userAgent });
    this.store = store ?? new TseStore(path.join(cfg.dataDir, cfg.env));
  }

  start(): void {
    if (this.timer || this.running) return;
    this.phase = "esperando-catalogo";
    const loop = async () => {
      let delay = this.cfg.pollMs;
      try { delay = await this.cycle(); } catch (e) { this.lastError = e instanceof Error ? e.message : String(e); console.error(`[tse] ciclo falló: ${this.lastError}`); }
      this.nextCycleAt = new Date(Date.now() + delay).toISOString();
      this.timer = setTimeout(loop, delay);
    };
    void loop();
  }
  stop(): void { if (this.timer) clearTimeout(this.timer); this.timer = null; this.phase = "apagado"; this.store.flush(); }

  status(): CollectorStatus {
    const e = this.election;
    return {
      phase: this.http.paused ? "pausado" : this.phase, env: this.cfg.env,
      election: e ? { cycle: e.cycle, pleito: e.pleito, electionId: e.electionId, electionName: e.electionName, round: e.round, cargoName: e.cargoName, date: e.date } : null,
      poll_ms: this.cfg.pollMs, last_cycle_at: this.lastCycleAt, next_cycle_at: this.nextCycleAt, last_update_at: this.store.lastUpdateAt,
      http_paused: this.http.paused, http_pause_reason: this.http.paused ? this.http.pauseReason : null,
      http_paused_until: this.http.paused ? new Date(this.http.pausedUntil).toISOString() : null,
      requests: { ...this.http.totals }, streak_404: this.http.streak404,
      pending_municipalities: this.pendingMun.size, tracked_municipalities: this.tracked.length,
      results_stored: this.store.keys().length, last_error: this.lastError,
    };
  }

  // ---- un ciclo; devuelve el delay hasta el próximo ----
  async cycle(): Promise<number> {
    if (this.running) return this.cfg.pollMs;
    this.running = true;
    try {
      this.lastCycleAt = new Date().toISOString();
      if (this.http.paused) return Math.max(this.cfg.pollMs, this.http.pausedUntil - Date.now() + 1000);
      await this.refreshCatalog();
      const el = this.election;
      if (!el) { this.phase = "esperando-catalogo"; return this.cfg.pollMs; }
      await this.refreshMunicipalities(el);

      // EA14: ¿qué cambió? Un 404 acá significa "todavía no publicado": espera creciente, sin insistir.
      const key = "ea14";
      const out = await this.http.get(urls.ea14(el), { etag: this.store.getAccomp(key)?.etag });
      if (out.skipped) return this.cfg.pollMs;
      if (out.notFound) {
        this.eaMissStreak++;
        this.phase = "esperando-publicacion";
        return Math.min(15 * 60_000, this.cfg.pollMs * 2 ** Math.min(this.eaMissStreak, 4));
      }
      this.eaMissStreak = 0;
      this.phase = "activo";
      const changedUfs = new Set<string>();
      let brChanged = !this.store.get("br");
      if (out.ok && out.body) {
        const prev = this.store.getAccomp(key)?.value;
        const cur = normalizeAccompaniment(out.body);
        this.store.setAccomp(key, cur, out.etag);
        for (const [k, v] of cur.entries) {
          const before = prev?.entries.get(k);
          if (before && before.signature === v.signature) continue;
          if (k === "br") brChanged = true;
          else if (v.type === "uf" && (this.ufList().includes(v.code.toUpperCase()) || this.tracked.some((m) => m.uf === v.code.toUpperCase()))) changedUfs.add(v.code.toUpperCase());
        }
        // Primer ciclo (sin previo): todas las UFs que todavía no tenemos.
        for (const uf of this.ufList()) if (!this.store.get(`uf:${uf}`)) changedUfs.add(uf);
      }
      if (brChanged) await this.fetchEa20(el, { type: "BR", country: "BR", uf: null, municipality_code: null, municipality_ibge: null, name: "Brasil" }, "br", urls.ea20Br(el));
      for (const uf of changedUfs) {
        if (this.http.paused) break;
        if (!this.ufList().includes(uf)) continue; // p. ej. ZZ: sólo se siguen sus municipios, no el agregado
        await this.fetchEa20(el, { type: "UF", country: "BR", uf, municipality_code: null, municipality_ibge: null, name: this.ea12?.ufs.get(uf) ?? uf }, `uf:${uf}`, urls.ea20Uf(el, uf));
      }
      await this.municipalPass(el, changedUfs);
      this.store.flush();
      return this.cfg.pollMs;
    } finally {
      this.running = false;
    }
  }

  private ufList(): string[] { return this.cfg.includeAbroad ? [...UFS, "ZZ"] : [...UFS]; }

  private async refreshCatalog(): Promise<void> {
    if (this.election && Date.now() - this.catalogAt < this.cfg.catalogEveryMs) return;
    const out = await this.http.get(catalogUrl(this.cfg.env), { etag: this.catalogEtag });
    this.catalogAt = Date.now();
    if (out.notModified || !out.ok || !out.body) { if (!out.ok && !out.notModified && !out.skipped) this.lastError = `catálogo: HTTP ${out.status}`; return; }
    this.catalogEtag = out.etag;
    const cat: Ea11 = parseCatalog(JSON.parse(out.body));
    const el = resolveElection(cat, this.cfg.env, { cycle: this.cfg.cycle, pleito: this.cfg.pleito || undefined, round: this.cfg.round, cargo: this.cfg.cargo });
    if (!el) { this.lastError = `el catálogo no tiene ${this.cfg.cycle}${this.cfg.pleito ? ` pleito ${this.cfg.pleito}` : ""} con Presidente (vuelta ${this.cfg.round})`; this.election = null; return; }
    if (!this.election || this.election.electionId !== el.electionId) this.lastError = null;
    this.election = el;
  }

  private async refreshMunicipalities(el: ResolvedElection): Promise<void> {
    if (this.ea12 && Date.now() - this.ea12At < this.cfg.municipalitiesEveryMs) return;
    const out = await this.http.get(urls.ea12(el), { etag: this.ea12Etag });
    this.ea12At = Date.now();
    if (!out.ok || !out.body) return; // 404/304: seguimos con la lista previa (si hay)
    this.ea12Etag = out.etag;
    this.ea12 = normalizeEa12(out.body);
    this.tracked = this.selectTracked(this.ea12);
  }

  private selectTracked(ix: Ea12Index): MunicipalityInfo[] {
    const sel: MunicipalityInfo[] = [];
    for (const s of this.cfg.municipalities) {
      const inUf = ix.municipalities.filter((m) => m.uf === s.uf);
      if (s.all) sel.push(...inUf);
      for (const n of s.names ?? []) { const m = inUf.find((x) => x.name.toUpperCase() === n.toUpperCase()); if (m) sel.push(m); }
    }
    return sel;
  }
  trackedMunicipalities(): MunicipalityInfo[] { return this.tracked; }
  municipality(uf: string, code: string): MunicipalityInfo | undefined {
    const c = code.padStart(5, "0");
    return this.ea12?.municipalities.find((m) => m.uf === uf.toUpperCase() && (m.code === c || m.ibge === code));
  }

  private async fetchEa20(el: ResolvedElection, geography: Geography, key: string, url: string): Promise<boolean> {
    const prev = this.store.get(key);
    const out = await this.http.get(url, { etag: prev?.etag });
    if (!out.ok || !out.body) return false;
    try {
      const r = normalizeEa20(out.body, { el, geography, fetchedAt: out.fetchedAt, lastModified: out.lastModified, url, idg: null });
      this.store.put(key, r, out.body, out.etag);
      return true;
    } catch (e) { this.lastError = `${key}: ${e instanceof Error ? e.message : e}`; return false; }
  }

  /** EA15 de las UFs con municipios seguidos que cambiaron → cola → EA20 municipales con tope por ciclo. */
  private async municipalPass(el: ResolvedElection, changedUfs: Set<string>): Promise<void> {
    // Pocos municipios (≤ SMALL_SET): no hace falta el EA15 (archivo grande, ~0,5–0,9 MB por UF). Cada EA20 municipal pesa ~10 KB
    // y se pide sólo cuando su UF cambió según EA14 (o todavía no lo tenemos); ETag evita rebajarlo si no cambió.
    const ufsTracked = [...new Set(this.tracked.map((m) => m.uf))];
    const small = this.tracked.length <= SMALL_SET;
    for (const uf of ufsTracked) {
      const mine = this.tracked.filter((m) => m.uf === uf);
      if (small) {
        for (const m of mine) {
          const k = `${uf}:${m.code}`;
          if (changedUfs.has(uf) || !this.store.get(`mun:${k}`)) this.pendingMun.add(k);
        }
        continue;
      }
      const needs = changedUfs.has(uf) || mine.some((m) => !this.store.get(`mun:${uf}:${m.code}`) && !this.pendingMun.has(`${uf}:${m.code}`));
      if (!needs || this.http.paused) continue;
      const out = await this.http.get(urls.ea15(el, uf), { etag: this.ea15Etag.get(uf) });
      if (!out.ok || !out.body) continue; // 304: sin cambios; 404: aún no publicado
      if (out.etag) this.ea15Etag.set(uf, out.etag);
      const acc = normalizeAccompaniment(out.body);
      for (const m of mine) {
        const e = acc.entries.get(`mun:${m.code}`);
        if (!e) continue;
        const k = `${uf}:${m.code}`;
        if (this.munSig.get(k) !== e.signature || !this.store.get(`mun:${k}`)) { this.pendingMun.add(k); this.munSig.set(k, e.signature); }
      }
    }
    // Prioridad: capitales/seleccionados por nombre primero, después el resto; hasta `maxFilesPerCycle` por ciclo.
    const queue = [...this.pendingMun].sort((a, b) => Number(!this.isCapital(a)) - Number(!this.isCapital(b)));
    let n = 0;
    for (const k of queue) {
      if (n >= this.cfg.maxFilesPerCycle || this.http.paused) break;
      const [uf, code] = k.split(":") as [string, string];
      const m = this.municipality(uf, code);
      if (!m) { this.pendingMun.delete(k); continue; }
      const ok = await this.fetchEa20(el, { type: "MUNICIPIO", country: "BR", uf, municipality_code: m.code, municipality_ibge: m.ibge, name: m.name }, `mun:${uf}:${m.code}`, urls.ea20Mun(el, uf, m.code));
      n++;
      if (ok || this.store.get(`mun:${uf}:${m.code}`)) this.pendingMun.delete(k);
    }
  }
  private isCapital(k: string): boolean { const [uf, c] = k.split(":") as [string, string]; return !!this.municipality(uf, c)?.capital; }

  // ---- bajo demanda: boletines de urna (EA16 → EA18) ----
  async listSections(uf: string, mun: string): Promise<{ zone: string; sections: { section: string; arrived_at: string | null }[] }[] | { error: string }> {
    const el = this.election; if (!el) return { error: "sin elección resuelta todavía" };
    const out = await this.http.get(urls.ea16(el, uf));
    if (!out.ok || !out.body) return { error: out.skipped ?? `EA16 HTTP ${out.status}` };
    return sectionsOfMunicipality(out.body, uf, mun).map((z) => ({ zone: z.zone, sections: z.sections.map((s) => ({ section: s.section, arrived_at: s.arrived_at })) }));
  }
  async bulletin(uf: string, mun: string, zona: string, secao: string) {
    const el = this.election; if (!el) return { error: "sin elección resuelta todavía" } as const;
    const url = urls.ea18(el, uf, mun, zona, secao);
    const out: FetchOutcome = await this.http.get(url);
    if (!out.ok || !out.body) return { error: out.skipped ?? `EA18 HTTP ${out.status}`, url } as const;
    const b = normalizeEa18(out.body);
    // El BU en sí es binario (.bu, ASN.1) y vive junto al hash: <dir de la sección>/<hash>/<nombre>. Sólo se arma la URL; no se descarga.
    const dir = url.replace(/\/[^/]+$/, "");
    return {
      geography: { uf: uf.toUpperCase(), municipality_code: mun.padStart(5, "0"), zone: zona.padStart(4, "0"), section: secao.padStart(4, "0") },
      aux_url: url, fetched_at: out.fetchedAt, aux_generated_at: b.generated_at, idg: b.idg, section_status: b.section_status,
      files: b.files.map((f) => ({ ...f, url_unverified: `${dir}/${f.hash}/${f.name}`, bulletin_identifier: f.type.toLowerCase() === "bu" ? f.name : null })),
      raw: b.raw,
    } as const;
  }
}
