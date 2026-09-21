import { Router } from "express";
import { getSupabase } from "../db/supabase.js";
import { rateLimited } from "../util/rateLimit.js";

// Ingresos fallidos: el panel de ingreso entra directo a Supabase Auth, así que avisa acá cuando falla.
// Público (todavía no hay sesión) y con límite. Sólo cuenta los intentos hechos desde este panel.
export function securityRouter(): Router {
  const r = Router();
  let warned = false;
  r.post("/login-attempt", async (req, res) => {
    if (rateLimited(`login:${req.ip}`, 20, 60_000)) return res.status(429).end();
    const sb = getSupabase();
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase().slice(0, 120) : "";
    if (!sb || !email) return res.status(204).end();
    try {
      const { error } = await sb.from("login_attempts").insert({ email, ip: req.ip ?? null, ok: false });
      if (error && !warned) { warned = true; console.warn(`[seguridad] no se pudo registrar el intento (${error.message}); ¿falta la migración 0018?`); }
    } catch { /* noop */ }
    res.status(204).end();
  });
  return r;
}
