import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ROLE_LABEL, normalizeRole } from "@newsroller/shared";
import { api } from "../lib/api";

interface Row { id: string; at: string; actor_id: string | null; actor_name: string | null; actor_role: string | null; action: string; summary: string | null }
interface Person { id: string; email: string | null; full_name: string | null }

const GROUPS: [string, string][] = [
  ["", "Todo"], ["contenido.", "Contenidos"], ["parrilla.", "Programación"], ["aire.", "Cortes del aire"],
  ["usuario.", "Personas"], ["camara.", "Cámaras"], ["banco.", "Banco"], ["plantilla.", "Plantillas"], ["ajustes.", "Ajustes"],
];
const fmt = (iso: string) => new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Registro de actividad: quién hizo qué y cuándo (Master y Administrador).
export function Actividad() {
  const [rows, setRows] = useState<Row[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [actor, setActor] = useState("");
  const [group, setGroup] = useState("");
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(true);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => { api.get<Person[]>("/api/users").then(setPeople).catch(() => {}); }, []);

  async function load(reset: boolean) {
    setLoading(true);
    const before = !reset && rows.length ? `&before=${encodeURIComponent(rows[rows.length - 1]!.at)}` : "";
    try {
      const r = await api.get<{ rows: Row[]; error?: string }>(`/api/activity?limit=100${actor ? `&actor=${actor}` : ""}${group ? `&action=${encodeURIComponent(group)}` : ""}${before}`);
      setNote(r.error ? "Todavía no hay registro de actividad (falta correr la migración 0016)." : null);
      setRows((cur) => (reset ? r.rows : [...cur, ...r.rows]));
      setMore(r.rows.length === 100);
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [actor, group]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Actividad</h1>
          <p>Quién hizo qué y cuándo: contenidos, envíos a vivo, cortes del aire, personas y más.</p>
        </div>
        <Link to="/ajustes" className="btn"><ArrowLeft size={16} /> Ajustes</Link>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <select value={actor} onChange={(e) => setActor(e.target.value)} style={{ width: 240 }}>
          <option value="">Todas las personas</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
        </select>
        <div className="tabs" style={{ marginBottom: 0 }}>
          {GROUPS.map(([k, l]) => <button key={k} className={"tab" + (group === k ? " active" : "")} onClick={() => setGroup(k)}>{l}</button>)}
        </div>
      </div>

      {note && <div className="alert info">{note}</div>}

      <div className="card">
        <table>
          <thead><tr><th style={{ width: 120 }}>Cuándo</th><th style={{ width: 240 }}>Quién</th><th>Qué</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="muted-note">{fmt(r.at)}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{r.actor_name ?? "—"}</div>
                  <div className="muted-note" style={{ fontSize: 12 }}>{r.actor_role === "sistema" ? "Sistema" : ROLE_LABEL[normalizeRole(r.actor_role)]}</div>
                </td>
                <td>{r.summary ?? r.action}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && <tr><td colSpan={3} className="muted-note">Sin actividad registrada.</td></tr>}
          </tbody>
        </table>
      </div>
      {more && rows.length > 0 && <button className="btn" style={{ marginTop: 14 }} disabled={loading} onClick={() => load(false)}>{loading ? "Cargando…" : "Ver más"}</button>}
    </>
  );
}
