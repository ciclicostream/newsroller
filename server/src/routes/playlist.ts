import { Router } from "express";
import { TEMPLATES, type ContentType } from "@newsroller/shared";
import { getSupabase } from "../db/supabase.js";
import { requireAuth } from "../auth/middleware.js";

const TYPES: ContentType[] = ["short", "placa", "ad", "background", "data"];
const TEMPLATE_IDS = new Set(TEMPLATES.map((t) => t.id));

export function playlistRouter(): Router {
  const r = Router();
  r.use(requireAuth);
  const sb = () => getSupabase()!;

  r.get("/", async (_req, res) => {
    const { data, error } = await sb().from("playlist_items").select("*").order("sort");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  r.post("/", async (req, res) => {
    const { content_type, content_id, template, duration_sec } = req.body ?? {};
    if (!TYPES.includes(content_type)) return res.status(400).json({ error: "content_type inválido" });
    if (!TEMPLATE_IDS.has(template)) return res.status(400).json({ error: "plantilla inválida" });
    const dur = Number(duration_sec);
    const { data: last } = await sb().from("playlist_items").select("sort").order("sort", { ascending: false }).limit(1).maybeSingle();
    const sort = (last?.sort ?? -1) + 1;
    const { data, error } = await sb()
      .from("playlist_items")
      .insert({
        content_type,
        content_id: content_id ?? null,
        template,
        duration_sec: Number.isFinite(dur) && dur > 0 ? Math.round(dur) : 8,
        sort,
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  });

  r.patch("/:id", async (req, res) => {
    const patch: Record<string, unknown> = {};
    for (const k of ["template", "duration_sec", "enabled", "sort"]) if (k in (req.body ?? {})) patch[k] = req.body[k];
    if ("template" in patch && !TEMPLATE_IDS.has(patch.template as string))
      return res.status(400).json({ error: "plantilla inválida" });
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: "nada para actualizar" });
    const { data, error } = await sb().from("playlist_items").update(patch).eq("id", req.params.id).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "bloque no encontrado" });
    res.json(data);
  });

  r.delete("/:id", async (req, res) => {
    const { error } = await sb().from("playlist_items").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.status(204).end();
  });

  // Reordenar: recibe los ids en el orden deseado y reasigna sort.
  r.post("/reorder", async (req, res) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids)) return res.status(400).json({ error: "ids debe ser un array" });
    for (let i = 0; i < ids.length; i++) {
      const { error } = await sb().from("playlist_items").update({ sort: i }).eq("id", ids[i]);
      if (error) return res.status(500).json({ error: error.message });
    }
    const { data } = await sb().from("playlist_items").select("*").order("sort");
    res.json(data);
  });

  return r;
}
