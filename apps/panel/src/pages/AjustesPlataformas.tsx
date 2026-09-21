import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Upload, Trash2, Plus, Loader2, X } from "lucide-react";
import type { Plataforma } from "@newsroller/shared";
import { settingsApi } from "../lib/settings";
import { uploadMedia } from "../lib/content";

const slug = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);

// Ajustes → Plataformas: las plataformas de streaming que se pueden elegir al cargar una SERIE en Cartelera
// (Cine). Cada una lleva su logo (opcional; si no tiene, la placa muestra el nombre). Se pueden agregar y quitar.
export function AjustesPlataformas() {
  const [list, setList] = useState<Plataforma[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null);

  useEffect(() => {
    settingsApi.get().then((s) => setList((s.plataformas ?? []) as Plataforma[])).catch((e) => setErr(e.message));
  }, []);

  async function save(next: Plataforma[], key: string, okMsg: string) {
    setBusy(key); setErr(null); setMsg(null);
    try {
      const s = await settingsApi.update({ plataformas: next });
      setList((s.plataformas ?? []) as Plataforma[]);
      setMsg(okMsg); setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    } finally { setBusy(null); }
  }

  function add() {
    if (!list) return;
    const name = nuevo.trim().slice(0, 30);
    if (!name) return;
    let id = slug(name) || "plataforma";
    const base = id; let n = 2;
    while (list.some((p) => p.id === id)) id = `${base}-${n++}`.slice(0, 30);
    setNuevo("");
    void save([...list, { id, name }], id, "Plataforma agregada.");
  }
  function rename(id: string, name: string) {
    if (!list) return;
    const clean = name.trim().slice(0, 30);
    const cur = list.find((p) => p.id === id);
    if (!clean || !cur || cur.name === clean) return;
    void save(list.map((p) => (p.id === id ? { ...p, name: clean } : p)), id, "Nombre guardado.");
  }
  function remove(p: Plataforma) {
    if (!list || !confirm(`¿Quitar ${p.name}? Las series ya cargadas siguen mostrando su nombre.`)) return;
    void save(list.filter((x) => x.id !== p.id), p.id, "Plataforma quitada.");
  }
  function pick(id: string) { target.current = id; fileRef.current?.click(); }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const id = target.current;
    e.target.value = "";
    if (!file || !id || !list) return;
    if (!/^image\//.test(file.type)) return setErr("El logo tiene que ser una imagen (PNG o SVG con fondo transparente, ideal).");
    setBusy(id); setErr(null);
    try {
      const url = await uploadMedia(file, "media", "ajustes");
      await save(list.map((p) => (p.id === id ? { ...p, logo: url } : p)), id, "Logo guardado.");
    } catch (er) {
      setErr(er instanceof Error ? er.message : "no se pudo subir el logo"); setBusy(null);
    }
  }
  function clearLogo(id: string) {
    if (!list) return;
    void save(list.map((p) => { if (p.id !== id) return p; const { logo: _l, ...rest } = p; return rest; }), id, "Logo quitado.");
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Plataformas</h1>
          <p>Las que se pueden elegir al cargar una serie en Cartelera. Cargá el logo de cada una (si no tiene, se muestra el nombre).</p>
        </div>
        <Link to="/ajustes" className="btn"><ArrowLeft size={16} /> Ajustes</Link>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFile} />

      {list == null ? (
        <div className="muted-note">Cargando…</div>
      ) : (
        <>
          <style>{CSS}</style>
          <div className="pl-grid">
            {list.map((p) => (
              <div className="card pl-card" key={p.id}>
                <div className="pl-thumb">
                  {p.logo ? <img src={p.logo} alt={p.name} /> : <span>{p.name}</span>}
                  {busy === p.id && <div className="pl-busy"><Loader2 size={20} className="spin" /></div>}
                </div>
                <input className="pl-name" defaultValue={p.name} maxLength={30} onBlur={(e) => rename(p.id, e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
                <div className="pl-actions">
                  <button className="btn" disabled={busy != null} onClick={() => pick(p.id)}><Upload size={15} /> {p.logo ? "Reemplazar" : "Cargar logo"}</button>
                  {p.logo && <button className="btn" disabled={busy != null} onClick={() => clearLogo(p.id)} title="Quitar el logo"><X size={15} /></button>}
                  <button className="btn" disabled={busy != null} onClick={() => remove(p)} title="Quitar la plataforma"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
            <div className="card pl-card pl-new">
              <div className="pl-name-lb">Agregar plataforma</div>
              <input className="pl-name" value={nuevo} maxLength={30} placeholder="Nombre (ej. Paramount+)" onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
              <button className="btn primary" disabled={busy != null || !nuevo.trim()} onClick={add} style={{ justifyContent: "center" }}><Plus size={16} /> Agregar</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

const CSS = `
.pl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:16px}
.pl-card{padding:12px;display:flex;flex-direction:column;gap:10px}
.pl-thumb{position:relative;height:96px;border-radius:10px;background:#f1f3f8;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#6b7688;font-weight:800;font-size:18px}
.pl-thumb img{max-width:80%;max-height:70%;object-fit:contain}
.pl-busy{position:absolute;inset:0;background:rgba(255,255,255,.7);display:flex;align-items:center;justify-content:center}
.pl-name{font-weight:600}
.pl-actions{display:flex;gap:8px}
.pl-actions .btn:first-child{flex:1;justify-content:center}
.pl-new{justify-content:center;border-style:dashed}
.pl-name-lb{font-size:12px;font-weight:700;color:#7c869b;text-transform:uppercase;letter-spacing:.05em}
.spin{animation:plspin 1s linear infinite}@keyframes plspin{to{transform:rotate(360deg)}}
`;
