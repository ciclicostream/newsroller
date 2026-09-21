import { useEffect, useRef, useState } from "react";
import { PreviewMonitor } from "../components/PreviewMonitor";
import { Plus, Trash2, Check, X, Loader2, CalendarDays, Pencil, Globe, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import type { ContentItem, EfemeridesData, EfemeridesEntry } from "@newsroller/shared";
import { formatEfemeridesDate } from "@newsroller/shared";
import { contentItems } from "../lib/content-items";
import { uploadMedia } from "../lib/content";
import { api } from "../lib/api";

const T_MAX = 60;
const B_MAX = 400;
// Una efeméride del formulario (la placa puede llevar 1, 2 o 3 en el mismo pase).
interface Entry {
  dateKind: EfemeridesEntry["dateKind"]; day: number; month: number; year: number;
  title: string; body: string; mediaUrl: string | null; mediaKind: "image" | "video";
}
const blankEntry = (): Entry => ({ dateKind: "full", day: 1, month: 0, year: new Date().getFullYear(), title: "", body: "", mediaUrl: null, mediaKind: "image" });
const entryData = (x: Entry): EfemeridesEntry => ({
  dateKind: x.dateKind,
  year: x.dateKind === "anniversary" ? undefined : x.year,
  month: x.dateKind !== "year" ? x.month : undefined,
  day: x.dateKind === "full" || x.dateKind === "anniversary" ? x.day : undefined,
  title: x.title.trim().slice(0, T_MAX),
  body: x.body.trim().slice(0, B_MAX),
  media_url: x.mediaUrl ?? "", media_kind: x.mediaKind,
});
// La 1ª efeméride va en los campos de arriba (compatible con las ya guardadas) y el resto en `more`.
const buildData = (es: Entry[]): EfemeridesData => {
  const [first, ...rest] = es.map(entryData);
  return { ...first!, ...(rest.length ? { more: rest } : {}) };
};

// Sugerencias que devuelve /api/content/efemerides-wikipedia (Wikipedia "En este día").
interface Sugerida {
  id: string; kind: "holiday" | "event"; group: "internacional" | "argentina" | "santoral" | "otros";
  region: string | null; title: string; description: string; year?: number;
  image: { url: string; width: number; height: number } | null; page: string | null;
}
interface WikiData { date: string; holidays: Sugerida[]; events: Sugerida[] }
const GROUP_LABEL: Record<Sugerida["group"], string> = { internacional: "Internacionales", argentina: "Argentina", santoral: "Santoral", otros: "Otros países" };
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const shiftISO = (iso: string, days: number) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export function Efemerides() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 1, 2 o 3 efemérides en el mismo pase; `act` es la que se está editando.
  const [entries, setEntries] = useState<Entry[]>([blankEntry()]);
  const [act, setAct] = useState(0);
  const cur = entries[act] ?? entries[0]!;
  const patch = (p: Partial<Entry>, at = act) => setEntries((es) => es.map((x, i) => (i === at ? { ...x, ...p } : x)));
  const { dateKind, day, month, year, title, body, mediaUrl, mediaKind } = cur;
  const setDateKind = (v: Entry["dateKind"]) => patch({ dateKind: v });
  const setDay = (v: number) => patch({ day: v });
  const setMonth = (v: number) => patch({ month: v });
  const setYear = (v: number) => patch({ year: v });
  const setTitle = (v: string) => patch({ title: v });
  const setBody = (v: string) => patch({ body: v });
  const [uploading, setUploading] = useState(false);
  const [dur, setDur] = useState(10); // segundos POR efeméride (el bloque dura dur × cantidad)

  function setCount(k: number) {
    if (k < entries.length && entries.slice(k).some((x) => x.title.trim() || x.body.trim() || x.mediaUrl) && !confirm("Se descartan las efemérides sobrantes. ¿Seguir?")) return;
    setEntries((es) => (k > es.length ? [...es, ...Array.from({ length: k - es.length }, blankEntry)] : es.slice(0, k)));
    setAct((a) => Math.min(a, k - 1));
  }
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ---- Traer de Wikipedia ----
  const [wikiOpen, setWikiOpen] = useState(false);
  const [wikiDate, setWikiDate] = useState(todayISO());
  const [wikiTab, setWikiTab] = useState<"holidays" | "events">("holidays");
  const [wikiData, setWikiData] = useState<WikiData | null>(null);
  const [wikiLoading, setWikiLoading] = useState(false);
  const [wikiErr, setWikiErr] = useState<string | null>(null);
  const [wikiQ, setWikiQ] = useState("");
  const [wikiPhoto, setWikiPhoto] = useState(true); // usar la foto de Wikipedia (si tiene)
  useEffect(() => {
    if (!wikiOpen) return;
    let on = true;
    setWikiLoading(true); setWikiErr(null);
    api.get<WikiData>(`/api/content/efemerides-wikipedia?date=${wikiDate.slice(5)}`)
      .then((d) => on && setWikiData(d))
      .catch((e) => on && setWikiErr(e instanceof Error ? e.message : "no se pudo consultar Wikipedia"))
      .finally(() => on && setWikiLoading(false));
    return () => { on = false; };
  }, [wikiOpen, wikiDate]);

  // Rellena el formulario con la sugerencia elegida (el editor la revisa/edita antes de guardar).
  function aplicarSugerida(it: Sugerida) {
    const [, m, d] = wikiDate.split("-").map(Number);
    patch({
      title: it.title.slice(0, T_MAX),
      body: it.description.slice(0, B_MAX),
      day: d!, month: m! - 1,
      ...(it.kind === "holiday" ? { dateKind: "anniversary" as const } : { dateKind: "full" as const, year: it.year ?? year }),
      ...(wikiPhoto && it.image ? { mediaUrl: it.image.url, mediaKind: "image" as const } : {}),
    });
    setWikiOpen(false);
    setMsg("Datos traídos de Wikipedia: revisalos y corregí lo que haga falta antes de guardar.");
    setErr(null);
  }

  const load = () => contentItems.list("efemerides").then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { void load(); }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setUploading(true);
    const at = act; // por si se cambia de pestaña mientras sube
    try {
      const url = await uploadMedia(file, "media");
      patch({ mediaUrl: url, mediaKind: file.type.startsWith("video") ? "video" : "image" }, at);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error subiendo");
    } finally {
      setUploading(false);
    }
  }
  function clearMedia() {
    patch({ mediaUrl: null });
    if (fileRef.current) fileRef.current.value = "";
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    for (let i = 0; i < entries.length; i++) {
      const x = entries[i]!;
      const tag = entries.length > 1 ? `Efeméride ${i + 1}: ` : "";
      if (!x.title.trim() || !x.body.trim()) { setAct(i); return setErr(`${tag}título y cuerpo son obligatorios.`); }
      if (!x.mediaUrl) { setAct(i); return setErr(`${tag}la foto o video es obligatoria.`); }
    }
    setSaving(true);
    try {
      const data = buildData(entries);
      const duration = dur * entries.length;
      if (editingId) {
        await contentItems.patch(editingId, { data, duration_sec: duration });
        setMsg("Cambios guardados.");
      } else {
        await contentItems.create({ type: "efemerides", data, duration_sec: duration });
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
    const d = it.data as EfemeridesData;
    const toEntry = (e: EfemeridesEntry): Entry => ({
      dateKind: e.dateKind, day: e.day ?? 1, month: e.month ?? 0, year: e.year ?? new Date().getFullYear(),
      title: e.title ?? "", body: e.body ?? "", mediaUrl: e.media_url ?? null, mediaKind: e.media_kind ?? "image",
    });
    const es = [toEntry(d), ...(d.more ?? []).map(toEntry)].slice(0, 3);
    setEditingId(it.id);
    setEntries(es);
    setAct(0);
    setDur(Math.max(2, Math.round(it.duration_sec / es.length)));
    setErr(null); setMsg(null);
  }
  function cancelEdit() {
    setEditingId(null);
    setEntries([blankEntry()]);
    setAct(0);
    if (fileRef.current) fileRef.current.value = "";
    setDur(10);
  }

  async function remove(it: ContentItem) {
    if (!confirm("¿Enviar esta efeméride a la papelera?")) return;
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
          <p>"Un día como hoy": título, cuerpo y foto/video son obligatorios. La fecha puede ser exacta, sólo mes o sólo año.</p>
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      <div className="pm-layout">
        <form className="card" style={{ padding: 18 }} onSubmit={save}>
          <div style={{ fontWeight: 500, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {editingId ? "Editar efeméride" : "Nueva efeméride"}
            {editingId && <button type="button" className="btn" onClick={cancelEdit}>Cancelar</button>}
          </div>

          <button type="button" className="btn" style={{ width: "100%", justifyContent: "center", marginBottom: 14 }} onClick={() => setWikiOpen(true)}>
            <Globe size={15} /> Traer de Wikipedia
          </button>

          <div className="field">
            <label>Efemérides en este pase</label>
            <div className="tabs" style={{ marginBottom: 0 }}>
              {[1, 2, 3].map((k) => (
                <button key={k} type="button" className={"tab" + (entries.length === k ? " active" : "")} onClick={() => setCount(k)}>{k === 1 ? "1 sola" : `${k} juntas`}</button>
              ))}
            </div>
            {entries.length > 1 && <div className="muted-note" style={{ marginTop: 6 }}>Pasan una tras otra girando como un cubo; la duración es por efeméride.</div>}
          </div>
          {entries.length > 1 && (
            <div className="tabs" style={{ marginBottom: 14 }}>
              {entries.map((x, i) => (
                <button key={i} type="button" className={"tab" + (act === i ? " active" : "")} onClick={() => setAct(i)}>
                  Efeméride {i + 1}{x.title.trim() && x.mediaUrl ? " ✓" : ""}
                </button>
              ))}
            </div>
          )}

          <div className="field">
            <label>Precisión de la fecha</label>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button type="button" className={"tab" + (dateKind === "full" ? " active" : "")} onClick={() => setDateKind("full")}>Día exacto</button>
              <button type="button" className={"tab" + (dateKind === "month" ? " active" : "")} onClick={() => setDateKind("month")}>Sólo mes</button>
              <button type="button" className={"tab" + (dateKind === "anniversary" ? " active" : "")} onClick={() => setDateKind("anniversary")} title="Día y mes, sin año (fechas que se repiten cada año)">Aniversario</button>
              {dateKind === "year" && <button type="button" className="tab active">Sólo año</button>}
            </div>
          </div>

          <div className="field xy" style={{ display: "flex", gap: 10 }}>
            {(dateKind === "full" || dateKind === "anniversary") && (
              <div><label>Día</label><input type="number" min={1} max={31} value={day} onChange={(e) => setDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))} /></div>
            )}
            {dateKind !== "year" && (
              <div style={{ flex: 1 }}><label>Mes</label>
                <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
              </div>
            )}
            {dateKind !== "anniversary" && (
              <div style={{ flex: 1 }}><label>Año</label><input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || year)} /></div>
            )}
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
            <label>Duración{entries.length > 1 ? " por efeméride" : ""} (segundos)</label>
            <input type="number" min={2} value={dur} onChange={(e) => setDur(Math.max(2, Number(e.target.value) || 10))} />
          </div>

          <button className="btn primary" type="submit" disabled={saving || uploading} style={{ width: "100%", justifyContent: "center" }}>
            <Plus size={16} /> {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Guardar en el banco"}
          </button>
        </form>

        <div className="pm-col">
          <PreviewMonitor type="efemerides" data={buildData(entries) as unknown as Record<string, unknown>} dur={dur * entries.length} ready={!!entries[0]!.title.trim() && !!entries[0]!.mediaUrl} />
          {items.length === 0 && <div className="card" style={{ padding: 18, color: "#6b7688" }}>Todavía no hay efemérides.</div>}
          {items.map((it) => {
            const d = it.data as EfemeridesData;
            return (
              <div key={it.id} data-item={it.id} className="card" style={{ padding: 16, display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 44, height: 64, borderRadius: 8, background: "#0d2168", flex: "0 0 auto", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {d.media_url ? <img src={d.media_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <CalendarDays size={20} color="#fff" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "#6b7688", fontWeight: 700 }}>{formatEfemeridesDate(d)}</div>
                  <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}{d.more?.length ? <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>+{d.more.length} más</span> : null}</div>
                  <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4 }}>{it.duration_sec}s</div>
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

      {wikiOpen && (
        <div className="modal-back" onClick={() => setWikiOpen(false)}>
          <div className="modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <b>Traer de Wikipedia</b>
              <button className="icon-btn" onClick={() => setWikiOpen(false)}><X size={18} /></button>
            </div>
            <div style={{ padding: "12px 16px 4px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button type="button" className="btn" onClick={() => setWikiDate(shiftISO(wikiDate, -1))} title="Día anterior"><ChevronLeft size={16} /></button>
                <input type="date" value={wikiDate} onChange={(e) => e.target.value && setWikiDate(e.target.value)} style={{ flex: 1 }} />
                <button type="button" className="btn" onClick={() => setWikiDate(shiftISO(wikiDate, 1))} title="Día siguiente"><ChevronRight size={16} /></button>
                <button type="button" className="btn" onClick={() => setWikiDate(todayISO())}>Hoy</button>
              </div>
              <div className="tabs" style={{ marginBottom: 0 }}>
                <button type="button" className={"tab" + (wikiTab === "holidays" ? " active" : "")} onClick={() => setWikiTab("holidays")}>Días{wikiData ? ` (${wikiData.holidays.length})` : ""}</button>
                <button type="button" className={"tab" + (wikiTab === "events" ? " active" : "")} onClick={() => setWikiTab("events")}>Hechos históricos{wikiData ? ` (${wikiData.events.length})` : ""}</button>
              </div>
              <input placeholder="Filtrar…" value={wikiQ} onChange={(e) => setWikiQ(e.target.value)} />
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                <input type="checkbox" checked={wikiPhoto} onChange={(e) => setWikiPhoto(e.target.checked)} style={{ width: "auto" }} />
                Usar la foto de Wikipedia cuando tenga (si no, subís la tuya)
              </label>
            </div>
            {wikiLoading ? (
              <div className="muted-note" style={{ padding: 20, display: "flex", gap: 8, alignItems: "center" }}><Loader2 size={16} className="spin" /> Consultando Wikipedia…</div>
            ) : wikiErr ? (
              <div className="alert error" style={{ margin: 16 }}>{wikiErr}</div>
            ) : wikiData ? (() => {
              const q = wikiQ.trim().toLowerCase();
              const list = (wikiTab === "holidays" ? wikiData.holidays : wikiData.events)
                .filter((x) => !q || `${x.title} ${x.description} ${x.region ?? ""} ${x.year ?? ""}`.toLowerCase().includes(q));
              if (list.length === 0) return <div className="muted-note" style={{ padding: 20 }}>Sin resultados.</div>;
              let lastGroup = "";
              return (
                <div className="imp-list">
                  {list.map((x) => {
                    const head = wikiTab === "holidays" && x.group !== lastGroup ? GROUP_LABEL[x.group] : null;
                    lastGroup = x.group;
                    return (
                      <div key={x.id}>
                        {head && <div className="muted-note" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", padding: "10px 10px 4px" }}>{head}</div>}
                        <button type="button" className="imp-item" style={{ width: "100%" }} onClick={() => aplicarSugerida(x)}>
                          <div className="imp-thumb" style={{ width: 44, height: 64 }}>{x.image ? <img src={x.image.url} alt="" loading="lazy" /> : <ImageIcon size={18} />}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="imp-title">{x.year ? <span style={{ color: "var(--accent)" }}>{x.year} · </span> : null}{x.region && x.region !== "Argentina" ? <span style={{ color: "var(--muted)" }}>{x.region}: </span> : null}{x.title}</div>
                            {x.description && x.description !== x.title && <div className="muted-note" style={{ fontSize: 11, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{x.description}</div>}
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })() : null}
            <div className="muted-note" style={{ padding: "8px 16px 12px", fontSize: 11 }}>Fuente: Wikipedia (CC BY-SA). Son textos colaborativos: revisalos antes de emitir.</div>
          </div>
        </div>
      )}
    </>
  );
}
