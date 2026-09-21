import { Router } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "../db/supabase.js";
import { requireAuth, requirePerm } from "../auth/middleware.js";
import { logActivity } from "../activity.js";
import { fetchAll, type Row } from "../db/fetchAll.js";
import { TRASH_DAYS } from "../trash.js";
import {
  UNUSED_DAYS, hasSynced, isMediaReady, isMissingMediaTable, loadUsage, markMediaMissing, prettyName, removeFiles, syncFromStorage, usageOf,
  kindFromMime,
} from "../media.js";

// Banco unificado (Ajustes > Banco): toda la media cargada, con uso, papelera y borrado múltiple.
// Ven y borran (a la papelera) quienes tienen "ajustes"; eliminar definitivamente sólo "vaciar_papelera".
export function bancoRouter(): Router {
  const r = Router();
  r.use(requireAuth, requirePerm("ajustes"));
  const sb = () => getSupabase()!;
  const publicUrl = (bucket: string, path: string) => sb().storage.from(bucket).getPublicUrl(path).data.publicUrl;

  const namesOf = async (ids: Array<string | null | undefined>): Promise<Map<string, string>> => {
    const uniq = [...new Set(ids.filter(Boolean))] as string[];
    if (!uniq.length) return new Map();
    const { data } = await sb().from("profiles").select("*").in("id", uniq);
    return new Map((data ?? []).map((p) => [p.id as string, (p.full_name as string) || [p.first_name, p.last_name].filter(Boolean).join(" ") || (p.email as string)]));
  };

  // Biblioteca (sin fondos: los fondos van aparte, en assets).
  r.get("/", async (req, res) => {
    const client = sb();
    if (isMediaReady()) {
      if (req.query.sync === "1") await syncFromStorage(client, req.user, true);
      else if (!hasSynced()) await syncFromStorage(client, req.user);
      else void syncFromStorage(client, req.user);
    }
    if (!isMediaReady()) return res.json(await legacy(client));

    const { rows, error } = await fetchAll((f, t) => client.from("media_files").select("*").is("deleted_at", null).neq("bucket", "backgrounds").order("created_at", { ascending: false }).range(f, t));
    if (error) {
      if (isMissingMediaTable(error)) { markMediaMissing(); return res.json(await legacy(client)); }
      return res.status(500).json({ error });
    }
    const [usage, names, { data: assets }] = await Promise.all([
      loadUsage(client),
      namesOf(rows.map((m) => m.uploaded_by)),
      client.from("assets").select("id, kind, active"),
    ]);
    const assetById = new Map((assets ?? []).map((a) => [a.id as string, a]));
    const items = rows.map((m) => {
      const u = usageOf(usage, m as never);
      const a = m.asset_id ? assetById.get(m.asset_id) : null;
      return {
        id: m.id, name: m.name ?? prettyName(m.path), url: publicUrl(m.bucket, m.path), bucket: m.bucket, path: m.path,
        mime: m.mime, size: m.size, kind: m.kind, source: m.source, created_at: m.created_at,
        uploaded_by: m.uploaded_by, uploaded_by_name: names.get(m.uploaded_by) ?? null,
        logo_active: !!(a && a.kind === "logo" && a.active), is_logo_asset: !!(a && a.kind === "logo"),
        usage: u,
      };
    });
    const trashCount = (await client.from("media_files").select("id", { count: "exact", head: true }).not("deleted_at", "is", null)).count ?? 0;
    res.json({ ready: true, unused_days: UNUSED_DAYS, trash_days: TRASH_DAYS, trash_count: trashCount, items });
  });

  // Sin la migración: sólo lo que registra la tabla assets (logos y fotos del Banco viejo).
  async function legacy(client: SupabaseClient) {
    const { data } = await client.from("assets").select("*").in("kind", ["logo", "ad"]).order("created_at", { ascending: false });
    const names = await namesOf((data ?? []).map((a) => a.created_by));
    return {
      ready: false, unused_days: UNUSED_DAYS, trash_days: TRASH_DAYS, trash_count: 0,
      items: (data ?? []).map((a) => ({
        id: a.id, name: a.name ?? prettyName(a.path), url: publicUrl(a.bucket, a.path), bucket: a.bucket, path: a.path, mime: a.mime, size: a.size,
        kind: kindFromMime(a.mime, a.name), source: "banco", created_at: a.created_at, uploaded_by: a.created_by, uploaded_by_name: names.get(a.created_by) ?? null,
        logo_active: a.kind === "logo" && a.active, is_logo_asset: a.kind === "logo", usage: { on_air: false, count: 0, refs: [] },
      })),
    };
  }

  r.get("/trash", async (_req, res) => {
    if (!isMediaReady()) return res.json([]);
    const cutoff = new Date(Date.now() - TRASH_DAYS * 86_400_000).toISOString();
    const { data, error } = await sb().from("media_files").select("*").not("deleted_at", "is", null).gte("deleted_at", cutoff).order("deleted_at", { ascending: false });
    if (error) { if (isMissingMediaTable(error.message)) markMediaMissing(); return res.json([]); }
    const names = await namesOf((data ?? []).flatMap((d) => [d.deleted_by, d.uploaded_by]));
    res.json((data ?? []).map((m) => ({
      id: m.id, name: m.name ?? prettyName(m.path), url: publicUrl(m.bucket, m.path), mime: m.mime, size: m.size, kind: m.kind,
      created_at: m.created_at, deleted_at: m.deleted_at, uploaded_by_name: names.get(m.uploaded_by) ?? null, deleted_by_name: names.get(m.deleted_by) ?? null,
      days_left: Math.max(0, TRASH_DAYS - Math.floor((Date.now() - new Date(m.deleted_at).getTime()) / 86_400_000)),
    })));
  });

  // Importa lo que hay en Storage y no estaba registrado.
  r.post("/sync", async (req, res) => {
    if (!isMediaReady()) return res.status(409).json({ error: "falta correr la migración 0017 en Supabase", code: "no_migration" });
    const added = await syncFromStorage(sb(), req.user, true);
    res.json({ added });
  });

  // Mandar a la papelera. Lo que está AL AIRE no se borra nunca; lo "en uso" se saltea salvo include_in_use.
  r.post("/delete", async (req, res) => {
    if (!isMediaReady()) return res.status(409).json({ error: "falta correr la migración 0017 en Supabase", code: "no_migration" });
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids.filter((x: unknown) => typeof x === "string") : [];
    if (!ids.length) return res.status(400).json({ error: "no hay nada seleccionado" });
    const includeInUse = req.body?.include_in_use === true;
    const client = sb();
    const { data: files, error } = await client.from("media_files").select("*").in("id", ids).is("deleted_at", null);
    if (error) return res.status(500).json({ error: error.message });
    const usage = await loadUsage(client);
    const ok: Row[] = [];
    const blocked: Row[] = [];
    const skipped: Row[] = [];
    for (const f of files ?? []) {
      const u = usageOf(usage, f as never);
      const brief = { id: f.id, name: f.name ?? prettyName(f.path), refs: u.refs };
      if (u.on_air) blocked.push(brief);
      else if (u.count > 0 && !includeInUse) skipped.push(brief);
      else ok.push(f);
    }
    if (ok.length) {
      const now = new Date().toISOString();
      const { error: e2 } = await client.from("media_files").update({ deleted_at: now, deleted_by: req.user!.id }).in("id", ok.map((f) => f.id));
      if (e2) return res.status(500).json({ error: e2.message });
      const assetIds = ok.map((f) => f.asset_id).filter(Boolean);
      if (assetIds.length) await client.from("assets").update({ active: false }).in("id", assetIds);
      logActivity(req.user, {
        action: "banco.borrar", entity: "media", entityId: ok.length === 1 ? ok[0]!.id : null,
        summary: ok.length === 1 ? `Mandó a la papelera "${ok[0]!.name ?? prettyName(ok[0]!.path)}" del Banco` : `Mandó a la papelera ${ok.length} archivos del Banco`,
        meta: { count: ok.length, names: ok.slice(0, 10).map((f) => f.name ?? prettyName(f.path)), blocked: blocked.length, skipped: skipped.length },
      });
    }
    const body = { deleted: ok.length, blocked, skipped };
    if (ok.length === 0 && blocked.length > 0) return res.status(409).json({ error: "esa media está al aire y no se puede borrar", code: "on_air", ...body });
    res.json(body);
  });

  r.post("/restore", async (req, res) => {
    if (!isMediaReady()) return res.status(409).json({ error: "falta correr la migración 0017 en Supabase", code: "no_migration" });
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids.filter((x: unknown) => typeof x === "string") : [];
    if (!ids.length) return res.status(400).json({ error: "no hay nada seleccionado" });
    const { data, error } = await sb().from("media_files").update({ deleted_at: null, deleted_by: null }).in("id", ids).select("id, name, path");
    if (error) return res.status(500).json({ error: error.message });
    if (data?.length) logActivity(req.user, { action: "banco.restaurar", entity: "media", summary: data.length === 1 ? `Restauró "${data[0]!.name ?? prettyName(data[0]!.path)}" del Banco` : `Restauró ${data.length} archivos del Banco`, meta: { count: data.length } });
    res.json({ restored: data?.length ?? 0 });
  });

  // Eliminar definitivamente (Master y Administrador): borra el archivo de Storage.
  r.post("/purge", requirePerm("vaciar_papelera"), async (req, res) => {
    if (!isMediaReady()) return res.status(409).json({ error: "falta correr la migración 0017 en Supabase", code: "no_migration" });
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids.filter((x: unknown) => typeof x === "string") : [];
    if (!ids.length) return res.status(400).json({ error: "no hay nada seleccionado" });
    const { data, error } = await sb().from("media_files").select("id, bucket, path, asset_id, name").in("id", ids).not("deleted_at", "is", null);
    if (error) return res.status(500).json({ error: error.message });
    const n = await removeFiles(sb(), (data ?? []) as any);
    if (n > 0) logActivity(req.user, { action: "banco.purgar", entity: "media", summary: `Eliminó definitivamente ${n} archivo(s) del Banco`, meta: { count: n, names: (data ?? []).slice(0, 10).map((f) => f.name ?? prettyName(f.path)) } });
    res.json({ purged: n });
  });

  // Usar/dejar de usar una imagen como logo global en pantalla (crea el asset "logo" si hace falta).
  r.patch("/:id/logo", async (req, res) => {
    if (!isMediaReady()) return res.status(409).json({ error: "falta correr la migración 0017 en Supabase", code: "no_migration" });
    const active = req.body?.active === true;
    const client = sb();
    const { data: f } = await client.from("media_files").select("*").eq("id", req.params.id).is("deleted_at", null).maybeSingle();
    if (!f) return res.status(404).json({ error: "archivo no encontrado" });
    if (f.kind !== "image") return res.status(400).json({ error: "sólo una imagen puede ser logo" });
    let assetId: string | null = f.asset_id;
    if (!assetId) {
      if (!active) return res.json({ logo_active: false });
      const { data: a, error } = await client.from("assets").insert({ kind: "logo", bucket: f.bucket, path: f.path, name: f.name, mime: f.mime, size: f.size, active: true, created_by: req.user!.id }).select("id").single();
      if (error || !a) return res.status(500).json({ error: error?.message ?? "no se pudo marcar como logo" });
      assetId = a.id;
      await client.from("media_files").update({ asset_id: assetId }).eq("id", f.id);
    } else {
      const { error } = await client.from("assets").update({ active }).eq("id", assetId);
      if (error) return res.status(500).json({ error: error.message });
    }
    logActivity(req.user, { action: "banco.logo", entity: "media", entityId: f.id, summary: `${active ? "Puso" : "Sacó"} "${f.name}" ${active ? "como" : "de los"} logo${active ? "" : "s"} en pantalla` });
    res.json({ logo_active: active });
  });

  return r;
}
