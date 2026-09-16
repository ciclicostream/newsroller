import { Construction, CalendarClock, BarChart3 } from "lucide-react";

export function Reportes() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reportes</h1>
          <p>Publicidades activas: fechas de emisión, editar o desactivar, y estadísticas de salida al aire.</p>
        </div>
      </div>

      <div className="kpi-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="muted-note" style={{ display: "flex", gap: 6, alignItems: "center" }}><CalendarClock size={15} /> Activas hoy</div>
          <div style={{ fontSize: 30, fontWeight: 600 }}>—</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="muted-note" style={{ display: "flex", gap: 6, alignItems: "center" }}><BarChart3 size={15} /> Salidas (7 días)</div>
          <div style={{ fontSize: 30, fontWeight: 600 }}>—</div>
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div className="muted-note" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Construction size={16} /> Sección en construcción — falta el backend de emisiones (fechas por publicidad + conteo de salidas al aire).
        </div>
      </div>
    </>
  );
}
