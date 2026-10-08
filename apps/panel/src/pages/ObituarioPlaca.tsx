import { useContentSelect } from "../lib/contentSelect";
import { useEffect, useRef, useState } from "react";
import { PreviewMonitor } from "../components/PreviewMonitor";
import { UltimaHoraSwitch } from "../components/PlacaSwitch";
import { Plus, Trash2, Check, X, Loader2, Flower2, Pencil } from "lucide-react";
import type { ContentItem, ObituarioData } from "@newsroller/shared";
import { contentItems } from "../lib/content-items";
import { uploadMedia } from "../lib/content";

const NAME_MAX = 50;
const YEARS_MAX = 20;
const ROLE_MAX = 60;
const TXT_MAX = 300;
const DEFAULT_DUR = 15;

// Obituario: vive dentro de la card de Última Hora. Placa sobria, sin marco ni ticker.
export function ObituarioPlaca() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [years, setYears] = useState("");
  const [role, setRole] = useState("");
  const [text, setText] = useState("");
  const [dur, setDur] = useState(DEFAULT_DUR);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => contentItems.list("obituario").then(setItems).catch((e) => setErr(e.message));
  const sel = useContentSelect(items, load);
  useEffect(() => { void load(); }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null); setUploading(true);
    try {
      setPhotoUrl(await uploadMedia(file, "media"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error subiendo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const buildData = (): ObituarioData => ({
    name: name.trim(),
    years: years.trim(),
    role: role.trim(),
    text: text.trim() || undefined,
    photo_url: photoUrl ?? "",
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (!photoUrl) return setErr("La foto es obligatoria.");
    if (!name.trim() || !years.trim() || !role.trim()) return setErr("Nombre, años y oficio son obligatorios.");
    setSaving(true);
    try {
      const data = buildData() as unknown as Record<string, any>;
      if (editingId) {
        await contentItems.patch(editingId, { data, duration_sec: dur });
        setMsg("Cambios guardados.");
      } else {
        await contentItems.create({ type: "obituario", data, duration_sec: dur });
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
    const d = it.data as ObituarioData;
    setEditingId(it.id);
    setPhotoUrl(d.photo_url || null);
    setName(d.name ?? ""); setYears(d.years ?? ""); setRole(d.role ?? ""); setText(d.text ?? "");
    setDur(it.duration_sec);
    setErr(null); setMsg(null);
  }
  function cancelEdit() {
    setEditingId(null);
    setPhotoUrl(null); setName(""); setYears(""); setRole(""); setText("");
    setDur(DEFAULT_DUR);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function remove(it: ContentItem) {
    if (!confirm("¿Enviar este obituario a la papelera?")) return;
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
          <h1>Última Hora</h1>
          <p>Obituario: despedida sobria, sin marco ni newsticker. La foto sale en blanco y negro.</p>
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      <div className="pm-layout">
        <form className="card" style={{ padding: 18 }} onSubmit={save}>
          <div style={{ fontWeight: 500, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {editingId ? "Editar obituario" : "Nuevo obituario"}
            {editingId && <button type="button" className="btn" onClick={cancelEdit}>Cancelar</button>}
          </div>

          <div className="field" style={{ marginBottom: 14 }}>
            <label>Tipo</label>
            <UltimaHoraSwitch active="obituario" />
          </div>

          <div className="field">
            <label>Foto (obligatoria)</label>
            {photoUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <img src={photoUrl} alt="" style={{ width: 56, height: 72, objectFit: "cover", borderRadius: 6, filter: "grayscale(1)" }} />
                <button type="button" className="btn" onClick={() => setPhotoUrl(null)}><X size={14} /> quitar</button>
              </div>
            ) : (
              <input ref={fileRef} type="file" accept="image/*" onChange={onFile} disabled={uploading} />
            )}
            {uploading && <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4 }}><Loader2 size={13} className="spin" /> subiendo…</div>}
          </div>

          <div className="field">
            <label>Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))} maxLength={NAME_MAX} required />
          </div>

          <div className="field xy" style={{ display: "flex", gap: 10 }}>
            <div style={{ width: 170 }}>
              <label>Años</label>
              <input value={years} onChange={(e) => setYears(e.target.value.slice(0, YEARS_MAX))} maxLength={YEARS_MAX} placeholder="1941 — 2026" required />
            </div>
            <div style={{ flex: 1 }}>
              <label>Oficio</label>
              <input value={role} onChange={(e) => setRole(e.target.value.slice(0, ROLE_MAX))} maxLength={ROLE_MAX} placeholder="Locutor y periodista" required />
            </div>
          </div>

          <div className="field">
            <label>Texto (opcional)</label>
            <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, TXT_MAX))} rows={4} maxLength={TXT_MAX} />
            <div style={{ fontSize: 12, color: "#6b7688", textAlign: "right", marginTop: 4 }}>{text.length}/{TXT_MAX}</div>
          </div>

          <div className="field">
            <label>Duración (segundos)</label>
            <input type="number" min={2} value={dur} onChange={(e) => setDur(Math.max(2, Number(e.target.value) || DEFAULT_DUR))} />
          </div>

          <button className="btn primary" type="submit" disabled={saving || uploading} style={{ width: "100%", justifyContent: "center" }}>
            <Plus size={16} /> {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Guardar en el banco"}
          </button>
        </form>

        <div className="pm-col">
          <PreviewMonitor type="obituario" data={buildData() as unknown as Record<string, unknown>} dur={dur} ready={!!photoUrl && !!name.trim()} />
          {items.length === 0 && <div className="card" style={{ padding: 18, color: "#6b7688" }}>Todavía no hay obituarios.</div>}
          {items.map((it) => {
            const d = it.data as ObituarioData;
            return (
              <div key={it.id} data-item={it.id} {...sel.row(it.id)} className="card" style={{ padding: 16, display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 44, height: 56, borderRadius: 6, background: "#1a1d24", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {d.photo_url ? <img src={d.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(1)" }} /> : <Flower2 size={20} color="#fff" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
                  <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4, display: "flex", gap: 12 }}>
                    <span>{d.years}</span>
                    <span>{d.role}</span>
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
