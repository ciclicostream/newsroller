import { Router } from "express";
import { ROLE_PERMS } from "@newsroller/shared";
import { requireAuthLoose, requireAuth } from "../auth/middleware.js";
import { idleLimits, startSession, ping, endSession } from "../auth/sessions.js";

export function meRouter(): Router {
  const r = Router();
  // Perfil + rol + permisos del usuario autenticado (lo usa el panel para mostrar/ocultar secciones).
  // Sin control de inactividad: es lo primero que se pide al abrir el panel; si la sesión venció, lo que
  // viene después (ya con control) responde 401 "idle".
  r.get("/me", requireAuthLoose, async (req, res) => {
    const limits = await idleLimits();
    res.json({ ...req.user, perms: ROLE_PERMS[req.user!.role], idleMinutes: limits[req.user!.role] });
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
