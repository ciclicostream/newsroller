import { Router, type NextFunction, type Request, type Response } from "express";
import { getSupabase } from "../db/supabase.js";
import { requireAuth, requirePerm } from "../auth/middleware.js";
import { isMissingTrashColumn, isTrashReady, liveContentItems, markTrashMissing } from "../db/contentItems.js";
import { logActivity } from "../activity.js";
import { TRASH_DAYS } from "../trash.js";

// Tipos válidos del banco de contenidos 2026. Se irán sumando a medida que se porten.
const TYPES = new Set([
  "ultima_hora",
  "dolar",
  "cifras",
  "efemerides",
  "cartelera",
  "declaraciones",
  "shorts",
  "informe",
  "publicidad",
  "video_full",
  "promos",
  "camaras",
  "clima",
  "placas",
]);

// Banco de contenidos tipados (ultima_hora, etc.). Todos los roles ven; ver ownerGuard para modificar.
// Borrar = mandar a la papelera 30 días (se puede restaurar). Un contenido AL AIRE no se puede borrar.
export function contentItemsRouter(): Router {
  const r = Router();
  r.use(requireAuth, requirePerm("contenidos"));
  const sb = () => getSupabase()!;

  // Nombre corto del contenido para el registro de actividad.
  const titleOf = (row: { type?: string; data?: Record<string, unknown> | null }): string => {
    const d = (row.data ?? {}) as Record<string, unknown>;
    return String(d.title ?? d.text ?? d.name ?? d.city ?? row.type ?? "contenido").slice(0, 80);
  };
  const isOnAir = async (id: string): Promise<boolean> => {
    const { data } = await sb().from("playlist_items").select("id").eq("content_type", "content_item").eq("content_id", id).eq("enabled", true).limit(1);
    return !!data?.length;
  };

  // El Generador ve todos los contenidos (para no repetir) pero sólo modifica o borra los suyos.
  const ownerGuard = async (req: Request, res: Response, next: NextFunction) => {
    if (req.user!.role !== "generador") return next();
    const { data } = await sb().from("content_items").select("created_by").eq("id", req.params.id).maybeSingle();
    if (data && data.created_by !== req.user!.id) return res.status(403).json({ error: "sólo podés modificar los contenidos que creaste vos", code: "forbidden" });
    next();
  };

  r.get("/", async (req, res) => {
    const type = typeof req.query.type === "string" ? req.query.type : null;
    const { data, error } = await liveContentItems(sb(), (q) => {
      let x = q.select("*").order("sort").order("created_at", { ascending: false });
      if (type) x = x.eq("type", type);
      return x;
    });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // ---- Papelera (30 días) ----
  r.get("/trash", async (_req, res) => {
    if (!isTrashReady()) return res.json([]);
    const cutoff = new Date(Date.now() - TRASH_DAYS * 86_400_000).toISOString();
    const { data, error } = await sb().from("content_items").select("*").not("deleted_at", "is", null).gte("deleted_at", cutoff).order("deleted_at", { ascending: false });
    if (error) { if (isMissingTrashColumn(error.message)) { markTrashMissing(); return res.json([]); } return res.status(500).json({ error: error.message }); }
    const ids = [...new Set((data ?? []).flatMap((d) => [d.deleted_by, d.created_by]).filter(Boolean))] as string[];
    const { data: people } = ids.length ? await sb().from("profiles").select("*").in("id", ids) : { data: [] as Record<string, unknown>[] };
    const nameOf = new Map((people ?? []).map((p) => [p.id as string, (p.full_name as string) || (p.email as string)]));
    res.json((data ?? []).map((d) => ({
      ...d,
      deleted_by_name: nameOf.get(d.deleted_by) ?? null,
      created_by_name: nameOf.get(d.created_by) ?? null,
      days_left: Math.max(0, TRASH_DAYS - Math.floor((Date.now() - new Date(d.deleted_at).getTime()) / 86_400_000)),
    })));
  });

  r.post("/:id/restore", ownerGuard, async (req, res) => {
    const { data, error } = await sb().from("content_items").update({ deleted_at: null, deleted_by: null }).eq("id", req.params.id).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "contenido no encontrado" });
    logActivity(req.user, { action: "contenido.restaurar", entity: "content_item", entityId: data.id, summary: `Restauró "${titleOf(data)}" (${data.type})`, meta: { type: data.type } });
    res.json(data);
  });

  // Borrar definitivamente (Master y Administrador).
  r.delete("/:id/purge", requirePerm("vaciar_papelera"), async (req, res) => {
    const { data: row } = await sb().from("content_items").select("*").eq("id", req.params.id).maybeSingle();
    if (!row) return res.status(404).json({ error: "contenido no encontrado" });
    if (!row.deleted_at) return res.status(400).json({ error: "primero tiene que estar en la papelera" });
    const { error } = await sb().from("content_items").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    logActivity(req.user, { action: "contenido.purgar", entity: "content_item", entityId: row.id, summary: `Eliminó definitivamente "${titleOf(row)}" (${row.type})`, meta: { type: row.type } });
    res.status(204).end();
  });

  r.post("/", async (req, res) => {
    const { type, data, duration_sec } = req.body ?? {};
    if (!TYPES.has(type)) return res.status(400).json({ error: "type inválido" });
    if (data == null || typeof data !== "object") return res.status(400).json({ error: "data requerido" });
    const dur = Number(duration_sec);
    const { data: row, error } = await sb()
      .from("content_items")
      .insert({
        type,
        data,
        duration_sec: Number.isFinite(dur) && dur > 0 ? Math.round(dur) : 8,
        created_by: req.user!.id,
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    logActivity(req.user, { action: "contenido.crear", entity: "content_item", entityId: row.id, summary: `Creó "${titleOf(row)}" (${type})`, meta: { type } });
    res.status(201).json(row);
  });

  r.patch("/:id", ownerGuard, async (req, res) => {
    const patch: Record<string, unknown> = {};
    for (const k of ["data", "duration_sec", "active", "in_parrilla", "sort"]) if (k in (req.body ?? {})) patch[k] = req.body[k];
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: "nada para actualizar" });
    const { data, error } = await sb().from("content_items").update(patch).eq("id", req.params.id).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "contenido no encontrado" });
    const onlyToggle = Object.keys(patch).every((k) => k === "in_parrilla" || k === "active");
    logActivity(req.user, {
      action: onlyToggle ? "contenido.disponibilidad" : "contenido.editar", entity: "content_item", entityId: data.id,
      summary: onlyToggle ? `${patch.in_parrilla === false || patch.active === false ? "Desactivó" : "Activó"} "${titleOf(data)}" (${data.type})` : `Editó "${titleOf(data)}" (${data.type})`,
      meta: { type: data.type },
    });
    res.json(data);
  });

  // Borrar = a la papelera. Un contenido al aire no se puede borrar: primero hay que sacarlo del aire.
  r.delete("/:id", ownerGuard, async (req, res) => {
    const id = req.params.id as string;
    const { data: row } = await sb().from("content_items").select("*").eq("id", id).maybeSingle();
    if (!row) return res.status(404).json({ error: "contenido no encontrado" });
    if (await isOnAir(id)) {
      return res.status(409).json({ error: "Este contenido está AL AIRE y no se puede borrar. Sacalo de la parrilla y enviá a vivo (o desactivalo) y después borralo.", code: "on_air" });
    }
    let trashed = false;
    if (isTrashReady()) {
      const { error } = await sb().from("content_items").update({ deleted_at: new Date().toISOString(), deleted_by: req.user!.id }).eq("id", id);
      if (!error) trashed = true;
      else if (isMissingTrashColumn(error.message)) markTrashMissing();
      else return res.status(500).json({ error: error.message });
    }
    if (!trashed) {
      const { error } = await sb().from("content_items").delete().eq("id", id); // sin papelera (migración pendiente)
      if (error) return res.status(500).json({ error: error.message });
    }
    logActivity(req.user, { action: "contenido.papelera", entity: "content_item", entityId: id, summary: `${trashed ? "Envió a la papelera" : "Borró"} "${titleOf(row)}" (${row.type})`, meta: { type: row.type, trashed } });
    res.status(204).end();
  });

  return r;
}
