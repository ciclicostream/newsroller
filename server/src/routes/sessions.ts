import { Router, type NextFunction, type Request, type Response } from "express";
import { LAYOUTS, type ContentType } from "@newsroller/shared";
import { getSupabase } from "../db/supabase.js";
import { requireAuth, requirePerm } from "../auth/middleware.js";
import type { IO } from "../realtime/socket.js";
import { logActivity } from "../activity.js";

const TYPES: ContentType[] = ["short", "placa", "ad", "background", "data", "template", "content_item"];
const TEMPLATE_IDS = new Set(LAYOUTS.map((t) => t.id));
const SELF_LAYOUT = new Set<ContentType>(["template", "content_item"]);

// Sesiones: playlists independientes del aire principal, cada una con su propia URL de salida
// (/output/?session=<id>). Master y Administrador ven y gestionan todas; Programador y Generador
// sólo las que un Administrador les asignó en session_managers.
export function sessionsRouter(io: IO): Router {
  const r = Router();
  r.use(requireAuth, requirePerm("sesiones"));
  const sb = () => getSupabase()!;
  const isAdmin = (req: Request) => req.user!.role === "master" || req.user!.role === "administrador";

  // ¿Puede esta persona gestionar el CONTENIDO de la sesión (agregar/ordenar/detener)?
  async function canManage(req: Request, sessionId: string): Promise<boolean> {
    if (isAdmin(req)) return true;
    const { data } = await sb().from("session_managers").select("user_id").eq("session_id", sessionId).eq("user_id", req.user!.id).maybeSingle();
    return !!data;
  }
  const manageGuard = async (req: Request, res: Response, next: NextFunction) => {
    if (!(await canManage(req, req.params.id as string))) return res.status(403).json({ error: "no gestionás esta sesión", code: "forbidden" });
    next();
  };

  // Lista: Master/Administrador ven todas; el resto, sólo las suyas.
  r.get("/", async (req, res) => {
    const client = sb();
    let ids: string[] | null = null;
    if (!isAdmin(req)) {
      const { data: mine } = await client.from("session_managers").select("session_id").eq("user_id", req.user!.id);
      ids = (mine ?? []).map((m) => m.session_id as string);
      if (ids.length === 0) return res.json([]);
    }
    let q = client.from("sessions").select("*").order("created_at", { ascending: false });
    if (ids) q = q.in("id", ids);
    const { data: sessions, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    const sessionIds = (sessions ?? []).map((s) => s.id);
    const [{ data: counts }, { data: managers }] = await Promise.all([
      sessionIds.length ? client.from("session_items").select("session_id, duration_sec").in("session_id", sessionIds) : Promise.resolve({ data: [] as { session_id: string; duration_sec: number }[] }),
      sessionIds.length ? client.from("session_managers").select("session_id, user_id").in("session_id", sessionIds) : Promise.resolve({ data: [] as { session_id: string; user_id: string }[] }),
    ]);
    const countBy = new Map<string, number>();
    const durBy = new Map<string, number>();
    for (const c of counts ?? []) { countBy.set(c.session_id, (countBy.get(c.session_id) ?? 0) + 1); durBy.set(c.session_id, (durBy.get(c.session_id) ?? 0) + (c.duration_sec ?? 0)); }
    const managersBy = new Map<string, string[]>();
    for (const m of managers ?? []) managersBy.set(m.session_id, [...(managersBy.get(m.session_id) ?? []), m.user_id]);
    res.json((sessions ?? []).map((s) => ({ ...s, item_count: countBy.get(s.id) ?? 0, total_duration_sec: durBy.get(s.id) ?? 0, manager_ids: managersBy.get(s.id) ?? [] })));
  });

  // Crear (Master/Administrador).
  r.post("/", requirePerm("sesiones_admin"), async (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 60) : "";
    if (!name) return res.status(400).json({ error: "el nombre es obligatorio" });
    const { data, error } = await sb().from("sessions").insert({ name, created_by: req.user!.id }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    logActivity(req.user, { action: "sesion.crear", entity: "sesion", entityId: data.id, summary: `Creó la sesión "${name}"` });
    res.status(201).json({ ...data, item_count: 0, total_duration_sec: 0, manager_ids: [] });
  });

  // Renombrar (Master/Administrador).
  r.patch("/:id", requirePerm("sesiones_admin"), async (req, res) => {
    const patch: Record<string, unknown> = {};
    if (typeof req.body?.name === "string" && req.body.name.trim()) patch.name = req.body.name.trim().slice(0, 60);
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: "nada para actualizar" });
    const { data, error } = await sb().from("sessions").update(patch).eq("id", req.params.id).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "sesión no encontrada" });
    res.json(data);
  });

  // Borrar (Master/Administrador).
  r.delete("/:id", requirePerm("sesiones_admin"), async (req, res) => {
    const { data } = await sb().from("sessions").select("name").eq("id", req.params.id).maybeSingle();
    const { error } = await sb().from("sessions").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    logActivity(req.user, { action: "sesion.borrar", entity: "sesion", entityId: req.params.id, summary: `Borró la sesión "${data?.name ?? ""}"` });
    res.status(204).end();
  });

  // Corte de emergencia: lo puede tocar cualquier manager de ESTA sesión (no hace falta ser Admin).
  // Instantáneo por socket + queda guardado, así el output lo toma aunque se pierda el mensaje.
  r.post("/:id/toggle", manageGuard, async (req, res) => {
    const active = req.body?.active !== false;
    const patch: Record<string, unknown> = { active };
    patch.paused_at = active ? null : new Date().toISOString();
    const { data, error } = await sb().from("sessions").update(patch).eq("id", req.params.id).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "sesión no encontrada" });
    io.emit("session:update", { id: data.id, active: data.active !== false, paused_at: data.paused_at });
    logActivity(req.user, { action: active ? "sesion.reanudar" : "sesion.detener", entity: "sesion", entityId: data.id, summary: `${active ? "Reanudó" : "Detuvo"} la sesión "${data.name}"` });
    res.json(data);
  });

  // Disponibilidad como contenido de Emisión (columna "Contenidos disponibles"): independiente de si está
  // en vivo en su propio link — una sesión puede estar transmitiendo y a la vez no ofrecerse para agregar
  // como bloque nuevo (por ejemplo, si ya tenés 30 sesiones corriendo y no querés que llenen esa lista).
  r.post("/:id/availability", manageGuard, async (req, res) => {
    const available = req.body?.available !== false;
    const { data, error } = await sb().from("sessions").update({ in_parrilla: available }).eq("id", req.params.id).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "sesión no encontrada" });
    logActivity(req.user, { action: "sesion.disponibilidad", entity: "sesion", entityId: data.id, summary: `${available ? "Puso" : "Sacó"} "${data.name}" ${available ? "en" : "de"} Contenidos disponibles` });
    res.json(data);
  });

  // ---- Managers (sólo Master/Administrador asigna) ----
  r.get("/:id/managers", requirePerm("sesiones_admin"), async (req, res) => {
    const { data, error } = await sb().from("session_managers").select("user_id").eq("session_id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json((data ?? []).map((m) => m.user_id));
  });
  r.put("/:id/managers", requirePerm("sesiones_admin"), async (req, res) => {
    const ids: string[] = Array.isArray(req.body?.user_ids) ? req.body.user_ids.filter((x: unknown) => typeof x === "string") : [];
    const client = sb();
    const { error: delErr } = await client.from("session_managers").delete().eq("session_id", req.params.id);
    if (delErr) return res.status(500).json({ error: delErr.message });
    if (ids.length) {
      const { error } = await client.from("session_managers").insert(ids.map((user_id) => ({ session_id: req.params.id, user_id })));
      if (error) return res.status(500).json({ error: error.message });
    }
    logActivity(req.user, { action: "sesion.asignar", entity: "sesion", entityId: req.params.id, summary: `Asignó ${ids.length} persona(s) a la sesión`, meta: { count: ids.length } });
    res.json({ ok: true });
  });

  // ---- Contenidos de la sesión (mismo patrón que parrilla_draft) ----
  r.get("/:id/items", manageGuard, async (req, res) => {
    const { data, error } = await sb().from("session_items").select("*").eq("session_id", req.params.id).order("sort");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  r.post("/:id/items", manageGuard, async (req, res) => {
    const { content_type, content_id, template, duration_sec } = req.body ?? {};
    if (!TYPES.includes(content_type)) return res.status(400).json({ error: "content_type inválido" });
    const tmpl = SELF_LAYOUT.has(content_type) ? "custom" : template;
    if (!SELF_LAYOUT.has(content_type) && !TEMPLATE_IDS.has(template)) return res.status(400).json({ error: "layout inválido" });
    const dur = Number(duration_sec);
    const { data: last } = await sb().from("session_items").select("sort").eq("session_id", req.params.id).order("sort", { ascending: false }).limit(1).maybeSingle();
    const sort = (last?.sort ?? -1) + 1;
    const { data, error } = await sb()
      .from("session_items")
      .insert({ session_id: req.params.id, content_type, content_id: content_id ?? null, template: tmpl, duration_sec: Number.isFinite(dur) && dur > 0 ? Math.round(dur) : 8, sort })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  });

  r.patch("/:id/items/:itemId", manageGuard, async (req, res) => {
    const patch: Record<string, unknown> = {};
    for (const k of ["template", "duration_sec", "enabled", "sort"]) if (k in (req.body ?? {})) patch[k] = req.body[k];
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: "nada para actualizar" });
    const { data, error } = await sb().from("session_items").update(patch).eq("id", req.params.itemId).eq("session_id", req.params.id).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "bloque no encontrado" });
    res.json(data);
  });

  r.delete("/:id/items/:itemId", manageGuard, async (req, res) => {
    const { error } = await sb().from("session_items").delete().eq("id", req.params.itemId).eq("session_id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.status(204).end();
  });

  r.post("/:id/items/reorder", manageGuard, async (req, res) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids)) return res.status(400).json({ error: "ids debe ser un array" });
    for (let i = 0; i < ids.length; i++) {
      const { error } = await sb().from("session_items").update({ sort: i }).eq("id", ids[i]).eq("session_id", req.params.id);
      if (error) return res.status(500).json({ error: error.message });
    }
    const { data } = await sb().from("session_items").select("*").eq("session_id", req.params.id).order("sort");
    res.json(data);
  });

  return r;
}
