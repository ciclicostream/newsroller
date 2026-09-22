import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Upload, Trash2, Music, Check, Loader2 } from "lucide-react";
import type { MusicTrack } from "@newsroller/shared";
import { MUSIC_DEFAULT } from "@newsroller/shared";
import { settingsApi } from "../lib/settings";
import { uploadMedia } from "../lib/content";

// Ajustes → Música: los temas que se pueden dejar sonando de fondo cuando el aire no tiene
// contenido con audio propio (fadeout/fadein automático, ver Output). Sólo uno puede estar
// seleccionado a la vez; el on/off del canal vive en el Monitor de Emisión, no acá.
export function AjustesMusica() {
  const [tracks, setTracks] = useState<MusicTrack[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const enabledRef = useRef(false); // se preserva tal cual: esta página no prende/apaga el canal
  const [busy, setBusy] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    settingsApi.get().then((s) => { const m = s.music ?? MUSIC_DEFAULT; setTracks(m.tracks); setActiveId(m.activeId); enabledRef.current = m.enabled; }).catch((e) => setErr(e.message));
  }, []);

  async function save(next: MusicTrack[], nextActive: string | null, key: string, okMsg: string) {
    setBusy(key); setErr(null); setMsg(null);
    try {
      const s = await settingsApi.update({ music: { tracks: next, activeId: nextActive, enabled: enabledRef.current } });
      const m = s.music ?? MUSIC_DEFAULT;
      setTracks(m.tracks); setActiveId(m.activeId); enabledRef.current = m.enabled;
      setMsg(okMsg); setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    } finally { setBusy(null); }
  }

  function pick() { fileRef.current?.click(); }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !tracks) return;
    if (!/^audio\//.test(file.type)) return setErr("Tiene que ser un archivo de audio (MP3, WAV, etc.).");
    setUploading(true); setErr(null);
    try {
      const url = await uploadMedia(file, "media", "ajustes");
      const id = `mus-${Date.now().toString(36)}`;
      const name = file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 60) || "Tema";
      const next = [...tracks, { id, name, url }];
      // El primer tema cargado queda seleccionado solo, así "Habilitar" en el Monitor ya tiene qué sonar.
      await save(next, activeId ?? id, id, "Tema cargado.");
    } catch (er) {
      setErr(er instanceof Error ? er.message : "no se pudo subir el tema");
    } finally { setUploading(false); }
  }
  function selectActive(id: string) {
    if (!tracks) return;
    void save(tracks, id, id, "Tema seleccionado.");
  }
  function remove(t: MusicTrack) {
    if (!tracks || !confirm(`¿Borrar "${t.name}"?`)) return;
    void save(tracks.filter((x) => x.id !== t.id), activeId === t.id ? null : activeId, t.id, "Tema borrado.");
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Música</h1>
          <p>Temas para el canal de música de fondo. Suena mientras el aire no tiene contenido con audio propio, y se apaga con fadeout al cruzarse con uno que sí. El volumen lo maneja vMix/OBS; acá sólo elegís qué tema está activo. El interruptor para encender el canal está en el Monitor de Emisión.</p>
        </div>
        <Link to="/ajustes" className="btn"><ArrowLeft size={16} /> Ajustes</Link>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}
      <input ref={fileRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={onFile} />

      {tracks == null ? (
        <div className="muted-note">Cargando…</div>
      ) : (
        <>
          <style>{CSS}</style>
          <div className="mus-list">
            {tracks.length === 0 && <div className="card" style={{ padding: 22, textAlign: "center" }}><div className="muted-note">Todavía no cargaste ningún tema.</div></div>}
            {tracks.map((t) => (
              <div className={"card mus-row" + (activeId === t.id ? " on" : "")} key={t.id}>
                <span className="mus-ic"><Music size={16} /></span>
                <span className="mus-name">{t.name}</span>
                <button className={"btn" + (activeId === t.id ? " primary" : "")} disabled={busy != null || activeId === t.id} onClick={() => selectActive(t.id)}>
                  {busy === t.id ? <Loader2 size={14} className="spin" /> : activeId === t.id ? <Check size={14} /> : null} {activeId === t.id ? "Activo" : "Elegir"}
                </button>
                <button className="btn danger-ghost" disabled={busy != null} onClick={() => remove(t)} title="Borrar"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
          <button className="btn primary" style={{ marginTop: 14 }} disabled={uploading} onClick={pick}>
            {uploading ? <Loader2 size={15} className="spin" /> : <Upload size={15} />} Cargar tema
          </button>
        </>
      )}
    </>
  );
}

const CSS = `
.mus-list{display:flex;flex-direction:column;gap:10px;max-width:640px}
.mus-row{padding:12px 14px;display:flex;align-items:center;gap:12px}
.mus-row.on{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.mus-ic{color:var(--muted);flex:none}
.mus-name{flex:1;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`;
