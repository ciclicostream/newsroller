import { Router } from "express";
import { getSupabase } from "../db/supabase.js";
import { getStore } from "../db/store.js";

// Escena pública para el output (vMix). Sin auth: sólo lectura de lo activo.
export function outputRouter(): Router {
  const r = Router();

  r.get("/scene", async (_req, res) => {
    const sb = getSupabase();
    const store = getStore();

    // Data en vivo (cacheada por los pollers).
    const cached = await store.getAll();
    const data: Record<string, unknown> = {};
    for (const c of cached) data[c.source] = c.payload;

    if (!sb) {
      return res.json({ background: null, logos: [], items: [], data, updatedAt: new Date().toISOString() });
    }

    const publicUrl = (bucket: string, path: string) => sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;

    const [{ data: playlist }, { data: assets }, { data: placas }, { data: shorts }] = await Promise.all([
      sb.from("playlist_items").select("*").eq("enabled", true).order("sort"),
      sb.from("assets").select("*"),
      sb.from("placas").select("*"),
      sb.from("shorts").select("*"),
    ]);

    const assetById = new Map((assets ?? []).map((a) => [a.id, a]));
    const placaById = new Map((placas ?? []).map((p) => [p.id, p]));
    const shortById = new Map((shorts ?? []).map((s) => [s.id, s]));

    // Fondo y logos activos (capas globales).
    const activeBg = (assets ?? []).find((a) => a.kind === "background" && a.active);
    const background = activeBg ? { url: publicUrl(activeBg.bucket, activeBg.path), mime: activeBg.mime } : null;
    const logos = (assets ?? [])
      .filter((a) => a.kind === "logo" && a.active)
      .map((a) => ({ url: publicUrl(a.bucket, a.path), name: a.name }));

    // Resolver cada bloque de la playlist a algo auto-contenido.
    const items = (playlist ?? [])
      .map((it) => {
        const base = { id: it.id, template: it.template, duration_sec: it.duration_sec, content_type: it.content_type };
        switch (it.content_type) {
          case "short": {
            const s = shortById.get(it.content_id);
            if (!s) return null;
            return { ...base, short: { videoId: s.id, title: s.custom_title ?? s.title, thumb: s.thumbnail_url } };
          }
          case "placa": {
            const p = placaById.get(it.content_id);
            if (!p) return null;
            return { ...base, placa: { title: p.title, body: p.body, accent: p.accent } };
          }
          case "ad":
          case "background": {
            const a = assetById.get(it.content_id);
            if (!a) return null;
            return { ...base, media: { url: publicUrl(a.bucket, a.path), mime: a.mime } };
          }
          case "data":
            return { ...base, data: { source: it.content_id } };
          default:
            return null;
        }
      })
      .filter(Boolean);

    res.json({ background, logos, items, data, updatedAt: new Date().toISOString() });
  });

  return r;
}
