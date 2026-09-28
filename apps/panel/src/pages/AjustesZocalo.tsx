import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Upload, Trash2, Plus, Loader2 } from "lucide-react";
import type { ZocaloItem } from "@newsroller/shared";
import { settingsApi } from "../lib/settings";
import { uploadMedia } from "../lib/content";

const DIAS: { v: number; l: string }[] = [
  { v: 1, l: "L" }, { v: 2, l: "M" }, { v: 3, l: "X" }, { v: 4, l: "J" },
  { v: 5, l: "V" }, { v: 6, l: "S" }, { v: 0, l: "D" },
];

const uid = () => "zc-" + Math.random().toString(36).slice(2, 9);
const blank = (n: number): ZocaloItem => ({ id: uid(), name: `Zócalo ${n}`, imageUrl: "", position: "derecha", pillText: "", days: [], startTime: "09:00", endTime: "10:00", active: true });

// Ajustes → Newsticker → Zócalo: PNGs con una pastilla de texto que entran sobre el newsticker real
// (el del feed de somosciclico.com), programados por día y horario. No salen en placas sin ese
// newsticker (Última Hora, Video Full, Obituario) ni durante el bloque "Ahora" de Modernas.
export function AjustesZocalo() {
  const [list, setList] = useState<ZocaloItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null);

  useEffect(() => {
    settingsApi.get().then((s) => setList((s.zocalos ?? []) as ZocaloItem[])).catch((e) => setErr(e.message));
  }, []);

  async function save(next: ZocaloItem[], key: string, okMsg?: string) {
    setBusy(key); setErr(null); setMsg(null);
    try {
      const s = await settingsApi.update({ zocalos: next });
      setList((s.zocalos ?? []) as ZocaloItem[]);
      if (okMsg) { setMsg(okMsg); setTimeout(() => setMsg(null), 2500); }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    } finally { setBusy(null); }
  }

  function add() {
    if (!list) return;
    void save([...list, blank(list.length + 1)], "new", "Zócalo agregado.");
  }
  function patch(id: string, p: Partial<ZocaloItem>) {
    if (!list) return;
    setList(list.map((z) => (z.id === id ? { ...z, ...p } : z)));
  }
  function remove(z: ZocaloItem) {
    if (!list || !confirm(`¿Quitar el zócalo "${z.name || "sin nombre"}"?`)) return;
    void save(list.filter((x) => x.id !== z.id), z.id, "Zócalo quitado.");
  }
  function toggleDay(z: ZocaloItem, d: number) {
    const days = z.days.includes(d) ? z.days.filter((x) => x !== d) : [...z.days, d];
    patch(z.id, { days });
    if (!list) return;
    void save(list.map((x) => (x.id === z.id ? { ...x, days } : x)), z.id);
  }
  function pick(id: string) { target.current = id; fileRef.current?.click(); }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const id = target.current;
    e.target.value = "";
    if (!file || !id || !list) return;
    if (file.type !== "image/png") return setErr("El zócalo tiene que ser un PNG.");
    setBusy(id); setErr(null);
    try {
      const url = await uploadMedia(file, "media", "ajustes");
      await save(list.map((z) => (z.id === id ? { ...z, imageUrl: url } : z)), id, "Imagen guardada.");
    } catch (er) {
      setErr(er instanceof Error ? er.message : "no se pudo subir la imagen"); setBusy(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Zócalo</h1>
          <p>PNGs con una pastilla de texto que entran sobre el newsticker (el del feed de Cíclico), programados por día y horario. No salen en Última Hora, Video Full, Obituario ni en el bloque "Ahora".</p>
        </div>
        <Link to="/ajustes" className="btn"><ArrowLeft size={16} /> Ajustes</Link>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}
      <input ref={fileRef} type="file" accept="image/png" style={{ display: "none" }} onChange={onFile} />

      {list == null ? (
        <div className="muted-note">Cargando…</div>
      ) : (
        <>
          <style>{CSS}</style>
          <div className="zc-list">
            {list.map((z) => (
              <section className="card zc-card" key={z.id}>
                <div className="zc-row">
                  <div className="zc-thumb">
                    {z.imageUrl ? <img src={z.imageUrl} alt="" /> : <span>sin imagen</span>}
                    {busy === z.id && <div className="zc-busy"><Loader2 size={20} className="spin" /></div>}
                  </div>
                  <div className="zc-fields">
                    <input className="zc-name" placeholder="Nombre interno (ej. Promo EPA)" defaultValue={z.name}
                      onBlur={(e) => { const name = e.target.value.trim().slice(0, 40); if (name !== z.name) void save(list.map((x) => (x.id === z.id ? { ...x, name } : x)), z.id); }} />
                    <input className="zc-pill-in" placeholder='Pastilla, ej. "Ya viene EPA! a las 12:00"' maxLength={80} defaultValue={z.pillText}
                      onBlur={(e) => { const pillText = e.target.value.trim().slice(0, 80); if (pillText !== z.pillText) void save(list.map((x) => (x.id === z.id ? { ...x, pillText } : x)), z.id); }} />
                    <div className="zc-line">
                      <label className="zc-lbl">Posición
                        <select value={z.position} onChange={(e) => void save(list.map((x) => (x.id === z.id ? { ...x, position: e.target.value as ZocaloItem["position"] } : x)), z.id)}>
                          <option value="derecha">Derecha</option>
                          <option value="centro">Centro</option>
                        </select>
                      </label>
                      <button className="btn" disabled={busy != null} onClick={() => pick(z.id)}><Upload size={14} /> {z.imageUrl ? "Reemplazar PNG" : "Cargar PNG"}</button>
                    </div>
                    <div className="zc-line">
                      <label className="zc-lbl">Entra <input type="time" value={z.startTime} onChange={(e) => void save(list.map((x) => (x.id === z.id ? { ...x, startTime: e.target.value } : x)), z.id)} /></label>
                      <label className="zc-lbl">Sale <input type="time" value={z.endTime} onChange={(e) => void save(list.map((x) => (x.id === z.id ? { ...x, endTime: e.target.value } : x)), z.id)} /></label>
                      <label className="zc-active"><input type="checkbox" checked={z.active} onChange={(e) => void save(list.map((x) => (x.id === z.id ? { ...x, active: e.target.checked } : x)), z.id)} /> Activo</label>
                    </div>
                    <div className="zc-days">
                      {DIAS.map((d) => (
                        <button key={d.v} type="button" className={"zc-day" + (z.days.includes(d.v) ? " on" : "")} onClick={() => toggleDay(z, d.v)}>{d.l}</button>
                      ))}
                      <span className="muted-note">{z.days.length === 0 ? "todos los días" : ""}</span>
                    </div>
                  </div>
                  <button className="btn zc-del" disabled={busy != null} onClick={() => remove(z)} title="Quitar el zócalo"><Trash2 size={15} /></button>
                </div>
              </section>
            ))}
          </div>
          <button className="btn primary" disabled={busy != null} onClick={add}><Plus size={16} /> Agregar zócalo</button>
        </>
      )}
    </>
  );
}

const CSS = `
.zc-list{display:flex;flex-direction:column;gap:14px;margin-bottom:16px}
.zc-card{padding:14px}
.zc-row{display:flex;gap:16px;align-items:flex-start}
.zc-thumb{position:relative;flex:none;width:150px;height:96px;border-radius:10px;background:#f1f3f8;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#8a93a6;font-size:12px}
.zc-thumb img{max-width:88%;max-height:80%;object-fit:contain}
.zc-busy{position:absolute;inset:0;background:rgba(255,255,255,.7);display:flex;align-items:center;justify-content:center}
.zc-fields{flex:1;display:flex;flex-direction:column;gap:8px;min-width:0}
.zc-name{font-weight:700}
.zc-pill-in{width:100%}
.zc-line{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.zc-lbl{display:flex;align-items:center;gap:6px;font-size:13px;color:#5b6579}
.zc-active{display:flex;align-items:center;gap:6px;font-size:13px;color:#5b6579}
.zc-days{display:flex;align-items:center;gap:6px}
.zc-day{width:30px;height:30px;border-radius:8px;border:1px solid #dfe3ee;background:#fff;font-weight:700;font-size:12px;cursor:pointer}
.zc-day.on{background:#2f6bff;border-color:#2f6bff;color:#fff}
.zc-del{align-self:flex-start}
.spin{animation:zcspin 1s linear infinite}@keyframes zcspin{to{transform:rotate(360deg)}}
`;
