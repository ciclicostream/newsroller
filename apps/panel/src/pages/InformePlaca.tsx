import { useEffect, useRef, useState } from "react";
import { PreviewMonitor } from "../components/PreviewMonitor";
import { InformesSwitch } from "../components/PlacaSwitch";
import { Plus, Trash2, Check, X, Loader2, ListOrdered, Pencil } from "lucide-react";
import type { ContentItem, InformeData } from "@newsroller/shared";
import { contentItems } from "../lib/content-items";
import { uploadMedia } from "../lib/content";

const MAX_SLIDES = 10;

export function InformePlaca() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [slides, setSlides] = useState<string[]>([]);
  const [secPerSlide, setSecPerSlide] = useState(5);
  const [uploading, setUploading] = useState(false);
  const [dur, setDur] = useState(25);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => contentItems.list("informe").then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { void load(); }, []);

  async function onSlideFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (slides.length >= MAX_SLIDES) return setErr(`Máximo ${MAX_SLIDES} slides.`);
    setErr(null); setUploading(true);
    try { const url = await uploadMedia(file, "media"); setSlides((s) => [...s, url]); }
    catch (e) { setErr(e instanceof Error ? e.message : "error subiendo"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  function removeSlide(i: number) {
    setSlides((s) => s.filter((_, j) => j !== i));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (!title.trim()) return setErr("El título del informe es obligatorio.");
    if (slides.length === 0) return setErr("Subí al menos una slide.");
    setSaving(true);
    try {
      const data: InformeData = { title: title.trim(), slides, sec_per_slide: secPerSlide };
      if (editingId) {
        await contentItems.patch(editingId, { data, duration_sec: dur });
        setMsg("Cambios guardados.");
      } else {
        await contentItems.create({ type: "informe", data, duration_sec: dur });
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
    const d = it.data as InformeData;
    setEditingId(it.id);
    setTitle(d.title ?? "");
    setSlides(d.slides ?? []);
    setSecPerSlide(d.sec_per_slide ?? 5);
    setDur(it.duration_sec);
    setErr(null); setMsg(null);
  }
  function cancelEdit() {
    setEditingId(null);
    setTitle(""); setSlides([]);
    setSecPerSlide(5);
    setDur(25);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function remove(it: ContentItem) {
    if (!confirm("¿Enviar este informe a la papelera?")) return;
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
          <h1>Informes</h1>
          <p>Carrusel de hasta {MAX_SLIDES} slides (imágenes 4:5) con título fijo mientras rotan solas.</p>
        </div>
      </div>

      <InformesSwitch active="informe" />

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      <div className="pm-layout">
        <form className="card" style={{ padding: 18 }} onSubmit={save}>
          <div style={{ fontWeight: 500, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {editingId ? "Editar informe" : "Nuevo informe"}
            {editingId && <button type="button" className="btn" onClick={cancelEdit}>Cancelar</button>}
          </div>

          <div className="field">
            <label>Título del informe (fijo)</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="field">
            <label>Slides ({slides.length}/{MAX_SLIDES}, formato 4:5)</label>
            {slides.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                {slides.map((url, i) => (
                  <div key={url + i} style={{ position: "relative" }}>
                    <img src={url} alt="" style={{ width: 48, height: 60, objectFit: "cover", borderRadius: 6 }} />
                    <button type="button" className="icon-btn" onClick={() => removeSlide(i)} style={{ position: "absolute", top: -6, right: -6, background: "#fff", borderRadius: "50%" }}><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
            {slides.length < MAX_SLIDES && (
              <input ref={fileRef} type="file" accept="image/*" onChange={onSlideFile} disabled={uploading} />
            )}
            {uploading && <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4 }}><Loader2 size={13} className="spin" /> subiendo…</div>}
          </div>

          <div className="field">
            <label>Segundos por slide</label>
            <input type="number" min={2} value={secPerSlide} onChange={(e) => setSecPerSlide(Math.max(2, Number(e.target.value) || 5))} />
          </div>

          <div className="field">
            <label>Duración del bloque (segundos)</label>
            <input type="number" min={2} value={dur} onChange={(e) => setDur(Math.max(2, Number(e.target.value) || 25))} />
          </div>

          <button className="btn primary" type="submit" disabled={saving || uploading} style={{ width: "100%", justifyContent: "center" }}>
            <Plus size={16} /> {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Guardar en el banco"}
          </button>
        </form>

        <div className="pm-col">
          <PreviewMonitor type="informe" data={{ title, slides, sec_per_slide: secPerSlide }} dur={dur} ready={slides.length > 0} />
          {items.length === 0 && <div className="card" style={{ padding: 18, color: "#6b7688" }}>Todavía no hay informes.</div>}
          {items.map((it) => {
            const d = it.data as InformeData;
            return (
              <div key={it.id} data-item={it.id} className="card" style={{ padding: 16, display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: "#0d2168", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ListOrdered size={20} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4, display: "flex", gap: 12 }}>
                    <span>{d.slides.length} slide{d.slides.length === 1 ? "" : "s"}</span>
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
