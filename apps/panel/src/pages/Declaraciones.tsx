import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Check, X, Loader2, Music, Quote, Pencil } from "lucide-react";
import type { ContentItem, DeclaracionesData } from "@newsroller/shared";
import { DECLARACIONES_PROGRAMAS } from "@newsroller/shared";
import { contentItems } from "../lib/content-items";
import { uploadMedia } from "../lib/content";

const Q_MAX = 450;

export function Declaraciones() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [place, setPlace] = useState("");
  const [quote, setQuote] = useState("");
  const [headline, setHeadline] = useState("");
  const [program, setProgram] = useState("");
  const [dur, setDur] = useState(10);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);

  const load = () => contentItems.list("declaraciones").then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { void load(); }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null); setUploading(true);
    try { setPhotoUrl(await uploadMedia(file, "media")); }
    catch (e) { setErr(e instanceof Error ? e.message : "error subiendo"); }
    finally { setUploading(false); }
  }

  async function onAudioFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null); setUploadingAudio(true);
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
    setErr(null); setMsg(null);
    if (!photoUrl) return setErr("La foto es obligatoria.");
    if (!name.trim() || !role.trim() || !place.trim() || !quote.trim()) {
      return setErr("Nombre, cargo, lugar y cita son obligatorios.");
    }
    setSaving(true);
    try {
      const data: DeclaracionesData = {
        photo_url: photoUrl, name: name.trim(), role: role.trim(), place: place.trim(),
        quote: quote.trim().slice(0, Q_MAX),
        headline: headline.trim() || undefined,
        interview_program: program.trim() || undefined,
        audio_url: audioUrl,
      };
      if (editingId) {
        await contentItems.patch(editingId, { data, duration_sec: dur });
        setMsg("Cambios guardados.");
      } else {
        await contentItems.create({ type: "declaraciones", data, duration_sec: dur });
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
    const d = it.data as DeclaracionesData;
    setEditingId(it.id);
    setPhotoUrl(d.photo_url ?? null);
    setName(d.name ?? "");
    setRole(d.role ?? "");
    setPlace(d.place ?? "");
    setQuote(d.quote ?? "");
    setHeadline(d.headline ?? "");
    setProgram(d.interview_program ?? "");
    setDur(it.duration_sec);
    setAudioUrl(d.audio_url ?? null);
    setErr(null); setMsg(null);
  }
  function cancelEdit() {
    setEditingId(null);
    setPhotoUrl(null); setName(""); setRole(""); setPlace(""); setQuote(""); setHeadline(""); setProgram("");
    setDur(10);
    if (fileRef.current) fileRef.current.value = "";
    clearAudio();
  }

  async function remove(it: ContentItem) {
    if (!confirm("¿Eliminar esta declaración?")) return;
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
      <div className="page-head">
        <div>
          <h1>Declaraciones</h1>
          <p>Foto, nombre, cargo, lugar y cita son obligatorios. Titular y "Entrevista completa en…" son opcionales.</p>
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 20, alignItems: "start" }}>
        <form className="card" style={{ padding: 18 }} onSubmit={save}>
          <div style={{ fontWeight: 500, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {editingId ? "Editar declaración" : "Nueva declaración"}
            {editingId && <button type="button" className="btn" onClick={cancelEdit}>Cancelar</button>}
          </div>

          <div className="field">
            <label>Foto cuadrada (obligatoria)</label>
            {photoUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <img src={photoUrl} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6 }} />
                <button type="button" className="btn" onClick={() => { setPhotoUrl(null); if (fileRef.current) fileRef.current.value = ""; }}><X size={14} /> quitar</button>
              </div>
            ) : (
              <input ref={fileRef} type="file" accept="image/*" onChange={onFile} disabled={uploading} required />
            )}
            {uploading && <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4 }}><Loader2 size={13} className="spin" /> subiendo…</div>}
          </div>

          <div className="field"><label>Nombre</label><input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="field"><label>Cargo</label><input value={role} onChange={(e) => setRole(e.target.value)} required /></div>
          <div className="field"><label>Lugar</label><input value={place} onChange={(e) => setPlace(e.target.value)} required /></div>

          <div className="field">
            <label>Cita</label>
            <textarea value={quote} onChange={(e) => setQuote(e.target.value.slice(0, Q_MAX))} rows={5} maxLength={Q_MAX} required />
            <div style={{ fontSize: 12, color: "#6b7688", textAlign: "right", marginTop: 4 }}>{quote.length}/{Q_MAX}</div>
          </div>

          <div className="field">
            <label>Titular de la nota (opcional)</label>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Si queda vacío, no se muestra la barra" />
          </div>

          <div className="field">
            <label>Entrevista completa en… (opcional)</label>
            <input value={program} onChange={(e) => setProgram(e.target.value)} list="programas" placeholder="Elegí o escribí un programa" />
            <datalist id="programas">
              {DECLARACIONES_PROGRAMAS.map((p) => <option key={p} value={p} />)}
            </datalist>
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
            <input type="number" min={2} value={dur} onChange={(e) => setDur(Math.max(2, Number(e.target.value) || 10))} />
          </div>

          <button className="btn primary" type="submit" disabled={saving || uploading || uploadingAudio} style={{ width: "100%", justifyContent: "center" }}>
            <Plus size={16} /> {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Guardar en el banco"}
          </button>
        </form>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.length === 0 && <div className="card" style={{ padding: 18, color: "#6b7688" }}>Todavía no hay declaraciones.</div>}
          {items.map((it) => {
            const d = it.data as DeclaracionesData;
            return (
              <div key={it.id} className="card" style={{ padding: 16, display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 48, height: 48, borderRadius: 8, background: "#0d2168", flex: "0 0 auto", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {d.photo_url ? <img src={d.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Quote size={20} color="#fff" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{d.name} — {d.role}</div>
                  <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.quote}</div>
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
