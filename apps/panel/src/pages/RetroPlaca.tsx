import { useEffect, useRef, useState } from "react";
import { PreviewMonitor } from "../components/PreviewMonitor";
import { EfemeridesSwitch } from "../components/PlacaSwitch";
import { Plus, Trash2, Check, X, Loader2, Tv, Pencil } from "lucide-react";
import type { ContentItem, RetroData } from "@newsroller/shared";
import { contentItems } from "../lib/content-items";
import { uploadMedia } from "../lib/content";

const CHIP_MAX = 14;
const YEAR_MAX = 14;
const T_MAX = 70;
const SUB_MAX = 50;
const TXT_MAX = 450;
const DEFAULT_DUR = 15;

export function RetroPlaca() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<"image" | "video">("image");
  const [videoSec, setVideoSec] = useState<number | null>(null); // duración del video cargado
  const [chip, setChip] = useState("PROGRAMA");
  const [year, setYear] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [text, setText] = useState("");
  const [dur, setDur] = useState(DEFAULT_DUR);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => contentItems.list("retro").then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { void load(); }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null); setUploading(true);
    try {
      const url = await uploadMedia(file, "media");
      setMediaUrl(url);
      setMediaKind(file.type.startsWith("video") ? "video" : "image");
      setVideoSec(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error subiendo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  function clearMedia() { setMediaUrl(null); setVideoSec(null); }

  const buildData = (): RetroData => ({
    media_url: mediaUrl ?? "",
    media_kind: mediaKind,
    chip: chip.trim(),
    year: year.trim() || undefined,
    title: title.trim(),
    subtitle: subtitle.trim() || undefined,
    text: text.trim() || undefined,
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (!mediaUrl) return setErr("La imagen o el video es obligatorio.");
    if (!title.trim()) return setErr("El título es obligatorio.");
    setSaving(true);
    try {
      const data = buildData() as unknown as Record<string, any>;
      if (editingId) {
        await contentItems.patch(editingId, { data, duration_sec: dur });
        setMsg("Cambios guardados.");
      } else {
        await contentItems.create({ type: "retro", data, duration_sec: dur });
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
    const d = it.data as RetroData;
    setEditingId(it.id);
    setMediaUrl(d.media_url || null); setMediaKind(d.media_kind ?? "image"); setVideoSec(null);
    setChip(d.chip ?? "PROGRAMA"); setYear(d.year ?? ""); setTitle(d.title ?? "");
    setSubtitle(d.subtitle ?? ""); setText(d.text ?? "");
    setDur(it.duration_sec);
    setErr(null); setMsg(null);
  }
  function cancelEdit() {
    setEditingId(null);
    setMediaUrl(null); setMediaKind("image"); setVideoSec(null);
    setChip("PROGRAMA"); setYear(""); setTitle(""); setSubtitle(""); setText("");
    setDur(DEFAULT_DUR);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function remove(it: ContentItem) {
    if (!confirm("¿Enviar este contenido a la papelera?")) return;
    await contentItems.remove(it.id);
    if (editingId === it.id) cancelEdit();
    await load();
  }
  async function toggleDisponible(it: ContentItem) {
    await contentItems.patch(it.id, { in_parrilla: !(it.in_parrilla !== false) });
    await load();
  }

  return (
    <>
      <div className="page-head pm-head">
        <div>
          <h1>Efemérides</h1>
          <p>Retro: un programa viejo, con imagen o video, año, título y descripción.</p>
        </div>
      </div>

      <EfemeridesSwitch active="retro" />

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      <div className="pm-layout">
        <form className="card" style={{ padding: 18 }} onSubmit={save}>
          <div style={{ fontWeight: 500, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {editingId ? "Editar retro" : "Nuevo retro"}
            {editingId && <button type="button" className="btn" onClick={cancelEdit}>Cancelar</button>}
          </div>

          <div className="field">
            <label>Imagen o video (obligatorio)</label>
            {mediaUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {mediaKind === "video"
                  ? <video src={mediaUrl} style={{ width: 84, height: 56, objectFit: "cover", borderRadius: 6 }} muted onLoadedMetadata={(e) => setVideoSec(e.currentTarget.duration)} />
                  : <img src={mediaUrl} alt="" style={{ width: 84, height: 56, objectFit: "cover", borderRadius: 6 }} />}
                <button type="button" className="btn" onClick={clearMedia}><X size={14} /> quitar</button>
              </div>
            ) : (
              <input ref={fileRef} type="file" accept="image/*,video/*" onChange={onFile} disabled={uploading} />
            )}
            {uploading && <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4 }}><Loader2 size={13} className="spin" /> subiendo…</div>}
            <div className="muted-note" style={{ marginTop: 4 }}>Captura horizontal, afiche vertical o un clip. El marco se ajusta a la proporción. El video sale mudo salvo que se active el audio de la salida.</div>
          </div>

          <div className="field xy" style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label>Año o época</label>
              <input value={year} onChange={(e) => setYear(e.target.value.slice(0, YEAR_MAX))} maxLength={YEAR_MAX} placeholder="1990 · Años 90 · 1978–83" />
            </div>
            <div style={{ width: 170 }}>
              <label>Etiqueta</label>
              <input value={chip} onChange={(e) => setChip(e.target.value.slice(0, CHIP_MAX).toUpperCase())} maxLength={CHIP_MAX} placeholder="PROGRAMA" />
            </div>
          </div>
          <div className="muted-note" style={{ marginTop: -6, marginBottom: 14 }}>La etiqueta va al lado del año. Vacía, no se muestra.</div>

          <div className="field">
            <label>Título</label>
            <textarea value={title} onChange={(e) => setTitle(e.target.value.slice(0, T_MAX))} rows={2} maxLength={T_MAX} required />
            <div style={{ fontSize: 12, color: "#6b7688", textAlign: "right", marginTop: 4 }}>{title.length}/{T_MAX}</div>
          </div>

          <div className="field">
            <label>Subtítulo</label>
            <input value={subtitle} onChange={(e) => setSubtitle(e.target.value.slice(0, SUB_MAX))} maxLength={SUB_MAX} placeholder="Tipo de programa, canal" />
          </div>

          <div className="field">
            <label>Descripción</label>
            <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, TXT_MAX))} rows={5} maxLength={TXT_MAX} />
            <div style={{ fontSize: 12, color: "#6b7688", textAlign: "right", marginTop: 4 }}>{text.length}/{TXT_MAX}</div>
          </div>

          <div className="field">
            <label>Duración del bloque (segundos)</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="number" min={2} value={dur} onChange={(e) => setDur(Math.max(2, Number(e.target.value) || DEFAULT_DUR))} style={{ flex: 1 }} />
              {mediaKind === "video" && videoSec ? (
                <button type="button" className="btn" onClick={() => setDur(Math.max(2, Math.ceil(videoSec)))}>Usar lo que dura el video ({Math.ceil(videoSec)} s)</button>
              ) : null}
            </div>
          </div>

          <button className="btn primary" type="submit" disabled={saving || uploading} style={{ width: "100%", justifyContent: "center" }}>
            <Plus size={16} /> {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Guardar en el banco"}
          </button>
        </form>

        <div className="pm-col">
          <PreviewMonitor type="retro" data={buildData() as unknown as Record<string, unknown>} dur={dur} ready={!!mediaUrl && !!title.trim()} />
          {items.length === 0 && <div className="card" style={{ padding: 18, color: "#6b7688" }}>Todavía no hay contenidos Retro.</div>}
          {items.map((it) => {
            const d = it.data as RetroData;
            return (
              <div key={it.id} data-item={it.id} className="card" style={{ padding: 16, display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: "#0d2168", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {d.media_kind === "image" && d.media_url ? <img src={d.media_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Tv size={20} color="#fff" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4, display: "flex", gap: 12 }}>
                    {d.year && <span>{d.year}</span>}
                    <span>{d.media_kind === "video" ? "Video" : "Imagen"}</span>
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
