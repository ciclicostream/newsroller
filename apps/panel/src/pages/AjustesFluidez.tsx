import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { api } from "../lib/api";

// Ajustes → Fluidez del aire: cuántos cuadros por segundo entrega cada output real (OBS/vMix) y en qué
// contenidos se corta. Los datos los manda el propio output cada minuto (apps/output/src/lib/perf.ts); el
// server guarda las últimas 24 h en memoria, así que se reinician con el server.
interface Row { minutos: number; fpsPromedio: number; medianaMs: number; p99Max: number; maxMs: number; saltosPct: number; tironesPct: number; congelados: number; tareasLargas: number }
interface Client { orientation: string; ua?: string; screen?: string; uptimeMin: number; heapMb: number | null; ultimoReporte: string; porContenido: Record<string, Row> }

const HOURS = [1, 6, 24];
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
const uptime = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`);
// Mediana ≈ 33 ms = la fuente de navegador corre a 30 fps; ≈ 16,7 ms = a 60 fps.
const nominal = (ms: number) => (ms >= 28 ? "30 fps" : ms >= 14 ? "60 fps" : ms > 0 ? "más de 60 fps" : "—");
const tone = (r: Row) => (r.congelados > 0 || r.saltosPct >= 3 ? "bad" : r.saltosPct >= 1 ? "warn" : "ok");

export function AjustesFluidez() {
  const [data, setData] = useState<Record<string, Client> | null>(null);
  const [hours, setHours] = useState(24);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true); setErr(null);
    api.get<Record<string, Client>>(`/api/perf?hours=${hours}`).then(setData).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, [hours]);
  useEffect(() => { const t = setInterval(load, 60_000); return () => clearInterval(t); }, [hours]);

  const clients = data ? Object.entries(data) : [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Fluidez del aire</h1>
          <p>Cuadros por segundo de cada output al aire y en qué contenidos se corta. Se actualiza solo cada minuto.</p>
        </div>
        <Link to="/ajustes" className="btn"><ArrowLeft size={16} /> Ajustes</Link>
      </div>

      {err && <div className="alert error">{err}</div>}

      <section className="card sec-card">
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="muted-note">Período:</span>
          {HOURS.map((h) => (
            <button key={h} type="button" className={"btn" + (hours === h ? " primary" : "")} onClick={() => setHours(h)}>{h === 1 ? "1 hora" : `${h} horas`}</button>
          ))}
          <button type="button" className="btn" onClick={load} disabled={loading} style={{ marginLeft: "auto" }}><RefreshCw size={14} /> Actualizar</button>
        </div>
      </section>

      {data == null ? <div className="muted-note">Cargando…</div> : clients.length === 0 ? (
        <section className="card sec-card">
          <div className="muted-note">Todavía no llegó ningún reporte. Hace falta un output real abierto (OBS/vMix, no el monitor del panel) con el server en marcha. Los reportes llegan cada minuto.</div>
        </section>
      ) : clients.map(([id, c]) => {
        const rows = Object.entries(c.porContenido).sort((a, b) => b[1].saltosPct - a[1].saltosPct);
        const med = rows.length ? rows.reduce((s, [, r]) => s + r.medianaMs * r.minutos, 0) / Math.max(0.001, rows.reduce((s, [, r]) => s + r.minutos, 0)) : 0;
        return (
          <section key={id} className="card sec-card" style={{ marginTop: 16 }}>
            <h2 style={{ marginBottom: 4 }}>Output {c.orientation} <span className="muted-note">· {id}</span></h2>
            <div className="muted-note" style={{ marginBottom: 12 }}>
              Fuente de navegador a <b>{nominal(med)}</b> · encendido hace {uptime(c.uptimeMin)} · memoria {c.heapMb != null ? `${c.heapMb} MB` : "—"} · último reporte {hhmm(c.ultimoReporte)}{c.screen ? ` · ${c.screen}` : ""}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="tbl" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Contenido</th><th>Tiempo</th><th>fps</th><th>Cuadros con saltos</th><th>Tirones</th><th>Congelados</th><th>Peor cuadro</th><th>Bloqueos del script</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([l, r]) => (
                    <tr key={l} className={"fl-" + tone(r)}>
                      <td style={{ textAlign: "left", fontWeight: 600 }}>{l}</td>
                      <td>{r.minutos < 1 ? "<1 min" : `${Math.round(r.minutos)} min`}</td>
                      <td>{r.fpsPromedio}</td>
                      <td>{r.saltosPct}%</td>
                      <td>{r.tironesPct}%</td>
                      <td>{r.congelados}</td>
                      <td>{r.maxMs} ms</td>
                      <td>{r.tareasLargas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <section className="card sec-card" style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 6 }}>Cómo leerlo</h3>
        <ul className="muted-note" style={{ paddingLeft: 18, display: "grid", gap: 4 }}>
          <li><b>30 fps</b> en la fuente de navegador: el ticker se ve entrecortado aunque nada falle. Subila a 60 en OBS (o igualala al lienzo) y revisá que esté activa la aceleración por hardware.</li>
          <li><b>Saltos</b>: cuadros que tardaron más de 1,5 veces lo normal. <b>Tirones</b>: más de 3 veces. <b>Congelados</b>: más de 6 veces.</li>
          <li>Si los saltos se concentran en uno o dos contenidos, esos contenidos son pesados para la máquina que transmite.</li>
          <li><b>Bloqueos del script</b> altos indican que el problema es el código; si son bajos y hay saltos, es el pintado o la GPU.</li>
          <li>Filas en amarillo: más del 1% con saltos. En rojo: más del 3% o algún congelamiento.</li>
        </ul>
      </section>
    </>
  );
}
