import { useEffect, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, FileText, Loader2, Minus, TriangleAlert } from "lucide-react";
import { ROLE_LABEL, normalizeRole } from "@newsroller/shared";
import { fmtSize } from "../lib/banco";
import {
  downloadCsv, fmtDur, fmtHour, fmtMetric, fmtWhen, metrics, reportsApi, typeLabel,
  type Metric, type PeriodKind, type ReportResponse,
} from "../lib/reports";
import { toast } from "../lib/toast";

// Reporte semanal / mensual (Master y Administrador): elegir período, comparar con el anterior, exportar a PDF y CSV.
export function Reportes() {
  const [period, setPeriod] = useState<PeriodKind>("month");
  const [start, setStart] = useState<string | undefined>(undefined);
  const [rep, setRep] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setErr(null);
    reportsApi.get(period, start)
      .then((r) => { if (live) setRep(r); })
      .catch((e) => { if (live) setErr(e instanceof Error ? e.message : "no se pudo cargar el reporte"); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [period, start]);

  const ms = rep ? metrics(rep.current, rep.previous) : [];
  const get = (label: string) => ms.find((m) => m.label === label)!;

  return (
    <div className="report">
      <div className="page-head no-print">
        <div>
          <h1>Reportes</h1>
          <p>Producción, emisión, incidentes, personas, seguridad y almacenamiento, comparados con el período anterior.</p>
        </div>
        <div className="row" style={{ alignItems: "center" }}>
          <button className="btn" disabled={!rep} onClick={() => rep && downloadCsv(rep)}><Download size={16} /> CSV</button>
          <button className="btn primary" disabled={!rep} onClick={() => { toast("En el diálogo de impresión elegí \"Guardar como PDF\".", "info"); setTimeout(() => window.print(), 300); }}>
            <FileText size={16} /> PDF
          </button>
        </div>
      </div>

      <div className="rp-controls no-print">
        <div className="rp-seg">
          <button className={period === "week" ? "on" : ""} onClick={() => { setPeriod("week"); setStart(undefined); }}>Semanal</button>
          <button className={period === "month" ? "on" : ""} onClick={() => { setPeriod("month"); setStart(undefined); }}>Mensual</button>
        </div>
        <button className="icon-btn rp-nav" disabled={!rep} onClick={() => rep && setStart(rep.prev_start)} aria-label="Anterior"><ChevronLeft size={18} /></button>
        <div className="rp-label">{rep?.label ?? "…"}{rep?.in_progress && <span className="rp-tag">en curso</span>}</div>
        <button className="icon-btn rp-nav" disabled={!rep?.next_start} onClick={() => rep?.next_start && setStart(rep.next_start)} aria-label="Siguiente"><ChevronRight size={18} /></button>
        {start && <button className="btn" onClick={() => setStart(undefined)}>Ir al actual</button>}
      </div>

      {err && <div className="alert error">{err}</div>}
      {loading && !rep && <div className="uploading"><Loader2 size={16} className="spin" /> Armando el reporte…</div>}

      {rep && (
        <div style={{ opacity: loading ? 0.5 : 1, transition: "opacity .15s" }}>
          <div className="rp-print-head">
            <h2>Reporte Cíclico — {rep.label}</h2>
            <div>Comparado con {rep.previous_label} · generado {fmtWhen(rep.generated_at)}</div>
          </div>

          <div className="alert info rp-warn">
            <TriangleAlert size={16} style={{ flex: "none" }} />
            <span>
              Los datos empiezan a acumularse desde que se implementaron: incidentes, salidas al aire de todos los tipos, ingresos fallidos y Banco.
              Antes de eso sólo existen las fechas de creación de contenidos, la actividad registrada y las salidas de Publicidad.
              {rep.current.notas.length > 0 && <> No se pudo leer: {rep.current.notas.join("; ")}.</>}
            </span>
          </div>

          <div className="rp-kpis">
            {["Contenidos nuevos", "Envíos a vivo", "Cortes del aire", "Tiempo fuera de aire", "Caídas de fuentes de datos", "Ingresos fallidos"].map((l) => <Kpi key={l} m={get(l)} prevLabel={rep.previous_label} />)}
          </div>

          <Produccion r={rep} />
          <Emision r={rep} />
          <Incidentes r={rep} />
          <Personas r={rep} />
          <Seguridad r={rep} />
          <Almacenamiento r={rep} get={get} />
          <Publicidad r={rep} />
        </div>
      )}
    </div>
  );
}

// ---- Piezas ----
function Delta({ m }: { m: Metric }) {
  const d = m.cur - m.prev;
  if (d === 0) return <span className="rp-delta flat"><Minus size={13} /> igual</span>;
  const good = m.lowerIsBetter ? d < 0 : d > 0;
  return (
    <span className={"rp-delta " + (good ? "good" : "bad")}>
      {d > 0 ? <ArrowUp size={13} /> : <ArrowDown size={13} />} {d > 0 ? "+" : "−"}{fmtMetric(Math.abs(d), m.kind)}
    </span>
  );
}
function Kpi({ m, prevLabel }: { m: Metric; prevLabel: string }) {
  return (
    <div className="card rp-kpi">
      <div className="muted-note">{m.label}</div>
      <div className="rp-big">{fmtMetric(m.cur, m.kind)}</div>
      <div className="rp-sub"><Delta m={m} /> <span className="muted-note" title={prevLabel}>antes: {fmtMetric(m.prev, m.kind)}</span></div>
    </div>
  );
}
function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="card rp-sec">
      <h2><span className="rp-n">{n}</span>{title}</h2>
      {children}
    </section>
  );
}
function Table({ head, rows, empty = "Sin datos en este período." }: { head: string[]; rows: ReactNode[][]; empty?: string }) {
  if (!rows.length) return <div className="muted-note rp-empty">{empty}</div>;
  return (
    <div className="rp-tablewrap">
      <table className="rp-table">
        <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
function Stats({ items }: { items: Array<[string, ReactNode]> }) {
  return <div className="rp-stats">{items.map(([l, v]) => <div key={l}><div className="muted-note">{l}</div><b>{v}</b></div>)}</div>;
}
function Hours({ horas }: { horas: number[] }) {
  const max = Math.max(1, ...horas);
  return (
    <div className="rp-hours" role="img" aria-label="Actividad por hora del día">
      {horas.map((n, h) => (
        <div key={h} className="rp-hour" title={`${fmtHour(h)}: ${n}`}>
          <div className="rp-bar" style={{ height: `${Math.max(2, (n / max) * 100)}%`, opacity: n ? 1 : 0.25 }} />
          <span>{h % 3 === 0 ? String(h).padStart(2, "0") : ""}</span>
        </div>
      ))}
    </div>
  );
}

function Produccion({ r }: { r: ReportResponse }) {
  const c = r.current.produccion;
  return (
    <Section n={1} title="Producción">
      <Stats items={[["Contenidos nuevos", c.creados], ["Editados", c.editados], ["Enviados a la papelera", c.papelera]]} />
      <h3>Nuevos por tipo</h3>
      <Table head={["Tipo", "Cantidad"]} rows={c.por_tipo.map((t) => [typeLabel(t.type), t.count])} />
      <h3>Por persona</h3>
      <Table head={["Persona", "Rol", "Nuevos", "Editados", "A la papelera"]}
        rows={r.current.personas.lista.map((p) => [p.name, ROLE_LABEL[normalizeRole(p.role)], p.creados, p.editados, p.papelera])}
        empty="Sin programadores ni generadores." />
    </Section>
  );
}

function Emision({ r }: { r: ReportResponse }) {
  const e = r.current.emision;
  return (
    <Section n={2} title="Emisión">
      <Stats items={[["Envíos a vivo", e.envios_a_vivo], ["Cortes del aire", e.cortes], ["Tiempo fuera de aire", fmtDur(e.segundos_fuera)], ["Bloques emitidos", e.bloques], ["Tiempo al aire", fmtDur(e.segundos_aire)]]} />
      {e.bloques > 0 && e.con_tipo < e.bloques && (
        <div className="muted-note rp-empty">Hasta el momento en que se amplió el registro, sólo Publicidad quedaba anotada: los bloques anteriores figuran con su tipo deducido y sin duración.</div>
      )}
      <div className="rp-two">
        <div><h3>Envíos a vivo por persona</h3><Table head={["Persona", "Envíos"]} rows={e.envios_por_persona.map((x) => [x.name, x.count])} /></div>
        <div><h3>Bloques por tipo</h3><Table head={["Tipo", "Bloques", "Tiempo"]} rows={e.por_tipo.map((x) => [typeLabel(x.type), x.count, x.seconds ? fmtDur(x.seconds) : "—"])} /></div>
      </div>
      {(e.vertical?.bloques ?? 0) > 0 && (
        <>
          <h3>Output vertical (se cuenta aparte)</h3>
          <Stats items={[["Bloques emitidos", e.vertical!.bloques], ["Tiempo al aire", fmtDur(e.vertical!.segundos_aire)]]} />
          <Table head={["Tipo", "Bloques", "Tiempo"]} rows={e.vertical!.por_tipo.map((x) => [typeLabel(x.type), x.count, x.seconds ? fmtDur(x.seconds) : "—"])} />
        </>
      )}
      <h3>Cortes del aire</h3>
      <Table head={["Desde", "Hasta", "Duración", "Quién"]} rows={e.cortes_lista.map((k) => [fmtWhen(k.start), k.end ? fmtWhen(k.end) : "sigue cortado", fmtDur(k.seconds), k.by ?? "—"])} empty="No hubo cortes del aire." />
    </Section>
  );
}

function Incidentes({ r }: { r: ReportResponse }) {
  const i = r.current.incidentes;
  return (
    <Section n={3} title="Incidentes">
      <Stats items={[["Caídas de fuentes", i.fuentes_total], ["Tiempo caídas", fmtDur(i.fuentes_segundos)], ["Cámaras sin señal", i.camaras_total], ["Fotos o videos rotos", i.media_total]]} />
      <h3>Fuentes de datos (dólar, clima, ticker…)</h3>
      <Table head={["Fuente", "Caídas", "Tiempo caída", "Último error"]} rows={i.fuentes.map((f) => [f.label, f.count, fmtDur(f.seconds), <span className="muted-note">{f.detail ?? "—"}</span>])} empty="Sin caídas registradas." />
      <div className="rp-two">
        <div><h3>Cámaras sin señal</h3><Table head={["Cámara", "Veces"]} rows={i.camaras.map((f) => [f.label, f.count])} empty="Sin incidentes de cámaras." /></div>
        <div><h3>Fotos o videos que no cargan</h3><Table head={["Archivo", "Veces"]} rows={i.media.map((f) => [f.label, f.count])} empty="Sin media rota detectada." /></div>
      </div>
      <div className="muted-note rp-empty">Las cámaras de YouTube o de página incrustada no permiten detectar la falta de señal; sólo se registran las de imagen y HLS.</div>
    </Section>
  );
}

function Personas({ r }: { r: ReportResponse }) {
  const p = r.current.personas;
  return (
    <Section n={4} title="Personas">
      <Table head={["Persona", "Rol", "Nuevos", "Editados", "Envíos", "Sesiones", "Días activos", "Sesiones por día", "Tiempo activo", "Hora pico"]}
        rows={p.lista.map((x) => [x.name, ROLE_LABEL[normalizeRole(x.role)], x.creados, x.editados, x.envios, x.sesiones, x.dias_activos, x.sesiones_por_dia, fmtDur(x.segundos_activo), fmtHour(x.hora_pico)])}
        empty="Sin programadores ni generadores." />
      <h3>Horarios pico (ingresos y acciones, hora de Argentina)</h3>
      <Hours horas={p.horas} />
      <div className="muted-note rp-empty">El tiempo activo cuenta desde que se abre la sesión hasta la última actividad registrada.</div>
    </Section>
  );
}

function Seguridad({ r }: { r: ReportResponse }) {
  const s = r.current.seguridad;
  return (
    <Section n={5} title="Seguridad">
      <Stats items={[["Ingresos fallidos", s.login_fallidos], ["Cambios de rol", s.cambios_rol], ["Invitaciones", s.invitaciones], ["Perfiles desactivados", s.desactivados], ["Perfiles eliminados", s.eliminados]]} />
      <div className="rp-two">
        <div>
          <h3>Borrados</h3>
          <Table head={["Qué", "Cantidad"]} rows={[
            ["Contenidos a la papelera", s.borrados.contenidos_papelera], ["Contenidos eliminados definitivamente", s.borrados.contenidos_definitivo],
            ["Archivos del Banco a la papelera", s.borrados.banco_papelera], ["Archivos del Banco eliminados definitivamente", s.borrados.banco_definitivo],
          ]} />
        </div>
        <div><h3>Ingresos fallidos por correo</h3><Table head={["Correo", "Intentos"]} rows={s.login_top.map((x) => [x.email, x.count])} empty="Sin intentos fallidos." /></div>
      </div>
      <h3>Cambios de personas</h3>
      <Table head={["Cuándo", "Quién", "Qué"]} rows={s.eventos.map((e) => [fmtWhen(e.at), e.by ?? "—", e.summary ?? "—"])} empty="Sin cambios de roles, invitaciones ni desactivaciones." />
      <div className="muted-note rp-empty">Los ingresos fallidos sólo cuentan los intentos hechos desde la pantalla de ingreso del panel.</div>
    </Section>
  );
}

function Almacenamiento({ r, get }: { r: ReportResponse; get: (l: string) => Metric }) {
  const a = r.current.almacenamiento;
  if (!a.disponible) return <Section n={6} title="Almacenamiento"><div className="muted-note">Todavía no hay datos: falta correr la migración del Banco (0017).</div></Section>;
  return (
    <Section n={6} title="Almacenamiento">
      <div className="rp-kpis" style={{ marginBottom: 12 }}>
        <Kpi m={get("Espacio usado")} prevLabel={r.previous_label} />
        <Kpi m={get("Crecimiento del período")} prevLabel={r.previous_label} />
      </div>
      <Stats items={[
        ["Archivos", a.total_files], ["Crecimiento (archivos)", a.crecimiento_files], ["En la papelera", fmtSize(a.papelera_bytes)],
        [`Sin uso hace más de ${a.dias_sin_uso} días`, a.sin_uso ? `${a.sin_uso.files} · ${fmtSize(a.sin_uso.bytes)}` : "—"],
      ]} />
      <Table head={["Tipo", "Archivos", "Espacio"]} rows={a.por_tipo.map((t) => [t.kind, t.files, fmtSize(t.bytes)])} />
      <div className="muted-note rp-empty">"Sin uso" refleja el estado de hoy, no del período.</div>
    </Section>
  );
}

function Publicidad({ r }: { r: ReportResponse }) {
  const p = r.current.publicidad;
  return (
    <Section n={7} title="Publicidad">
      <Stats items={[["Salidas al aire de avisos", p.total], ["Período anterior", r.previous.publicidad.total]]} />
      <Table head={["Aviso", "Salidas al aire"]} rows={p.avisos.map((a) => [
        <span className="rp-ad">{a.media_url && a.kind === "image" && <img src={a.media_url} alt="" />}{a.label}</span>, a.count,
      ])} empty="Ningún aviso salió al aire en este período." />
    </Section>
  );
}
