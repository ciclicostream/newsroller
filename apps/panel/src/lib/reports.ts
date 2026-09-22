import { api } from "./api";
import { fmtSize } from "./banco";
import { TIPO_BY_KEY } from "./tipos";

export type PeriodKind = "week" | "month";
interface Counted { count: number }
export interface Report {
  produccion: { creados: number; editados: number; papelera: number; por_tipo: Array<{ type: string; count: number }> };
  emision: {
    envios_a_vivo: number; envios_por_persona: Array<{ name: string; count: number }>;
    cortes: number; segundos_fuera: number; cortes_lista: Array<{ start: string; end: string | null; seconds: number; by: string | null }>;
    bloques: number; segundos_aire: number; por_tipo: Array<{ type: string; count: number; seconds: number }>; con_tipo: number;
    vertical?: { bloques: number; segundos_aire: number; por_tipo: Array<{ type: string; count: number; seconds: number }> };
    por_sesion: Array<{ session_id: string; name?: string; count: number; seconds: number }>;
  };
  incidentes: {
    fuentes: Array<Counted & { key: string; label: string; seconds: number; detail: string | null }>; fuentes_total: number; fuentes_segundos: number;
    camaras: Array<Counted & { key: string; label: string }>; camaras_total: number;
    media: Array<Counted & { key: string; label: string }>; media_total: number;
  };
  personas: {
    lista: Array<{
      id: string; name: string; role: string; creados: number; editados: number; papelera: number; envios: number; sesiones: number;
      dias_activos: number; sesiones_por_dia: number; segundos_activo: number; hora_pico: number | null; horas: number[];
    }>;
    horas: number[];
  };
  seguridad: {
    login_fallidos: number; login_top: Array<Counted & { email: string }>; cambios_rol: number; invitaciones: number; desactivados: number; reactivados: number; eliminados: number;
    borrados: { contenidos_papelera: number; contenidos_definitivo: number; banco_papelera: number; banco_definitivo: number };
    eventos: Array<{ at: string; by: string | null; summary: string | null }>;
  };
  almacenamiento: {
    disponible: boolean; total_bytes: number; total_files: number; crecimiento_bytes: number; crecimiento_files: number; papelera_bytes: number;
    por_tipo: Array<{ kind: string; files: number; bytes: number }>; sin_uso: { files: number; bytes: number } | null; dias_sin_uso: number;
  };
  publicidad: { total: number; avisos: Array<Counted & { id: string; label: string; media_url: string | null; kind: string | null }> };
  notas: string[];
}
export interface ReportResponse {
  period: PeriodKind; start: string; end: string; label: string; in_progress: boolean;
  previous_label: string; prev_start: string; next_start: string | null;
  current: Report; previous: Report; generated_at: string;
}

export const reportsApi = {
  get: (period: PeriodKind, start?: string) => api.get<ReportResponse>(`/api/reports/summary?period=${period}${start ? `&start=${start}` : ""}`),
};

export const fmtDur = (s: number): string => {
  s = Math.max(0, Math.round(s));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${String(m % 60).padStart(2, "0")} min`;
};
export const fmtHour = (h: number | null) => (h == null ? "—" : `${String(h).padStart(2, "0")}:00`);
export const typeLabel = (t: string) => TIPO_BY_KEY[t]?.label ?? t;
export const fmtWhen = (iso: string) => new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Métricas de resumen: alimentan las tarjetas y el CSV (valor actual y del período anterior).
export type MetricKind = "num" | "dur" | "bytes";
export interface Metric { section: string; label: string; cur: number; prev: number; kind: MetricKind; lowerIsBetter?: boolean }
export function metrics(c: Report, p: Report): Metric[] {
  const m = (section: string, label: string, a: number, b: number, kind: MetricKind = "num", lowerIsBetter = false): Metric => ({ section, label, cur: a, prev: b, kind, lowerIsBetter });
  return [
    m("Producción", "Contenidos nuevos", c.produccion.creados, p.produccion.creados),
    m("Producción", "Contenidos editados", c.produccion.editados, p.produccion.editados),
    m("Producción", "Enviados a la papelera", c.produccion.papelera, p.produccion.papelera, "num", true),
    m("Emisión", "Envíos a vivo", c.emision.envios_a_vivo, p.emision.envios_a_vivo),
    m("Emisión", "Cortes del aire", c.emision.cortes, p.emision.cortes, "num", true),
    m("Emisión", "Tiempo fuera de aire", c.emision.segundos_fuera, p.emision.segundos_fuera, "dur", true),
    m("Emisión", "Bloques emitidos", c.emision.bloques, p.emision.bloques),
    m("Emisión", "Tiempo al aire (bloques)", c.emision.segundos_aire, p.emision.segundos_aire, "dur"),
    m("Emisión vertical", "Bloques emitidos (vertical)", c.emision.vertical?.bloques ?? 0, p.emision.vertical?.bloques ?? 0),
    m("Emisión vertical", "Tiempo al aire (vertical)", c.emision.vertical?.segundos_aire ?? 0, p.emision.vertical?.segundos_aire ?? 0, "dur"),
    m("Incidentes", "Caídas de fuentes de datos", c.incidentes.fuentes_total, p.incidentes.fuentes_total, "num", true),
    m("Incidentes", "Tiempo caídas de fuentes", c.incidentes.fuentes_segundos, p.incidentes.fuentes_segundos, "dur", true),
    m("Incidentes", "Cámaras sin señal", c.incidentes.camaras_total, p.incidentes.camaras_total, "num", true),
    m("Incidentes", "Fotos o videos rotos", c.incidentes.media_total, p.incidentes.media_total, "num", true),
    m("Seguridad", "Ingresos fallidos", c.seguridad.login_fallidos, p.seguridad.login_fallidos, "num", true),
    m("Seguridad", "Cambios de rol", c.seguridad.cambios_rol, p.seguridad.cambios_rol),
    m("Seguridad", "Invitaciones", c.seguridad.invitaciones, p.seguridad.invitaciones),
    m("Seguridad", "Perfiles desactivados", c.seguridad.desactivados, p.seguridad.desactivados),
    m("Almacenamiento", "Espacio usado", c.almacenamiento.total_bytes, p.almacenamiento.total_bytes, "bytes"),
    m("Almacenamiento", "Crecimiento del período", c.almacenamiento.crecimiento_bytes, p.almacenamiento.crecimiento_bytes, "bytes"),
    m("Publicidad", "Salidas al aire de avisos", c.publicidad.total, p.publicidad.total),
  ];
}
export const fmtMetric = (v: number, k: MetricKind) => (k === "dur" ? fmtDur(v) : k === "bytes" ? fmtSize(v) : String(v));

// ---- CSV (punto y coma + BOM: se abre bien en Excel en español) ----
const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function buildCsv(r: ReportResponse): string {
  const c = r.current, p = r.previous;
  const out: unknown[][] = [];
  const blank = () => out.push([]);
  out.push(["Reporte Cíclico", r.label], ["Comparado con", r.previous_label], ["Generado", fmtWhen(r.generated_at)]);
  out.push(["Aviso", "Los datos de incidentes, salidas al aire de todos los tipos, ingresos fallidos y Banco empiezan a acumularse desde que se implementaron."]);
  blank();
  out.push(["Sección", "Métrica", r.label, r.previous_label, "Diferencia"]);
  for (const m of metrics(c, p)) out.push([m.section, m.label, fmtMetric(m.cur, m.kind), fmtMetric(m.prev, m.kind), fmtMetric(m.cur - m.prev, m.kind)]);

  const table = (title: string, head: string[], rows: unknown[][]) => {
    if (!rows.length) return;
    blank(); out.push([title]); out.push(head); rows.forEach((x) => out.push(x));
  };
  table("Producción: contenidos nuevos por tipo", ["Tipo", "Cantidad"], c.produccion.por_tipo.map((t) => [typeLabel(t.type), t.count]));
  table("Emisión: envíos a vivo por persona", ["Persona", "Envíos"], c.emision.envios_por_persona.map((t) => [t.name, t.count]));
  table("Emisión: cortes del aire", ["Desde", "Hasta", "Duración", "Quién"], c.emision.cortes_lista.map((k) => [fmtWhen(k.start), k.end ? fmtWhen(k.end) : "sigue cortado", fmtDur(k.seconds), k.by ?? ""]));
  table("Emisión: bloques emitidos por tipo", ["Tipo", "Bloques", "Tiempo al aire"], c.emision.por_tipo.map((t) => [typeLabel(t.type), t.count, fmtDur(t.seconds)]));
  table("Emisión vertical: bloques por tipo", ["Tipo", "Bloques", "Tiempo al aire"], (c.emision.vertical?.por_tipo ?? []).map((t) => [typeLabel(t.type), t.count, fmtDur(t.seconds)]));
  table("Sesiones: salidas al aire", ["Sesión", "Bloques", "Tiempo al aire"], c.emision.por_sesion.map((x) => [x.name ?? x.session_id, x.count, fmtDur(x.seconds)]));
  table("Incidentes: fuentes de datos", ["Fuente", "Caídas", "Tiempo caída", "Último error"], c.incidentes.fuentes.map((f) => [f.label, f.count, fmtDur(f.seconds), f.detail ?? ""]));
  table("Incidentes: cámaras sin señal", ["Cámara", "Veces"], c.incidentes.camaras.map((f) => [f.label, f.count]));
  table("Incidentes: fotos o videos rotos", ["Archivo", "Veces"], c.incidentes.media.map((f) => [f.label, f.count]));
  table("Personas", ["Persona", "Rol", "Creados", "Editados", "Papelera", "Envíos a vivo", "Sesiones", "Días activos", "Sesiones por día", "Tiempo activo", "Hora pico"],
    c.personas.lista.map((x) => [x.name, x.role, x.creados, x.editados, x.papelera, x.envios, x.sesiones, x.dias_activos, x.sesiones_por_dia, fmtDur(x.segundos_activo), fmtHour(x.hora_pico)]));
  table("Actividad por hora del día", ["Hora", "Acciones y ingresos"], c.personas.horas.map((n, h) => [fmtHour(h), n]));
  table("Seguridad: ingresos fallidos por correo", ["Correo", "Intentos"], c.seguridad.login_top.map((x) => [x.email, x.count]));
  table("Seguridad: eventos de personas", ["Cuándo", "Quién", "Qué"], c.seguridad.eventos.map((e) => [fmtWhen(e.at), e.by ?? "", e.summary ?? ""]));
  table("Almacenamiento por tipo", ["Tipo", "Archivos", "Espacio"], c.almacenamiento.por_tipo.map((t) => [t.kind, t.files, fmtSize(t.bytes)]));
  if (c.almacenamiento.sin_uso) table("Almacenamiento: sin uso", ["Métrica", "Valor"], [[`Archivos sin uso hace más de ${c.almacenamiento.dias_sin_uso} días`, c.almacenamiento.sin_uso.files], ["Espacio que ocupan", fmtSize(c.almacenamiento.sin_uso.bytes)]]);
  table("Publicidad: salidas al aire por aviso", ["Aviso", "Salidas"], c.publicidad.avisos.map((a) => [a.label, a.count]));

  return "﻿" + out.map((row) => row.map(cell).join(";")).join("\r\n");
}
export function downloadCsv(r: ReportResponse) {
  const blob = new Blob([buildCsv(r)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `reporte-ciclico-${r.period === "week" ? "semana" : "mes"}-${r.start}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
