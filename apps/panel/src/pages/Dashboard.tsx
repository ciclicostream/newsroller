import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

interface SourceStatus {
  id: string;
  label: string;
  ok: boolean;
  lastOkAt: string | null;
}

export function Dashboard() {
  const { me } = useAuth();
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.get<SourceStatus[]>("/api/sources").then(setSources).catch((e) => setErr(e.message));
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Panel</h1>
          <p>Hola{me?.email ? `, ${me.email}` : ""}. Estado general del sistema.</p>
        </div>
      </div>

      {err && <div className="alert error">No se pudo leer el estado: {err}</div>}

      <div className="grid">
        {sources.map((s) => (
          <div key={s.id} className="card stat">
            <div className="label">{s.label}</div>
            <div className="value" style={{ fontSize: 18 }}>
              <span className={"dot " + (s.ok ? "ok" : "bad")} />
              {s.ok ? "En línea" : "Con error"}
            </div>
            <div className="muted-note" style={{ marginTop: 6 }}>
              {s.lastOkAt ? new Date(s.lastOkAt).toLocaleString("es-AR") : "sin datos"}
            </div>
          </div>
        ))}
        {sources.length === 0 && !err && <div className="muted-note">Cargando fuentes…</div>}
      </div>
    </>
  );
}
