import { Router } from "express";
import { ROLES, assignableRoles, normalizeRole, type Role } from "@newsroller/shared";
import { getSupabase } from "../db/supabase.js";
import { requireAuth, requirePerm } from "../auth/middleware.js";
import { logActivity } from "../activity.js";

const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLES as string[]).includes(v);
const isEmail = (v: unknown): v is string => typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// Personas: Master ve y gestiona a todos; el Administrador gestiona a administradores, programadores y
// generadores pero NO ve ni toca al Master. Borrar personas es sólo del Master (el resto desactiva).
export function usersRouter(): Router {
  const r = Router();
  r.use(requireAuth, requirePerm("perfiles"));
  const sb = () => getSupabase()!;

  const countMasters = async () => {
    const { data } = await sb().from("profiles").select("id, role");
    return (data ?? []).filter((p) => normalizeRole(p.role) === "master").length;
  };

  // Listar personas (perfil + rol). El Master es invisible para quien no lo es.
  r.get("/", async (req, res) => {
    const { data, error } = await sb().from("profiles").select("*").order("created_at", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    const rows = (data ?? [])
      .map((p) => ({ ...p, role: normalizeRole(p.role), active: p.active !== false }))
      .filter((p) => req.user!.role === "master" || p.role !== "master");
    res.json(rows);
  });

  // Crear usuario con rol (el rol tiene que estar entre los que puede asignar quien lo crea).
  r.post("/", async (req, res) => {
    const { email, password, full_name, role } = req.body ?? {};
    if (!isEmail(email)) return res.status(400).json({ error: "email inválido" });
    if (typeof password !== "string" || password.length < 8)
      return res.status(400).json({ error: "la contraseña debe tener al menos 8 caracteres" });
    const finalRole: Role = isRole(role) ? role : "generador";
    if (!assignableRoles(req.user!.role).includes(finalRole)) return res.status(403).json({ error: "no podés crear ese rol" });

    const { data: created, error } = await sb().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: typeof full_name === "string" ? full_name : null },
    });
    if (error || !created.user) return res.status(400).json({ error: error?.message ?? "no se pudo crear" });

    const { error: upErr } = await sb().from("profiles").update({ role: finalRole, full_name: full_name ?? null }).eq("id", created.user.id);
    if (upErr) return res.status(500).json({ error: upErr.message });

    res.status(201).json({ id: created.user.id, email, full_name: full_name ?? null, role: finalRole });
  });

  // Origen del panel para el link (viene del navegador que pide; tiene que estar permitido en Supabase → Redirect URLs).
  const panelOrigin = (req: import("express").Request): string => {
    const o = typeof req.headers.origin === "string" ? req.headers.origin : "";
    try { return new URL(o).origin; } catch { return `${req.protocol}://${req.get("host")}`; }
  };

  // Invitar: crea la persona con el rol asignado y devuelve un link de un solo uso (sin enviar mails).
  r.post("/invite", async (req, res) => {
    const { email, role, first_name, last_name } = req.body ?? {};
    if (!isEmail(email)) return res.status(400).json({ error: "email inválido" });
    const finalRole: Role = isRole(role) ? role : "generador";
    if (!assignableRoles(req.user!.role).includes(finalRole)) return res.status(403).json({ error: "no podés invitar a ese rol" });
    const first = typeof first_name === "string" ? first_name.trim().slice(0, 60) : "";
    const last = typeof last_name === "string" ? last_name.trim().slice(0, 60) : "";
    const fullName = `${first} ${last}`.trim();

    const { data, error } = await sb().auth.admin.generateLink({
      type: "invite", email,
      options: { redirectTo: `${panelOrigin(req)}/login`, data: fullName ? { full_name: fullName } : undefined },
    });
    if (error || !data?.user) return res.status(400).json({ error: error?.message ?? "no se pudo generar la invitación" });

    const { error: upErr } = await sb().from("profiles").update({ role: finalRole, first_name: first || null, last_name: last || null, full_name: fullName || null }).eq("id", data.user.id);
    if (upErr) return res.status(500).json({ error: upErr.message });
    logActivity(req.user, { action: "usuario.invitar", entity: "usuario", entityId: data.user.id, summary: `Invitó a ${email} como ${finalRole}`, meta: { role: finalRole } });
    res.status(201).json({ id: data.user.id, email, role: finalRole, link: data.properties.action_link });
  });

  // Link de acceso para alguien ya creado: invitación (si nunca ingresó) o de recuperación de contraseña.
  r.post("/:id/link", async (req, res) => {
    const id = req.params.id as string;
    const { data: target } = await sb().from("profiles").select("*").eq("id", id).maybeSingle();
    if (!target || (normalizeRole(target.role) === "master" && req.user!.role !== "master")) return res.status(404).json({ error: "usuario no encontrado" });
    const email = target.email as string | null;
    if (!email) return res.status(400).json({ error: "la persona no tiene email" });
    const { data: au } = await sb().auth.admin.getUserById(id);
    const neverSignedIn = !au?.user?.last_sign_in_at;
    const redirectTo = `${panelOrigin(req)}/login`;
    let link: string | undefined; let kind: "invite" | "recovery" = neverSignedIn ? "invite" : "recovery";
    if (neverSignedIn) {
      const r1 = await sb().auth.admin.generateLink({ type: "invite", email, options: { redirectTo } });
      link = r1.data?.properties?.action_link;
    }
    if (!link) {
      kind = "recovery";
      const r2 = await sb().auth.admin.generateLink({ type: "recovery", email, options: { redirectTo } });
      if (r2.error) return res.status(400).json({ error: r2.error.message });
      link = r2.data?.properties?.action_link;
    }
    logActivity(req.user, { action: "usuario.link", entity: "usuario", entityId: id, summary: `Generó un link de ${kind === "invite" ? "invitación" : "acceso"} para ${email}` });
    res.json({ link, kind, email });
  });

  // Cambiar rol / nombre / activo.
  r.patch("/:id", async (req, res) => {
    const { id } = req.params;
    const { role, full_name, active, first_name, last_name, phone } = req.body ?? {};
    const actor = req.user!.role;

    const { data: target } = await sb().from("profiles").select("*").eq("id", id).maybeSingle();
    // Quien no es Master no ve al Master: para él, esa persona no existe.
    if (!target || (normalizeRole(target.role) === "master" && actor !== "master")) return res.status(404).json({ error: "usuario no encontrado" });

    const patch: Record<string, unknown> = {};
    if (role !== undefined) {
      if (!isRole(role) || !assignableRoles(actor).includes(role)) return res.status(403).json({ error: "no podés asignar ese rol" });
      if (id === req.user!.id) return res.status(400).json({ error: "no podés cambiar tu propio rol" });
      if (normalizeRole(target.role) === "master" && role !== "master" && (await countMasters()) <= 1)
        return res.status(400).json({ error: "tiene que quedar al menos un Master" });
      patch.role = role;
    }
    if (typeof full_name === "string") patch.full_name = full_name;
    if (typeof first_name === "string") patch.first_name = first_name.trim().slice(0, 60) || null;
    if (typeof last_name === "string") patch.last_name = last_name.trim().slice(0, 60) || null;
    if (typeof phone === "string") patch.phone = phone.trim().slice(0, 30) || null;
    if ("first_name" in patch || "last_name" in patch) {
      const f = ("first_name" in patch ? patch.first_name : target.first_name) ?? "";
      const l = ("last_name" in patch ? patch.last_name : target.last_name) ?? "";
      patch.full_name = `${f} ${l}`.trim() || null;
    }
    if (active !== undefined) {
      if (typeof active !== "boolean") return res.status(400).json({ error: "active inválido" });
      if (id === req.user!.id) return res.status(400).json({ error: "no podés desactivarte a vos mismo" });
      if (!active && normalizeRole(target.role) === "master" && (await countMasters()) <= 1)
        return res.status(400).json({ error: "tiene que quedar al menos un Master activo" });
      patch.active = active;
    }
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: "nada para actualizar" });

    const { data, error } = await sb().from("profiles").update(patch).eq("id", id).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if ("role" in patch) logActivity(req.user, { action: "usuario.rol", entity: "usuario", entityId: id, summary: `Cambió el rol de ${target.email} a ${patch.role}`, meta: { role: patch.role } });
    if ("active" in patch) logActivity(req.user, { action: patch.active ? "usuario.activar" : "usuario.desactivar", entity: "usuario", entityId: id, summary: `${patch.active ? "Activó" : "Desactivó"} a ${target.email}` });
    res.json(data);
  });

  // Eliminar usuario: sólo el Master (el Administrador desactiva).
  r.delete("/:id", requirePerm("eliminar_personas"), async (req, res) => {
    const id = req.params.id as string;
    if (id === req.user!.id) return res.status(400).json({ error: "no podés eliminarte a vos mismo" });
    const { data: target } = await sb().from("profiles").select("role").eq("id", id).maybeSingle();
    if (target && normalizeRole(target.role) === "master" && (await countMasters()) <= 1)
      return res.status(400).json({ error: "tiene que quedar al menos un Master" });
    const { error } = await sb().auth.admin.deleteUser(id);
    if (error) return res.status(400).json({ error: error.message });
    logActivity(req.user, { action: "usuario.eliminar", entity: "usuario", entityId: id, summary: "Eliminó a una persona" });
    res.status(204).end();
  });

  return r;
}
