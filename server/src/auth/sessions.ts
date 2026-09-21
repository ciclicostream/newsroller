import { IDLE_MINUTES_DEFAULT, ROLES, type Role } from "@newsroller/shared";
import { getSupabase } from "../db/supabase.js";

// Sesiones y cierre por inactividad. La "actividad" la informa el panel con /api/session/ping (sólo cuando
// la persona mueve el mouse, tipea, etc.); las consultas pasivas (el monitor abierto) NO cuentan.
// Estado en memoria + tabla `user_sessions` (para reportes: sesiones por día, tiempo activo). Si la tabla
// todavía no existe (migración sin correr) se degrada: no se cierra ninguna sesión por inactividad.

const lastSeen = new Map<string, number>(); // userId → última actividad (ms)
const lastDbWrite = new Map<string, number>();
let limitsCache: { at: number; v: Record<Role, number> } | null = null;
let warned = false;

const warnOnce = (msg: string) => { if (!warned) { warned = true; console.warn(`[sessions] ${msg}`); } };

export async function idleLimits(): Promise<Record<Role, number>> {
  if (limitsCache && Date.now() - limitsCache.at < 30_000) return limitsCache.v;
  const v = { ...IDLE_MINUTES_DEFAULT };
  try {
    const sb = getSupabase();
    const { data } = await sb!.from("app_settings").select("value").eq("key", "idleMinutes").maybeSingle();
    const cfg = (data?.value ?? {}) as Partial<Record<Role, number>>;
    for (const r of ROLES) if (Number.isFinite(cfg[r]) && cfg[r]! >= 1) v[r] = Math.round(cfg[r]!);
  } catch { /* defaults */ }
  limitsCache = { at: Date.now(), v };
  return v;
}
export const clearLimitsCache = () => { limitsCache = null; };

async function loadLastSeen(userId: string): Promise<number> {
  try {
    const { data, error } = await getSupabase()!
      .from("user_sessions").select("last_seen_at").eq("user_id", userId).is("ended_at", null)
      .order("started_at", { ascending: false }).limit(1).maybeSingle();
    if (error) { warnOnce(`sin tabla user_sessions (${error.message}): sin cierre por inactividad`); return Date.now(); }
    return data?.last_seen_at ? new Date(data.last_seen_at).getTime() : Date.now();
  } catch { return Date.now(); }
}

// ¿Pasó el tiempo de inactividad de este rol? Si sí, se cierra la sesión registrada.
export async function isIdle(userId: string, role: Role): Promise<boolean> {
  let last = lastSeen.get(userId);
  if (last == null) { last = await loadLastSeen(userId); lastSeen.set(userId, last); }
  const limit = (await idleLimits())[role] * 60_000;
  if (Date.now() - last <= limit) return false;
  await endSession(userId, "idle");
  return true;
}

export async function startSession(userId: string): Promise<void> {
  lastSeen.set(userId, Date.now());
  try {
    const sb = getSupabase()!;
    await sb.from("user_sessions").update({ ended_at: new Date().toISOString(), end_reason: "replaced" }).eq("user_id", userId).is("ended_at", null);
    const { error } = await sb.from("user_sessions").insert({ user_id: userId });
    if (error) warnOnce(`no se pudo registrar la sesión (${error.message})`);
  } catch { /* noop */ }
}

export async function ping(userId: string): Promise<void> {
  const now = Date.now();
  lastSeen.set(userId, now);
  if (now - (lastDbWrite.get(userId) ?? 0) < 55_000) return; // la base se actualiza como mucho 1 vez por minuto
  lastDbWrite.set(userId, now);
  try {
    await getSupabase()!.from("user_sessions").update({ last_seen_at: new Date(now).toISOString() }).eq("user_id", userId).is("ended_at", null);
  } catch { /* noop */ }
}

export async function endSession(userId: string, reason: "manual" | "idle"): Promise<void> {
  lastSeen.delete(userId);
  lastDbWrite.delete(userId);
  try {
    await getSupabase()!.from("user_sessions").update({ ended_at: new Date().toISOString(), end_reason: reason }).eq("user_id", userId).is("ended_at", null);
  } catch { /* noop */ }
}
