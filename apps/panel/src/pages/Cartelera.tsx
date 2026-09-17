import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Check, X, Loader2, Clapperboard } from "lucide-react";
import type { ContentItem, CarteleraData } from "@newsroller/shared";
import { contentItems } from "../lib/content-items";
import { uploadMedia } from "../lib/content";

const T_MAX = 90;

export function Cartelera() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [cast, setCast] = useState("");
  const [venue, setVenue] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [days, setDays] = useState("");
  const [time, setTime] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [dur, setDur] = useState(10);
  const [saving, setSaving] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const load = () => contentItems.list("cartelera").then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { void load(); }, []);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null); setUploadingPhoto(true);
    try { setPhotoUrl(await uploadMedia(file, "media")); }
    catch (e) { setErr(e instanceof Error ? e.message : "error subiendo"); }
    finally { setUploadingPhoto(false); }
  }
  async function onVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null); setUploadingVideo(true);
    try { setVideoUrl(await uploadMedia(file, "media")); }
    catch (e) { setErr(e instanceof Error ? e.message : "error subiendo"); }
    finally { setUploadingVideo(false); }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (!photoUrl) return setErr("La foto horizontal es obligatoria.");
    if (!title.trim() || !author.trim() || !cast.trim() || !venue.trim() || !address.trim() || !city.trim() || !days.trim() || !time.trim()) {
      return setErr("Todos los campos son obligatorios (salvo el video).");
    }
    setSaving(true);
    try {
      const data: CarteleraData = {
        photo_url: photoUrl, title: title.trim().slice(0, T_MAX), author: author.trim(), cast: cast.trim(),
        venue: venue.trim(), address: address.trim(), city: city.trim(), days: days.trim(), time: time.trim(),
        video_url: videoUrl,
      };
      await contentItems.create({ type: "cartelera", data, duration_sec: dur });
      setPhotoUrl(null); setTitle(""); setAuthor(""); setCast(""); setVenue(""); setAddress(""); setCity(""); setDays(""); setTime(""); setVideoUrl(null);
      if (photoRef.current) photoRef.current.value = "";
      if (videoRef.current) videoRef.current.value = "";
      setMsg("Guardado en el banco.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(it: ContentItem) {
    if (!confirm("¿Eliminar esta cartelera?")) return;
    await contentItems.remove(it.id);
    await load();
  }
  async function toggleDisponible(it: ContentItem) {
    await contentItems.patch(it.id, { in_parrilla: !(it.in_parrilla !== false) });
    await load();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Cartelera</h1>
          <p>Estreno u obra con ficha completa. Todos los campos son obligatorios salvo el video (opcional, 9:16).</p>
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "440px 1fr", gap: 20, alignItems: "start" }}>
        <form className="card" style={{ padding: 18 }} onSubmit={save}>
          <div style={{ fontWeight: 500, marginBottom: 14 }}>Nueva cartelera</div>

          <div className="field">
            <label>Foto horizontal (obligatoria)</label>
            {photoUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <img src={photoUrl} alt="" style={{ width: 72, height: 40, objectFit: "cover", borderRadius: 6 }} />
                <button type="button" className="btn" onClick={() => { setPhotoUrl(null); if (photoRef.current) photoRef.current.value = ""; }}><X size={14} /> quitar</button>
              </div>
            ) : (
              <input ref={photoRef} type="file" accept="image/*" onChange={onPhoto} disabled={uploadingPhoto} required />
            )}
            {uploadingPhoto && <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4 }}><Loader2 size={13} className="spin" /> subiendo…</div>}
          </div>

          <div className="field">
            <label>Título de la obra</label>
            <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, T_MAX))} maxLength={T_MAX} required />
          </div>
          <div className="field">
            <label>Autor (se muestra "De …")</label>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} required />
          </div>
          <div className="field">
            <label>Elenco (se muestra "Con: …")</label>
            <input value={cast} onChange={(e) => setCast(e.target.value)} required />
          </div>

          <div className="field xy" style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><label>Lugar</label><input value={venue} onChange={(e) => setVenue(e.target.value)} required /></div>
            <div style={{ flex: 1 }}><label>Ciudad/barrio</label><input value={city} onChange={(e) => setCity(e.target.value)} required /></div>
          </div>
          <div className="field">
            <label>Dirección</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} required />
          </div>
          <div className="field xy" style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><label>Día(s)</label><input value={days} onChange={(e) => setDays(e.target.value)} placeholder="Vie y sáb" required /></div>
            <div style={{ flex: 1 }}><label>Horario</label><input value={time} onChange={(e) => setTime(e.target.value)} placeholder="21:00 hs" required /></div>
          </div>

          <div className="field">
            <label>Video vertical (opcional, 9:16)</label>
            {videoUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <video src={videoUrl} style={{ width: 30, height: 54, objectFit: "cover", borderRadius: 6 }} muted />
                <button type="button" className="btn" onClick={() => { setVideoUrl(null); if (videoRef.current) videoRef.current.value = ""; }}><X size={14} /> quitar</button>
              </div>
            ) : (
              <input ref={videoRef} type="file" accept="video/*" onChange={onVideo} disabled={uploadingVideo} />
            )}
            {uploadingVideo && <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4 }}><Loader2 size={13} className="spin" /> subiendo…</div>}
          </div>

          <div className="field">
            <label>Duración (segundos)</label>
            <input type="number" min={2} value={dur} onChange={(e) => setDur(Math.max(2, Number(e.target.value) || 10))} />
          </div>

          <button className="btn primary" type="submit" disabled={saving || uploadingPhoto || uploadingVideo} style={{ width: "100%", justifyContent: "center" }}>
            <Plus size={16} /> {saving ? "Guardando…" : "Guardar en el banco"}
          </button>
        </form>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.length === 0 && <div className="card" style={{ padding: 18, color: "#6b7688" }}>Todavía no hay carteleras.</div>}
          {items.map((it) => {
            const d = it.data as CarteleraData;
            return (
              <div key={it.id} className="card" style={{ padding: 16, display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 90, height: 56, borderRadius: 8, background: "#0d2168", flex: "0 0 auto", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {d.photo_url ? <img src={d.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Clapperboard size={20} color="#fff" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4, display: "flex", gap: 12 }}>
                    <span>{d.venue}</span>
                    <span>{d.video_url ? "con video" : "sin video"}</span>
                    <span>{it.duration_sec}s</span>
                  </div>
                </div>
                <button className={"toggle-pill" + (it.in_parrilla !== false ? " on" : "")} onClick={() => toggleDisponible(it)}>
                  {it.in_parrilla !== false && <Check size={14} />} {it.in_parrilla !== false ? "En parrilla" : "Disponible: no"}
                </button>
                <button className="btn" onClick={() => remove(it)}><Trash2 size={15} /></button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
