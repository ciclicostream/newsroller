import { randomBytes } from "node:crypto";
import { Router } from "express";
import { OUTPUT_LINK_RESERVED, OUTPUT_LINK_SLUG_RE, can, collectionById, type OutputLink, type OutputLinkTarget, type Perm, type Role } from "@newsroller/shared";
import { getSupabase } from "../db/supabase.js";
import { requireAuth, requirePerm } from "../auth/middleware.js";
import { logActivity } from "../activity.js";
import { radioKey } from "./radio.js";

// Links de salida con nombre (/output/<slug>). La configuración (qué emite, orientación, audio y estilo)
// vive en la tabla output_links: el link público no lleva variables y sólo se cambia desde el panel.
const TARGETS: OutputLinkTarget[] = ["emision", "sesion", "stream"];
const COLS = "slug, label, target, session_id, orientation, audio, style, created_at, updated_at";
// Cada destino pide el permiso de la sección donde se genera: Emisión (Copiloto), Sesiones o Stream.
const PERM_OF: Record<OutputLinkTarget, Perm> = { emision: "programar", sesion: "sesiones", stream: "stream" };
const canTarget = (role: Role | undefined, t: OutputLinkTarget) => can(role, PERM_OF[t]);

// Código al azar de 10 caracteres (minúsculas y números), para cuando no se elige un nombre.
function randomSlug(): string {
  const abc = "abcdefghijkmnopqrstuvwxyz23456789";
  return Array.from(randomBytes(10), (b) => abc[b % abc.length]).join("");
}

export function slugError(slug: string): string | null {
  if (!OUTPUT_LINK_SLUG_RE.test(slug)) return "El nombre va de 3 a 40 caracteres: minúsculas, números y guiones.";
  if (OUTPUT_LINK_RESERVED.includes(slug)) return "Ese nombre está reservado. Elegí otro.";
  return null;
}

// Valida y normaliza el cuerpo de un link (para crear o editar).
function parseBody(b: Record<string, unknown>, partial: boolean): { ok: Partial<OutputLink> } | { error: string } {
  const out: Partial<OutputLink> = {};
  if ("label" in b) out.label = typeof b.label === "string" && b.label.trim() ? b.label.trim().slice(0, 60) : null;
  if ("target" in b || !partial) {
    const t = (b.target ?? "emision") as OutputLinkTarget;
    if (!TARGETS.includes(t)) return { error: "destino inválido" };
    out.target = t;
  }
  if ("session_id" in b) out.session_id = typeof b.session_id === "string" && b.session_id ? b.session_id : null;
  if ("orientation" in b || !partial) {
    const o = b.orientation ?? "horizontal";
    if (o !== "horizontal" && o !== "vertical") return { error: "orientación inválida" };
    out.orientation = o;
  }
  if ("audio" in b || !partial) out.audio = b.audio === true;
  if ("style" in b) {
    if (b.style == null || b.style === "") out.style = null;
    else if (typeof b.style === "string" && collectionById(b.style)) out.style = b.style;
    else return { error: "estilo inválido" };
  }
  if (out.target === "sesion" && !out.session_id && !partial) return { error: "falta la sesión" };
  return { ok: out };
}

// Resolución pública (la llama el output al abrir /output/<slug>). Devuelve sólo lo que el output necesita;
// para el Stream incluye la clave, que así nunca aparece en la URL.
export async function resolveOutputLink(slug: string): Promise<Record<string, unknown> | null> {
  const sb = getSupabase();
  if (!sb || slugError(slug)) return null;
  const { data } = await sb.from("output_links").select(COLS).eq("slug", slug).maybeSingle();
  if (!data) return null;
  return {
    slug: data.slug,
    target: data.target,
    session: data.target === "sesion" ? data.session_id : null,
    key: data.target === "stream" ? radioKey() : null,
    orientation: data.orientation,
    audio: data.audio,
    style: data.style,
  };
}

// Administración desde el panel: quien opera Emisión, Sesiones o Stream.
export function outputLinksRouter(): Router {
  const r = Router();
  r.use(requireAuth, requirePerm("programar", "sesiones", "stream"));
  const sb = () => getSupabase()!;

  r.get("/", async (req, res) => {
    if (!getSupabase()) return res.json([]);
    const { data, error } = await sb().from("output_links").select(COLS).order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const role = req.user!.role;
    let mine: Set<string> | null = null; // sesiones que gestiona (null = todas)
    if (!can(role, "sesiones_admin")) {
      const { data: m } = await sb().from("session_managers").select("session_id").eq("user_id", req.user!.id);
      mine = new Set((m ?? []).map((x) => x.session_id as string));
    }
    res.json((data ?? []).filter((l) => canTarget(role, l.target as OutputLinkTarget) && (l.target !== "sesion" || !mine || mine.has(l.session_id as string))));
  });

  // Links de sesión: sólo de las sesiones que la persona gestiona (quien administra sesiones, de todas).
  const managesSession = async (userId: string, role: Role | undefined, sessionId: string | null | undefined) => {
    if (!sessionId) return false;
    if (can(role, "sesiones_admin")) return true;
    const { data } = await sb().from("session_managers").select("user_id").eq("session_id", sessionId).eq("user_id", userId).maybeSingle();
    return !!data;
  };

  // Para editar o borrar: el link tiene que existir y ser de un destino (y una sesión) que esta persona maneja.
  const loadOwned = async (slug: string, userId: string, role: Role | undefined) => {
    const { data } = await sb().from("output_links").select("target, session_id").eq("slug", slug).maybeSingle();
    if (!data) return "missing" as const;
    if (!canTarget(role, data.target as OutputLinkTarget)) return "forbidden" as const;
    if (data.target === "sesion" && !(await managesSession(userId, role, data.session_id))) return "forbidden" as const;
    return "ok" as const;
  };

  r.post("/", async (req, res) => {
    if (!getSupabase()) return res.status(503).json({ error: "sin base de datos" });
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = parseBody(body, false);
    if ("error" in parsed) return res.status(400).json({ error: parsed.error });
    if (!canTarget(req.user!.role, parsed.ok.target!)) return res.status(403).json({ error: "no tenés permiso para crear este tipo de link", code: "forbidden" });
    if (parsed.ok.target === "sesion" && !(await managesSession(req.user!.id, req.user!.role, parsed.ok.session_id))) return res.status(403).json({ error: "no gestionás esta sesión", code: "forbidden" });
    const wanted = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
    const slug = wanted || randomSlug();
    const err = slugError(slug);
    if (err) return res.status(400).json({ error: err });
    const { data, error } = await sb().from("output_links").insert({ ...parsed.ok, slug, created_by: req.user!.id }).select(COLS).maybeSingle();
    if (error) {
      const taken = error.code === "23505";
      return res.status(taken ? 409 : 500).json({ error: taken ? "Ya hay un link con ese nombre." : error.message });
    }
    logActivity(req.user, { action: "links.crear", entity: "links", summary: `Creó el link /output/${slug}` });
    res.status(201).json(data);
  });

  r.patch("/:slug", async (req, res) => {
    if (!getSupabase()) return res.status(503).json({ error: "sin base de datos" });
    const parsed = parseBody((req.body ?? {}) as Record<string, unknown>, true);
    if ("error" in parsed) return res.status(400).json({ error: parsed.error });
    delete parsed.ok.target; delete parsed.ok.session_id; // el destino de un link no se cambia: se crea otro
    const own = await loadOwned(req.params.slug, req.user!.id, req.user!.role);
    if (own === "missing") return res.status(404).json({ error: "link no encontrado" });
    if (own === "forbidden") return res.status(403).json({ error: "no tenés permiso para editar este link", code: "forbidden" });
    const { data, error } = await sb().from("output_links").update({ ...parsed.ok, updated_at: new Date().toISOString() }).eq("slug", req.params.slug).select(COLS).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "link no encontrado" });
    logActivity(req.user, { action: "links.editar", entity: "links", summary: `Editó el link /output/${req.params.slug}` });
    res.json(data);
  });

  r.delete("/:slug", async (req, res) => {
    if (!getSupabase()) return res.status(503).json({ error: "sin base de datos" });
    const own = await loadOwned(req.params.slug, req.user!.id, req.user!.role);
    if (own === "missing") return res.status(404).json({ error: "link no encontrado" });
    if (own === "forbidden") return res.status(403).json({ error: "no tenés permiso para borrar este link", code: "forbidden" });
    const { error } = await sb().from("output_links").delete().eq("slug", req.params.slug);
    if (error) return res.status(500).json({ error: error.message });
    logActivity(req.user, { action: "links.borrar", entity: "links", summary: `Borró el link /output/${req.params.slug}` });
    res.status(204).end();
  });

  return r;
}
