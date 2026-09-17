import { Router } from "express";
import { getSupabase } from "../db/supabase.js";
import { requireAuth } from "../auth/middleware.js";
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
};

type SettingsKey = keyof typeof DEFAULTS;
type SettingsValue = number | boolean | string;

// Fallback en memoria cuando no hay Supabase (dev local sin credenciales).
const memory: Record<string, unknown> = {};

function coerce(key: SettingsKey, raw: unknown): SettingsValue | null {
  if (key === "tickerSpeed") {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    // Segundos por vuelta: 20 (rápido) .. 240 (muy lento).
    return Math.round(Math.min(240, Math.max(20, n)));
  }
  if (key === "onAir") {
    if (typeof raw === "boolean") return raw;
    if (raw === "true") return true;
    if (raw === "false") return false;
    return null;
  }
  if (key === "airSince") {
    if (typeof raw !== "string" || Number.isNaN(Date.parse(raw))) return null;
    return raw;
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
  r.put("/settings", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const updates: Partial<Record<SettingsKey, SettingsValue>> = {};
    for (const key of Object.keys(DEFAULTS) as SettingsKey[]) {
      if (!(key in body)) continue;
      const val = coerce(key, body[key]);
      if (val == null) return res.status(400).json({ error: `valor inválido para ${key}` });
      updates[key] = val;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "sin cambios válidos" });
    }
    try {
      res.json(await writeSettings(io, updates));
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "error" });
    }
  });

  return r;
}
