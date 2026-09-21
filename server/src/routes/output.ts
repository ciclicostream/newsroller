import { Router } from "express";
import { getSupabase } from "../db/supabase.js";
import { getStore } from "../db/store.js";
import { liveContentItems } from "../db/contentItems.js";
import { rateLimited } from "../util/rateLimit.js";
import { outputIncident } from "../incidents.js";

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

    const [{ data: playlist }, { data: assets }, { data: placas }, { data: shorts }, { data: templates }, { data: cameras }, { data: contentItems }] =
      await Promise.all([
        sb.from("playlist_items").select("*").eq("enabled", true).order("sort"),
        sb.from("assets").select("*"),
        sb.from("placas").select("*"),
        sb.from("shorts").select("*"),
        sb.from("templates").select("*"),
        sb.from("cameras").select("*"),
        liveContentItems(sb, (q) => q.select("*")),
      ]);

    const assetById = new Map((assets ?? []).map((a) => [a.id, a]));
    const placaById = new Map((placas ?? []).map((p) => [p.id, p]));
    const shortById = new Map((shorts ?? []).map((s) => [s.id, s]));
    const templateById = new Map((templates ?? []).map((t) => [t.id, t]));
    const itemById = new Map((contentItems ?? []).map((c) => [c.id, c]));

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
            return { ...base, placa: { title: p.title, body: p.body, accent: p.accent, image_url: p.image_url, image_fit: p.image_fit } };
          }
          case "ad":
          case "background": {
            const a = assetById.get(it.content_id);
            if (!a) return null;
            return { ...base, media: { url: publicUrl(a.bucket, a.path), mime: a.mime } };
          }
          case "data":
            return { ...base, data: { source: it.content_id } };
          case "template": {
            const t = templateById.get(it.content_id);
            if (!t) return null;
            return { ...base, tpl: { id: t.id, name: t.name, background: t.background, elements: t.elements } };
          }
          case "content_item": {
            const ci = itemById.get(it.content_id);
            if (!ci) return null;
            return { ...base, item: { id: ci.id, type: ci.type, data: ci.data } };
          }
          default:
            return null;
        }
      })
      .filter(Boolean);

    res.json({ background, logos, items, data, cameras: cameras ?? [], updatedAt: new Date().toISOString() });
  });

  // Preview público de un contenido tipado del banco (para el MONITOR del panel).
  r.get("/item/:id", async (req, res) => {
    const sb = getSupabase();
    if (!sb) return res.status(404).json({ error: "sin base" });
    const { data } = await sb.from("content_items").select("type, data, duration_sec").eq("id", req.params.id).maybeSingle();
    if (!data) return res.status(404).json({ error: "no encontrado" });
    res.json({ type: data.type, data: data.data, duration_sec: data.duration_sec });
  });

  // Registra una salida al aire de un contenido (cualquier tipo) para los reportes.
  // Lo llama el output real (OBS/vMix) cuando un bloque empieza; el monitor del panel no cuenta.
  let airingOrientationCol = true; // false si falta la migración 0019 (no se guarda la orientación)
  let airingExtraCols = true; // false si falta la migración 0018 (se registra sólo el id, como antes)
  r.post("/airing", async (req, res) => {
    const sb = getSupabase();
    if (!sb) return res.status(204).end();
    if (rateLimited(`airing:${req.ip}`, 240, 60_000)) return res.status(429).end();
    const contentItemId = req.body?.content_item_id;
    if (typeof contentItemId !== "string" || !contentItemId) return res.status(400).json({ error: "content_item_id requerido" });
    let type = typeof req.body?.content_type === "string" ? req.body.content_type.slice(0, 40) : null;
    if (!type) {
      const { data } = await sb.from("content_items").select("type").eq("id", contentItemId).maybeSingle();
      type = data?.type ?? null;
    }
    const dur = Number(req.body?.duration_sec);
    const row: Record<string, unknown> = { content_item_id: contentItemId };
    if (airingExtraCols) {
      row.content_type = type; row.duration_sec = Number.isFinite(dur) && dur > 0 ? Math.round(dur) : null;
      if (airingOrientationCol) row.orientation = req.body?.orientation === "vertical" ? "vertical" : "horizontal";
    }
    let { error } = await sb.from("airings").insert(row);
    if (error && airingOrientationCol && /orientation/.test(error.message)) {
      airingOrientationCol = false;
      delete row.orientation;
      ({ error } = await sb.from("airings").insert(row));
    }
    if (error && airingExtraCols && /content_type|duration_sec/.test(error.message)) {
      airingExtraCols = false;
      ({ error } = await sb.from("airings").insert({ content_item_id: contentItemId }));
    }
    if (error) return res.status(204).end(); // p. ej. el contenido ya no existe: no es un error del output
    res.status(204).end();
  });

  // Problemas que detecta el output al aire: cámara sin señal, foto/video que no carga.
  r.post("/incident", async (req, res) => {
    if (rateLimited(`incident:${req.ip}`, 60, 60_000)) return res.status(429).end();
    const b = req.body ?? {};
    if ((b.kind !== "camara" && b.kind !== "media") || typeof b.key !== "string" || !b.key) return res.status(400).json({ error: "datos inválidos" });
    void outputIncident({
      kind: b.kind, key: b.key.slice(0, 500), label: typeof b.label === "string" ? b.label : undefined,
      detail: typeof b.detail === "string" ? b.detail : undefined, item_id: typeof b.item_id === "string" ? b.item_id : null,
    });
    res.status(204).end();
  });

  return r;
}
