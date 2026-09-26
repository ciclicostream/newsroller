import { randomBytes } from "node:crypto";
import { Router } from "express";
import { OUTPUT_LINK_RESERVED, OUTPUT_LINK_SLUG_RE, type OutputLink } from "@newsroller/shared";
import { getSupabase } from "../db/supabase.js";
import { requireAuth, requirePerm } from "../auth/middleware.js";
import { logActivity } from "../activity.js";
import { radioKey } from "./radio.js";
import type { IO } from "../realtime/socket.js";

// Links de la salida del canal (/output/<slug>): uno horizontal y uno vertical, fijos (migración 0026).
// La salida es UNA señal: la parrilla del Copiloto y, mientras el Host tiene Stream abierto, el Stream.
// Los links no llevan colección: usan la suite activa (Ajustes → Suites). El Administrador o el Master sólo
// pueden prender o apagar el audio, cambiarles el nombre o regenerarlos si se filtran.
const COLS = "slug, orientation, audio, updated_at";

// Código al azar de 10 caracteres (minúsculas y números).
function randomSlug(): string {
  const abc = "abcdefghijkmnopqrstuvwxyz23456789";
  return Array.from(randomBytes(10), (b) => abc[b % abc.length]).join("");
}

export function slugError(slug: string): string | null {
  if (!OUTPUT_LINK_SLUG_RE.test(slug)) return "El nombre va de 3 a 40 caracteres: minúsculas, números y guiones.";
  if (OUTPUT_LINK_RESERVED.includes(slug)) return "Ese nombre está reservado. Elegí otro.";
  return null;
}

// Resolución pública (la llama el output al abrir /output/<slug>). Incluye la clave de Stream, que así nunca
// aparece en la URL: el output la usa para pasar a Stream cuando el Host transmite.
export async function resolveOutputLink(slug: string): Promise<Record<string, unknown> | null> {
  const sb = getSupabase();
  if (!sb || slugError(slug)) return null;
  const { data } = await sb.from("output_links").select(COLS).eq("slug", slug).maybeSingle();
  if (!data) return null;
  return { slug: data.slug, orientation: data.orientation, audio: data.audio, key: radioKey() };
}

export function outputLinksRouter(io: IO): Router {
  const r = Router();
  r.use(requireAuth);
  const sb = () => getSupabase()!;

  // Lectura: quien opera el aire o Stream (para el monitor) y quien administra.
  r.get("/", requirePerm("programar", "stream", "perfiles"), async (_req, res) => {
    if (!getSupabase()) return res.json([]);
    const { data, error } = await sb().from("output_links").select(COLS).order("orientation");
    if (error) return res.status(500).json({ error: error.message });
    res.json((data ?? []) as OutputLink[]);
  });

  // Cambiar el audio o el nombre (sólo Administrador o Master).
  r.patch("/:slug", requirePerm("perfiles"), async (req, res) => {
    if (!getSupabase()) return res.status(503).json({ error: "sin base de datos" });
    const body = (req.body ?? {}) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if ("audio" in body) patch.audio = body.audio === true;
    if ("slug" in body) {
      const next = String(body.slug ?? "").trim().toLowerCase();
      const err = slugError(next);
      if (err) return res.status(400).json({ error: err });
      patch.slug = next;
    }
    if (!Object.keys(patch).length) return res.status(400).json({ error: "nada para actualizar" });
    const { data, error } = await sb().from("output_links").update({ ...patch, updated_at: new Date().toISOString() }).eq("slug", req.params.slug).select(COLS).maybeSingle();
    if (error) {
      const taken = error.code === "23505";
      return res.status(taken ? 409 : 500).json({ error: taken ? "Ya hay un link con ese nombre." : error.message });
    }
    if (!data) return res.status(404).json({ error: "link no encontrado" });
    logActivity(req.user, { action: "links.editar", entity: "links", summary: patch.slug ? `Renombró el link /output/${req.params.slug} a /output/${patch.slug}` : `${patch.audio ? "Prendió" : "Apagó"} el audio de /output/${req.params.slug}` });
    io.emit("link:update", { slug: String(req.params.slug) }); // los outputs con este link lo vuelven a leer (o se apagan si cambió el nombre)
    res.json(data);
  });

  // Regenerar: nombre nuevo al azar; el viejo deja de emitir (para cuando un link se filtró).
  r.post("/:slug/regenerate", requirePerm("perfiles"), async (req, res) => {
    if (!getSupabase()) return res.status(503).json({ error: "sin base de datos" });
    const next = randomSlug();
    const { data, error } = await sb().from("output_links").update({ slug: next, updated_at: new Date().toISOString() }).eq("slug", req.params.slug).select(COLS).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "link no encontrado" });
    logActivity(req.user, { action: "links.regenerar", entity: "links", summary: `Regeneró el link /output/${req.params.slug} (ahora /output/${next})` });
    io.emit("link:update", { slug: String(req.params.slug) });
    res.json(data);
  });

  return r;
}
