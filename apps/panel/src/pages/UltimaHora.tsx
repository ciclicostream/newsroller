import { useEffect, useRef, useState } from "react";
import { PreviewMonitor } from "../components/PreviewMonitor";
import { Plus, Trash2, Check, Loader2, Image as ImageIcon, Video, Music, X, Pencil } from "lucide-react";
import type { ContentItem, UltimaHoraData } from "@newsroller/shared";
import { contentItems } from "../lib/content-items";
import { uploadMedia } from "../lib/content";

const MAX = 200;

export function UltimaHora() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [dur, setDur] = useState(8);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<"image" | "video" | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);

  const load = () => contentItems.list("ultima_hora").then(setItems).catch((e) => setErr(e.message));
  useEffect(() => {
    void load();
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setUploading(true);
    try {
      const url = await uploadMedia(file, "media");
      setMediaUrl(url);
      setMediaKind(file.type.startsWith("video/") ? "video" : "image");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error subiendo");
    } finally {
      setUploading(false);
    }
  }

  function clearMedia() {
    setMediaUrl(null);
    setMediaKind(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onAudioFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setUploadingAudio(true);
    try { setAudioUrl(await uploadMedia(file, "media")); }
    catch (e) { setErr(e instanceof Error ? e.message : "error subiendo"); }
    finally { setUploadingAudio(false); }
  }
  function clearAudio() {
    setAudioUrl(null);
    if (audioRef.current) audioRef.current.value = "";
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!text.trim()) return setErr("El texto es obligatorio.");
    setSaving(true);
    try {
      const data: UltimaHoraData = { text: text.trim().slice(0, MAX), media_url: mediaUrl, media_kind: mediaKind, audio_url: audioUrl };
      if (editingId) {
        await contentItems.patch(editingId, { data, duration_sec: dur });
        setMsg("Cambios guardados.");
      } else {
        await contentItems.create({ type: "ultima_hora", data, duration_sec: dur });
        setMsg("Guardado en el banco.");
      }
      cancelEdit();
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(it: ContentItem) {
    const d = it.data as UltimaHoraData;
    setEditingId(it.id);
    setText(d.text ?? "");
    setDur(it.duration_sec);
    setMediaUrl(d.media_url ?? null);
    setMediaKind(d.media_kind ?? null);
    setAudioUrl(d.audio_url ?? null);
    setErr(null); setMsg(null);
  }
  function cancelEdit() {
    setEditingId(null);
    setText("");
    setDur(8);
    clearMedia();
    clearAudio();
  }

  async function remove(it: ContentItem) {
    if (!confirm("¿Eliminar esta placa de Última Hora?")) return;
    await contentItems.remove(it.id);
    if (editingId === it.id) cancelEdit();
    await load();
  }

  async function toggleDisponible(it: ContentItem) {
    setErr(null);
    try {
      await contentItems.patch(it.id, { in_parrilla: !(it.in_parrilla !== false) });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    }
  }

  return (
    <>
      <div className="page-head pm-head">
        <div>
          <h1>Última Hora</h1>
          <p>Placa de alerta (roja). Texto obligatorio (máx. {MAX}, admite **negrita** con asteriscos).</p>
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      <div className="pm-layout">
        <form className="card" style={{ padding: 18 }} onSubmit={save}>
          <div style={{ fontWeight: 500, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {editingId ? "Editar placa" : "Nueva placa"}
            {editingId && <button type="button" className="btn" onClick={cancelEdit}>Cancelar</button>}
          </div>

          <div className="field">
            <label>Texto de la noticia</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX))}
              rows={4}
              maxLength={MAX}
              placeholder={'Abogados de Cristina presentaron una **"prueba trascendente"**…'}
              required
            />
            <div style={{ fontSize: 12, color: "#6b7688", textAlign: "right", marginTop: 4 }}>{text.length}/{MAX}</div>
          </div>

          <div className="field">
            <label>Foto o video (opcional)</label>
            {mediaUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  {mediaKind === "video" ? <Video size={16} /> : <ImageIcon size={16} />} recurso cargado
                </span>
                <button type="button" className="btn" onClick={clearMedia}><X size={14} /> quitar</button>
              </div>
            ) : (
              <input ref={fileRef} type="file" accept="image/*,video/*" onChange={onFile} disabled={uploading} />
            )}
            {uploading && <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4 }}><Loader2 size={13} className="spin" /> subiendo…</div>}
          </div>

          <div className="field">
            <label>Audio (opcional)</label>
            {audioUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  <Music size={16} /> audio cargado
                </span>
                <button type="button" className="btn" onClick={clearAudio}><X size={14} /> quitar</button>
              </div>
            ) : (
              <input ref={audioRef} type="file" accept="audio/*" onChange={onAudioFile} disabled={uploadingAudio} />
            )}
            {uploadingAudio && <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4 }}><Loader2 size={13} className="spin" /> subiendo…</div>}
          </div>

          <div className="field">
            <label>Duración (segundos)</label>
            <input type="number" min={2} value={dur} onChange={(e) => setDur(Math.max(2, Number(e.target.value) || 8))} />
          </div>

          <button className="btn primary" type="submit" disabled={saving || uploading || uploadingAudio} style={{ width: "100%", justifyContent: "center" }}>
            <Plus size={16} /> {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Guardar en el banco"}
          </button>
        </form>

        <div className="pm-col">
          <PreviewMonitor type="ultima_hora" data={{ text, media_url: mediaUrl, media_kind: mediaKind, audio_url: null }} dur={dur} ready={!!text.trim()} />
          {items.length === 0 && <div className="card" style={{ padding: 18, color: "#6b7688" }}>Todavía no hay placas de Última Hora.</div>}
          {items.map((it) => {
            const d = it.data as UltimaHoraData;
            return (
              <div key={it.id} className="card" style={{ padding: 16, display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 90, height: 64, borderRadius: 8, background: "#EE220C", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 12, fontFamily: "Zilla Slab, serif" }}>
                  ÚLTIMA
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {(d.text ?? "").replace(/\*\*/g, "")}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4, display: "flex", gap: 12 }}>
                    <span>{d.media_url ? (d.media_kind === "video" ? "con video" : "con foto") : "solo texto (full)"}</span>
                    <span>{it.duration_sec}s</span>
                  </div>
                </div>
                <button className={"toggle-pill" + (it.in_parrilla !== false ? " on" : "")} onClick={() => toggleDisponible(it)}>
                  {it.in_parrilla !== false && <Check size={14} />} {it.in_parrilla !== false ? "En parrilla" : "Disponible: no"}
                </button>
                <button className="btn" onClick={() => startEdit(it)}><Pencil size={15} /></button>
                <button className="btn" onClick={() => remove(it)}><Trash2 size={15} /></button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
