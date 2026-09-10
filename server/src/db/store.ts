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

  async getData(source: SourceId): Promise<CachedData | null> {
    const local = this.mirror.get(source);
    if (local) return local;
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb
      .from("data_cache")
      .select("source, payload, fetched_at")
      .eq("source", source)
      .maybeSingle();
    if (error || !data) return null;
    return { source: data.source, payload: data.payload, fetchedAt: data.fetched_at };
  }

  async getAll(): Promise<CachedData[]> {
    if (this.mirror.size) return [...this.mirror.values()];
    const sb = getSupabase();
    if (!sb) return [];
    const { data, error } = await sb.from("data_cache").select("source, payload, fetched_at");
    if (error || !data) return [];
    return data.map((r) => ({ source: r.source, payload: r.payload, fetchedAt: r.fetched_at }));
  }
}

let store: CacheStore | null = null;

export function getStore(): CacheStore {
  if (!store) store = getSupabase() ? new SupabaseStore() : new MemoryStore();
  return store;
}
