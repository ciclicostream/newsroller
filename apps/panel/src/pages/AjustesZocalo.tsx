import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, ChevronDown, ChevronRight, ImageOff, Plus, Loader2, Trash2, Upload } from "lucide-react";
import type { ZocaloItem } from "@newsroller/shared";
import { settingsApi } from "../lib/settings";
import { uploadMedia } from "../lib/content";

const DIAS: { v: number; l: string }[] = [
  { v: 1, l: "L" }, { v: 2, l: "M" }, { v: 3, l: "X" }, { v: 4, l: "J" },
  { v: 5, l: "V" }, { v: 6, l: "S" }, { v: 0, l: "D" },
];

const uid = () => "zc-" + Math.random().toString(36).slice(2, 9);
const blank = (n: number): ZocaloItem => ({ id: uid(), name: `Zócalo ${n}`, imageUrl: "", position: "derecha", pillText: "", days: [], startTime: "09:00", endTime: "10:00", active: true });
const diasLabel = (days: number[]) => (days.length ? DIAS.filter((d) => days.includes(d.v)).map((d) => d.l).join(" ") : "todos los días");

// Ajustes → Newsticker → Zócalo: PNGs con una pastilla de texto que entran sobre el newsticker real
// (el del feed de somosciclico.com), programados por día y horario. No salen en placas sin ese
// newsticker (Última Hora, Video Full, Obituario) ni durante el bloque "Ahora" de Modernas.
// Cada zócalo es una card plegable (acordeón: sólo una abierta a la vez) para poder concentrarse
// en el que se está editando sin que los demás ocupen pantalla.
export function AjustesZocalo() {
  const [list, setList] = useState<ZocaloItem[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null);

  // Timing global (aplica a todos los zócalos): cuánto quedan en pantalla, la pausa entre
  // apariciones, y si se anima la entrada/salida/parpadeo o aparecen y desaparecen secos.
  const [durationSec, setDurationSec] = useState(15);
  const [intervalSec, setIntervalSec] = useState(60);
  const [effects, setEffects] = useState(true);
  const [savedTiming, setSavedTiming] = useState({ durationSec: 15, intervalSec: 60, effects: true });

  useEffect(() => {
    settingsApi.get().then((s) => {
      setList((s.zocalos ?? []) as ZocaloItem[]);
      const d = s.zocaloDurationSec ?? 15, i = s.zocaloIntervalSec ?? 60, e = s.zocaloEffects !== false;
      setDurationSec(d); setIntervalSec(i); setEffects(e);
      setSavedTiming({ durationSec: d, intervalSec: i, effects: e });
    }).catch((e) => setErr(e.message));
  }, []);

  const timingDirty = durationSec !== savedTiming.durationSec || intervalSec !== savedTiming.intervalSec || effects !== savedTiming.effects;
  async function saveTiming() {
    setBusy("timing"); setErr(null);
    try {
      const s = await settingsApi.update({ zocaloDurationSec: durationSec, zocaloIntervalSec: intervalSec, zocaloEffects: effects });
      const d = s.zocaloDurationSec ?? 15, i = s.zocaloIntervalSec ?? 60, e = s.zocaloEffects !== false;
      setDurationSec(d); setIntervalSec(i); setEffects(e);
      setSavedTiming({ durationSec: d, intervalSec: i, effects: e });
      setMsg("Timing guardado."); setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    } finally { setBusy(null); }
  }

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
    const item = blank(list.length + 1);
    setOpenId(item.id);
    void save([...list, item], "new", "Zócalo agregado.");
  }
  function toggleOpen(id: string) {
    setOpenId((cur) => (cur === id ? null : id));
  }
  function toggleActive(z: ZocaloItem) {
    if (!list) return;
    void save(list.map((x) => (x.id === z.id ? { ...x, active: !x.active } : x)), z.id);
  }
  function remove(z: ZocaloItem) {
    if (!list || !confirm(`¿Quitar el zócalo "${z.name || "sin nombre"}"?`)) return;
    void save(list.filter((x) => x.id !== z.id), z.id, "Zócalo quitado.");
  }
  function toggleDay(z: ZocaloItem, d: number) {
    if (!list) return;
    const days = z.days.includes(d) ? z.days.filter((x) => x !== d) : [...z.days, d];
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

          <section className="card sec-card">
            <div className="sec-card-hd">
              <h3>Duración y ritmo</h3>
              <p>Se aplica a todos los zócalos: cuánto quedan en pantalla, la pausa entre apariciones y si animan al entrar/salir.</p>
            </div>
            <div className="row zc-timing-row">
              <div className="field zc-num-field">
                <label>Duración en pantalla</label>
                <div className="zc-num"><input type="number" min={5} max={120} value={durationSec} onChange={(e) => setDurationSec(Math.max(5, Math.min(120, Number(e.target.value) || 5)))} /><span>seg</span></div>
              </div>
              <div className="field zc-num-field">
                <label>Intervalo entre apariciones</label>
                <div className="zc-num"><input type="number" min={5} max={600} value={intervalSec} onChange={(e) => setIntervalSec(Math.max(5, Math.min(600, Number(e.target.value) || 5)))} /><span>seg</span></div>
              </div>
              <div className="field">
                <label>Animación</label>
                <button type="button" className={"toggle-pill" + (effects ? " on" : "")} onClick={() => setEffects(!effects)}>
                  {effects ? <Check size={14} /> : null} {effects ? "Con efecto" : "Sin efecto"}
                </button>
              </div>
              {timingDirty && (
                <button className="btn primary zc-timing-save" disabled={busy === "timing"} onClick={saveTiming}>{busy === "timing" ? "Guardando…" : "Guardar"}</button>
              )}
            </div>
          </section>

          <section className="card sec-card">
            <div className="sec-card-hd">
              <h3>Zócalos {list.length > 0 && <span className="zc-count">{list.length}</span>}</h3>
              <p>Tocá uno para editarlo — se abre uno solo a la vez para no perderte entre los demás.</p>
            </div>

            {list.length === 0 && <div className="muted-note zc-empty">Todavía no hay zócalos cargados.</div>}

            <div className="zc-list">
              {list.map((z) => {
                const open = openId === z.id;
                return (
                  <div className={"zc-card" + (open ? " open" : "")} key={z.id}>
                    <div className="zc-hd" onClick={() => toggleOpen(z.id)}>
                      <div className="zc-hd-thumb">
                        {z.imageUrl ? <img src={z.imageUrl} alt="" /> : <ImageOff size={16} />}
                        {busy === z.id && <div className="zc-busy"><Loader2 size={16} className="spin" /></div>}
                      </div>
                      <div className="zc-hd-main">
                        <div className="zc-hd-name">{z.name || "Sin nombre"}</div>
                        <div className="zc-hd-meta">
                          <span>{z.pillText || "sin pastilla"}</span>
                          <span className="zc-dot">·</span>
                          <span>{z.position === "centro" ? "Centro" : "Derecha"}</span>
                          <span className="zc-dot">·</span>
                          <span>{z.startTime}–{z.endTime}</span>
                          <span className="zc-dot">·</span>
                          <span>{diasLabel(z.days)}</span>
                        </div>
                      </div>
                      <button type="button" className={"toggle-pill zc-hd-active" + (z.active ? " on" : "")} onClick={(e) => { e.stopPropagation(); toggleActive(z); }}>
                        {z.active ? <Check size={12} /> : null} {z.active ? "Activo" : "Inactivo"}
                      </button>
                      <button type="button" className="btn btn-sm zc-hd-del" disabled={busy != null} onClick={(e) => { e.stopPropagation(); remove(z); }} title="Quitar el zócalo"><Trash2 size={14} /></button>
                      {open ? <ChevronDown size={18} className="zc-chev" /> : <ChevronRight size={18} className="zc-chev" />}
                    </div>

                    {open && (
                      <div className="zc-body">
                        <div className="row">
                          <div className="field" style={{ flex: 1, minWidth: 220 }}>
                            <label>Nombre interno</label>
                            <input placeholder="ej. Promo EPA" defaultValue={z.name} maxLength={40}
                              onBlur={(e) => { const name = e.target.value.trim().slice(0, 40); if (name !== z.name) void save(list.map((x) => (x.id === z.id ? { ...x, name } : x)), z.id); }} />
                          </div>
                          <div className="field" style={{ flex: 2, minWidth: 260 }}>
                            <label>Pastilla</label>
                            <input placeholder='ej. "Ya viene EPA! a las 12:00"' maxLength={80} defaultValue={z.pillText}
                              onBlur={(e) => { const pillText = e.target.value.trim().slice(0, 80); if (pillText !== z.pillText) void save(list.map((x) => (x.id === z.id ? { ...x, pillText } : x)), z.id); }} />
                          </div>
                        </div>

                        <div className="row">
                          <div className="field">
                            <label>Imagen</label>
                            <button type="button" className="btn" disabled={busy != null} onClick={() => pick(z.id)}><Upload size={14} /> {z.imageUrl ? "Reemplazar PNG" : "Cargar PNG"}</button>
                          </div>
                          <div className="field">
                            <label>Posición</label>
                            <select value={z.position} onChange={(e) => void save(list.map((x) => (x.id === z.id ? { ...x, position: e.target.value as ZocaloItem["position"] } : x)), z.id)}>
                              <option value="derecha">Derecha</option>
                              <option value="centro">Centro</option>
                            </select>
                          </div>
                          <div className="field">
                            <label>Entra</label>
                            <input type="time" value={z.startTime} onChange={(e) => void save(list.map((x) => (x.id === z.id ? { ...x, startTime: e.target.value } : x)), z.id)} />
                          </div>
                          <div className="field">
                            <label>Sale</label>
                            <input type="time" value={z.endTime} onChange={(e) => void save(list.map((x) => (x.id === z.id ? { ...x, endTime: e.target.value } : x)), z.id)} />
                          </div>
                        </div>

                        <div className="field">
                          <label>Días</label>
                          <div className="zc-days">
                            {DIAS.map((d) => (
                              <button key={d.v} type="button" className={"zc-day" + (z.days.includes(d.v) ? " on" : "")} onClick={() => toggleDay(z, d.v)}>{d.l}</button>
                            ))}
                            <span className="muted-note zc-days-note">{z.days.length === 0 ? "todos los días" : ""}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button className="btn primary zc-add" disabled={busy != null} onClick={add}><Plus size={16} /> Agregar zócalo</button>
          </section>
        </>
      )}
    </>
  );
}

const CSS = `
.zc-count{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;margin-left:8px;border-radius:999px;background:var(--accent-weak);color:var(--accent);font-size:11px;font-weight:700;vertical-align:middle}
.zc-timing-row{align-items:flex-end}
.zc-num-field label{white-space:nowrap}
.zc-num{display:flex;align-items:center;gap:6px;border:1px solid var(--border);border-radius:8px;padding:0 10px;background:#fff;height:38px}
.zc-num input{border:0;padding:0;width:56px;text-align:right}
.zc-num input:focus{outline:none}
.zc-num span{color:var(--muted);font-size:13px}
.zc-timing-save{margin-left:auto}
.zc-empty{padding:6px 2px 2px}
.zc-list{display:flex;flex-direction:column;gap:10px;margin-bottom:14px}
.zc-card{border:1px solid var(--border);border-radius:10px;overflow:hidden;background:#fff;transition:border-color .12s ease}
.zc-card.open{border-color:var(--accent)}
.zc-hd{display:flex;align-items:center;gap:12px;padding:10px 12px;cursor:pointer;user-select:none}
.zc-hd:hover{background:#f7f8fb}
.zc-card.open .zc-hd{background:var(--accent-weak)}
.zc-hd-thumb{position:relative;flex:none;width:44px;height:44px;border-radius:8px;background:#f1f3f8;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#8a93a6}
.zc-hd-thumb img{max-width:88%;max-height:88%;object-fit:contain}
.zc-busy{position:absolute;inset:0;background:rgba(255,255,255,.7);display:flex;align-items:center;justify-content:center}
.zc-hd-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.zc-hd-name{font-weight:700;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.zc-hd-meta{font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;gap:6px;align-items:center}
.zc-hd-meta span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px}
.zc-dot{opacity:.5}
.zc-hd-active{flex:none}
.zc-hd-del{flex:none;color:var(--muted)}
.zc-hd-del:hover{color:var(--danger);border-color:#f0c7c2}
.zc-chev{flex:none;color:var(--muted)}
.zc-body{padding:14px 16px 16px;border-top:1px solid var(--border);background:#fbfcfe}
.zc-body .row{margin-bottom:2px}
.zc-days{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.zc-day{width:32px;height:32px;border-radius:8px;border:1px solid var(--border);background:#fff;font-weight:700;font-size:12px}
.zc-day.on{background:var(--accent);border-color:var(--accent);color:#fff}
.zc-days-note{margin-left:2px}
.zc-add{width:100%;justify-content:center}
`;
