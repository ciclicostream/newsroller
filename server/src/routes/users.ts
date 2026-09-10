import { Router } from "express";
import { getSupabase } from "../db/supabase.js";
import { requireAuth, requireAdmin, type Role } from "../auth/middleware.js";

const ROLES: Role[] = ["admin", "editor"];
const isRole = (v: unknown): v is Role => typeof v === "string" && ROLES.includes(v as Role);
const isEmail = (v: unknown): v is string => typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// Toda esta API es sólo para admins.
export function usersRouter(): Router {
  const r = Router();
  r.use(requireAuth, requireAdmin);

  // Listar usuarios (perfil + rol).
  r.get("/", async (_req, res) => {
    const sb = getSupabase()!;
    const { data, error } = await sb
      .from("profiles")
      .select("id, email, full_name, role, created_at")
      .order("created_at", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // Crear usuario con rol.
  r.post("/", async (req, res) => {
    const sb = getSupabase()!;
    const { email, password, full_name, role } = req.body ?? {};
    if (!isEmail(email)) return res.status(400).json({ error: "email inválido" });
    if (typeof password !== "string" || password.length < 8)
      return res.status(400).json({ error: "la contraseña debe tener al menos 8 caracteres" });
    const finalRole: Role = isRole(role) ? role : "editor";

    const { data: created, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: typeof full_name === "string" ? full_name : null },
    });
    if (error || !created.user) return res.status(400).json({ error: error?.message ?? "no se pudo crear" });

    // El trigger crea el profile como 'editor'; ajustamos rol y nombre.
    const { error: upErr } = await sb
      .from("profiles")
      .update({ role: finalRole, full_name: full_name ?? null })
      .eq("id", created.user.id);
    if (upErr) return res.status(500).json({ error: upErr.message });

    res.status(201).json({ id: created.user.id, email, full_name: full_name ?? null, role: finalRole });
  });

  // Cambiar rol / nombre.
  r.patch("/:id", async (req, res) => {
    const sb = getSupabase()!;
    const { id } = req.params;
    const { role, full_name } = req.body ?? {};

    if (role !== undefined) {
      if (!isRole(role)) return res.status(400).json({ error: "rol inválido" });
      if (id === req.user!.id) return res.status(400).json({ error: "no podés cambiar tu propio rol" });
    }
    const patch: Record<string, unknown> = {};
    if (role !== undefined) patch.role = role;
    if (typeof full_name === "string") patch.full_name = full_name;
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: "nada para actualizar" });

    const { data, error } = await sb.from("profiles").update(patch).eq("id", id).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "usuario no encontrado" });
    res.json(data);
  });

  // Eliminar usuario.
  r.delete("/:id", async (req, res) => {
    const sb = getSupabase()!;
    const { id } = req.params;
    if (id === req.user!.id) return res.status(400).json({ error: "no podés eliminarte a vos mismo" });
    const { error } = await sb.auth.admin.deleteUser(id);
    if (error) return res.status(400).json({ error: error.message });
    res.status(204).end();
  });

  return r;
}
