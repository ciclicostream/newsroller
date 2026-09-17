import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Check, MonitorPlay, X, Loader2 } from "lucide-react";
import type { ContentItem, VideoFullData } from "@newsroller/shared";
import { contentItems } from "../lib/content-items";
import { uploadMedia } from "../lib/content";

export function VideoFullPlaca() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<"image" | "video">("video");
  const [uploading, setUploading] = useState(false);
  const [dur, setDur] = useState(15);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => contentItems.list("video_full").then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { void load(); }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null); setUploading(true);
    try {
      setMediaUrl(await uploadMedia(file, "media"));
      setMediaKind(file.type.startsWith("video") ? "video" : "image");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error subiendo");
    } finally {
      setUploading(false);
    }
  }
  function clearMedia() {
    setMediaUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (!mediaUrl) return setErr("El video o imagen es obligatorio.");
    setSaving(true);
    try {
      const data: VideoFullData = { media_url: mediaUrl, media_kind: mediaKind };
      await contentItems.create({ type: "video_full", data, duration_sec: dur });
      clearMedia();
      setMsg("Guardado en el banco.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(it: ContentItem) {
    if (!confirm("¿Eliminar este video full?")) return;
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
          <h1>Video Full</h1>
          <p>Video o imagen a pantalla completa, sin overlay. Igual que Publicidad Full, pero NO genera reporte.</p>
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", gap: 20, alignItems: "start" }}>
        <form className="card" style={{ padding: 18 }} onSubmit={save}>
          <div style={{ fontWeight: 500, marginBottom: 14 }}>Nuevo video full</div>

          <div className="field">
            <label>Video o imagen</label>
            {mediaUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {mediaKind === "video" ? <video src={mediaUrl} style={{ width: 72, height: 40, objectFit: "cover", borderRadius: 6 }} muted /> : <img src={mediaUrl} alt="" style={{ width: 72, height: 40, objectFit: "cover", borderRadius: 6 }} />}
                <button type="button" className="btn" onClick={clearMedia}><X size={14} /> quitar</button>
              </div>
            ) : (
              <input ref={fileRef} type="file" accept="image/*,video/*" onChange={onFile} disabled={uploading} required />
            )}
            {uploading && <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4 }}><Loader2 size={13} className="spin" /> subiendo…</div>}
          </div>

          <div className="field">
            <label>Duración (segundos)</label>
            <input type="number" min={2} value={dur} onChange={(e) => setDur(Math.max(2, Number(e.target.value) || 15))} />
          </div>

          <button className="btn primary" type="submit" disabled={saving || uploading} style={{ width: "100%", justifyContent: "center" }}>
            <Plus size={16} /> {saving ? "Guardando…" : "Guardar en el banco"}
          </button>
        </form>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.length === 0 && <div className="card" style={{ padding: 18, color: "#6b7688" }}>Todavía no hay videos full.</div>}
          {items.map((it) => {
            const d = it.data as VideoFullData;
            return (
              <div key={it.id} className="card" style={{ padding: 16, display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 72, height: 40, borderRadius: 6, background: "#0d2168", flex: "0 0 auto", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {d.media_kind === "video" ? <video src={d.media_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted /> : <img src={d.media_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                    <MonitorPlay size={15} /> {d.media_kind === "video" ? "Video" : "Imagen"}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4 }}>{it.duration_sec}s</div>
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
