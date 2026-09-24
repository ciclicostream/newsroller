import { Router } from "express";
import type { AssetKind } from "@newsroller/shared";
import { getSupabase } from "../db/supabase.js";
import { requireAuth, requirePerm } from "../auth/middleware.js";
import { syncShorts, searchUploads } from "../content/youtube.js";
import { efemeridesDeWikipedia } from "../content/wikipedia.js";
import { logActivity } from "../activity.js";
import { registerFile } from "../media.js";
import { env } from "../config/env.js";

const BUCKETS: Record<AssetKind, string> = {
  background: "backgrounds",
  logo: "logos",
  ad: "ads",
};
const isKind = (v: unknown): v is AssetKind =>
  typeof v === "string" && v in BUCKETS;

// Buckets válidos para SUBIR (firma). Incluye "media": bucket neutro para la media
// embebida en plantillas/placas/última hora. NO usar "ads" para eso: su ruta (/ads/)
// la bloquean los adblockers (uBlock/AdBlock) → la imagen no carga en Chrome.
const UPLOAD_BUCKETS: Record<string, string> = { ...BUCKETS, media: "media" };
const isUploadKind = (v: unknown): v is string =>
  typeof v === "string" && v in UPLOAD_BUCKETS;

const safeName = (name: string) =>
  name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80);

// Gestor de contenidos. Lo usan admin y editor (cualquiera autenticado).
export function contentRouter(): Router {
  const r = Router();
  r.use(requireAuth);

  const sb = () => getSupabase()!;
  const publicUrl = (bucket: string, path: string) =>
    sb().storage.from(bucket).getPublicUrl(path).data.publicUrl;

  // 1) Pedir URL firmada para subir directo a Storage (sin pasar el archivo por el server).
  r.post("/uploads/sign", requirePerm("contenidos"), async (req, res) => {
    const { kind, filename, folder } = req.body ?? {};
    if (!isUploadKind(kind)) return res.status(400).json({ error: "kind inválido" });
    if (typeof filename !== "string" || !filename) return res.status(400).json({ error: "filename requerido" });
    const bucket = UPLOAD_BUCKETS[kind]!; // isUploadKind garantiza que existe
    // `folder: "ajustes"`: media de Ajustes (íconos del clima, logos de plataformas); nunca entra al Banco.
    const path = `${folder === "ajustes" ? "ajustes/" : ""}${Date.now()}-${crypto.randomUUID()}-${safeName(filename)}`;
    const { data, error } = await sb().storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data) return res.status(500).json({ error: error?.message ?? "no se pudo firmar" });
    res.json({ bucket, path: data.path, token: data.token, signedUrl: data.signedUrl });
  });

  // 1b) Registrar en el Banco toda subida (quién, cuándo, tamaño). Lo llama el panel tras subir a Storage.
  // Si la migración del Banco no está corrida, no hace nada (204) y la subida sigue andando.
  r.post("/uploads/register", requirePerm("contenidos"), async (req, res) => {
    const { bucket, path, name, mime, size, source } = req.body ?? {};
    if (typeof bucket !== "string" || !Object.values(UPLOAD_BUCKETS).includes(bucket) || typeof path !== "string" || !path)
      return res.status(400).json({ error: "faltan datos de la subida" });
    const { ok, row } = await registerFile(sb(), {
      bucket, path, name: typeof name === "string" ? name : null, mime: typeof mime === "string" ? mime : null,
      size: Number.isFinite(size) ? Number(size) : null, uploaded_by: req.user!.id, source: source === "banco" ? "banco" : "placa",
    });
    if (!ok) return res.status(204).end();
    const label = typeof name === "string" && name ? name : path;
    logActivity(req.user, { action: "banco.subir", entity: "media", entityId: row?.id ?? null, summary: `Subió "${label}"${source === "banco" ? " al Banco" : ""}`, meta: { bucket, size: Number.isFinite(size) ? Number(size) : null, mime: mime ?? null } });
    res.status(201).json({ id: row?.id ?? null });
  });

  // 2) Registrar la metadata una vez subido el binario.
  r.post("/assets", requirePerm("contenidos"), async (req, res) => {
    const { kind, bucket, path, name, mime, size } = req.body ?? {};
    if (!isKind(kind) || !bucket || !path) return res.status(400).json({ error: "faltan datos del asset" });
    const { data, error } = await sb()
      .from("assets")
      .insert({ kind, bucket, path, name: name ?? null, mime: mime ?? null, size: size ?? null, created_by: req.user!.id })
      .select()
      .single();
    if (error || !data) return res.status(500).json({ error: error?.message ?? "no se pudo guardar" });
    res.status(201).json({ ...data, url: publicUrl(data.bucket, data.path) });
  });

  // Listar assets (opcionalmente por kind).
  r.get("/assets", requirePerm("contenidos"), async (req, res) => {
    const kind = req.query.kind;
    let q = sb().from("assets").select("*").order("sort").order("created_at");
    if (typeof kind === "string" && isKind(kind)) q = q.eq("kind", kind);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json((data ?? []).map((a) => ({ ...a, url: publicUrl(a.bucket, a.path) })));
  });

  // Editar (activar, renombrar, reordenar).
  r.patch("/assets/:id", requirePerm("ajustes"), async (req, res) => {
    const patch: Record<string, unknown> = {};
    for (const k of ["active", "name", "sort", "meta"]) if (k in (req.body ?? {})) patch[k] = req.body[k];
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: "nada para actualizar" });
    const { data, error } = await sb().from("assets").update(patch).eq("id", req.params.id).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "asset no encontrado" });
    res.json({ ...data, url: publicUrl(data.bucket, data.path) });
  });

  // Eliminar (borra el binario en Storage y la fila).
  r.delete("/assets/:id", requirePerm("ajustes"), async (req, res) => {
    const { data: row } = await sb().from("assets").select("bucket, path").eq("id", req.params.id).maybeSingle();
    if (row) await sb().storage.from(row.bucket).remove([row.path]);
    const { error } = await sb().from("assets").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.status(204).end();
  });

  // ---- Placas (texto) ----
  r.get("/placas", requirePerm("contenidos"), async (_req, res) => {
    const { data, error } = await sb().from("placas").select("*").order("sort").order("created_at");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  r.post("/placas", requirePerm("contenidos"), async (req, res) => {
    const { title, body, accent, image_url, image_fit } = req.body ?? {};
    if (typeof title !== "string" || !title.trim()) return res.status(400).json({ error: "el título es obligatorio" });
    const { data, error } = await sb()
      .from("placas")
      .insert({
        title: title.trim(),
        body: body ?? null,
        accent: accent ?? null,
        image_url: image_url ?? null,
        image_fit: image_fit ?? "contain",
        created_by: req.user!.id,
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  });

  r.patch("/placas/:id", requirePerm("contenidos"), async (req, res) => {
    const patch: Record<string, unknown> = {};
    for (const k of ["title", "body", "accent", "active", "sort", "image_url", "image_fit"]) if (k in (req.body ?? {})) patch[k] = req.body[k];
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: "nada para actualizar" });
    const { data, error } = await sb().from("placas").update(patch).eq("id", req.params.id).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "placa no encontrada" });
    res.json(data);
  });

  r.delete("/placas/:id", requirePerm("contenidos"), async (req, res) => {
    const { error } = await sb().from("placas").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.status(204).end();
  });

  // ---- Shorts de YouTube ----
  // Sincronizar con el canal (trae/actualiza shorts, preserva títulos editados).
  r.post("/shorts/sync", requirePerm("ajustes_medios"), async (_req, res) => {
    try {
      const count = await syncShorts(sb());
      const { data } = await sb().from("shorts").select("*").order("published_at", { ascending: false });
      res.json({ synced: count, shorts: data ?? [] });
    } catch (e) {
      res.status(502).json({ error: e instanceof Error ? e.message : "error sincronizando" });
    }
  });

  r.get("/shorts", requirePerm("contenidos"), async (_req, res) => {
    const { data, error } = await sb().from("shorts").select("*").order("published_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  r.patch("/shorts/:id", requirePerm("ajustes_medios"), async (req, res) => {
    const patch: Record<string, unknown> = {};
    for (const k of ["custom_title", "active", "sort"]) if (k in (req.body ?? {})) patch[k] = req.body[k];
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: "nada para actualizar" });
    const { data, error } = await sb().from("shorts").update(patch).eq("id", req.params.id).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "short no encontrado" });
    res.json(data);
  });

  r.delete("/shorts/:id", requirePerm("ajustes_medios"), async (req, res) => {
    const { error } = await sb().from("shorts").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.status(204).end();
  });

  // ---- Efemérides sugeridas desde Wikipedia (días conmemorativos + hechos históricos) ----
  r.get("/efemerides-wikipedia", requirePerm("contenidos"), async (req, res) => {
    const m = /^(\d{2})-(\d{2})$/.exec(typeof req.query.date === "string" ? req.query.date : "");
    const mm = m?.[1], dd = m?.[2];
    if (!mm || !dd || +mm < 1 || +mm > 12 || +dd < 1 || +dd > 31) return res.status(400).json({ error: "date inválida (MM-DD)" });
    try {
      res.json(await efemeridesDeWikipedia(mm, dd));
    } catch (e) {
      res.status(502).json({ error: e instanceof Error ? e.message : "no se pudo consultar Wikipedia" });
    }
  });

  // ---- Búsqueda en uploads del canal (Promos: autoseleccionar por hashtag) ----
  r.get("/youtube-search", requirePerm("contenidos"), async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    try {
      const results = await searchUploads(q);
      res.json(results);
    } catch (e) {
      res.status(502).json({ error: e instanceof Error ? e.message : "error buscando" });
    }
  });

  // ---- Reporte de Publicidad: cuántas veces salió cada aviso al aire en un período ----
  r.get("/report/publicidad", requirePerm("reportes"), async (req, res) => {
    const from = typeof req.query.from === "string" ? req.query.from : new Date(Date.now() - 30 * 86400_000).toISOString();
    const to = typeof req.query.to === "string" ? req.query.to : new Date().toISOString();
    const { data, error } = await sb()
      .from("airings")
      .select("content_item_id")
      .gte("played_at", from)
      .lte("played_at", to);
    if (error) return res.status(500).json({ error: error.message });
    const counts = new Map<string, number>();
    for (const row of data ?? []) counts.set(row.content_item_id, (counts.get(row.content_item_id) ?? 0) + 1);
    res.json({ from, to, counts: Object.fromEntries(counts) });
  });

  // ---- Cámaras ----
  r.get("/cameras", requirePerm("contenidos"), async (_req, res) => {
    const { data, error } = await sb().from("cameras").select("*").order("sort").order("created_at");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  r.post("/cameras", requirePerm("camaras"), async (req, res) => {
    const { name, city, type, url } = req.body ?? {};
    if (!["youtube", "hls", "image", "iframe"].includes(type)) return res.status(400).json({ error: "type inválido" });
    if (typeof name !== "string" || !name.trim() || typeof url !== "string" || !url.trim())
      return res.status(400).json({ error: "faltan nombre o url" });
    const { data, error } = await sb()
      .from("cameras")
      .insert({ name: name.trim(), city: city ?? null, type, url: url.trim() })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    logActivity(req.user, { action: "camara.crear", entity: "camara", entityId: data.id, summary: `Agregó la cámara "${data.name}"` });
    res.status(201).json(data);
  });

  r.patch("/cameras/:id", requirePerm("camaras"), async (req, res) => {
    const patch: Record<string, unknown> = {};
    for (const k of ["name", "city", "type", "url", "active", "sort"]) if (k in (req.body ?? {})) patch[k] = req.body[k];
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: "nada para actualizar" });
    const { data, error } = await sb().from("cameras").update(patch).eq("id", req.params.id).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "cámara no encontrada" });
    logActivity(req.user, { action: "camara.editar", entity: "camara", entityId: data.id, summary: `Editó la cámara "${data.name}"` });
    res.json(data);
  });

  r.delete("/cameras/:id", requirePerm("camaras"), async (req, res) => {
    const { error } = await sb().from("cameras").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    logActivity(req.user, { action: "camara.borrar", entity: "camara", entityId: req.params.id as string, summary: "Borró una cámara" });
    res.status(204).end();
  });

  // Buscar cámaras en Windy por ciudad (geocoding + nearby). Devuelve imágenes que se actualizan.
  r.get("/windy", requirePerm("camaras"), async (req, res) => {
    if (!env.windyApiKey) return res.status(400).json({ error: "falta WINDY_API_KEY" });
    const city = String(req.query.city ?? "").trim();
    if (!city) return res.status(400).json({ error: "indicá una ciudad" });
    try {
      const geo = (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=es`).then((r) => r.json())) as any;
      const hit = geo.results?.[0];
      if (!hit) return res.status(404).json({ error: "ciudad no encontrada" });
      const url = `https://api.windy.com/webcams/api/v3/webcams?nearby=${hit.latitude},${hit.longitude},50&limit=12&include=images,location`;
      const w = (await fetch(url, { headers: { "x-windy-api-key": env.windyApiKey } }).then((r) => r.json())) as any;
      const cams = (w.webcams ?? []).map((c: any) => ({
        webcamId: c.webcamId,
        title: c.title,
        city: c.location?.city ?? city,
        preview: c.images?.current?.preview ?? null,
      })).filter((c: any) => c.preview);
      res.json({ city: hit.name, cameras: cams });
    } catch (e) {
      res.status(502).json({ error: e instanceof Error ? e.message : "error consultando Windy" });
    }
  });

  return r;
}
