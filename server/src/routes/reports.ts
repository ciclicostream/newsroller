import { Router } from "express";
import { getSupabase } from "../db/supabase.js";
import { requireAuth, requirePerm } from "../auth/middleware.js";
import { fetchAll, type Row } from "../db/fetchAll.js";
import { loadUsage, usageOf, UNUSED_DAYS, prettyName } from "../media.js";

// Reportes semanales / mensuales (Master y Administrador). Todo sale de tablas que ya se llenan:
// content_items, activity_log, airings, user_sessions, incidents, login_attempts y media_files.
// Los datos nuevos (incidentes, airings de todos los tipos, ingresos fallidos, Banco) empiezan a
// acumularse desde que se implementan; lo que falta se marca como "sin datos" y no rompe el reporte.

const TZ_OFFSET_MS = 3 * 3_600_000; // Argentina: UTC-3 todo el año
const DAY = 86_400_000;
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// ---- Períodos (en hora argentina) ----
const localMs = (ms: number) => new Date(ms - TZ_OFFSET_MS); // getUTC* de esto = hora local
const dayKey = (ms: number) => localMs(ms).toISOString().slice(0, 10);
const hourOf = (ms: number) => localMs(ms).getUTCHours();
const fromLocalDate = (y: number, m: number, d: number) => Date.UTC(y, m, d) + TZ_OFFSET_MS; // 00:00 local en ms UTC

export type PeriodKind = "week" | "month";
export interface Range { period: PeriodKind; from: number; to: number; label: string }

export function rangeFor(period: PeriodKind, anchor: number): Range {
  const l = localMs(anchor);
  if (period === "month") {
    const y = l.getUTCFullYear(), m = l.getUTCMonth();
    return { period, from: fromLocalDate(y, m, 1), to: fromLocalDate(y, m + 1, 1), label: `${MONTHS[m]![0]!.toUpperCase()}${MONTHS[m]!.slice(1)} ${y}` };
  }
  const dow = (l.getUTCDay() + 6) % 7; // lunes = 0
  const from = fromLocalDate(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate() - dow);
  const to = from + 7 * DAY;
  const a = localMs(from), b = localMs(to - DAY);
  const label = a.getUTCMonth() === b.getUTCMonth()
    ? `Semana del ${a.getUTCDate()} al ${b.getUTCDate()} de ${MONTHS[b.getUTCMonth()]} de ${b.getUTCFullYear()}`
    : `Semana del ${a.getUTCDate()} de ${MONTHS[a.getUTCMonth()]} al ${b.getUTCDate()} de ${MONTHS[b.getUTCMonth()]} de ${b.getUTCFullYear()}`;
  return { period, from, to, label };
}
const previousRange = (r: Range): Range => rangeFor(r.period, r.from - DAY); // un día antes del inicio cae en el período anterior

// ---- Armado del reporte de un período ----
const iso = (ms: number) => new Date(ms).toISOString();
const rows = async (build: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>, notes: string[], what: string): Promise<Row[]> => {
  const r = await fetchAll(build);
  if (r.error) notes.push(`${what}: ${r.error}`);
  return r.rows;
};
const top = <T extends { count: number }>(a: T[], n: number) => a.sort((x, y) => y.count - x.count).slice(0, n);

export async function buildReport(range: Range, viewerIsMaster: boolean) {
  const sb = getSupabase()!;
  const { from, to } = range;
  const notes: string[] = []; // secciones que no se pudieron leer (p. ej. falta una migración)
  const now = Date.now();

  const [profiles, activity, created, airingsAll, incidents, sessions, logins, media, priorAire] = await Promise.all([
    rows((f, t) => sb.from("profiles").select("*").range(f, t), notes, "personas"),
    rows((f, t) => sb.from("activity_log").select("actor_id, actor_name, actor_role, action, summary, meta, at").gte("at", iso(from)).lt("at", iso(to)).order("at").range(f, t), notes, "actividad"),
    rows((f, t) => sb.from("content_items").select("id, type, created_by, created_at").gte("created_at", iso(from)).lt("created_at", iso(to)).range(f, t), notes, "contenidos"),
    rows((f, t) => sb.from("airings").select("*").gte("played_at", iso(from)).lt("played_at", iso(to)).range(f, t), notes, "salidas al aire"),
    rows((f, t) => sb.from("incidents").select("*").lt("started_at", iso(to)).gte("last_seen_at", iso(from)).range(f, t), notes, "incidentes"),
    rows((f, t) => sb.from("user_sessions").select("user_id, started_at, last_seen_at, ended_at").gte("started_at", iso(from)).lt("started_at", iso(to)).range(f, t), notes, "sesiones"),
    rows((f, t) => sb.from("login_attempts").select("email, at").gte("at", iso(from)).lt("at", iso(to)).range(f, t), notes, "ingresos fallidos"),
    rows((f, t) => sb.from("media_files").select("id, bucket, path, kind, size, created_at, deleted_at, asset_id").lt("created_at", iso(to)).range(f, t), notes, "almacenamiento"),
    sb.from("activity_log").select("action, at").in("action", ["aire.cortar", "aire.reanudar"]).lt("at", iso(from)).order("at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  // Las salidas del output vertical y las de Sesiones se cuentan aparte del aire principal.
  const airings = airingsAll.filter((a) => a.orientation !== "vertical" && !a.session_id);
  const airingsV = airingsAll.filter((a) => a.orientation === "vertical" && !a.session_id);
  const airingsS = airingsAll.filter((a) => !!a.session_id);

  // El Master es invisible para quien no lo es: sus acciones no aparecen en las listas por persona.
  const masterIds = new Set(profiles.filter((p) => p.role === "master").map((p) => p.id as string));
  const hidden = (id: string | null | undefined, role?: string | null) => !viewerIsMaster && (role === "master" || (!!id && masterIds.has(id)));
  const nameOf = new Map(profiles.map((p) => [p.id as string, (p.full_name as string) || [p.first_name, p.last_name].filter(Boolean).join(" ") || (p.email as string) || "—"]));
  type Act = Row & { ms: number };
  const act = (a: Row): Act => ({ ...a, ms: Date.parse(a.at) });
  const acts = activity.map(act);
  const visibleActs = acts.filter((a) => !hidden(a.actor_id, a.actor_role));
  const count = (list: Act[], ...actions: string[]) => list.filter((a) => actions.includes(a.action)).length;
  const sumMeta = (list: Act[], ...actions: string[]) => list.filter((a) => actions.includes(a.action)).reduce((s, a) => s + (Number((a.meta as Row | null)?.count) || 1), 0);

  // ---- 1. Producción ----
  const porTipo = new Map<string, number>();
  for (const c of created) porTipo.set(c.type, (porTipo.get(c.type) ?? 0) + 1);
  const produccion = {
    creados: created.length,
    editados: count(acts, "contenido.editar"),
    papelera: count(acts, "contenido.papelera"),
    por_tipo: top([...porTipo].map(([type, count]) => ({ type, count })), 30),
  };

  // ---- 2. Emisión ----
  const publicar = acts.filter((a) => a.action === "parrilla.publicar");
  const enviosPor = new Map<string, number>();
  for (const a of publicar) if (!hidden(a.actor_id, a.actor_role)) enviosPor.set(a.actor_name ?? "—", (enviosPor.get(a.actor_name ?? "—") ?? 0) + 1);

  // Cortes del aire: pares cortar → reanudar; el estado inicial sale del último evento anterior al período.
  const aireEvents = acts.filter((a) => a.action === "aire.cortar" || a.action === "aire.reanudar");
  let cutStart: number | null = priorAire.data?.action === "aire.cortar" ? from : null;
  let cutBy: string | null = null;
  let cortes = 0;
  const cortesLista: Array<{ start: string; end: string | null; seconds: number; by: string | null }> = [];
  const nowCap = Math.min(now, to);
  for (const e of aireEvents) {
    if (e.action === "aire.cortar" && cutStart == null) { cutStart = e.ms; cutBy = hidden(e.actor_id, e.actor_role) ? null : e.actor_name; cortes++; }
    else if (e.action === "aire.reanudar" && cutStart != null) {
      cortesLista.push({ start: iso(cutStart), end: e.at, seconds: Math.round((e.ms - cutStart) / 1000), by: cutBy });
      cutStart = null;
    }
  }
  if (cutStart != null) cortesLista.push({ start: iso(cutStart), end: null, seconds: Math.max(0, Math.round((nowCap - cutStart) / 1000)), by: cutBy });

  // Bloques emitidos (airings): el tipo viene en la fila o, en los viejos, del contenido.
  const typeById = new Map<string, string>();
  const titleById = new Map<string, Row>();
  const ids = [...new Set(airings.map((a) => a.content_item_id as string))];
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await sb.from("content_items").select("id, type, data").in("id", ids.slice(i, i + 100));
    for (const c of data ?? []) { typeById.set(c.id, c.type); titleById.set(c.id, c); }
  }
  const emitidosTipo = new Map<string, { count: number; seconds: number }>();
  for (const a of airings) {
    const t = (a.content_type as string) || typeById.get(a.content_item_id) || "otro";
    const cur = emitidosTipo.get(t) ?? { count: 0, seconds: 0 };
    cur.count++;
    cur.seconds += Number(a.duration_sec) || 0;
    emitidosTipo.set(t, cur);
  }
  const emision = {
    envios_a_vivo: publicar.length,
    envios_por_persona: top([...enviosPor].map(([name, count]) => ({ name, count })), 20),
    cortes,
    segundos_fuera: cortesLista.reduce((s, c) => s + c.seconds, 0),
    cortes_lista: cortesLista.slice(0, 40),
    bloques: airings.length,
    segundos_aire: airings.reduce((s, a) => s + (Number(a.duration_sec) || 0), 0),
    por_tipo: top([...emitidosTipo].map(([type, v]) => ({ type, count: v.count, seconds: v.seconds })), 30),
    con_tipo: airings.filter((a) => a.content_type).length, // cuántas salidas ya traen el tipo (registro nuevo)
    vertical: (() => {
      const m = new Map<string, { count: number; seconds: number }>();
      for (const a of airingsV) {
        const t = (a.content_type as string) || "otro";
        const cur = m.get(t) ?? { count: 0, seconds: 0 };
        cur.count++; cur.seconds += Number(a.duration_sec) || 0; m.set(t, cur);
      }
      return {
        bloques: airingsV.length,
        segundos_aire: airingsV.reduce((s, a) => s + (Number(a.duration_sec) || 0), 0),
        por_tipo: top([...m].map(([type, v]) => ({ type, count: v.count, seconds: v.seconds })), 30),
      };
    })(),
    por_sesion: (() => {
      const m = new Map<string, { count: number; seconds: number }>();
      for (const a of airingsS) {
        const cur = m.get(a.session_id as string) ?? { count: 0, seconds: 0 };
        cur.count++; cur.seconds += Number(a.duration_sec) || 0; m.set(a.session_id as string, cur);
      }
      return [...m.entries()].map(([session_id, v]) => ({ session_id, ...v }));
    })(),
  };

  // ---- 3. Incidentes ----
  const clip = (i: Row) => {
    const s = Math.max(Date.parse(i.started_at), from);
    const e = Math.min(i.ended_at ? Date.parse(i.ended_at) : Date.parse(i.last_seen_at), to);
    return Math.max(0, Math.round((e - s) / 1000));
  };
  const group = (kind: string) => {
    const m = new Map<string, { key: string; label: string; count: number; seconds: number; detail: string | null }>();
    for (const i of incidents.filter((x) => x.kind === kind)) {
      const cur = m.get(i.key) ?? { key: i.key, label: i.label ?? i.key, count: 0, seconds: 0, detail: i.detail ?? null };
      cur.count++;
      cur.seconds += clip(i);
      m.set(i.key, cur);
    }
    return [...m.values()];
  };
  const fuentes = group("fuente");
  const mediaRota = group("media").map((m) => ({ ...m, label: m.label && m.label !== m.key ? m.label : prettyName(m.key.split("/").pop() ?? m.key) }));
  const incidentesData = {
    fuentes: top(fuentes as any, 20),
    fuentes_total: fuentes.reduce((s, f) => s + f.count, 0),
    fuentes_segundos: fuentes.reduce((s, f) => s + f.seconds, 0),
    camaras: top(group("camara") as any, 20),
    media: top(mediaRota as any, 20),
  };
  const camarasTotal = incidents.filter((i) => i.kind === "camara").length;
  const mediaTotal = mediaRota.length;

  // ---- 4. Personas (programadores y generadores) ----
  const staff = profiles.filter((p) => (p.role === "programador" || p.role === "generador") && !hidden(p.id));
  const personas = staff.map((p) => {
    const mine = visibleActs.filter((a) => a.actor_id === p.id);
    const ses = sessions.filter((s) => s.user_id === p.id);
    const horas = new Array<number>(24).fill(0);
    const dias = new Set<string>();
    for (const a of mine) { horas[hourOf(a.ms)]!++; dias.add(dayKey(a.ms)); }
    let activo = 0;
    for (const s of ses) {
      const st = Date.parse(s.started_at);
      horas[hourOf(st)]!++;
      dias.add(dayKey(st));
      activo += Math.max(0, (Date.parse(s.ended_at ?? s.last_seen_at) - st) / 1000);
    }
    const max = Math.max(...horas);
    return {
      id: p.id as string, name: nameOf.get(p.id) ?? "—", role: p.role as string,
      creados: created.filter((c) => c.created_by === p.id).length,
      editados: count(mine, "contenido.editar"),
      papelera: count(mine, "contenido.papelera"),
      envios: count(mine, "parrilla.publicar"),
      sesiones: ses.length,
      dias_activos: dias.size,
      sesiones_por_dia: dias.size ? Math.round((ses.length / dias.size) * 10) / 10 : 0,
      segundos_activo: Math.round(activo),
      hora_pico: max > 0 ? horas.indexOf(max) : null,
      horas,
    };
  }).sort((a, b) => b.creados + b.editados + b.envios - (a.creados + a.editados + a.envios));
  const horasGlobal = new Array<number>(24).fill(0);
  for (const p of personas) p.horas.forEach((n, h) => { horasGlobal[h]! += n; });

  // ---- 5. Seguridad ----
  const emails = new Map<string, number>();
  for (const l of logins) emails.set(l.email ?? "—", (emails.get(l.email ?? "—") ?? 0) + 1);
  const gente = visibleActs.filter((a) => ["usuario.rol", "usuario.invitar", "usuario.link", "usuario.desactivar", "usuario.activar", "usuario.eliminar"].includes(a.action));
  const seguridad = {
    login_fallidos: logins.length,
    login_top: top([...emails].map(([email, count]) => ({ email, count })), 5),
    cambios_rol: count(visibleActs, "usuario.rol"),
    invitaciones: count(visibleActs, "usuario.invitar", "usuario.link"),
    desactivados: count(visibleActs, "usuario.desactivar"),
    reactivados: count(visibleActs, "usuario.activar"),
    eliminados: count(visibleActs, "usuario.eliminar"),
    borrados: {
      contenidos_papelera: count(visibleActs, "contenido.papelera"),
      contenidos_definitivo: count(visibleActs, "contenido.purgar"),
      banco_papelera: sumMeta(visibleActs, "banco.borrar"),
      banco_definitivo: sumMeta(visibleActs, "banco.purgar"),
    },
    eventos: gente.slice(-60).reverse().map((a) => ({ at: a.at, by: a.actor_name, summary: a.summary })),
  };

  // ---- 6. Almacenamiento (media_files: sin la migración 0017 no hay datos) ----
  const mediaReady = !notes.some((n) => n.startsWith("almacenamiento"));
  const inPeriod = media.filter((m) => Date.parse(m.created_at) >= from);
  const kinds = new Map<string, { files: number; bytes: number }>();
  for (const m of media) {
    const k = kinds.get(m.kind) ?? { files: 0, bytes: 0 };
    k.files++; k.bytes += Number(m.size) || 0;
    kinds.set(m.kind, k);
  }
  let sinUso: { files: number; bytes: number } | null = null;
  if (mediaReady && media.length) {
    try {
      const usage = await loadUsage(sb);
      const cut = now - UNUSED_DAYS * DAY;
      const list = media.filter((m) => !m.deleted_at && m.bucket !== "backgrounds" && Date.parse(m.created_at) < cut && usageOf(usage, m as never).count === 0);
      sinUso = { files: list.length, bytes: list.reduce((s, m) => s + (Number(m.size) || 0), 0) };
    } catch { /* noop */ }
  }
  const almacenamiento = {
    disponible: mediaReady,
    total_bytes: media.reduce((s, m) => s + (Number(m.size) || 0), 0),
    total_files: media.length,
    crecimiento_bytes: inPeriod.reduce((s, m) => s + (Number(m.size) || 0), 0),
    crecimiento_files: inPeriod.length,
    papelera_bytes: media.filter((m) => m.deleted_at).reduce((s, m) => s + (Number(m.size) || 0), 0),
    por_tipo: [...kinds].map(([kind, v]) => ({ kind, ...v })),
    sin_uso: sinUso,
    dias_sin_uso: UNUSED_DAYS,
  };

  // ---- 7. Publicidad: salidas al aire por aviso ----
  const pub = new Map<string, number>();
  for (const a of airings) {
    const t = (a.content_type as string) || typeById.get(a.content_item_id);
    if (t === "publicidad") pub.set(a.content_item_id, (pub.get(a.content_item_id) ?? 0) + 1);
  }
  const publicidad = {
    total: [...pub.values()].reduce((s, n) => s + n, 0),
    avisos: top([...pub].map(([id, count]) => {
      const d = (titleById.get(id)?.data ?? {}) as Row;
      const file = typeof d.media_url === "string" ? prettyName(decodeURIComponent(d.media_url.split("/").pop() ?? "")) : "";
      return { id, count, label: d.title ? String(d.title) : `${d.format === "vertical" ? "Vertical" : "Full"}${file ? ` · ${file}` : ""}`, media_url: d.media_url ?? null, kind: d.media_kind ?? null };
    }), 50),
  };

  return {
    produccion, emision, incidentes: { ...incidentesData, camaras_total: camarasTotal, media_total: mediaTotal },
    personas: { lista: personas, horas: horasGlobal }, seguridad, almacenamiento, publicidad, notas: notes,
  };
}

export function reportsRouter(): Router {
  const r = Router();
  r.use(requireAuth, requirePerm("reportes"));

  // ?period=week|month&start=YYYY-MM-DD (cualquier día del período; por defecto, el actual)
  r.get("/summary", async (req, res) => {
    if (!getSupabase()) return res.status(503).json({ error: "sin base de datos" });
    const period: PeriodKind = req.query.period === "week" ? "week" : "month";
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof req.query.start === "string" ? req.query.start : "");
    const anchor = m ? fromLocalDate(+m[1]!, +m[2]! - 1, +m[3]!) + 12 * 3_600_000 : Date.now();
    const cur = rangeFor(period, anchor);
    const prev = previousRange(cur);
    const master = req.user!.role === "master";
    try {
      const [current, previous] = await Promise.all([buildReport(cur, master), buildReport(prev, master)]);
      previous.almacenamiento.sin_uso = null; // el "sin uso" es del estado de hoy: no se compara

      // Nombre de cada Sesión (las salidas se agregaron por id).
      const sessIds = [...new Set([...current.emision.por_sesion, ...previous.emision.por_sesion].map((s) => s.session_id))];
      if (sessIds.length) {
        const { data: sessRows } = await getSupabase()!.from("sessions").select("id, name").in("id", sessIds);
        const nameOf = new Map((sessRows ?? []).map((s) => [s.id, s.name]));
        for (const rep of [current, previous]) for (const s of rep.emision.por_sesion) (s as any).name = nameOf.get(s.session_id) ?? "(sesión borrada)";
      }
      const ymd = dayKey;
      res.json({
        period, start: ymd(cur.from), end: ymd(cur.to - 1), label: cur.label, in_progress: Date.now() < cur.to,
        previous_label: prev.label, prev_start: ymd(prev.from),
        next_start: cur.to <= Date.now() ? ymd(cur.to) : null,
        current, previous, generated_at: new Date().toISOString(),
      });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "no se pudo armar el reporte" });
    }
  });

  return r;
}
