import { Router } from "express";
import type { AssetKind } from "@newsroller/shared";
import { getSupabase } from "../db/supabase.js";
import { requireAuth } from "../auth/middleware.js";
import { syncShorts } from "../content/youtube.js";

const BUCKETS: Record<AssetKind, string> = {
  background: "backgrounds",
  logo: "logos",
  ad: "ads",
};
const isKind = (v: unknown): v is AssetKind =>
  typeof v === "string" && v in BUCKETS;

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
  r.post("/uploads/sign", async (req, res) => {
    const { kind, filename } = req.body ?? {};
    if (!isKind(kind)) return res.status(400).json({ error: "kind inválido" });
    if (typeof filename !== "string" || !filename) return res.status(400).json({ error: "filename requerido" });
    const bucket = BUCKETS[kind];
    const path = `${Date.now()}-${crypto.randomUUID()}-${safeName(filename)}`;
    const { data, error } = await sb().storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data) return res.status(500).json({ error: error?.message ?? "no se pudo firmar" });
    res.json({ bucket, path: data.path, token: data.token, signedUrl: data.signedUrl });
  });

  // 2) Registrar la metadata una vez subido el binario.
  r.post("/assets", async (req, res) => {
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
  r.get("/assets", async (req, res) => {
    const kind = req.query.kind;
    let q = sb().from("assets").select("*").order("sort").order("created_at");
    if (typeof kind === "string" && isKind(kind)) q = q.eq("kind", kind);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json((data ?? []).map((a) => ({ ...a, url: publicUrl(a.bucket, a.path) })));
  });

  // Editar (activar, renombrar, reordenar).
  r.patch("/assets/:id", async (req, res) => {
    const patch: Record<string, unknown> = {};
    for (const k of ["active", "name", "sort", "meta"]) if (k in (req.body ?? {})) patch[k] = req.body[k];
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: "nada para actualizar" });
    const { data, error } = await sb().from("assets").update(patch).eq("id", req.params.id).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "asset no encontrado" });
    res.json({ ...data, url: publicUrl(data.bucket, data.path) });
  });

  // Eliminar (borra el binario en Storage y la fila).
  r.delete("/assets/:id", async (req, res) => {
    const { data: row } = await sb().from("assets").select("bucket, path").eq("id", req.params.id).maybeSingle();
    if (row) await sb().storage.from(row.bucket).remove([row.path]);
    const { error } = await sb().from("assets").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.status(204).end();
  });

  // ---- Placas (texto) ----
  r.get("/placas", async (_req, res) => {
    const { data, error } = await sb().from("placas").select("*").order("sort").order("created_at");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  r.post("/placas", async (req, res) => {
    const { title, body, accent } = req.body ?? {};
    if (typeof title !== "string" || !title.trim()) return res.status(400).json({ error: "el título es obligatorio" });
    const { data, error } = await sb()
      .from("placas")
      .insert({ title: title.trim(), body: body ?? null, accent: accent ?? null, created_by: req.user!.id })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  });

  r.patch("/placas/:id", async (req, res) => {
    const patch: Record<string, unknown> = {};
    for (const k of ["title", "body", "accent", "active", "sort"]) if (k in (req.body ?? {})) patch[k] = req.body[k];
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: "nada para actualizar" });
    const { data, error } = await sb().from("placas").update(patch).eq("id", req.params.id).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "placa no encontrada" });
    res.json(data);
  });

  r.delete("/placas/:id", async (req, res) => {
    const { error } = await sb().from("placas").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.status(204).end();
  });

  // ---- Shorts de YouTube ----
  // Sincronizar con el canal (trae/actualiza shorts, preserva títulos editados).
  r.post("/shorts/sync", async (_req, res) => {
    try {
      const count = await syncShorts(sb());
      const { data } = await sb().from("shorts").select("*").order("published_at", { ascending: false });
      res.json({ synced: count, shorts: data ?? [] });
    } catch (e) {
      res.status(502).json({ error: e instanceof Error ? e.message : "error sincronizando" });
    }
  });

  r.get("/shorts", async (_req, res) => {
    const { data, error } = await sb().from("shorts").select("*").order("published_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  r.patch("/shorts/:id", async (req, res) => {
    const patch: Record<string, unknown> = {};
    for (const k of ["custom_title", "active", "sort"]) if (k in (req.body ?? {})) patch[k] = req.body[k];
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: "nada para actualizar" });
    const { data, error } = await sb().from("shorts").update(patch).eq("id", req.params.id).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "short no encontrado" });
    res.json(data);
  });

  r.delete("/shorts/:id", async (req, res) => {
    const { error } = await sb().from("shorts").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.status(204).end();
  });

  return r;
}
