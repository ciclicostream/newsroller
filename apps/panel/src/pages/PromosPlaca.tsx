import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Check, Search, Sparkles } from "lucide-react";
import type { ContentItem, PromosData } from "@newsroller/shared";
import { contentItems } from "../lib/content-items";
import { api } from "../lib/api";

interface VideoResult { id: string; title: string; thumbnail_url: string | null; duration_sec: number }

export function PromosPlaca() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [query, setQuery] = useState("#avance");
  const [results, setResults] = useState<VideoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [videoId, setVideoId] = useState("");
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
    if (!videoId.trim()) return setErr("Elegí un video.");
    if (!title.trim()) return setErr("El título es obligatorio.");
    if (!body.trim()) return setErr("El texto es obligatorio.");
    setSaving(true);
    try {
      const data: PromosData = { title: title.trim().slice(0, 24), body: body.trim().slice(0, 160), format, video_id: videoId.trim() };
      await contentItems.create({ type: "promos", data, duration_sec: dur });
      setTitle(""); setBody("");
      setMsg("Guardado en el banco.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(it: ContentItem) {
    if (!confirm("¿Eliminar esta promo?")) return;
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
          <h1>Promos / Avances</h1>
          <p>Pill + card de texto + video 9:16 o 4:3, elegido del canal de YouTube (autoseleccionable por hashtag).</p>
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 20, alignItems: "start" }}>
        <form className="card" style={{ padding: 18 }} onSubmit={save}>
          <div style={{ fontWeight: 500, marginBottom: 14 }}>Nueva promo</div>

          <div className="field">
            <label>Buscar en el canal (por hashtag o texto)</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="#avance" />
              <button type="button" className="btn" onClick={() => void search()} disabled={searching}>
                <Search size={14} /> {searching ? "…" : "Buscar"}
              </button>
            </div>
          </div>

          <div className="field">
            <label>Video</label>
            <select value={videoId} onChange={(e) => setVideoId(e.target.value)}>
              {results.length === 0 && <option value="">— sin resultados —</option>}
              {results.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
            </select>
          </div>

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
            <Plus size={16} /> {saving ? "Guardando…" : "Guardar en el banco"}
          </button>
        </form>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.length === 0 && <div className="card" style={{ padding: 18, color: "#6b7688" }}>Todavía no hay promos.</div>}
          {items.map((it) => {
            const d = it.data as PromosData;
            return (
              <div key={it.id} className="card" style={{ padding: 16, display: "flex", gap: 16, alignItems: "center" }}>
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
                <button className="btn" onClick={() => remove(it)}><Trash2 size={15} /></button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
