import { getSupabase } from "./db/supabase.js";

// Registro automático de incidentes (tabla `incidents`, migración 0018). Nunca rompe lo que lo llama:
// sin la tabla se avisa una vez por consola y se sigue.
let warned = false;
const warn = (msg: string) => { if (!warned) { warned = true; console.warn(`[incidentes] ${msg}; ¿falta la migración 0018?`); } };

// ---- Fuentes de datos (dólar, clima, ticker…): el Registry abre/cierra el incidente ----
const openSource = new Map<string, string>(); // fuente → id del incidente abierto

export async function sourceFailed(id: string, label: string, detail: string, since: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    const open = openSource.get(id);
    if (open) {
      await sb.from("incidents").update({ last_seen_at: new Date().toISOString(), detail: detail.slice(0, 300) }).eq("id", open);
      return;
    }
    const { data, error } = await sb.from("incidents").insert({ kind: "fuente", key: id, label, detail: detail.slice(0, 300), started_at: since }).select("id").single();
    if (error) return warn(error.message);
    openSource.set(id, data.id);
  } catch { /* noop */ }
}

export async function sourceRecovered(id: string): Promise<void> {
  const open = openSource.get(id);
  if (!open) return;
  openSource.delete(id);
  try { await getSupabase()?.from("incidents").update({ ended_at: new Date().toISOString() }).eq("id", open); } catch { /* noop */ }
}

// Al arrancar el server: los incidentes de fuentes que quedaron abiertos se cierran en su último aviso.
export async function closeOrphanIncidents(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    const { data, error } = await sb.from("incidents").select("id, last_seen_at").eq("kind", "fuente").is("ended_at", null);
    if (error) return warn(error.message);
    for (const r of data ?? []) await sb.from("incidents").update({ ended_at: r.last_seen_at }).eq("id", r.id);
  } catch { /* noop */ }
}

// ---- Avisos del output (cámara sin señal, foto/video roto) ----
const REPEAT_WINDOW_MS = 30 * 60_000; // el mismo problema dentro de esta ventana es UN incidente

export async function outputIncident(i: { kind: "camara" | "media"; key: string; label?: string; detail?: string; item_id?: string | null }): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    const now = new Date();
    const { data: open } = await sb.from("incidents").select("id, count, last_seen_at").eq("kind", i.kind).eq("key", i.key).is("ended_at", null).order("started_at", { ascending: false }).limit(1).maybeSingle();
    if (open && now.getTime() - new Date(open.last_seen_at).getTime() < REPEAT_WINDOW_MS) {
      await sb.from("incidents").update({ last_seen_at: now.toISOString(), count: (open.count ?? 1) + 1 }).eq("id", open.id);
      return;
    }
    if (open) await sb.from("incidents").update({ ended_at: open.last_seen_at }).eq("id", open.id);
    const { error } = await sb.from("incidents").insert({ kind: i.kind, key: i.key, label: i.label?.slice(0, 120) ?? null, detail: i.detail?.slice(0, 300) ?? null, item_id: i.item_id ?? null });
    if (error) warn(error.message);
  } catch { /* noop */ }
}
