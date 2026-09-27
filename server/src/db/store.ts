import type { CachedData, SourceId } from "@newsroller/shared";
import { getSupabase } from "./supabase.js";

// Abstracción de cache: memoria (default) o Supabase (si hay credenciales).
// El resto del código no sabe cuál está activa.
export interface CacheStore {
  kind: "memory" | "supabase";
  saveData(data: CachedData): Promise<void>;
  getData(source: SourceId): Promise<CachedData | null>;
  getAll(): Promise<CachedData[]>;
}

class MemoryStore implements CacheStore {
  kind = "memory" as const;
  private map = new Map<string, CachedData>();

  async saveData(data: CachedData): Promise<void> {
    this.map.set(data.source, data);
  }
  async getData(source: SourceId): Promise<CachedData | null> {
    return this.map.get(source) ?? null;
  }
  async getAll(): Promise<CachedData[]> {
    return [...this.map.values()];
  }
}

class SupabaseStore implements CacheStore {
  kind = "supabase" as const;
  // Fallback en memoria para lecturas inmediatas y si Supabase falla puntualmente.
  private mirror = new Map<string, CachedData>();

  async saveData(data: CachedData): Promise<void> {
    this.mirror.set(data.source, data);
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb
      .from("data_cache")
      .upsert(
        { source: data.source, payload: data.payload, fetched_at: data.fetchedAt },
        { onConflict: "source" },
      );
    if (error) throw new Error(`supabase upsert ${data.source}: ${error.message}`);
  }

  // Tras un reinicio el espejo arranca vacío y cada fuente lo va llenando a medida que termina su primera consulta
  // (el clima tarda: son 24 capitales). Antes, con una sola fuente ya cargada, getAll devolvía sólo esa y el resto
  // (clima incluido) faltaba hasta su primer poll. Ahora se hidrata UNA vez desde la base con lo último guardado;
  // lo que llegue fresco de un poller siempre pisa lo hidratado.
  private hydrating: Promise<void> | null = null;
  private hydrate(): Promise<void> {
    this.hydrating ??= (async () => {
      const sb = getSupabase();
      if (!sb) return;
      const { data, error } = await sb.from("data_cache").select("source, payload, fetched_at");
      if (error || !data) { this.hydrating = null; return; } // se reintenta en la próxima lectura
      for (const r of data) if (!this.mirror.has(r.source)) this.mirror.set(r.source, { source: r.source, payload: r.payload, fetchedAt: r.fetched_at });
    })();
    return this.hydrating;
  }

  async getData(source: SourceId): Promise<CachedData | null> {
    await this.hydrate();
    return this.mirror.get(source) ?? null;
  }

  async getAll(): Promise<CachedData[]> {
    await this.hydrate();
    return [...this.mirror.values()];
  }
}

let store: CacheStore | null = null;

export function getStore(): CacheStore {
  if (!store) store = getSupabase() ? new SupabaseStore() : new MemoryStore();
  return store;
}
