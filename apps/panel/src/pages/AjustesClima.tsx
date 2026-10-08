import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Upload, RotateCcw, Loader2, Sun, Moon } from "lucide-react";
import {
  CLIMA_ESTADOS, climaCodeOf, climaSlotLabel, climaEstadoLabel, normalizeClimaIcons, normalizeClimaDayIcons, resolveClimaBig, resolveClimaDay,
  type ClimaDayIconsConfig, type ClimaEstado, type ClimaIconsConfig, type ClimaSlotKey,
} from "@newsroller/shared";
import { settingsApi } from "../lib/settings";
import { uploadMedia } from "../lib/content";
import { OUTPUT_FRAME_BASE } from "../lib/parrilla";
import { PreviewMonitor } from "../components/PreviewMonitor";

// Las imágenes predeterminadas vienen con el output, en /output/clima/.
const BASE = `${OUTPUT_FRAME_BASE}/output/clima/`;

// Límite de carga: los íconos se muestran chicos (grande ≈ 940 px, de día ≈ 120 px) y un PNG enorme se decodifica entero
// al aire (un 1500×1500 son ~9 MB de memoria) y congela cuadros. Lo que pase del tamaño se achica solo al subirlo.
const LIMITS = { big: { px: 1100, maxKb: 3000 }, day: { px: 256, maxKb: 600 } } as const;
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

// Devuelve la imagen lista para subir: tal cual si ya entra en el límite, o achicada (PNG, conserva la transparencia).
async function fitIcon(file: File, kind: "big" | "day"): Promise<File> {
  const { px, maxKb } = LIMITS[kind];
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file); } catch { throw new Error("No se pudo leer la imagen. Usá un PNG o WebP."); }
  try {
    const side = Math.max(bmp.width, bmp.height);
    let out = file;
    if (side > px) {
      const k = px / side;
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("No se pudo achicar la imagen.");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
      if (!blob) throw new Error("No se pudo achicar la imagen.");
      out = new File([blob], file.name.replace(/\.[^.]+$/, "") + ".png", { type: "image/png" });
    }
    if (out.size > maxKb * 1024) throw new Error(`La imagen pesa ${kb(out.size)} y el máximo es ${kb(maxKb * 1024)} (incluso achicada a ${px} px). Probá comprimirla (por ejemplo con TinyPNG).`);
    return out;
  } finally { bmp.close(); }
}

type Target = { kind: "big"; key: ClimaSlotKey } | { kind: "day"; key: ClimaEstado };
const tid = (t: Target) => `${t.kind}:${t.key}`;

// Ajustes → Íconos del clima. Cada estado del cielo que informa Open-Meteo (según su código) tiene:
//  - un ícono grande de día y otro de noche (el que va arriba de todo en la placa Clima);
//  - un ícono chico para los días del pronóstico.
// Lo que no se cargue usa la imagen predeterminada o, si no hay, la del estado más parecido (se indica cuál).
// A la derecha, la placa Clima en vivo con el estado elegido (tocando un ícono o al cargarlo), para ver cómo queda.
export function AjustesClima() {
  const [big, setBig] = useState<ClimaIconsConfig | null>(null);
  const [day, setDay] = useState<ClimaDayIconsConfig>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const target = useRef<Target | null>(null);
  // Vista previa: estado y día/noche que se muestran; `v` cambia al guardar para que la placa relea los íconos.
  const [sel, setSel] = useState<{ estado: ClimaEstado; night: boolean }>({ estado: "despejado", night: false });
  const [v, setV] = useState(0);
  const show = (t: Target) => setSel(t.kind === "big" ? { estado: t.key.replace(/_noche$/, "") as ClimaEstado, night: t.key.endsWith("_noche") } : { estado: t.key, night: false });

  useEffect(() => {
    settingsApi.get().then((s) => { setBig(normalizeClimaIcons(s.climaIcons)); setDay(normalizeClimaDayIcons(s.climaDayIcons)); }).catch((e) => setErr(e.message));
  }, []);

  async function save(t: Target, url: string | null, okMsg: string) {
    if (!big) return;
    setBusy(tid(t)); setErr(null); setMsg(null);
    try {
      if (t.kind === "big") {
        const next = { ...big }; if (url) next[t.key] = url; else delete next[t.key];
        const s = await settingsApi.update({ climaIcons: next });
        setBig(normalizeClimaIcons(s.climaIcons));
      } else {
        const next = { ...day }; if (url) next[t.key] = url; else delete next[t.key];
        const s = await settingsApi.update({ climaDayIcons: next });
        setDay(normalizeClimaDayIcons(s.climaDayIcons));
      }
      setMsg(okMsg);
      show(t); setV((n) => n + 1);
      setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(null);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const t = target.current;
    e.target.value = "";
    if (!file || !t) return;
    if (!/^image\//.test(file.type)) return setErr("El archivo tiene que ser una imagen (PNG con fondo transparente, ideal).");
    setBusy(tid(t)); setErr(null);
    try {
      const ready = await fitIcon(file, t.kind);
      const url = await uploadMedia(ready, "media", "ajustes");
      await save(t, url, ready === file ? "Ícono guardado." : `Ícono guardado (se achicó a ${LIMITS[t.kind].px} px).`);
    } catch (er) {
      setErr(er instanceof Error ? er.message : "no se pudo subir la imagen");
      setBusy(null);
    }
  }
  const pick = (t: Target) => { target.current = t; fileRef.current?.click(); };

  function Slot({ t, src, custom, from, label }: { t: Target; src: string; custom: boolean; from: string | null; label: React.ReactNode }) {
    const id = tid(t);
    const on = t.kind === "big" ? sel.estado === t.key.replace(/_noche$/, "") && sel.night === t.key.endsWith("_noche") : false;
    return (
      <div className="cw-slot">
        <div className={"cw-thumb" + (on ? " sel" : "")} onClick={() => show(t)} title="Ver en la vista previa">
          <img src={src} alt="" />
          {busy === id && <div className="cw-busy"><Loader2 size={22} className="spin" /></div>}
        </div>
        <div className="cw-sl">{label}</div>
        <div className={"cw-badge" + (custom ? " on" : "")}>{custom ? "Personalizado" : from ? `Usa: ${from}` : "Predeterminado"}</div>
        <div className="cw-actions">
          <button className="btn" disabled={busy != null} onClick={() => pick(t)}><Upload size={14} /> {custom ? "Reemplazar" : "Cargar"}</button>
          {custom && <button className="btn" disabled={busy != null} onClick={() => void save(t, null, "Volvió al predeterminado.")} title="Volver al predeterminado"><RotateCcw size={14} /></button>}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Íconos del clima</h1>
          <p>Un ícono por cada estado del cielo que informa Open-Meteo. Lo que no cargues usa la imagen predeterminada o la del estado más parecido. Las imágenes se achican solas al subirlas: el grande a 1100 px (máx. 3 MB) y el de los días a 256 px (máx. 600 KB).</p>
        </div>
        <Link to="/ajustes" className="btn"><ArrowLeft size={16} /> Ajustes</Link>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}
      <input ref={fileRef} type="file" accept="image/png,image/webp,image/*" style={{ display: "none" }} onChange={onFile} />
      <style>{CSS}</style>

      {big == null ? (
        <div className="muted-note">Cargando…</div>
      ) : (
        <div className="cw-layout">
        <div className="cw-main">
          <section className="card sec-card">
          <h2 className="cw-h">Ícono grande</h2>
          <p className="cw-p">Va arriba de todo en la placa Clima, según el estado actual. De noche usa el de noche.</p>
          <div className="cw-grid">
            {CLIMA_ESTADOS.map((e) => (
              <div className="card cw-card" key={e.key}>
                <div className="cw-name">{e.label}</div>
                <div className="cw-when">Código{e.codes.includes(",") ? "s" : ""} {e.codes}</div>
                <div className="cw-pair">
                  {([false, true] as const).map((night) => {
                    const key = (night ? `${e.key}_noche` : e.key) as ClimaSlotKey;
                    const r = resolveClimaBig(e.key, night, big, BASE);
                    const custom = !!big[key];
                    return (
                      <Slot key={key} t={{ kind: "big", key }} src={r.url} custom={custom} from={custom || r.from === key ? null : climaSlotLabel(r.from)}
                        label={night ? <><Moon size={12} /> Noche</> : <><Sun size={12} /> Día</>} />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          </section>

          <section className="card sec-card">
          <h2 className="cw-h">Íconos de los días</h2>
          <p className="cw-p">Los chicos de HOY, MAÑANA y el día siguiente, según el pronóstico de cada día.</p>
          <div className="cw-grid small">
            {CLIMA_ESTADOS.map((e) => {
              const r = resolveClimaDay(e.key, day, BASE);
              const custom = !!day[e.key];
              return (
                <div className="card cw-card" key={e.key}>
                  <Slot t={{ kind: "day", key: e.key }} src={r.url} custom={custom} from={custom || !r.from || r.from === e.key ? null : climaEstadoLabel(r.from)}
                    label={<><b>{e.label}</b> · {e.codes}</>} />
                </div>
              );
            })}
          </div>
          </section>
        </div>
        <aside className="card sec-card cw-side">
          <div className="cw-pv-hd">Vista previa: <b>{climaEstadoLabel(sel.estado)}</b> · {sel.night ? "noche" : "día"}</div>
          <PreviewMonitor type="clima" data={{ city: "Buenos Aires", preview: { code: climaCodeOf(sel.estado), isDay: !sel.night, v } }} dur={10} />
          <div className="cw-pv-ctl">
            <select value={sel.estado} onChange={(e) => setSel((x) => ({ ...x, estado: e.target.value as ClimaEstado }))} aria-label="Estado">
              {CLIMA_ESTADOS.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
            </select>
            <div className="cw-seg">
              <button type="button" className={!sel.night ? "on" : ""} onClick={() => setSel((x) => ({ ...x, night: false }))}><Sun size={14} /> Día</button>
              <button type="button" className={sel.night ? "on" : ""} onClick={() => setSel((x) => ({ ...x, night: true }))}><Moon size={14} /> Noche</button>
            </div>
          </div>
          <p className="cw-p">Tocá cualquier ícono para verlo acá. Los días del pronóstico muestran el mismo estado.</p>
        </aside>
        </div>
      )}
    </>
  );
}

const CSS = `
.cw-layout{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:14px;align-items:start}
@media (max-width:1100px){.cw-layout{grid-template-columns:1fr}.cw-side{position:static!important;order:-1}}
.cw-side{position:sticky;top:16px;display:flex;flex-direction:column;gap:10px}
.cw-pv-hd{font-size:13px;color:var(--muted)}
.cw-pv-hd b{color:inherit;font-weight:700}
.cw-pv-ctl{display:flex;gap:8px;align-items:center}
.cw-pv-ctl select{flex:1}
.cw-seg{display:flex;border:1px solid #d8dee9;border-radius:8px;overflow:hidden}
.cw-seg button{display:flex;align-items:center;gap:5px;padding:6px 10px;border:0;background:#fff;font:inherit;font-size:13px;cursor:pointer;color:#5b6477}
.cw-seg button.on{background:#2f6bff;color:#fff}
.cw-thumb{cursor:pointer;outline:2px solid transparent;outline-offset:2px;transition:outline-color .2s}
.cw-thumb.sel{outline-color:#2f6bff}
.cw-h{font-size:16px;margin:0 0 2px}
.cw-p{font-size:13px;color:var(--muted);margin:0 0 12px}
.cw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
.cw-grid.small{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.cw-card{padding:12px;display:flex;flex-direction:column;gap:6px}
.cw-name{font-weight:600;font-size:14px}
.cw-when{font-size:11.5px;color:var(--muted)}
.cw-pair{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px}
.cw-slot{display:flex;flex-direction:column;gap:6px;min-width:0}
.cw-thumb{position:relative;aspect-ratio:1/1;border-radius:10px;background:linear-gradient(135deg,#1d3a9a,#0b1f52);display:flex;align-items:center;justify-content:center;overflow:hidden}
.cw-thumb img{width:84%;height:84%;object-fit:contain}
.cw-busy{position:absolute;inset:0;background:rgba(5,13,51,.55);display:flex;align-items:center;justify-content:center;color:#fff}
.cw-sl{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--muted)}
.cw-sl b{color:inherit;font-weight:600;color:var(--text,#0b1330)}
.cw-badge{align-self:flex-start;max-width:100%;font-size:10.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;padding:2px 8px;border-radius:999px;background:#eef1f6;color:#7c869b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cw-badge.on{background:#e8efff;color:#2f6bff}
.cw-actions{display:flex;gap:6px}
.cw-actions .btn:first-child{flex:1;justify-content:center}
.spin{animation:cwspin 1s linear infinite}@keyframes cwspin{to{transform:rotate(360deg)}}
`;
