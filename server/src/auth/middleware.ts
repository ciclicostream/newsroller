import type { NextFunction, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { can, normalizeRole, type Perm, type Role } from "@newsroller/shared";
import { getSupabase } from "../db/supabase.js";
import { isIdle } from "./sessions.js";

export type { Role };

export interface AuthUser {
  id: string;
  email: string | null;
  role: Role;
  full_name: string | null;
}

// Amplía Request con el usuario autenticado.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

async function loadUser(sb: SupabaseClient, token: string): Promise<(AuthUser & { active: boolean }) | null> {
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile } = await sb.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  return {
    id: data.user.id,
    email: profile?.email ?? data.user.email ?? null,
    role: normalizeRole(profile?.role),
    full_name: profile?.full_name ?? null,
    active: profile?.active !== false, // sin la columna (migración pendiente) = activo
  };
}

// Exige sesión válida. `idle: true` (por defecto) además cierra la sesión si la persona estuvo inactiva más
// del tiempo de su rol (401 con code "idle"). Responde 401 si falta o es inválida y 403 si está desactivada.
export function authenticate(opts: { idle: boolean }) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const sb = getSupabase();
    if (!sb) {
      res.status(503).json({ error: "auth no disponible: falta configurar Supabase" });
      return;
    }
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
      res.status(401).json({ error: "falta token" });
      return;
    }
    const user = await loadUser(sb, token);
    if (!user) {
      res.status(401).json({ error: "token inválido" });
      return;
    }
    if (!user.active) {
      res.status(403).json({ error: "tu usuario está desactivado", code: "disabled" });
      return;
    }
    if (opts.idle && (await isIdle(user.id, user.role))) {
      res.status(401).json({ error: "sesión cerrada por inactividad", code: "idle" });
      return;
    }
    req.user = { id: user.id, email: user.email, role: user.role, full_name: user.full_name };
    next();
  };
}
export const requireAuth = authenticate({ idle: true });
export const requireAuthLoose = authenticate({ idle: false }); // para iniciar/cerrar la sesión y /me

// Exige al menos uno de los permisos indicados. Debe ir después de requireAuth.
export function requirePerm(...perms: Perm[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!perms.some((p) => can(req.user?.role, p))) {
      res.status(403).json({ error: "no tenés permiso para esto", code: "forbidden" });
      return;
    }
    next();
  };
}

// Permisos distintos según el método: lectura (GET) con `read`, el resto con `write`.
export function requirePermByMethod(read: Perm[], write: Perm[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    requirePerm(...(req.method === "GET" ? read : write))(req, res, next);
  };
}

// Compatibilidad: administrar personas.
export const requireAdmin = requirePerm("perfiles");
