import { Router } from "express";
import { LAYOUTS, type ContentType } from "@newsroller/shared";
import { getSupabase } from "../db/supabase.js";
import { requireAuth, requirePermByMethod } from "../auth/middleware.js";
import type { IO } from "../realtime/socket.js";
import { writeSettings, readAll } from "./settings.js";

const TYPES: ContentType[] = ["short", "placa", "ad", "background", "data", "template", "content_item"];
const TEMPLATE_IDS = new Set(LAYOUTS.map((t) => t.id));
const SELF_LAYOUT = new Set<ContentType>(["template", "content_item"]);

// Parrilla en BORRADOR (parrilla_draft). Se publica a playlist_items (el aire) con /publish.
export function parrillaRouter(io: IO): Router {
  const r = Router();
  // Ver: quien crea o programa. Modificar (armar la parrilla, publicar): sólo quien programa.
  r.use(requireAuth, requirePermByMethod(["contenidos", "programar"], ["programar"]));
  const sb = () => getSupabase()!;

  // Lista el borrador. Si está vacío, lo siembra con lo que está al aire (playlist_items).
  r.get("/", async (_req, res) => {
    const { data, error } = await sb().from("parrilla_draft").select("*").order("sort");
    if (error) return res.status(500).json({ error: error.message });
    if (data && data.length > 0) return res.json(data);

    const { data: live } = await sb().from("playlist_items").select("*").order("sort");
    if (live && live.length > 0) {
      const rows = live.map((l, i) => ({
        content_type: l.content_type, content_id: l.content_id, template: l.template,
        duration_sec: l.duration_sec, enabled: l.enabled, sort: i,
      }));
      const { data: seeded, error: e2 } = await sb().from("parrilla_draft").insert(rows).select();
      if (e2) return res.status(500).json({ error: e2.message });
      return res.json((seeded ?? []).sort((a, b) => a.sort - b.sort));
    }
    res.json([]);
  });

  r.post("/", async (req, res) => {
    const { content_type, content_id, template, duration_sec } = req.body ?? {};
    if (!TYPES.includes(content_type)) return res.status(400).json({ error: "content_type inválido" });
    const tmpl = SELF_LAYOUT.has(content_type) ? "custom" : template;
    if (!SELF_LAYOUT.has(content_type) && !TEMPLATE_IDS.has(template))
      return res.status(400).json({ error: "layout inválido" });
    const dur = Number(duration_sec);
    const { data: last } = await sb().from("parrilla_draft").select("sort").order("sort", { ascending: false }).limit(1).maybeSingle();
    const sort = (last?.sort ?? -1) + 1;
    const { data, error } = await sb()
      .from("parrilla_draft")
      .insert({ content_type, content_id: content_id ?? null, template: tmpl, duration_sec: Number.isFinite(dur) && dur > 0 ? Math.round(dur) : 8, sort })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  });

  r.patch("/:id", async (req, res) => {
    const patch: Record<string, unknown> = {};
    for (const k of ["template", "duration_sec", "enabled", "sort"]) if (k in (req.body ?? {})) patch[k] = req.body[k];
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: "nada para actualizar" });
    const { data, error } = await sb().from("parrilla_draft").update(patch).eq("id", req.params.id).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "bloque no encontrado" });
    res.json(data);
  });

  r.delete("/:id", async (req, res) => {
    const { error } = await sb().from("parrilla_draft").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.status(204).end();
  });

  r.post("/reorder", async (req, res) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids)) return res.status(400).json({ error: "ids debe ser un array" });
    for (let i = 0; i < ids.length; i++) {
      const { error } = await sb().from("parrilla_draft").update({ sort: i }).eq("id", ids[i]);
      if (error) return res.status(500).json({ error: error.message });
    }
    const { data } = await sb().from("parrilla_draft").select("*").order("sort");
    res.json(data);
  });

  // Publicar: el borrador reemplaza lo que está al aire (playlist_items).
  r.post("/publish", async (_req, res) => {
    const { data: draft, error } = await sb().from("parrilla_draft").select("*").order("sort");
    if (error) return res.status(500).json({ error: error.message });
    const rows = (draft ?? []).map((d, i) => ({
      content_type: d.content_type, content_id: d.content_id, template: d.template,
      duration_sec: d.duration_sec, enabled: d.enabled, sort: i,
    }));
    // Reemplazo total: borro el aire actual e inserto el borrador.
    const { error: delErr } = await sb().from("playlist_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (delErr) return res.status(500).json({ error: delErr.message });
    if (rows.length > 0) {
      const { error: insErr } = await sb().from("playlist_items").insert(rows);
      if (insErr) return res.status(500).json({ error: insErr.message });
    }
    // Estampa "al aire desde" para el reloj del Monitor (persiste entre refrescos
    // del navegador). No bloquea la respuesta si esto falla por algún motivo.
    // Con el canal cortado sólo se prepara la parrilla: el reloj queda congelado.
    try {
      const st = await readAll();
      if (st.onAir !== false) await writeSettings(io, { airSince: new Date().toISOString() });
    } catch { /* noop */ }
    res.json({ ok: true, count: rows.length });
  });

  return r;
}
