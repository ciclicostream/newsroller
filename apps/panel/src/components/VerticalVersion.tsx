import { useRef, useState } from "react";
import { Loader2, X, Youtube } from "lucide-react";
import { uploadMedia } from "../lib/content";
import { youtubeId } from "../lib/cameras";

// Versión vertical (9:16) de un contenido "full pantalla". Sin ella, el contenido NO sale en el output vertical.
// Puede ser un archivo (imagen o video 9:16) o, si `allowYoutube`, el link de un short de YouTube.
export interface VerticalValue { url?: string | null; kind?: "image" | "video" | null; yt?: string | null }

export function VerticalVersion({ value, onChange, allowYoutube = false }: { value: VerticalValue; onChange: (v: VerticalValue) => void; allowYoutube?: boolean }) {
  const [mode, setMode] = useState<"file" | "yt">(value.yt ? "yt" : "file");
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ytInput, setYtInput] = useState(value.yt ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null); setUploading(true);
    try {
      const url = await uploadMedia(file, "media");
      onChange({ url, kind: file.type.startsWith("video") ? "video" : "image", yt: null });
    } catch (er) {
      setErr(er instanceof Error ? er.message : "error subiendo");
    } finally {
      setUploading(false);
    }
  }
  function clear() {
    onChange({ url: null, kind: null, yt: null });
    setYtInput("");
    if (fileRef.current) fileRef.current.value = "";
  }
  const has = !!(value.url || value.yt);

  return (
    <div className="field">
      <label>Versión vertical 9:16 <i>(opcional)</i></label>
      {allowYoutube && (
        <div className="tabs" style={{ marginBottom: 8 }}>
          <button type="button" className={"tab" + (mode === "file" ? " active" : "")} onClick={() => setMode("file")}>Archivo</button>
          <button type="button" className={"tab" + (mode === "yt" ? " active" : "")} onClick={() => setMode("yt")}><Youtube size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Short de YouTube</button>
        </div>
      )}
      {mode === "file" ? (
        value.url ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {value.kind === "video" ? <video src={value.url} style={{ width: 30, height: 54, objectFit: "cover", borderRadius: 6 }} muted /> : <img src={value.url} alt="" style={{ width: 30, height: 54, objectFit: "cover", borderRadius: 6 }} />}
            <button type="button" className="btn" onClick={clear}><X size={14} /> quitar</button>
          </div>
        ) : (
          <input ref={fileRef} type="file" accept="image/*,video/*" onChange={onFile} disabled={uploading} />
        )
      ) : (
        <input
          value={ytInput}
          onChange={(e) => { setYtInput(e.target.value); const id = youtubeId(e.target.value); onChange({ url: null, kind: null, yt: e.target.value.trim() ? id : null }); }}
          placeholder="https://youtube.com/shorts/…"
        />
      )}
      {uploading && <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4 }}><Loader2 size={13} className="spin" /> subiendo…</div>}
      {err && <div className="muted-note" style={{ color: "#c0392b", marginTop: 4 }}>{err}</div>}
      <div className="muted-note" style={{ marginTop: 4 }}>
        {has ? "Este contenido saldrá también en el output vertical." : "Sin versión vertical, este contenido no sale en el output vertical."}
      </div>
    </div>
  );
}
