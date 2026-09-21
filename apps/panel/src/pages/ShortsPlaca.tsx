import { useEffect, useState } from "react";
import { PreviewMonitor } from "../components/PreviewMonitor";
import { Plus, Trash2, Check, Youtube, Pencil } from "lucide-react";
import type { ContentItem, ShortsData, Short } from "@newsroller/shared";
import { contentItems } from "../lib/content-items";
import { content } from "../lib/content";

export function ShortsPlaca() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [available, setAvailable] = useState<Short[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [count, setCount] = useState<1 | 2>(1);
  const [video1, setVideo1] = useState("");
  const [video2, setVideo2] = useState("");
  const [title, setTitle] = useState("");
  const [dur, setDur] = useState(15);
  const [saving, setSaving] = useState(false);

  const load = () => contentItems.list("shorts").then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    content.listShorts().then((sh) => {
      const active = sh.filter((s) => s.active);
      setAvailable(active);
      if (active[0]) { setVideo1(active[0].id); setTitle(active[0].custom_title ?? active[0].title); }
    }).catch((e) => setErr(e.message));
  }, []);

  function pickVideo1(id: string) {
    setVideo1(id);
    const s = available.find((x) => x.id === id);
    if (s && count === 1) setTitle(s.custom_title ?? s.title);
  }

  const s1 = available.find((x) => x.id === video1);
  const s2 = available.find((x) => x.id === video2);
  const minDur = count === 2
    ? (s1?.duration_sec ?? 0) + (s2?.duration_sec ?? 0)
    : (s1?.duration_sec ?? 0);

  useEffect(() => {
    if (minDur > 0) setDur((d) => Math.max(d, minDur));
  }, [minDur]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (!video1) return setErr("Elegí al menos un short.");
    if (count === 2 && !video2) return setErr("Elegí el segundo short.");
    if (!title.trim()) return setErr("El título es obligatorio.");
    if (dur < minDur) return setErr(`La duración mínima es ${minDur}s (la duración real del/los video/s).`);
    setSaving(true);
    try {
      const data: ShortsData = { count, video1, video2: count === 2 ? video2 : undefined, title: title.trim() };
      if (editingId) {
        await contentItems.patch(editingId, { data, duration_sec: dur });
        setMsg("Cambios guardados.");
      } else {
        await contentItems.create({ type: "shorts", data, duration_sec: dur });
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
    const d = it.data as ShortsData;
    setEditingId(it.id);
    setCount(d.count);
    setVideo1(d.video1 ?? "");
    setVideo2(d.video2 ?? "");
    setTitle(d.title ?? "");
    setDur(it.duration_sec);
    setErr(null); setMsg(null);
  }
  function cancelEdit() {
    setEditingId(null);
    setTitle("");
    setDur(15);
  }

  async function remove(it: ContentItem) {
    if (!confirm("¿Enviar esta placa de shorts a la papelera?")) return;
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
          <h1>Shorts</h1>
          <p>1 o 2 shorts verticales del canal. El título viene de YouTube y es editable.</p>
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}
      {available.length === 0 && (
        <div className="card muted-note" style={{ padding: 18, marginBottom: 18 }}>
          No hay shorts sincronizados todavía. Sincronizá el canal en <b>Ajustes → Shorts</b>.
        </div>
      )}

      <div className="pm-layout">
        <form className="card" style={{ padding: 18 }} onSubmit={save}>
          <div style={{ fontWeight: 500, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {editingId ? "Editar placa de shorts" : "Nueva placa de shorts"}
            {editingId && <button type="button" className="btn" onClick={cancelEdit}>Cancelar</button>}
          </div>

          <div className="field">
            <label>Cantidad</label>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button type="button" className={"tab" + (count === 1 ? " active" : "")} onClick={() => setCount(1)}>1 short</button>
              <button type="button" className={"tab" + (count === 2 ? " active" : "")} onClick={() => setCount(2)}>2 shorts</button>
            </div>
          </div>

          <div className="field">
            <label>Short{count === 2 ? " (1)" : ""}</label>
            <select value={video1} onChange={(e) => pickVideo1(e.target.value)}>
              {available.map((s) => <option key={s.id} value={s.id}>{s.custom_title ?? s.title}</option>)}
            </select>
          </div>

          {count === 2 && (
            <div className="field">
              <label>Short (2)</label>
              <select value={video2} onChange={(e) => setVideo2(e.target.value)}>
                <option value="">— elegir —</option>
                {available.filter((s) => s.id !== video1).map((s) => <option key={s.id} value={s.id}>{s.custom_title ?? s.title}</option>)}
              </select>
            </div>
          )}

          <div className="field">
            <label>Título {count === 2 && "(compartido para ambos)"}</label>
            <textarea value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))} rows={3} maxLength={120} required />
            <div style={{ fontSize: 12, color: "#6b7688", textAlign: "right", marginTop: 4 }}>{title.length}/120</div>
          </div>

          <div className="field">
            <label>Duración (segundos)</label>
            <input type="number" min={minDur || 2} value={dur} onChange={(e) => setDur(Math.max(minDur || 2, Number(e.target.value) || minDur || 15))} />
            {minDur > 0 && <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4 }}>Mínimo {minDur}s (duración real del/los video/s).</div>}
          </div>

          <button className="btn primary" type="submit" disabled={saving} style={{ width: "100%", justifyContent: "center" }}>
            <Plus size={16} /> {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Guardar en el banco"}
          </button>
        </form>

        <div className="pm-col">
          <PreviewMonitor type="shorts" data={{ count, video1, video2: count === 2 ? video2 : undefined, title }} dur={dur} ready={!!video1} />
          {items.length === 0 && <div className="card" style={{ padding: 18, color: "#6b7688" }}>Todavía no hay placas de shorts.</div>}
          {items.map((it) => {
            const d = it.data as ShortsData;
            return (
              <div key={it.id} data-item={it.id} className="card" style={{ padding: 16, display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: "#0d2168", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Youtube size={20} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4, display: "flex", gap: 12 }}>
                    <span>{d.count === 2 ? "2 shorts" : "1 short"}</span>
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
