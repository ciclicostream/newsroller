import type { CachedData, SourceId, SourceStatus } from "@newsroller/shared";
import { getStore, type CacheStore } from "../db/store.js";
import { sources } from "./index.js";
import type { DataSource } from "./types.js";

type UpdateHandler = (data: CachedData) => void;

// Agenda cada fuente según su intervalMs, cachea el resultado, trackea estado
// y avisa por callback (que index.ts conecta a Socket.IO).
export class Registry {
  private store: CacheStore = getStore();
  private status = new Map<SourceId, SourceStatus>();
  private timers: NodeJS.Timeout[] = [];
  private onUpdate: UpdateHandler = () => {};

  constructor() {
    for (const s of sources) {
      this.status.set(s.id, {
        id: s.id,
        label: s.label,
        intervalMs: s.intervalMs,
        ok: false,
        lastRunAt: null,
        lastOkAt: null,
        lastError: null,
      });
    }
  }

  setUpdateHandler(fn: UpdateHandler) {
    this.onUpdate = fn;
  }

  getStatuses(): SourceStatus[] {
    return [...this.status.values()];
  }

  storeKind() {
    return this.store.kind;
  }

  // Corre una fuente una vez: fetch -> cache -> emit. Nunca lanza.
  private async runOne(source: DataSource): Promise<void> {
    const st = this.status.get(source.id)!;
    st.lastRunAt = new Date().toISOString();
    try {
      const payload = await source.fetch();
      const data: CachedData = { source: source.id, payload, fetchedAt: new Date().toISOString() };
      await this.store.saveData(data);
      st.ok = true;
      st.lastOkAt = data.fetchedAt;
      st.lastError = null;
      this.onUpdate(data);
      console.log(`[poll] ${source.id} ok`);
    } catch (err) {
      st.ok = false;
      st.lastError = err instanceof Error ? err.message : String(err);
      // Se conserva el último payload bueno en el store: no se pisa con vacío.
      console.error(`[poll] ${source.id} ERROR: ${st.lastError}`);
    }
  }

  // Arranca: corre todas una vez ya, y programa las repeticiones.
  start(): void {
    for (const source of sources) {
      void this.runOne(source);
      const timer = setInterval(() => void this.runOne(source), source.intervalMs);
      this.timers.push(timer);
    }
  }

  stop(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
  }
}
