import { useEffect, useRef, useState } from "react";
import { PreviewMonitor } from "../components/PreviewMonitor";
import { Plus, Trash2, Check, Search, Sparkles, Pencil } from "lucide-react";
import type { ContentItem, PromosData } from "@newsroller/shared";
import { contentItems } from "../lib/content-items";
import { api } from "../lib/api";
import { youtubeId } from "../lib/cameras";

interface VideoResult { id: string; title: string; thumbnail_url: string | null; duration_sec: number }

export function PromosPlaca() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [source, setSource] = useState<"search" | "manual">("search");
  const [query, setQuery] = useState("#avance");
  const [results, setResults] = useState<VideoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [videoId, setVideoId] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [format, setFormat] = useState<"916" | "43">("916");
  const [dur, setDur] = useState(15);
  const [saving, setSaving] = useState(false);
  const searchedOnce = useRef(false);

  const load = () => contentItems.list("promos").then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (!searchedOnce.current) { searchedOnce.current = true; void search(); } }, []);

  async function search() {
    setErr(null); setSearching(true);
    try {
      const r = await api.get<VideoResult[]>(`/api/content/youtube-search?q=${encodeURIComponent(query)}`);
      setResults(r);
      if (r[0] && !videoId) setVideoId(r[0].id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error buscando");
    } finally {
      setSearching(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    const id = source === "manual" ? youtubeId(manualInput) : videoId.trim();
    if (!id) return setErr(source === "manual" ? "Pegá el link o ID del video de YouTube." : "Elegí un video.");
    if (!title.trim()) return setErr("El título es obligatorio.");
    if (!body.trim()) return setErr("El texto es obligatorio.");
    setSaving(true);
    try {
      const data: PromosData = { title: title.trim().slice(0, 24), body: body.trim().slice(0, 160), format, video_id: id };
      if (editingId) {
        await contentItems.patch(editingId, { data, duration_sec: dur });
        setMsg("Cambios guardados.");
      } else {
        await contentItems.create({ type: "promos", data, duration_sec: dur });
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
    const d = it.data as PromosData;
    setEditingId(it.id);
    setSource("manual");
    setManualInput(d.video_id ?? "");
    setVideoId(d.video_id ?? "");
    setTitle(d.title ?? "");
    setBody(d.body ?? "");
    setFormat(d.format);
    setDur(it.duration_sec);
    setErr(null); setMsg(null);
  }
  function cancelEdit() {
    setEditingId(null);
    setTitle(""); setBody(""); setManualInput("");
    setDur(15);
  }

  async function remove(it: ContentItem) {
    if (!confirm("¿Eliminar esta promo?")) return;
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
          <h1>Promos / Avances</h1>
          <p>Pill + card de texto + video 9:16 o 4:3, elegido del canal de YouTube (por hashtag o pegando el link/ID, para no listados).</p>
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      <div className="pm-layout">
        <form className="card" style={{ padding: 18 }} onSubmit={save}>
          <div style={{ fontWeight: 500, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {editingId ? "Editar promo" : "Nueva promo"}
            {editingId && <button type="button" className="btn" onClick={cancelEdit}>Cancelar</button>}
          </div>

          <div className="field">
            <label>Video</label>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button type="button" className={"tab" + (source === "search" ? " active" : "")} onClick={() => setSource("search")}>Buscar en el canal</button>
              <button type="button" className={"tab" + (source === "manual" ? " active" : "")} onClick={() => setSource("manual")}>Pegar link/ID</button>
            </div>
          </div>

          {source === "search" ? (
            <>
              <div className="field">
                <label>Buscar en el canal (por hashtag o texto)</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="#avance" />
                  <button type="button" className="btn" onClick={() => void search()} disabled={searching}>
                    <Search size={14} /> {searching ? "…" : "Buscar"}
                  </button>
                </div>
                <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4 }}>Sólo encuentra videos públicos del canal.</div>
              </div>

              <div className="field">
                <label>Resultado</label>
                <select value={videoId} onChange={(e) => setVideoId(e.target.value)}>
                  {results.length === 0 && <option value="">— sin resultados —</option>}
                  {results.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
                </select>
              </div>
            </>
          ) : (
            <div className="field">
              <label>Link o ID del video de YouTube</label>
              <input value={manualInput} onChange={(e) => setManualInput(e.target.value)} placeholder="https://youtube.com/watch?v=…" />
              <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4 }}>Usalo para videos no listados (unlisted), que la búsqueda no encuentra.</div>
            </div>
          )}

          <div className="field">
            <label>Formato del video</label>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button type="button" className={"tab" + (format === "916" ? " active" : "")} onClick={() => setFormat("916")}>9:16</button>
              <button type="button" className={"tab" + (format === "43" ? " active" : "")} onClick={() => setFormat("43")}>4:3</button>
            </div>
          </div>

          <div className="field">
            <label>Título (pill, máx. 24)</label>
            <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 24))} maxLength={24} required />
          </div>

          <div className="field">
            <label>Texto (card, máx. 160)</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, 160))} rows={4} maxLength={160} required />
            <div style={{ fontSize: 12, color: "#6b7688", textAlign: "right", marginTop: 4 }}>{body.length}/160</div>
          </div>

          <div className="field">
            <label>Duración (segundos)</label>
            <input type="number" min={2} value={dur} onChange={(e) => setDur(Math.max(2, Number(e.target.value) || 15))} />
          </div>

          <button className="btn primary" type="submit" disabled={saving} style={{ width: "100%", justifyContent: "center" }}>
            <Plus size={16} /> {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Guardar en el banco"}
          </button>
        </form>

        <div className="pm-col">
          <PreviewMonitor type="promos" data={{ title, body, format, video_id: source === "manual" ? youtubeId(manualInput) : videoId.trim() }} dur={dur} ready={!!title.trim() && !!(source === "manual" ? youtubeId(manualInput) : videoId.trim())} />
          {items.length === 0 && <div className="card" style={{ padding: 18, color: "#6b7688" }}>Todavía no hay promos.</div>}
          {items.map((it) => {
            const d = it.data as PromosData;
            return (
              <div key={it.id} data-item={it.id} className="card" style={{ padding: 16, display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: "#0d2168", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Sparkles size={20} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4, display: "flex", gap: 12 }}>
                    <span>{d.format === "916" ? "9:16" : "4:3"}</span>
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
