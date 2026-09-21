import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Upload, RotateCcw, Loader2 } from "lucide-react";
import { CLIMA_SLOTS, type ClimaIconsConfig, type ClimaSlotKey } from "@newsroller/shared";
import { settingsApi } from "../lib/settings";
import { uploadMedia } from "../lib/content";
import { OUTPUT_FRAME_BASE } from "../lib/parrilla";

// Imagen predeterminada de cada slot (viene con el output, en /output/clima/).
const defaultUrl = (k: ClimaSlotKey) => `${OUTPUT_FRAME_BASE}/output/clima/big-${k}.png`;

// Ajustes → Íconos del clima: una imagen grande (BIG) por cada situación del cielo que distingue el
// sistema según lo que manda la API (código del clima + día/noche). Lo que no se cargue usa la
// imagen predeterminada.
export function AjustesClima() {
  const [icons, setIcons] = useState<ClimaIconsConfig | null>(null);
  const [busy, setBusy] = useState<ClimaSlotKey | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const target = useRef<ClimaSlotKey | null>(null);

  useEffect(() => {
    settingsApi.get().then((s) => setIcons((s.climaIcons ?? {}) as ClimaIconsConfig)).catch((e) => setErr(e.message));
  }, []);

  async function save(next: ClimaIconsConfig, key: ClimaSlotKey, okMsg: string) {
    setBusy(key); setErr(null); setMsg(null);
    try {
      const s = await settingsApi.update({ climaIcons: next });
      setIcons((s.climaIcons ?? {}) as ClimaIconsConfig);
      setMsg(okMsg);
      setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(null);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const key = target.current;
    e.target.value = "";
    if (!file || !key || !icons) return;
    if (!/^image\//.test(file.type)) return setErr("El archivo tiene que ser una imagen (PNG con fondo transparente, ideal).");
    setBusy(key); setErr(null);
    try {
      const url = await uploadMedia(file, "media", "ajustes");
      await save({ ...icons, [key]: url }, key, "Ícono guardado.");
    } catch (er) {
      setErr(er instanceof Error ? er.message : "no se pudo subir la imagen");
      setBusy(null);
    }
  }

  function pick(key: ClimaSlotKey) { target.current = key; fileRef.current?.click(); }
  function restore(key: ClimaSlotKey) {
    if (!icons) return;
    const next = { ...icons }; delete next[key];
    void save(next, key, "Volvió al predeterminado.");
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Íconos del clima</h1>
          <p>Cargá la imagen grande de cada situación del cielo. Lo que no cargues usa la imagen predeterminada.</p>
        </div>
        <Link to="/ajustes" className="btn"><ArrowLeft size={16} /> Ajustes</Link>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}
      <input ref={fileRef} type="file" accept="image/png,image/webp,image/*" style={{ display: "none" }} onChange={onFile} />

      {icons == null ? (
        <div className="muted-note">Cargando…</div>
      ) : (
        <div className="cw-grid">
          <style>{CSS}</style>
          {CLIMA_SLOTS.map((s) => {
            const custom = icons[s.key];
            const fb = !custom && !s.hasDefault ? CLIMA_SLOTS.find((x) => x.key === s.fallback) : null;
            const src = custom ?? (s.hasDefault ? defaultUrl(s.key) : fb ? (icons[fb.key] ?? defaultUrl(fb.key)) : null);
            return (
              <div className="card cw-card" key={s.key}>
                <div className="cw-thumb">
                  {src ? <img src={src} alt={s.label} /> : <span>Sin imagen</span>}
                  {busy === s.key && <div className="cw-busy"><Loader2 size={22} className="spin" /></div>}
                </div>
                <div className="cw-name">{s.label}</div>
                <div className="cw-when">{s.when}</div>
                <div className={"cw-badge" + (custom ? " on" : "")}>
                  {custom ? "Personalizado" : fb ? `Usa la de ${fb.label}` : "Predeterminado"}
                </div>
                <div className="cw-actions">
                  <button className="btn" disabled={busy != null} onClick={() => pick(s.key)}><Upload size={15} /> {custom ? "Reemplazar" : "Cargar"}</button>
                  {custom && <button className="btn" disabled={busy != null} onClick={() => restore(s.key)} title="Volver al predeterminado"><RotateCcw size={15} /></button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

const CSS = `
.cw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:16px}
.cw-card{padding:12px;display:flex;flex-direction:column;gap:6px}
.cw-thumb{position:relative;aspect-ratio:1/1;border-radius:10px;background:linear-gradient(135deg,#1d3a9a,#0b1f52);display:flex;align-items:center;justify-content:center;overflow:hidden;color:#8fa0d6;font-size:12px}
.cw-thumb img{width:88%;height:88%;object-fit:contain}
.cw-busy{position:absolute;inset:0;background:rgba(5,13,51,.55);display:flex;align-items:center;justify-content:center;color:#fff}
.cw-name{font-weight:600;font-size:14px;margin-top:4px}
.cw-when{font-size:11.5px;color:var(--muted);line-height:1.3;min-height:30px}
.cw-badge{align-self:flex-start;font-size:10.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;padding:2px 8px;border-radius:999px;background:#eef1f6;color:#7c869b}
.cw-badge.on{background:#e8efff;color:#2f6bff}
.cw-actions{display:flex;gap:8px;margin-top:4px}
.cw-actions .btn:first-child{flex:1;justify-content:center}
.spin{animation:cwspin 1s linear infinite}@keyframes cwspin{to{transform:rotate(360deg)}}
`;
