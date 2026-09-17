import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Check, Video, X, Loader2, Pencil } from "lucide-react";
import type { ContentItem, CamarasData, Camera } from "@newsroller/shared";
import { contentItems } from "../lib/content-items";
import { camerasApi } from "../lib/cameras";
import { uploadMedia } from "../lib/content";

export function CamarasPlaca() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [cameraId, setCameraId] = useState("");
  const [location, setLocation] = useState("");
  const [ads, setAds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dur, setDur] = useState(20);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => contentItems.list("camaras").then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    camerasApi.list().then((cs) => {
      const active = cs.filter((c) => c.active);
      setCameras(active);
      if (active[0]) { setCameraId(active[0].id); setLocation(active[0].city ?? active[0].name); }
    }).catch((e) => setErr(e.message));
  }, []);

  function pickCamera(id: string) {
    setCameraId(id);
    const c = cameras.find((x) => x.id === id);
    if (c) setLocation(c.city ?? c.name);
  }

  async function onAdFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null); setUploading(true);
    try { const url = await uploadMedia(file, "media"); setAds((a) => [...a, url]); }
    catch (e) { setErr(e instanceof Error ? e.message : "error subiendo"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  function removeAd(i: number) {
    setAds((a) => a.filter((_, j) => j !== i));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (!cameraId) return setErr("Elegí una cámara.");
    if (!location.trim()) return setErr("La ubicación es obligatoria.");
    setSaving(true);
    try {
      const data: CamarasData = { camera_id: cameraId, location: location.trim(), ads };
      if (editingId) {
        await contentItems.patch(editingId, { data, duration_sec: dur });
        setMsg("Cambios guardados.");
      } else {
        await contentItems.create({ type: "camaras", data, duration_sec: dur });
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
    const d = it.data as CamarasData;
    setEditingId(it.id);
    setCameraId(d.camera_id ?? "");
    setLocation(d.location ?? "");
    setAds(d.ads ?? []);
    setDur(it.duration_sec);
    setErr(null); setMsg(null);
  }
  function cancelEdit() {
    setEditingId(null);
    setAds([]);
    setDur(20);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function remove(it: ContentItem) {
    if (!confirm("¿Eliminar esta placa de cámara?")) return;
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
          <h1>Cámaras</h1>
          <p>Cámara en vivo (nunca con audio) + ubicación + avisos de imagen que rotan. Sin "A continuación".</p>
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}
      {cameras.length === 0 && (
        <div className="card muted-note" style={{ padding: 18, marginBottom: 18 }}>
          No hay cámaras cargadas todavía. Agregalas en <b>Ajustes → Cámaras</b>.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 20, alignItems: "start" }}>
        <form className="card" style={{ padding: 18 }} onSubmit={save}>
          <div style={{ fontWeight: 500, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {editingId ? "Editar placa de cámara" : "Nueva placa de cámara"}
            {editingId && <button type="button" className="btn" onClick={cancelEdit}>Cancelar</button>}
          </div>

          <div className="field">
            <label>Cámara</label>
            <select value={cameraId} onChange={(e) => pickCamera(e.target.value)}>
              {cameras.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Ubicación (se muestra junto a EN VIVO)</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Buenos Aires · Obelisco" required />
          </div>

          <div className="field">
            <label>Avisos (imágenes, rotan en fade)</label>
            {ads.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                {ads.map((url, i) => (
                  <div key={url + i} style={{ position: "relative" }}>
                    <img src={url} alt="" style={{ width: 60, height: 44, objectFit: "cover", borderRadius: 6 }} />
                    <button type="button" className="icon-btn" onClick={() => removeAd(i)} style={{ position: "absolute", top: -6, right: -6, background: "#fff", borderRadius: "50%" }}><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={onAdFile} disabled={uploading} />
            {uploading && <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4 }}><Loader2 size={13} className="spin" /> subiendo…</div>}
          </div>

          <div className="field">
            <label>Duración (segundos)</label>
            <input type="number" min={2} value={dur} onChange={(e) => setDur(Math.max(2, Number(e.target.value) || 20))} />
          </div>

          <button className="btn primary" type="submit" disabled={saving || uploading} style={{ width: "100%", justifyContent: "center" }}>
            <Plus size={16} /> {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Guardar en el banco"}
          </button>
        </form>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.length === 0 && <div className="card" style={{ padding: 18, color: "#6b7688" }}>Todavía no hay placas de cámara.</div>}
          {items.map((it) => {
            const d = it.data as CamarasData;
            const cam = cameras.find((c) => c.id === d.camera_id);
            return (
              <div key={it.id} className="card" style={{ padding: 16, display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: "#0d2168", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Video size={20} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{cam?.name ?? "(cámara eliminada)"} — {d.location}</div>
                  <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4, display: "flex", gap: 12 }}>
                    <span>{d.ads.length} aviso{d.ads.length === 1 ? "" : "s"}</span>
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
