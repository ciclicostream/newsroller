import { Router } from "express";
import { getSupabase } from "../db/supabase.js";
import { getStore } from "../db/store.js";
import { liveContentItems } from "../db/contentItems.js";
import { rateLimited } from "../util/rateLimit.js";
import { outputIncident } from "../incidents.js";
import { resolveSceneItems } from "../db/scene.js";

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

    const [{ data: playlist }, { data: cameras }] = await Promise.all([
      sb.from("playlist_items").select("*").eq("enabled", true).order("sort"),
      sb.from("cameras").select("*"),
    ]);
    const { items, background, logos } = await resolveSceneItems(sb, playlist ?? []);

    res.json({ background, logos, items, data, cameras: cameras ?? [], updatedAt: new Date().toISOString() });
  });

  // Escena del BORRADOR (parrilla_draft, lo que todavía no se publicó al aire). Misma forma que /scene;
  // la usa el Monitor de Emisión en PREVIEW para rotar la lista completa (con música de fondo y todo)
  // antes de mandarla al aire real. Sin auth (como /scene): sólo lectura de lo que ya se está editando.
  r.get("/draft-scene", async (_req, res) => {
    const sb = getSupabase();
    const store = getStore();
    const cached = await store.getAll();
    const data: Record<string, unknown> = {};
    for (const c of cached) data[c.source] = c.payload;

    if (!sb) return res.json({ background: null, logos: [], items: [], data, updatedAt: new Date().toISOString() });

    const [{ data: draftRows }, { data: cameras }] = await Promise.all([
      sb.from("parrilla_draft").select("*").eq("enabled", true).order("sort"),
      sb.from("cameras").select("*"),
    ]);
    const { items, background, logos } = await resolveSceneItems(sb, draftRows ?? []);

    res.json({ background, logos, items, data, cameras: cameras ?? [], updatedAt: new Date().toISOString() });
  });

  // Escena pública de una Sesión (misma forma que /scene, pero de session_items). Sin auth: es lo que
  // abre OBS/el celular en /output/?session=<id>. `active=false` => el output muestra la placa fija.
  r.get("/session/:id/scene", async (req, res) => {
    const sb = getSupabase();
    const store = getStore();
    const cached = await store.getAll();
    const data: Record<string, unknown> = {};
    for (const c of cached) data[c.source] = c.payload;

    if (!sb) return res.json({ active: true, background: null, logos: [], items: [], data, updatedAt: new Date().toISOString() });

    const { data: session } = await sb.from("sessions").select("*").eq("id", req.params.id).maybeSingle();
    if (!session) return res.status(404).json({ error: "sesión no encontrada" });

    const [{ data: rows }, { data: cameras }] = await Promise.all([
      sb.from("session_items").select("*").eq("session_id", session.id).eq("enabled", true).order("sort"),
      sb.from("cameras").select("*"),
    ]);
    const { items, background, logos } = await resolveSceneItems(sb, rows ?? []);

    res.json({ active: session.active !== false, background, logos, items, data, cameras: cameras ?? [], updatedAt: new Date().toISOString() });
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
  let airingSessionCol = true; // false si falta la migración 0020 (no se guarda la sesión)
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
      if (airingSessionCol && typeof req.body?.session_id === "string" && req.body.session_id) row.session_id = req.body.session_id;
    }
    let { error } = await sb.from("airings").insert(row);
    if (error && airingSessionCol && /session_id/.test(error.message)) {
      airingSessionCol = false;
      delete row.session_id;
      ({ error } = await sb.from("airings").insert(row));
    }
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
