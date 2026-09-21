import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./db/supabase.js";
import { liveContentItems } from "./db/contentItems.js";
import { logActivity } from "./activity.js";
import { TRASH_DAYS } from "./trash.js";

// Banco unificado: índice `media_files` de toda la media subida. Mientras la migración 0017 no esté
// corrida, todo se degrada (no registra, no lista de más) sin romper nada.

export const UNUSED_DAYS = 60;
export const MEDIA_BUCKETS = ["media", "logos", "ads", "backgrounds"] as const;

let mediaReady: boolean | null = null;
export const isMediaReady = () => mediaReady !== false;
export const markMediaMissing = () => { mediaReady = false; };
export const markMediaReady = () => { mediaReady = true; };
export const isMissingMediaTable = (msg?: string) => !!msg && /media_files/.test(msg) && /(does not exist|schema cache|relation|find the table)/i.test(msg);

export const kindFromMime = (mime: string | null | undefined, name?: string | null): "image" | "video" | "audio" | "other" => {
  const m = (mime ?? "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  const ext = (name ?? "").toLowerCase().split(".").pop() ?? "";
  if (["jpg", "jpeg", "png", "webp", "gif", "svg", "avif"].includes(ext)) return "image";
  if (["mp4", "webm", "mov", "m4v"].includes(ext)) return "video";
  if (["mp3", "wav", "m4a", "ogg", "aac"].includes(ext)) return "audio";
  return "other";
};

// El nombre en Storage es "<timestamp>-<uuid>-<nombre>"; se lo saca para mostrar algo legible.
export const prettyName = (path: string): string => path.replace(/^\d{10,}-[0-9a-f-]{36}-/i, "");

export const titleOfItem = (row: { type?: string; data?: Record<string, unknown> | null }): string => {
  const d = (row.data ?? {}) as Record<string, unknown>;
  return String(d.title ?? d.text ?? d.name ?? d.city ?? row.type ?? "contenido").slice(0, 80);
};

// ---- Uso: qué contenidos referencian cada archivo ----
export interface UsageRef { id: string; type: string; title: string; on_air: boolean; created_by: string | null }
export interface UsageMap {
  byKey: Map<string, UsageRef[]>; // "bucket/path" → contenidos que lo usan
  onAirAssets: Set<string>; // ids de assets al aire (logo global activo, ad/background en la playlist)
}
const URL_RE = /\/object\/public\/([a-z0-9_-]+)\/([A-Za-z0-9._%-]+)/g;

export async function loadUsage(sb: SupabaseClient): Promise<UsageMap> {
  const byKey = new Map<string, UsageRef[]>();
  const onAirAssets = new Set<string>();
  const [{ data: items }, { data: playlist }, { data: placas }, { data: assets }] = await Promise.all([
    liveContentItems(sb, (q) => q.select("id, type, data, created_by")),
    sb.from("playlist_items").select("content_type, content_id").eq("enabled", true),
    sb.from("placas").select("id, title, image_url, created_by"),
    sb.from("assets").select("id, kind, active"),
  ]);
  const onAirItems = new Set((playlist ?? []).filter((p) => p.content_type === "content_item").map((p) => p.content_id as string));
  for (const p of playlist ?? []) if (p.content_type === "ad" || p.content_type === "background") onAirAssets.add(p.content_id as string);
  for (const a of assets ?? []) if (a.kind === "logo" && a.active) onAirAssets.add(a.id as string);

  const add = (text: string, ref: UsageRef) => {
    const seen = new Set<string>();
    for (const m of text.matchAll(URL_RE)) {
      let p = m[2]!;
      try { p = decodeURIComponent(p); } catch { /* deja el path tal cual */ }
      const key = `${m[1]}/${p}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const arr = byKey.get(key) ?? [];
      arr.push(ref);
      byKey.set(key, arr);
    }
  };
  for (const it of items ?? []) {
    add(JSON.stringify(it.data ?? {}), { id: it.id, type: it.type, title: titleOfItem(it), on_air: onAirItems.has(it.id), created_by: it.created_by ?? null });
  }
  for (const p of placas ?? []) if (p.image_url) add(String(p.image_url), { id: p.id, type: "placa", title: String(p.title ?? "placa").slice(0, 80), on_air: false, created_by: p.created_by ?? null });
  return { byKey, onAirAssets };
}

export interface FileUsage { on_air: boolean; count: number; refs: Array<{ id: string; type: string; title: string; on_air: boolean }> }
export function usageOf(u: UsageMap, f: { bucket: string; path: string; asset_id?: string | null }): FileUsage {
  const refs = u.byKey.get(`${f.bucket}/${f.path}`) ?? [];
  const assetAir = !!f.asset_id && u.onAirAssets.has(f.asset_id);
  return {
    on_air: assetAir || refs.some((r) => r.on_air),
    count: refs.length + (assetAir ? 1 : 0),
    refs: refs.slice(0, 5).map(({ id, type, title, on_air }) => ({ id, type, title, on_air })),
  };
}

// ---- Registro y sincronización con Storage ----
export async function registerFile(
  sb: SupabaseClient,
  f: { bucket: string; path: string; name?: string | null; mime?: string | null; size?: number | null; uploaded_by?: string | null; source?: "banco" | "placa" | "importado"; created_at?: string; asset_id?: string | null },
): Promise<{ ok: boolean; row?: Record<string, any> }> {
  if (!isMediaReady()) return { ok: false };
  const { data, error } = await sb.from("media_files").upsert({
    bucket: f.bucket, path: f.path, name: f.name ?? prettyName(f.path), mime: f.mime ?? null, size: f.size ?? null,
    kind: kindFromMime(f.mime, f.name ?? f.path), source: f.source ?? "placa", uploaded_by: f.uploaded_by ?? null,
    ...(f.created_at ? { created_at: f.created_at } : {}), ...(f.asset_id ? { asset_id: f.asset_id } : {}),
  }, { onConflict: "bucket,path", ignoreDuplicates: false }).select().maybeSingle();
  if (error) {
    if (isMissingMediaTable(error.message)) markMediaMissing();
    return { ok: false };
  }
  markMediaReady();
  return { ok: true, row: data ?? undefined };
}

let lastSync = 0;
export const hasSynced = () => lastSync > 0;
let syncing: Promise<number> | null = null;

// Importa lo que hay en los buckets y no está registrado (lo de antes de la migración y cualquier subida
// que no haya pasado por /uploads/register). También liga los `assets` existentes. Devuelve cuántos sumó.
export async function syncFromStorage(sb: SupabaseClient, actor?: Parameters<typeof logActivity>[0], force = false): Promise<number> {
  if (!isMediaReady()) return 0;
  if (!force && Date.now() - lastSync < 5 * 60_000) return 0;
  if (syncing) return syncing;
  syncing = (async () => {
    let added = 0;
    try {
      const have = new Set<string>();
      for (let from = 0; ; from += 1000) {
        const { data: known, error: kErr } = await sb.from("media_files").select("bucket, path").order("created_at").range(from, from + 999);
        if (kErr) { if (isMissingMediaTable(kErr.message)) markMediaMissing(); return 0; }
        for (const k of known ?? []) have.add(`${k.bucket}/${k.path}`);
        if ((known?.length ?? 0) < 1000) break;
      }
      markMediaReady();
      const { data: assets } = await sb.from("assets").select("id, bucket, path, name, mime, size, created_by, created_at");
      const assetByKey = new Map((assets ?? []).map((a) => [`${a.bucket}/${a.path}`, a]));

      const rows: Record<string, unknown>[] = [];
      for (const bucket of MEDIA_BUCKETS) {
        for (let offset = 0; ; offset += 100) {
          const { data: objs, error } = await sb.storage.from(bucket).list("", { limit: 100, offset, sortBy: { column: "created_at", order: "asc" } });
          if (error || !objs?.length) break;
          for (const o of objs) {
            if (!o.name || o.id == null) continue; // carpetas
            const key = `${bucket}/${o.name}`;
            if (have.has(key)) continue;
            const a = assetByKey.get(key);
            const meta = (o.metadata ?? {}) as { size?: number; mimetype?: string };
            const mime = a?.mime ?? meta.mimetype ?? null;
            rows.push({
              bucket, path: o.name, name: a?.name ?? prettyName(o.name), mime, size: a?.size ?? meta.size ?? null,
              kind: kindFromMime(mime, a?.name ?? o.name), source: "importado", asset_id: a?.id ?? null,
              uploaded_by: a?.created_by ?? null, created_at: a?.created_at ?? o.created_at ?? new Date().toISOString(),
            });
          }
          if (objs.length < 100) break;
        }
      }
      for (let i = 0; i < rows.length; i += 200) {
        const { data, error } = await sb.from("media_files").upsert(rows.slice(i, i + 200), { onConflict: "bucket,path", ignoreDuplicates: true }).select("id");
        if (error) { console.warn(`[banco] no se pudo importar: ${error.message}`); break; }
        added += data?.length ?? 0;
      }

      // Ligar assets que ya estaban registrados sin asset_id (p. ej. subidos por el Banco viejo).
      const { data: unlinked } = await sb.from("media_files").select("id, bucket, path").is("asset_id", null).in("bucket", ["logos", "ads"]);
      for (const m of unlinked ?? []) {
        const a = assetByKey.get(`${m.bucket}/${m.path}`);
        if (a) await sb.from("media_files").update({ asset_id: a.id }).eq("id", m.id);
      }

      // Quién subió lo importado sin dato: se infiere del creador del primer contenido que lo usa.
      const { data: orphans } = await sb.from("media_files").select("id, bucket, path").is("uploaded_by", null).limit(2000);
      if (orphans?.length) {
        const usage = await loadUsage(sb);
        for (const m of orphans) {
          const by = usage.byKey.get(`${m.bucket}/${m.path}`)?.find((r) => r.created_by)?.created_by;
          if (by) await sb.from("media_files").update({ uploaded_by: by }).eq("id", m.id);
        }
      }
      lastSync = Date.now();
      if (added > 0) logActivity(actor ?? null, { action: "banco.importar", entity: "media", summary: `Se importaron ${added} archivo(s) del almacenamiento al Banco`, meta: { count: added } });
    } catch (e) {
      console.warn(`[banco] sync falló: ${e instanceof Error ? e.message : e}`);
    }
    return added;
  })().finally(() => { syncing = null; });
  return syncing;
}

// ---- Purga: borra el binario y la fila de lo que lleva más de 30 días en la papelera ----
export async function removeFiles(sb: SupabaseClient, rows: Array<{ id: string; bucket: string; path: string; asset_id?: string | null }>): Promise<number> {
  const byBucket = new Map<string, string[]>();
  for (const r of rows) byBucket.set(r.bucket, [...(byBucket.get(r.bucket) ?? []), r.path]);
  for (const [bucket, paths] of byBucket) await sb.storage.from(bucket).remove(paths);
  const ids = rows.map((r) => r.id);
  const assetIds = rows.map((r) => r.asset_id).filter(Boolean) as string[];
  if (ids.length) await sb.from("media_files").delete().in("id", ids);
  if (assetIds.length) await sb.from("assets").delete().in("id", assetIds);
  return rows.length;
}

export async function purgeOldMedia(): Promise<number> {
  const sb = getSupabase();
  if (!sb || !isMediaReady()) return 0;
  const cutoff = new Date(Date.now() - TRASH_DAYS * 86_400_000).toISOString();
  const { data, error } = await sb.from("media_files").select("id, bucket, path, asset_id").lt("deleted_at", cutoff);
  if (error) { if (isMissingMediaTable(error.message)) markMediaMissing(); return 0; }
  if (!data?.length) return 0;
  const n = await removeFiles(sb, data as any);
  if (n > 0) logActivity(null, { action: "banco.purgar", entity: "media", summary: `Se eliminaron ${n} archivo(s) con más de ${TRASH_DAYS} días en la papelera del Banco`, meta: { count: n, auto: true } });
  return n;
}
