import { Router } from "express";
import { getSupabase } from "../db/supabase.js";
import { requireAuth, requirePerm } from "../auth/middleware.js";
import { clearLimitsCache } from "../auth/sessions.js";
import { logActivity } from "../activity.js";
import { CLIMA_SLOT_KEYS, PLATAFORMAS_DEFAULT, IDLE_MINUTES_DEFAULT, MUSIC_DEFAULT, ROLES, DEFAULT_COLLECTION, SUITE_DEFAULT, SUITE_NAME_RE, collectionById, can, type Suite, type Plataforma, type Role, type MusicSettings } from "@newsroller/shared";
import type { IO } from "../realtime/socket.js";

// Preferencias del sistema (key/value). Defaults + validación por clave.
// tickerSpeed: velocidad del newsticker del marco (Chrome), en segundos por vuelta.
// onAir: corte manual de emisión — cuando es false, el output muestra la placa de
// "fuera del aire" en vez de la rotación normal (botón "en vivo" del Monitor).
// airSince: timestamp ISO de la última vez que se publicó la parrilla (para el
// reloj "al aire" del Monitor — persiste entre refrescos del navegador).
const DEFAULTS = {
  tickerSpeed: 90,
  onAir: true,
  airSince: "" as string,
  // Momento en que se cortó la emisión (vacío = al aire). Congela el reloj "al aire".
  airPausedAt: "" as string,
  // Íconos BIG del clima cargados por el editor: { [slot]: url }. Vacío = predeterminados.
  climaIcons: {} as Record<string, string>,
  // Plataformas de streaming (Cartelera → series): { id, name, logo? }. Se administran en Ajustes → Plataformas.
  plataformas: PLATAFORMAS_DEFAULT as Plataforma[],
  // Minutos de inactividad para cerrar la sesión, por rol (sólo lo cambia el Master).
  idleMinutes: IDLE_MINUTES_DEFAULT as Record<Role, number>,
  // Música de fondo continua (Ajustes → Música): temas cargados, cuál está seleccionado y si
  // el canal está habilitado (el toggle vive en el Monitor de Emisión, no acá).
  music: MUSIC_DEFAULT as MusicSettings,
  // Colecciones de templates habilitadas por el Master (Ajustes → Suites). Cada suite elige una de éstas.
  collections: [DEFAULT_COLLECTION] as string[],
  // Suites (nombre + colección) y cuál está activa: la salida del canal emite con la colección de la activa.
  suites: [SUITE_DEFAULT] as Suite[],
  activeSuite: SUITE_DEFAULT.id as string,
  // Links viejos con variables (/output/?orientation=…): se apagan cuando todos los outputs usan links con nombre.
  legacyLinks: true,
};

type SettingsKey = keyof typeof DEFAULTS;
type SettingsValue = number | boolean | string | string[] | Suite[] | Record<string, string> | Record<string, number> | Plataforma[] | MusicSettings;

// Fallback en memoria cuando no hay Supabase (dev local sin credenciales).
const memory: Record<string, unknown> = {};

function coerce(key: SettingsKey, raw: unknown): SettingsValue | null {
  if (key === "tickerSpeed") {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    // Segundos por vuelta: 20 (rápido) .. 240 (muy lento).
    return Math.round(Math.min(240, Math.max(20, n)));
  }
  if (key === "collections") {
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) return null;
    const ids = [...new Set(raw)];
    return ids.every((id) => typeof id === "string" && collectionById(id)?.ready) ? (ids as string[]) : null;
  }
  if (key === "legacyLinks") return typeof raw === "boolean" ? raw : null;
  if (key === "suites") {
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 30) return null;
    const out: Suite[] = [];
    const ids = new Set<string>(), names = new Set<string>();
    for (const it of raw as Record<string, unknown>[]) {
      const id = typeof it?.id === "string" ? it.id : "";
      const name = typeof it?.name === "string" ? it.name.trim().toLowerCase() : "";
      const style = typeof it?.style === "string" ? it.style : "";
      if (!/^[a-z0-9_-]{1,40}$/.test(id) || !SUITE_NAME_RE.test(name) || !collectionById(style)?.ready || ids.has(id) || names.has(name)) return null;
      ids.add(id); names.add(name);
      out.push({ id, name, style });
    }
    return out;
  }
  if (key === "activeSuite") return typeof raw === "string" && raw ? raw : null;
  if (key === "onAir") {
    if (typeof raw === "boolean") return raw;
    if (raw === "true") return true;
    if (raw === "false") return false;
    return null;
  }
  if (key === "airSince" || key === "airPausedAt") {
    if (key === "airPausedAt" && raw === "") return "";
    if (typeof raw !== "string" || Number.isNaN(Date.parse(raw))) return null;
    return raw;
  }
  if (key === "climaIcons") {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!CLIMA_SLOT_KEYS.includes(k as never)) return null;
      if (v == null || v === "") continue; // sin valor = volver al predeterminado
      if (typeof v !== "string" || !/^https?:\/\//.test(v)) return null;
      out[k] = v;
    }
    return out;
  }
  if (key === "idleMinutes") {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const out: Record<string, number> = { ...IDLE_MINUTES_DEFAULT };
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const n = Number(v);
      if (!(ROLES as string[]).includes(k) || !Number.isFinite(n) || n < 1 || n > 480) return null;
      out[k] = Math.round(n);
    }
    return out;
  }
  if (key === "plataformas") {
    if (!Array.isArray(raw) || raw.length > 40) return null;
    const out: Plataforma[] = [];
    const ids = new Set<string>();
    for (const it of raw as Record<string, unknown>[]) {
      const id = typeof it?.id === "string" ? it.id : "";
      const name = typeof it?.name === "string" ? it.name.trim().slice(0, 30) : "";
      if (!/^[a-z0-9_-]{1,30}$/.test(id) || !name || ids.has(id)) return null;
      const logo = it.logo;
      if (logo != null && logo !== "" && (typeof logo !== "string" || !/^https?:\/\//.test(logo))) return null;
      ids.add(id);
      out.push({ id, name, ...(typeof logo === "string" && logo ? { logo } : {}) });
    }
    return out;
  }
  if (key === "music") {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const m = raw as Record<string, unknown>;
    if (!Array.isArray(m.tracks) || m.tracks.length > 40) return null;
    const tracks: MusicSettings["tracks"] = [];
    const ids = new Set<string>();
    for (const it of m.tracks as Record<string, unknown>[]) {
      const id = typeof it?.id === "string" ? it.id : "";
      const name = typeof it?.name === "string" ? it.name.trim().slice(0, 60) : "";
      const url = typeof it?.url === "string" ? it.url : "";
      if (!/^[a-z0-9_-]{1,40}$/.test(id) || !name || !/^https?:\/\//.test(url) || ids.has(id)) return null;
      ids.add(id);
      tracks.push({ id, name, url });
    }
    const activeId = m.activeId === null ? null : typeof m.activeId === "string" && tracks.some((t) => t.id === m.activeId) ? m.activeId : null;
    const enabled = typeof m.enabled === "boolean" ? m.enabled : false;
    return { tracks, activeId, enabled };
  }
  return null;
}

export async function readAll(): Promise<Record<string, unknown>> {
  const sb = getSupabase();
  const out: Record<string, unknown> = { ...DEFAULTS, ...memory };
  if (!sb) return out;
  const { data } = await sb.from("app_settings").select("key, value");
  for (const row of data ?? []) out[row.key] = row.value;
  return out;
}

// Escribe preferencias y avisa por socket al instante (lo usan tanto el PUT de
// abajo como otras rutas, ej. parrilla.publish() para estampar airSince).
export async function writeSettings(io: IO, updates: Partial<Record<SettingsKey, SettingsValue>>): Promise<Record<string, unknown>> {
  const sb = getSupabase();
  if (sb) {
    const rows = Object.entries(updates).map(([key, value]) => ({ key, value }));
    const { error } = await sb.from("app_settings").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);
  } else {
    Object.assign(memory, updates);
  }
  const all = await readAll();
  io.emit("settings:update", all);
  return all;
}

export function settingsRouter(io: IO): Router {
  const r = Router();

  // Público (lo lee el output). Devuelve todas las preferencias con defaults aplicados.
  r.get("/settings", async (_req, res) => {
    res.json(await readAll());
  });

  // Guardar preferencias (sólo editores/admins). Valida y clampa cada clave conocida.
  r.put("/settings", requireAuth, requirePerm("ajustes_medios"), async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const updates: Partial<Record<SettingsKey, SettingsValue>> = {};
    for (const key of Object.keys(DEFAULTS) as SettingsKey[]) {
      if (!(key in body)) continue;
      // La música de fondo la toca también el Host (ajustes_medios); el resto de las preferencias pide "ajustes".
      if (key !== "music" && !can(req.user!.role, "ajustes")) return res.status(403).json({ error: "no tenés permiso para cambiar esta preferencia", code: "forbidden" });
      if (key === "collections" && !can(req.user!.role, "config_sistema")) return res.status(403).json({ error: "sólo el Master habilita colecciones", code: "forbidden" });
      if ((key === "suites" || key === "activeSuite") && !can(req.user!.role, "perfiles")) return res.status(403).json({ error: "sólo un Administrador o el Master manejan las suites", code: "forbidden" });
      if (key === "legacyLinks" && !can(req.user!.role, "perfiles")) return res.status(403).json({ error: "sólo un Administrador o el Master apagan los links viejos", code: "forbidden" });
      if (key === "idleMinutes" && !can(req.user!.role, "config_sistema")) return res.status(403).json({ error: "sólo el Master cambia los tiempos de inactividad", code: "forbidden" });
      const val = coerce(key, body[key]);
      if (val == null) return res.status(400).json({ error: `valor inválido para ${key}` });
      updates[key] = val;
    }
    // Suites: la activa tiene que existir y cada suite usar una colección habilitada por el Master.
    if ("suites" in updates || "activeSuite" in updates || "collections" in updates) {
      const cur = await readAll();
      const suites = (updates.suites ?? cur.suites ?? [SUITE_DEFAULT]) as Suite[];
      const enabled = (updates.collections ?? cur.collections ?? [DEFAULT_COLLECTION]) as string[];
      if (("suites" in updates || "activeSuite" in updates) && suites.some((x) => !enabled.includes(x.style))) return res.status(400).json({ error: "hay una suite con una colección que no está habilitada" });
      const active = (updates.activeSuite ?? cur.activeSuite) as string;
      if (!suites.some((x) => x.id === active)) {
        if ("activeSuite" in updates) return res.status(400).json({ error: "esa suite no existe" });
        updates.activeSuite = suites[0]!.id; // se borró la suite activa: queda activa la primera
      }
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "sin cambios válidos" });
    }
    try {
      const all = await writeSettings(io, updates);
      if ("idleMinutes" in updates) clearLimitsCache();
      // Registro: corte / reanudación del aire y cambios de ajustes (sin los relojes internos del reloj "al aire").
      if ("onAir" in updates) logActivity(req.user, { action: updates.onAir === false ? "aire.cortar" : "aire.reanudar", entity: "aire", summary: updates.onAir === false ? "Cortó la emisión (fuera de aire)" : "Reanudó la emisión" });
      const changed = Object.keys(updates).filter((k) => !["onAir", "airSince", "airPausedAt"].includes(k));
      if (changed.length) logActivity(req.user, { action: "ajustes.cambiar", entity: "ajustes", summary: `Cambió ajustes: ${changed.join(", ")}`, meta: { keys: changed } });
      res.json(all);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "error" });
    }
  });

  return r;
}
