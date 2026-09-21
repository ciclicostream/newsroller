import { Router } from "express";
import { ROLE_PERMS, ROLE_RANK, normalizeRole } from "@newsroller/shared";
import { requireAuthLoose, requireAuth } from "../auth/middleware.js";
import { idleLimits, startSession, ping, endSession } from "../auth/sessions.js";
import { getSupabase } from "../db/supabase.js";
import { env } from "../config/env.js";

const clean = (v: unknown, max: number): string | undefined => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : undefined);
const AVATAR_BUCKET = "avatars";

export function meRouter(): Router {
  const r = Router();
  const sb = () => getSupabase()!;

  // Perfil + rol + permisos del usuario autenticado (lo usa el panel para mostrar/ocultar secciones).
  // Sin control de inactividad: es lo primero que se pide al abrir el panel; si la sesión venció, lo que
  // viene después (ya con control) responde 401 "idle".
  r.get("/me", requireAuthLoose, async (req, res) => {
    const limits = await idleLimits();
    res.json({ ...req.user, perms: ROLE_PERMS[req.user!.role], idleMinutes: limits[req.user!.role] });
  });

  // ---- Mi perfil: cada persona edita sus propios datos (nombre, apellido, teléfono, foto) ----
  r.patch("/me/profile", requireAuth, async (req, res) => {
    const b = req.body ?? {};
    const patch: Record<string, unknown> = {};
    const first = clean(b.first_name, 60), last = clean(b.last_name, 60), phone = clean(b.phone, 30);
    if (first !== undefined) patch.first_name = first || null;
    if (last !== undefined) patch.last_name = last || null;
    if (phone !== undefined) {
      if (phone && !/^[+()\d][\d\s().+-]{5,}$/.test(phone)) return res.status(400).json({ error: "teléfono inválido (solo números, espacios, + - ( ))" });
      patch.phone = phone || null;
    }
    if (b.avatar_url !== undefined) {
      const url = typeof b.avatar_url === "string" ? b.avatar_url : "";
      // La foto tiene que estar en la carpeta propia del bucket de perfiles (no se acepta cualquier URL).
      const prefix = `${env.supabaseUrl}/storage/v1/object/public/${AVATAR_BUCKET}/${req.user!.id}/`;
      if (url && !url.startsWith(prefix)) return res.status(400).json({ error: "foto inválida" });
      patch.avatar_url = url || null;
    }
    if ("first_name" in patch || "last_name" in patch) {
      const f = ("first_name" in patch ? (patch.first_name as string | null) : req.user!.first_name) ?? "";
      const l = ("last_name" in patch ? (patch.last_name as string | null) : req.user!.last_name) ?? "";
      patch.full_name = `${f} ${l}`.trim() || null;
    }
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: "nada para actualizar" });
    const { data, error } = await sb().from("profiles").update(patch).eq("id", req.user!.id).select("*").maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // Firma para subir la foto de perfil (siempre a la carpeta de la propia persona).
  r.post("/me/avatar/sign", requireAuth, async (req, res) => {
    const client = sb();
    // El bucket se crea solo si todavía no existe (por si no se corrió la migración).
    const { data: bucket } = await client.storage.getBucket(AVATAR_BUCKET);
    if (!bucket) await client.storage.createBucket(AVATAR_BUCKET, { public: true });
    const path = `${req.user!.id}/${Date.now()}.jpg`;
    const { data, error } = await client.storage.from(AVATAR_BUCKET).createSignedUploadUrl(path);
    if (error || !data) return res.status(500).json({ error: error?.message ?? "no se pudo firmar" });
    res.json({ bucket: AVATAR_BUCKET, path: data.path, token: data.token });
  });

  // ---- Quién está conectado: sesiones abiertas con actividad reciente. El Master es invisible ----
  r.get("/presence", requireAuth, async (_req, res) => {
    const limits = await idleLimits();
    const since = new Date(Date.now() - 60 * 60_000).toISOString();
    const { data: sessions, error } = await sb().from("user_sessions").select("user_id, last_seen_at").is("ended_at", null).gte("last_seen_at", since);
    if (error) return res.json([]); // sin tabla de sesiones todavía
    const ids = [...new Set((sessions ?? []).map((s) => s.user_id))];
    if (ids.length === 0) return res.json([]);
    const { data: profiles } = await sb().from("profiles").select("*").in("id", ids);
    const seen = new Map((sessions ?? []).map((s) => [s.user_id, new Date(s.last_seen_at).getTime()]));
    const out = (profiles ?? [])
      .map((p) => ({ p, role: normalizeRole(p.role) }))
      .filter(({ p, role }) => role !== "master" && p.active !== false && Date.now() - (seen.get(p.id) ?? 0) <= limits[role] * 60_000)
      .sort((a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role])
      .map(({ p, role }) => ({
        id: p.id, role, avatar_url: p.avatar_url ?? null,
        name: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email,
        last_seen_at: new Date(seen.get(p.id)!).toISOString(),
      }));
    res.json(out);
  });

  // Sesiones: se abre al iniciar sesión, se mantiene viva con "ping" mientras la persona está activa y se cierra
  // al salir o por inactividad.
  r.post("/session/start", requireAuthLoose, async (req, res) => {
    await startSession(req.user!.id);
    res.json({ ok: true, idleMinutes: (await idleLimits())[req.user!.role] });
  });
  r.post("/session/ping", requireAuth, async (req, res) => {
    await ping(req.user!.id);
    res.json({ ok: true });
  });
  r.post("/session/end", requireAuthLoose, async (req, res) => {
    await endSession(req.user!.id, "manual");
    res.json({ ok: true });
  });
  return r;
}
