import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Check, Loader2, Image as ImageIcon, X, Download, Newspaper } from "lucide-react";
import type { ContentItem, PlacasData } from "@newsroller/shared";
import { contentItems } from "../lib/content-items";
import { uploadMedia } from "../lib/content";
import { api } from "../lib/api";

const T_MAX = 130;
const B_MAX = 700;

interface CiclicoPost {
  id: number;
  title: string;
  excerpt: string;
  link: string;
  date: string;
  image: string | null;
  categories: string[];
  youtube: string | null;
}

export function Placas() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dur, setDur] = useState(10);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [posts, setPosts] = useState<CiclicoPost[] | null>(null);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const load = () => contentItems.list("placas").then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { void load(); }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setUploading(true);
    try {
      setMediaUrl(await uploadMedia(file, "ad"));
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

  async function openImport() {
    setImportOpen(true);
    if (posts) return;
    setLoadingPosts(true);
    try {
      const d = await api.get<{ payload: { posts: CiclicoPost[] } }>("/api/data/ciclico-web");
      setPosts(d.payload.posts ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "no se pudo traer de Cíclico");
    } finally {
      setLoadingPosts(false);
    }
  }
  function usePost(p: CiclicoPost) {
    setLabel((p.categories[0] || "").toUpperCase());
    setTitle(p.title.slice(0, T_MAX));
    setBody(p.excerpt.slice(0, B_MAX));
    setMediaUrl(p.image);
    setImportOpen(false);
    setMsg("Nota traída de Cíclico. Revisá y guardá.");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!title.trim()) return setErr("El título es obligatorio.");
    setSaving(true);
    try {
      const data: PlacasData = {
        title: title.trim().slice(0, T_MAX),
        body: body.trim().slice(0, B_MAX) || undefined,
        label: label.trim() || undefined,
        media_url: mediaUrl,
        media_kind: mediaUrl ? "image" : null,
      };
      await contentItems.create({ type: "placas", data, duration_sec: dur });
      setLabel(""); setTitle(""); setBody(""); setDur(10);
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
    if (!confirm("¿Eliminar esta placa?")) return;
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
          <h1>Placas</h1>
          <p>Noticia: escribila a mano o traela del sitio de Cíclico. Título obligatorio (admite **negrita**), cuerpo y foto opcionales.</p>
        </div>
        <button className="btn" onClick={openImport}><Download size={16} /> Traer de Cíclico</button>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", gap: 20, alignItems: "start" }}>
        <form className="card" style={{ padding: 18 }} onSubmit={save}>
          <div style={{ fontWeight: 500, marginBottom: 14 }}>Nueva placa</div>

          <div className="field">
            <label>Volanta / fecha (opcional)</label>
            <input value={label} onChange={(e) => setLabel(e.target.value.slice(0, 40))} placeholder="17 DE SEPTIEMBRE" />
          </div>

          <div className="field">
            <label>Título</label>
            <textarea value={title} onChange={(e) => setTitle(e.target.value.slice(0, T_MAX))} rows={2} maxLength={T_MAX} required />
            <div style={{ fontSize: 12, color: "#6b7688", textAlign: "right", marginTop: 4 }}>{title.length}/{T_MAX}</div>
          </div>

          <div className="field">
            <label>Cuerpo (opcional)</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, B_MAX))} rows={6} maxLength={B_MAX} placeholder="Texto de la nota. Dejá una línea en blanco para separar párrafos." />
            <div style={{ fontSize: 12, color: "#6b7688", textAlign: "right", marginTop: 4 }}>{body.length}/{B_MAX}</div>
          </div>

          <div className="field">
            <label>Foto (opcional)</label>
            {mediaUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <img src={mediaUrl} alt="" style={{ width: 64, height: 40, objectFit: "cover", borderRadius: 6 }} />
                <button type="button" className="btn" onClick={clearMedia}><X size={14} /> quitar</button>
              </div>
            ) : (
              <input ref={fileRef} type="file" accept="image/*" onChange={onFile} disabled={uploading} />
            )}
            {uploading && <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4 }}><Loader2 size={13} className="spin" /> subiendo…</div>}
          </div>

          <div className="field">
            <label>Duración (segundos)</label>
            <input type="number" min={2} value={dur} onChange={(e) => setDur(Math.max(2, Number(e.target.value) || 10))} />
          </div>

          <button className="btn primary" type="submit" disabled={saving || uploading} style={{ width: "100%", justifyContent: "center" }}>
            <Plus size={16} /> {saving ? "Guardando…" : "Guardar en el banco"}
          </button>
        </form>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.length === 0 && <div className="card" style={{ padding: 18, color: "#6b7688" }}>Todavía no hay placas.</div>}
          {items.map((it) => {
            const d = it.data as PlacasData;
            return (
              <div key={it.id} className="card" style={{ padding: 16, display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 90, height: 64, borderRadius: 8, background: "#0d2168", flex: "0 0 auto", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {d.media_url ? <img src={d.media_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Newspaper size={22} color="#fff" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {d.label && <div style={{ fontSize: 11, color: "#6b7688", fontWeight: 700 }}>{d.label.toUpperCase()}</div>}
                  <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(d.title ?? "").replace(/\*\*/g, "")}</div>
                  <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4, display: "flex", gap: 12 }}>
                    <span>{d.media_url ? "con foto" : "solo texto"}</span>
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

      {importOpen && (
        <div className="modal-back" onClick={() => setImportOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <b>Traer nota de Cíclico</b>
              <button className="icon-btn" onClick={() => setImportOpen(false)}><X size={18} /></button>
            </div>
            {loadingPosts ? (
              <div className="muted-note" style={{ padding: 20, display: "flex", gap: 8, alignItems: "center" }}><Loader2 size={16} className="spin" /> Cargando notas…</div>
            ) : posts && posts.length > 0 ? (
              <div className="imp-list">
                {posts.map((p) => (
                  <button key={p.id} className="imp-item" onClick={() => usePost(p)}>
                    <div className="imp-thumb">{p.image ? <img src={p.image} alt="" /> : <ImageIcon size={20} />}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="imp-title">{p.title}</div>
                      <div className="muted-note" style={{ fontSize: 11 }}>{p.categories.join(" · ") || "—"}</div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="muted-note" style={{ padding: 20 }}>Sin notas disponibles (¿la fuente ya corrió?).</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
