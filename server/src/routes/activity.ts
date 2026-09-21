import { Router } from "express";
import { getSupabase } from "../db/supabase.js";
import { requireAuth, requirePerm } from "../auth/middleware.js";

// Registro de actividad (Master y Administrador). Las acciones del Master sólo las ve el Master.
export function activityRouter(): Router {
  const r = Router();
  r.use(requireAuth, requirePerm("reportes"));

  r.get("/", async (req, res) => {
    const sb = getSupabase()!;
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
    let q = sb.from("activity_log").select("*").order("at", { ascending: false }).limit(limit);
    if (typeof req.query.actor === "string" && req.query.actor) q = q.eq("actor_id", req.query.actor);
    if (typeof req.query.action === "string" && req.query.action) q = q.like("action", `${req.query.action}%`);
    if (typeof req.query.before === "string" && req.query.before) q = q.lt("at", req.query.before);
    if (req.user!.role !== "master") q = q.neq("actor_role", "master");
    const { data, error } = await q;
    if (error) return res.json({ rows: [], error: error.message });
    res.json({ rows: data });
  });

  return r;
}
