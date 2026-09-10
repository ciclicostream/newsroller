import type { NextFunction, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "../db/supabase.js";

export type Role = "admin" | "editor";

export interface AuthUser {
  id: string;
  email: string | null;
  role: Role;
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

async function loadUser(sb: SupabaseClient, token: string): Promise<AuthUser | null> {
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile } = await sb
    .from("profiles")
    .select("role, email")
    .eq("id", data.user.id)
    .maybeSingle();
  return {
    id: data.user.id,
    email: profile?.email ?? data.user.email ?? null,
    role: (profile?.role as Role) ?? "editor",
  };
}

// Exige sesión válida. Responde 401 si falta o es inválida.
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
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
  req.user = user;
  next();
}

// Exige rol admin. Debe ir después de requireAuth.
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "requiere rol administrador" });
    return;
  }
  next();
}
