import { Router } from "express";
import { getSupabase } from "../db/supabase.js";
import { requireAuth } from "../auth/middleware.js";

// CRUD de plantillas (editor visual). Cualquier usuario autenticado.
export function templatesRouter(): Router {
  const r = Router();
  r.use(requireAuth);
  const sb = () => getSupabase()!;

  r.get("/", async (_req, res) => {
    const { data, error } = await sb().from("templates").select("*").order("updated_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  r.get("/:id", async (req, res) => {
    const { data, error } = await sb().from("templates").select("*").eq("id", req.params.id).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "plantilla no encontrada" });
    res.json(data);
  });

  r.post("/", async (req, res) => {
    const { name, background, elements } = req.body ?? {};
    const { data, error } = await sb()
      .from("templates")
      .insert({
        name: typeof name === "string" && name.trim() ? name.trim() : "Plantilla",
        background: background ?? { type: "color", value: "#ffffff" },
        elements: Array.isArray(elements) ? elements : [],
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  });

  r.put("/:id", async (req, res) => {
    const { name, background, elements } = req.body ?? {};
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) patch.name = name;
    if (background !== undefined) patch.background = background;
    if (elements !== undefined) patch.elements = elements;
    const { data, error } = await sb().from("templates").update(patch).eq("id", req.params.id).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "plantilla no encontrada" });
    res.json(data);
  });

  r.delete("/:id", async (req, res) => {
    const { error } = await sb().from("templates").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.status(204).end();
  });

  return r;
}
