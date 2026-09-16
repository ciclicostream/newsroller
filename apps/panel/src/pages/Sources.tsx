import { useEffect, useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
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

interface CachedData {
  source: string;
  payload: unknown;
  fetchedAt: string;
}

export function Sources() {
  const [rows, setRows] = useState<SourceStatus[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, CachedData | { error: string } | "loading">>({});

  useEffect(() => {
    const load = () => api.get<SourceStatus[]>("/api/sources").then(setRows).catch((e) => setErr(e.message));
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  async function toggle(id: string) {
    if (open === id) {
      setOpen(null);
      return;
    }
    setOpen(id);
    setData((d) => ({ ...d, [id]: "loading" }));
    try {
      const res = await api.get<CachedData>(`/api/data/${id}`);
      setData((d) => ({ ...d, [id]: res }));
    } catch (e) {
      setData((d) => ({ ...d, [id]: { error: e instanceof Error ? e.message : "sin datos" } }));
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Fuentes / APIs</h1>
          <p>Estado de cada fuente de datos. Tocá una para desplegar y ver qué valores trae ahora mismo.</p>
        </div>
      </div>
      {err && <div className="alert error">{err}</div>}

      <div className="card" style={{ padding: 6 }}>
        {rows.map((s) => {
          const isOpen = open === s.id;
          const d = data[s.id];
          return (
            <div key={s.id} className="src-row">
              <button className="src-head" onClick={() => toggle(s.id)}>
                <ChevronRight size={16} className={"src-caret" + (isOpen ? " open" : "")} />
                <span className={"dot " + (s.ok ? "ok" : "bad")} />
                <span className="src-label">{s.label}</span>
                <span className="src-meta">cada {Math.round(s.intervalMs / 1000)}s</span>
                <span className="src-meta">{s.lastOkAt ? "OK " + new Date(s.lastOkAt).toLocaleTimeString("es-AR") : "sin datos"}</span>
                {s.lastError && <span className="src-meta err">{s.lastError}</span>}
              </button>
              {isOpen && (
                <div className="src-detail">
                  {d === "loading" || d === undefined ? (
                    <div className="muted-note" style={{ display: "flex", gap: 6, alignItems: "center" }}><Loader2 size={14} className="spin" /> Cargando…</div>
                  ) : "error" in (d as any) ? (
                    <div className="muted-note">{(d as { error: string }).error}</div>
                  ) : (
                    <>
                      <div className="muted-note" style={{ marginBottom: 10 }}>
                        Actualizado {new Date((d as CachedData).fetchedAt).toLocaleString("es-AR")}
                      </div>
                      <Payload value={(d as CachedData).payload} />
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {rows.length === 0 && !err && <div className="muted-note" style={{ padding: 12 }}>Sin fuentes.</div>}
      </div>
    </>
  );
}

// Muestra el payload de forma legible resaltando los campos disponibles.
function Payload({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined) return <span className="pl-null">—</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="pl-null">(vacío)</span>;
    return (
      <div className="pl-array">
        <div className="muted-note" style={{ marginBottom: 6 }}>{value.length} ítem{value.length === 1 ? "" : "s"}</div>
        {value.slice(0, 20).map((it, i) => (
          <div key={i} className="pl-item"><Payload value={it} depth={depth + 1} /></div>
        ))}
        {value.length > 20 && <div className="muted-note">…y {value.length - 20} más</div>}
      </div>
    );
  }

  if (typeof value === "object") {
    return (
      <div className="pl-obj">
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <div key={k} className="pl-field">
            <span className="pl-key">{k}</span>
            {typeof v === "object" && v !== null ? (
              <div style={{ marginTop: 4 }}><Payload value={v} depth={depth + 1} /></div>
            ) : (
              <span className="pl-val">{String(v)}</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  return <span className="pl-val">{String(value)}</span>;
}
