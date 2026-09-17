import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Check, X, Loader2, CalendarDays } from "lucide-react";
import type { ContentItem, EfemeridesData } from "@newsroller/shared";
import { formatEfemeridesDate } from "@newsroller/shared";
import { contentItems } from "../lib/content-items";
import { uploadMedia } from "../lib/content";

const T_MAX = 60;
const B_MAX = 400;
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export function Efemerides() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [dateKind, setDateKind] = useState<"full" | "month" | "year">("full");
  const [day, setDay] = useState(1);
  const [month, setMonth] = useState(0);
  const [year, setYear] = useState(new Date().getFullYear());
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<"image" | "video">("image");
  const [uploading, setUploading] = useState(false);
  const [dur, setDur] = useState(10);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => contentItems.list("efemerides").then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { void load(); }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setUploading(true);
    try {
      setMediaUrl(await uploadMedia(file, "media"));
      setMediaKind(file.type.startsWith("video") ? "video" : "image");
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

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!title.trim() || !body.trim()) return setErr("Título y cuerpo son obligatorios.");
    if (!mediaUrl) return setErr("La foto o video es obligatoria.");
    setSaving(true);
    try {
      const data: EfemeridesData = {
        dateKind, year,
        month: dateKind !== "year" ? month : undefined,
        day: dateKind === "full" ? day : undefined,
        title: title.trim().slice(0, T_MAX),
        body: body.trim().slice(0, B_MAX),
        media_url: mediaUrl, media_kind: mediaKind,
      };
      await contentItems.create({ type: "efemerides", data, duration_sec: dur });
      setTitle(""); setBody(""); clearMedia();
      setMsg("Guardado en el banco.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(it: ContentItem) {
    if (!confirm("¿Eliminar esta efeméride?")) return;
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
          <h1>Efemérides</h1>
          <p>"Un día como hoy": título, cuerpo y foto/video son obligatorios. La fecha puede ser exacta, sólo mes o sólo año.</p>
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 20, alignItems: "start" }}>
        <form className="card" style={{ padding: 18 }} onSubmit={save}>
          <div style={{ fontWeight: 500, marginBottom: 14 }}>Nueva efeméride</div>

          <div className="field">
            <label>Precisión de la fecha</label>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button type="button" className={"tab" + (dateKind === "full" ? " active" : "")} onClick={() => setDateKind("full")}>Día exacto</button>
              <button type="button" className={"tab" + (dateKind === "month" ? " active" : "")} onClick={() => setDateKind("month")}>Sólo mes</button>
              <button type="button" className={"tab" + (dateKind === "year" ? " active" : "")} onClick={() => setDateKind("year")}>Sólo año</button>
            </div>
          </div>

          <div className="field xy" style={{ display: "flex", gap: 10 }}>
            {dateKind === "full" && (
              <div><label>Día</label><input type="number" min={1} max={31} value={day} onChange={(e) => setDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))} /></div>
            )}
            {dateKind !== "year" && (
              <div style={{ flex: 1 }}><label>Mes</label>
                <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
              </div>
            )}
            <div style={{ flex: 1 }}><label>Año</label><input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || year)} /></div>
          </div>
          <div className="muted-note" style={{ marginBottom: 14 }}>Vista previa: {formatEfemeridesDate({ dateKind, day, month, year })}</div>

          <div className="field">
            <label>Título</label>
            <textarea value={title} onChange={(e) => setTitle(e.target.value.slice(0, T_MAX))} rows={2} maxLength={T_MAX} required />
            <div style={{ fontSize: 12, color: "#6b7688", textAlign: "right", marginTop: 4 }}>{title.length}/{T_MAX}</div>
          </div>

          <div className="field">
            <label>Cuerpo</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, B_MAX))} rows={5} maxLength={B_MAX} required />
            <div style={{ fontSize: 12, color: "#6b7688", textAlign: "right", marginTop: 4 }}>{body.length}/{B_MAX}</div>
          </div>

          <div className="field">
            <label>Foto o video (vertical, obligatorio)</label>
            {mediaUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {mediaKind === "video" ? <video src={mediaUrl} style={{ width: 40, height: 64, objectFit: "cover", borderRadius: 6 }} muted /> : <img src={mediaUrl} alt="" style={{ width: 40, height: 64, objectFit: "cover", borderRadius: 6 }} />}
                <button type="button" className="btn" onClick={clearMedia}><X size={14} /> quitar</button>
              </div>
            ) : (
              <input ref={fileRef} type="file" accept="image/*,video/*" onChange={onFile} disabled={uploading} required />
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
          {items.length === 0 && <div className="card" style={{ padding: 18, color: "#6b7688" }}>Todavía no hay efemérides.</div>}
          {items.map((it) => {
            const d = it.data as EfemeridesData;
            return (
              <div key={it.id} className="card" style={{ padding: 16, display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 44, height: 64, borderRadius: 8, background: "#0d2168", flex: "0 0 auto", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {d.media_url ? <img src={d.media_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <CalendarDays size={20} color="#fff" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "#6b7688", fontWeight: 700 }}>{formatEfemeridesDate(d)}</div>
                  <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4 }}>{it.duration_sec}s</div>
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
