import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Video, Play, Square } from "lucide-react";
import type { Camera, CameraType } from "@newsroller/shared";
import { camerasApi, youtubeId } from "../lib/cameras";

function thumb(c: Camera): string | null {
  if (c.type === "youtube") return `https://img.youtube.com/vi/${c.url}/hqdefault.jpg`;
  if (c.type === "image") return c.url;
  return null;
}

export function Camaras() {
  const [items, setItems] = useState<Camera[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState<CameraType>("youtube");
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const load = () => camerasApi.list().then(setItems).catch((e) => setErr(e.message));
  useEffect(() => {
    void load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.trim() || !url.trim()) return;
    try {
      await camerasApi.create({ name: name.trim(), city: city.trim() || undefined, type, url: type === "youtube" ? youtubeId(url) : url.trim() });
      setName("");
      setCity("");
      setUrl("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    }
  }
  async function remove(cam: Camera) {
    if (!confirm(`¿Eliminar la cámara "${cam.name}"?`)) return;
    await camerasApi.remove(cam.id);
    await load();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Cámaras</h1>
          <p>Cámaras en vivo (YouTube o HLS). Tocá ▶ para ver el vivo y confirmar que transmite; "Al aire" elige cuál usan las placas con el elemento Cámara.</p>
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>
        <form className="card" style={{ padding: 18 }} onSubmit={add}>
          <div style={{ fontWeight: 500, marginBottom: 14 }}>Agregar cámara</div>
          <div className="field"><label>Nombre</label><input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="field"><label>Ciudad</label><input value={city} onChange={(e) => setCity(e.target.value)} /></div>
          <div className="field"><label>Tipo</label>
            <select value={type} onChange={(e) => setType(e.target.value as CameraType)}>
              <option value="youtube">YouTube (link o ID)</option>
              <option value="hls">HLS (.m3u8)</option>
            </select>
          </div>
          <div className="field"><label>{type === "youtube" ? "Link o ID de YouTube" : "URL del .m3u8"}</label><input value={url} onChange={(e) => setUrl(e.target.value)} required placeholder={type === "youtube" ? "https://youtube.com/live/…" : "https://…/stream.m3u8"} /></div>
          <button className="btn primary" type="submit" style={{ width: "100%", justifyContent: "center" }}><Plus size={16} /> Agregar</button>
        </form>

        <div className="asset-grid">
          {items.map((c) => {
            const t = thumb(c);
            const live = preview === c.id;
            return (
              <div key={c.id} className={"asset-card" + (c.active ? " on" : "")}>
                <div className="asset-thumb cam-thumb">
                  {live ? (
                    <LivePreview cam={c} />
                  ) : t ? (
                    <img src={t} alt={c.name} />
                  ) : (
                    <Video size={26} />
                  )}
                  <button
                    className="cam-play"
                    onClick={() => setPreview(live ? null : c.id)}
                    title={live ? "Detener preview" : "Ver en vivo"}
                  >
                    {live ? <Square size={15} /> : <Play size={15} />}
                  </button>
                </div>
                <div className="asset-body">
                  <div className="asset-name">
                    {c.name}{c.city ? <span className="muted-note"> · {c.city}</span> : null}
                    <span className="cam-type">{c.type.toUpperCase()}</span>
                  </div>
                  <div className="asset-actions">
                    <button className="icon-btn" onClick={() => remove(c)} aria-label="Eliminar"><Trash2 size={16} /></button>
                  </div>
                </div>
              </div>
            );
          })}
          {items.length === 0 && <div className="muted-note">Sin cámaras todavía.</div>}
        </div>
      </div>
    </>
  );
}

// Reproduce el vivo real para confirmar que la cámara está transmitiendo.
function LivePreview({ cam }: { cam: Camera }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (cam.type !== "hls") return;
    const v = videoRef.current;
    if (!v) return;
    let hls: import("hls.js").default | undefined;
    if (v.canPlayType("application/vnd.apple.mpegurl")) {
      v.src = cam.url;
    } else {
      void import("hls.js").then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          hls = new Hls();
          hls.loadSource(cam.url);
          hls.attachMedia(v);
        } else {
          v.src = cam.url;
        }
      });
    }
    return () => hls?.destroy();
  }, [cam.type, cam.url]);

  if (cam.type === "youtube") {
    return (
      <iframe
        className="cam-live"
        src={`https://www.youtube.com/embed/${cam.url}?autoplay=1&mute=1&playsinline=1`}
        allow="autoplay; encrypted-media"
        title={cam.name}
      />
    );
  }
  if (cam.type === "hls") {
    return <video ref={videoRef} className="cam-live" autoPlay muted playsInline controls />;
  }
  return <img className="cam-live" src={cam.url} alt={cam.name} />;
}
