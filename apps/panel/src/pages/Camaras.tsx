import { useEffect, useState } from "react";
import { Plus, Trash2, Video, Search, Loader2 } from "lucide-react";
import type { Camera, CameraType } from "@newsroller/shared";
import { camerasApi, youtubeId, type WindyHit } from "../lib/cameras";

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
  // Marcar una cámara como activa (y desactivar las demás).
  async function setActive(cam: Camera) {
    await Promise.all(items.filter((c) => c.active && c.id !== cam.id).map((c) => camerasApi.patch(c.id, { active: false })));
    await camerasApi.patch(cam.id, { active: !cam.active });
    await load();
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
          <p>Cámaras en vivo para mostrar al aire (YouTube, HLS, imagen que se actualiza). La activa es la que usan las plantillas con el elemento "Cámara" en modo activa.</p>
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <form className="card" style={{ padding: 18 }} onSubmit={add}>
            <div style={{ fontWeight: 500, marginBottom: 14 }}>Agregar cámara</div>
            <div className="field"><label>Nombre</label><input value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div className="field"><label>Ciudad</label><input value={city} onChange={(e) => setCity(e.target.value)} /></div>
            <div className="field"><label>Tipo</label>
              <select value={type} onChange={(e) => setType(e.target.value as CameraType)}>
                <option value="youtube">YouTube (link o ID)</option>
                <option value="hls">HLS (.m3u8)</option>
                <option value="image">Imagen que refresca (.jpg)</option>
                <option value="iframe">Embed (iframe)</option>
              </select>
            </div>
            <div className="field"><label>{type === "youtube" ? "Link o ID de YouTube" : "URL"}</label><input value={url} onChange={(e) => setUrl(e.target.value)} required placeholder={type === "youtube" ? "https://youtube.com/live/…" : "https://…"} /></div>
            <button className="btn primary" type="submit" style={{ width: "100%", justifyContent: "center" }}><Plus size={16} /> Agregar</button>
          </form>

          <WindySearch onAdded={load} setErr={setErr} />
        </div>

        <div className="asset-grid">
          {items.map((c) => {
            const t = thumb(c);
            return (
              <div key={c.id} className={"asset-card" + (c.active ? " on" : "")}>
                <div className="asset-thumb">
                  {t ? <img src={t} alt={c.name} /> : <Video size={26} />}
                </div>
                <div className="asset-body">
                  <div className="asset-name">{c.name}{c.city ? <span className="muted-note"> · {c.city}</span> : null}</div>
                  <div className="asset-actions">
                    <button className={"toggle-pill" + (c.active ? " on" : "")} onClick={() => setActive(c)}>
                      {c.active && <span className="live-dot" />}
                      {c.active ? "Al aire" : "Poner al aire"}
                    </button>
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

function WindySearch({ onAdded, setErr }: { onAdded: () => Promise<void>; setErr: (s: string | null) => void }) {
  const [city, setCity] = useState("");
  const [hits, setHits] = useState<WindyHit[]>([]);
  const [busy, setBusy] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await camerasApi.windy(city.trim());
      setHits(r.cameras);
      if (r.cameras.length === 0) setErr("Sin cámaras de Windy para esa ciudad.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }
  async function addHit(h: WindyHit) {
    await camerasApi.create({ name: h.title, city: h.city, type: "image", url: h.preview });
    await onAdded();
  }

  return (
    <form className="card" style={{ padding: 18 }} onSubmit={search}>
      <div style={{ fontWeight: 500, marginBottom: 12 }}>Buscar en Windy</div>
      <div className="row" style={{ gap: 8 }}>
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ciudad (ej: Córdoba)" />
        <button className="btn" type="submit" disabled={busy}>{busy ? <Loader2 size={14} className="spin" /> : <Search size={14} />}</button>
      </div>
      {hits.length > 0 && (
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {hits.map((h) => (
            <div key={h.webcamId} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <img src={h.preview} style={{ width: 56, height: 32, objectFit: "cover", borderRadius: 4 }} />
              <div style={{ flex: 1, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.title}</div>
              <button type="button" className="btn" style={{ padding: "4px 8px" }} onClick={() => addHit(h)}><Plus size={13} /></button>
            </div>
          ))}
        </div>
      )}
    </form>
  );
}
