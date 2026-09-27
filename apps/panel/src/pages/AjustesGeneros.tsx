import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, X, RotateCcw } from "lucide-react";
import { GENEROS_MUSICALES_DEFAULT } from "@newsroller/shared";
import { settingsApi } from "../lib/settings";

// Ajustes → Géneros musicales: la lista de la que el editor elige al cargar una canción en Contenido → Música.
// Quitar un género de la lista no toca las canciones ya cargadas (guardan el nombre).
export function AjustesGeneros() {
  const [list, setList] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState("");

  useEffect(() => {
    settingsApi.get().then((s) => setList(s.generos ?? GENEROS_MUSICALES_DEFAULT)).catch((e) => setErr(e.message));
  }, []);

  async function save(next: string[], okMsg: string) {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const s = await settingsApi.update({ generos: next });
      setList(s.generos ?? next);
      setMsg(okMsg); setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    } finally { setBusy(false); }
  }

  function add() {
    if (!list) return;
    const g = nuevo.trim().slice(0, 40);
    if (!g) return;
    if (list.some((x) => x.toLowerCase() === g.toLowerCase())) return setErr("Ese género ya está en la lista.");
    setNuevo("");
    void save([...list, g].sort((a, b) => a.localeCompare(b, "es")), "Género agregado.");
  }
  function remove(g: string) {
    if (!list) return;
    void save(list.filter((x) => x !== g), "Género quitado.");
  }
  function restore() {
    if (confirm("¿Volver a la lista original de géneros? Se pierden los que agregaste.")) void save(GENEROS_MUSICALES_DEFAULT, "Lista restaurada.");
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Géneros musicales</h1>
          <p>La lista de la que se elige al cargar una canción en Contenido → Música (hasta 3 por canción).</p>
        </div>
        <Link to="/ajustes" className="btn"><ArrowLeft size={16} /> Ajustes</Link>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      <section className="card sec-card">
        {list == null ? <div className="muted-note">Cargando…</div> : (
          <>
            <style>{CSS}</style>
            <div className="gen-add">
              <input value={nuevo} maxLength={40} placeholder="Nuevo género (ej. Cumbia santafesina)" onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
              <button className="btn primary" disabled={busy || !nuevo.trim()} onClick={add}><Plus size={16} /> Agregar</button>
            </div>
            <div className="gen-chips">
              {list.length === 0 && <span className="muted-note">La lista está vacía: no se van a poder cargar canciones.</span>}
              {list.map((g) => (
                <span className="gen-chip" key={g}>{g}<button type="button" disabled={busy} onClick={() => remove(g)} title="Quitar"><X size={13} /></button></span>
              ))}
            </div>
            <button className="btn" style={{ marginTop: 18 }} disabled={busy} onClick={restore}><RotateCcw size={15} /> Restaurar lista original</button>
          </>
        )}
      </section>
    </>
  );
}

const CSS = `
.gen-add{display:flex;gap:10px;max-width:520px;margin-bottom:18px}
.gen-add input{flex:1}
.gen-chips{display:flex;flex-wrap:wrap;gap:8px}
.gen-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 8px 6px 12px;border-radius:999px;background:#eef2fb;color:#1a3aa8;font-weight:600;font-size:13px}
.gen-chip button{display:inline-flex;border:0;background:transparent;color:#6b7688;cursor:pointer;padding:2px;border-radius:50%}
.gen-chip button:hover{background:#dbe3f7;color:#1a3aa8}
`;
