import { Router } from "express";
import { getSupabase } from "../db/supabase.js";
import { requireAuth } from "../auth/middleware.js";

// Tipos válidos del banco de contenidos 2026. Se irán sumando a medida que se porten.
const TYPES = new Set([
  "ultima_hora",
  "dolar",
  "cifras",
  "efemerides",
  "cartelera",
  "declaraciones",
  "shorts",
  "informe",
  "publicidad",
  "video_full",
  "promos",
  "camaras",
  "clima",
  "placas",
]);

// Banco de contenidos tipados (ultima_hora, etc.). Cualquiera autenticado.
export function contentItemsRouter(): Router {
  const r = Router();
  r.use(requireAuth);
  const sb = () => getSupabase()!;

  r.get("/", async (req, res) => {
    let q = sb().from("content_items").select("*").order("sort").order("created_at", { ascending: false });
    if (typeof req.query.type === "string") q = q.eq("type", req.query.type);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  r.post("/", async (req, res) => {
    const { type, data, duration_sec } = req.body ?? {};
    if (!TYPES.has(type)) return res.status(400).json({ error: "type inválido" });
    if (data == null || typeof data !== "object") return res.status(400).json({ error: "data requerido" });
    const dur = Number(duration_sec);
    const { data: row, error } = await sb()
      .from("content_items")
      .insert({
        type,
        data,
        duration_sec: Number.isFinite(dur) && dur > 0 ? Math.round(dur) : 8,
        created_by: req.user!.id,
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(row);
  });

  r.patch("/:id", async (req, res) => {
    const patch: Record<string, unknown> = {};
    for (const k of ["data", "duration_sec", "active", "in_parrilla", "sort"]) if (k in (req.body ?? {})) patch[k] = req.body[k];
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: "nada para actualizar" });
    const { data, error } = await sb().from("content_items").update(patch).eq("id", req.params.id).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "contenido no encontrado" });
    res.json(data);
  });

  r.delete("/:id", async (req, res) => {
    const { error } = await sb().from("content_items").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.status(204).end();
  });

  return r;
}
