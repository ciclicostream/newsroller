import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface SourceStatus {
  id: string;
  label: string;
  intervalMs: number;
  ok: boolean;
  lastRunAt: string | null;
  lastOkAt: string | null;
  lastError: string | null;
}

export function Sources() {
  const [rows, setRows] = useState<SourceStatus[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const load = () => api.get<SourceStatus[]>("/api/sources").then(setRows).catch((e) => setErr(e.message));
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Fuentes / APIs</h1>
          <p>Estado de los pollers de datos. La configuración avanzada (keys, intervalos) vive acá.</p>
        </div>
      </div>
      {err && <div className="alert error">{err}</div>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Fuente</th>
              <th>Estado</th>
              <th>Cada</th>
              <th>Última OK</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{s.label}</td>
                <td>
                  <span className={"dot " + (s.ok ? "ok" : "bad")} />
                  {s.ok ? "OK" : "Error"}
                </td>
                <td>{Math.round(s.intervalMs / 1000)}s</td>
                <td>{s.lastOkAt ? new Date(s.lastOkAt).toLocaleString("es-AR") : "—"}</td>
                <td className="muted-note">{s.lastError ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
