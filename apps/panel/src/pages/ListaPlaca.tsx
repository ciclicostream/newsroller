import { useEffect, useRef, useState } from "react";
import { PreviewMonitor } from "../components/PreviewMonitor";
import { InformesSwitch } from "../components/InformesSwitch";
import { Plus, Trash2, Check, X, Loader2, ListChecks, Pencil, ArrowUp, ArrowDown, Search, Play, Pause, Music } from "lucide-react";
import type { ContentItem, ListaData, ListaItem } from "@newsroller/shared";
import { LISTA_MAX_ITEMS } from "@newsroller/shared";
import { contentItems } from "../lib/content-items";
import { uploadMedia } from "../lib/content";
import { api } from "../lib/api";

const MIN_ITEMS = 3;
const T_MAX = 90;
const SUB_MAX = 60;
const VAL_MAX = 16;
const TXT_MAX = 140;
const KICKER_MAX = 14;
const INTRO_OUTRO_SEC = 2; // entrada + salida, además de los segundos de cada ítem

interface Track { id: string; title: string; artist: string; album: string; cover: string | null; preview: string; source: "deezer" | "itunes" }
const blankItem = (): ListaItem => ({ title: "", subtitle: "", value: "", text: "", image_url: null, audio_url: null });

export function ListaPlaca() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [kicker, setKicker] = useState("");
  const [numbered, setNumbered] = useState(true);
  const [sec, setSec] = useState(5);
  const [rows, setRows] = useState<ListaItem[]>([blankItem(), blankItem(), blankItem()]);
  const [act, setAct] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);

  // Búsqueda de audio (Deezer, respaldo iTunes).
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const dur = rows.length * sec + INTRO_OUTRO_SEC;
  const cur = rows[act] ?? rows[0]!;

  const load = () => contentItems.list("lista").then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { void load(); }, []);
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const patchRow = (i: number, p: Partial<ListaItem>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  function addRow() {
    if (rows.length >= LISTA_MAX_ITEMS) return;
    setRows((r) => [...r, blankItem()]);
    setAct(rows.length);
    resetSearch();
  }
  function removeRow(i: number) {
    if (rows.length <= MIN_ITEMS) return setErr(`La lista lleva al menos ${MIN_ITEMS} ítems.`);
    setRows((r) => r.filter((_, j) => j !== i));
    setAct((a) => Math.max(0, Math.min(a > i ? a - 1 : a, rows.length - 2)));
    resetSearch();
  }
  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    setRows((r) => { const x = [...r]; [x[i], x[j]] = [x[j]!, x[i]!]; return x; });
    setAct(j);
  }
  function selectRow(i: number) { setAct(i); resetSearch(); }
  function resetSearch() { setTracks(null); setQ(""); stopPreview(); }

  async function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null); setUploading(true);
    try { patchRow(act, { image_url: await uploadMedia(file, "media") }); }
    catch (e) { setErr(e instanceof Error ? e.message : "error subiendo"); }
    finally { setUploading(false); if (imgRef.current) imgRef.current.value = ""; }
  }

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!q.trim()) return;
    setErr(null); setSearching(true); stopPreview();
    try { setTracks(await api.get<Track[]>(`/api/content/music-search?q=${encodeURIComponent(q.trim())}`)); }
    catch (e) { setErr(e instanceof Error ? e.message : "no se pudo buscar"); setTracks([]); }
    finally { setSearching(false); }
  }
  function stopPreview() { audioRef.current?.pause(); setPlaying(null); }
  function togglePreview(t: Track) {
    if (playing === t.id) return stopPreview();
    audioRef.current?.pause();
    const a = new Audio(t.preview);
    a.onended = () => setPlaying(null);
    audioRef.current = a;
    void a.play().catch(() => setPlaying(null));
    setPlaying(t.id);
  }
  // Elegir un tema: se copia el preview al storage propio (el link original vence) y, si el ítem no tenía, se completan
  // el título (álbum), el subtítulo (artista) y la tapa.
  async function useTrack(t: Track) {
    setErr(null); setImporting(t.id); stopPreview();
    const at = act;
    try {
      const audio = await api.post<{ url: string }>("/api/content/music-import", { url: t.preview, kind: "audio" });
      const p: Partial<ListaItem> = { audio_url: audio.url };
      const row = rows[at]!;
      if (!row.title.trim()) p.title = (t.album || t.title).slice(0, 50);
      if (!row.subtitle?.trim()) p.subtitle = t.artist.slice(0, SUB_MAX);
      if (!row.image_url && t.cover) {
        try { p.image_url = (await api.post<{ url: string }>("/api/content/music-import", { url: t.cover, kind: "image" })).url; } catch { /* la tapa es opcional */ }
      }
      patchRow(at, p);
      resetSearch();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "no se pudo importar el audio");
    } finally {
      setImporting(null);
    }
  }

  function buildData(): ListaData {
    return {
      title: title.trim(),
      kicker: kicker.trim() || undefined,
      numbered,
      sec_per_item: sec,
      items: rows.map((r) => ({
        title: r.title.trim(),
        subtitle: r.subtitle?.trim() || undefined,
        value: r.value?.trim() || undefined,
        text: r.text?.trim() || undefined,
        image_url: r.image_url || null,
        audio_url: r.audio_url || null,
      })),
    };
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (!title.trim()) return setErr("El título de la lista es obligatorio.");
    const missing = rows.findIndex((r) => !r.title.trim());
    if (missing >= 0) { setAct(missing); return setErr(`El ítem ${missing + 1} no tiene título.`); }
    setSaving(true);
    try {
      const data = buildData();
      if (editingId) {
        await contentItems.patch(editingId, { data: data as unknown as Record<string, any>, duration_sec: dur });
        setMsg("Cambios guardados.");
      } else {
        await contentItems.create({ type: "lista", data: data as unknown as Record<string, any>, duration_sec: dur });
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
    const d = it.data as ListaData;
    setEditingId(it.id);
    setTitle(d.title ?? ""); setKicker(d.kicker ?? "");
    setNumbered(d.numbered !== false);
    setSec(d.sec_per_item ?? 5);
    setRows((d.items?.length ? d.items : [blankItem(), blankItem(), blankItem()]).map((x) => ({ ...blankItem(), ...x })));
    setAct(0); resetSearch();
    setErr(null); setMsg(null);
  }
  function cancelEdit() {
    setEditingId(null);
    setTitle(""); setKicker(""); setNumbered(true); setSec(5);
    setRows([blankItem(), blankItem(), blankItem()]); setAct(0); resetSearch();
  }

  async function remove(it: ContentItem) {
    if (!confirm("¿Enviar esta lista a la papelera?")) return;
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
          <p>Lista con foco: el foco pasa de un ítem al siguiente y suena su audio, si tiene. De {MIN_ITEMS} a {LISTA_MAX_ITEMS} ítems.</p>
        </div>
      </div>

      <InformesSwitch active="lista" />

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      <div className="pm-layout">
        <form className="card" style={{ padding: 18 }} onSubmit={save}>
          <div style={{ fontWeight: 500, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {editingId ? "Editar lista" : "Nueva lista"}
            {editingId && <button type="button" className="btn" onClick={cancelEdit}>Cancelar</button>}
          </div>

          <div className="field">
            <label>Título de la lista</label>
            <textarea value={title} onChange={(e) => setTitle(e.target.value.slice(0, T_MAX))} rows={2} maxLength={T_MAX} placeholder="Los 10 álbumes más escuchados del año" required />
            <div style={{ fontSize: 12, color: "#6b7688", textAlign: "right", marginTop: 4 }}>{title.length}/{T_MAX}</div>
          </div>

          <div className="field xy" style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label>Volanta (pill)</label>
              <input value={kicker} onChange={(e) => setKicker(e.target.value.slice(0, KICKER_MAX))} placeholder="LISTA" maxLength={KICKER_MAX} />
            </div>
            <div style={{ width: 150 }}>
              <label>Segundos por ítem</label>
              <input type="number" min={2} value={sec} onChange={(e) => setSec(Math.max(2, Number(e.target.value) || 5))} />
            </div>
          </div>

          <div className="field">
            <label>Numeración</label>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button type="button" className={"tab" + (numbered ? " active" : "")} onClick={() => setNumbered(true)}>Con números</button>
              <button type="button" className={"tab" + (!numbered ? " active" : "")} onClick={() => setNumbered(false)}>Sin números</button>
            </div>
            <div className="muted-note" style={{ marginTop: 6 }}>
              {numbered ? "El número grande, en rojo, es el ranking." : "Sin ranking: el nombre va en rojo y el dato destacado queda como dato."}
            </div>
          </div>

          <div className="field">
            <label>Ítems ({rows.length}/{LISTA_MAX_ITEMS})</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {rows.map((r, i) => (
                <div key={i} className="card" onClick={() => selectRow(i)}
                  style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", borderColor: i === act ? "var(--accent)" : undefined }}>
                  <span style={{ width: 22, fontWeight: 600, color: "#6b7688" }}>{i + 1}</span>
                  <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: r.title.trim() ? undefined : "#9aa5b6" }}>
                    {r.title.trim() || "(sin título)"}
                  </span>
                  {r.audio_url && <Music size={14} color="#6b7688" />}
                  <button type="button" className="icon-btn" title="Subir" onClick={(e) => { e.stopPropagation(); move(i, -1); }} disabled={i === 0}><ArrowUp size={14} /></button>
                  <button type="button" className="icon-btn" title="Bajar" onClick={(e) => { e.stopPropagation(); move(i, 1); }} disabled={i === rows.length - 1}><ArrowDown size={14} /></button>
                  <button type="button" className="icon-btn" title="Quitar" onClick={(e) => { e.stopPropagation(); removeRow(i); }}><X size={14} /></button>
                </div>
              ))}
            </div>
            {rows.length < LISTA_MAX_ITEMS && (
              <button type="button" className="btn" style={{ marginTop: 8 }} onClick={addRow}><Plus size={14} /> Agregar ítem</button>
            )}
          </div>

          <div className="card" style={{ padding: 14, marginBottom: 14, background: "#f7f9fc" }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Ítem {act + 1}</div>

            <div className="field">
              <label>Título (obligatorio)</label>
              <input value={cur.title} onChange={(e) => patchRow(act, { title: e.target.value.slice(0, 50) })} maxLength={50} placeholder="Nombre del álbum, de la persona…" />
            </div>
            <div className="field xy" style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label>Subtítulo</label>
                <input value={cur.subtitle ?? ""} onChange={(e) => patchRow(act, { subtitle: e.target.value.slice(0, SUB_MAX) })} maxLength={SUB_MAX} placeholder="Artista, profesión, lugar" />
              </div>
              <div style={{ width: 150 }}>
                <label>Dato destacado</label>
                <input value={cur.value ?? ""} onChange={(e) => patchRow(act, { value: e.target.value.slice(0, VAL_MAX) })} maxLength={VAL_MAX} placeholder="4,8 M · 1889" />
              </div>
            </div>
            <div className="field">
              <label>Descripción</label>
              <textarea value={cur.text ?? ""} onChange={(e) => patchRow(act, { text: e.target.value.slice(0, TXT_MAX) })} rows={2} maxLength={TXT_MAX} />
              <div style={{ fontSize: 12, color: "#6b7688", textAlign: "right", marginTop: 4 }}>{(cur.text ?? "").length}/{TXT_MAX}</div>
            </div>

            <div className="field">
              <label>Imagen (cuadrada, opcional)</label>
              {cur.image_url ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <img src={cur.image_url} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }} />
                  <button type="button" className="btn" onClick={() => patchRow(act, { image_url: null })}><X size={14} /> quitar</button>
                </div>
              ) : (
                <input ref={imgRef} type="file" accept="image/*" onChange={onImage} disabled={uploading} />
              )}
              {uploading && <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4 }}><Loader2 size={13} className="spin" /> subiendo…</div>}
              <div className="muted-note" style={{ marginTop: 4 }}>Sin imagen, el ítem muestra un color con sus iniciales.</div>
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label>Audio (opcional)</label>
              {cur.audio_url ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <audio src={cur.audio_url} controls style={{ height: 34 }} />
                  <button type="button" className="btn" onClick={() => patchRow(act, { audio_url: null })}><X size={14} /> quitar</button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar un tema: artista y canción"
                      onKeyDown={(e) => { if (e.key === "Enter") void search(e); }} style={{ flex: 1 }}
                    />
                    <button type="button" className="btn" onClick={() => void search()} disabled={searching || !q.trim()}>
                      {searching ? <Loader2 size={14} className="spin" /> : <Search size={14} />} Buscar
                    </button>
                  </div>
                  {tracks && tracks.length === 0 && <div className="muted-note" style={{ marginTop: 6 }}>No se encontraron temas.</div>}
                  {tracks && tracks.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                      {tracks.map((t) => (
                        <div key={t.id} className="card" style={{ padding: "6px 8px", display: "flex", alignItems: "center", gap: 10 }}>
                          {t.cover ? <img src={t.cover} alt="" style={{ width: 38, height: 38, borderRadius: 6, objectFit: "cover" }} /> : <div style={{ width: 38, height: 38 }} />}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</div>
                            <div style={{ fontSize: 12, color: "#6b7688", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.artist} · {t.album}</div>
                          </div>
                          <button type="button" className="icon-btn" title="Escuchar" onClick={() => togglePreview(t)}>{playing === t.id ? <Pause size={15} /> : <Play size={15} />}</button>
                          <button type="button" className="btn" onClick={() => void useTrack(t)} disabled={importing !== null}>
                            {importing === t.id ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Usar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="muted-note" style={{ marginTop: 6 }}>Se usa un preview de 30 s y suenan los primeros {sec} s. Al elegir un tema se completan el título, el subtítulo y la tapa que estén vacíos.</div>
                </>
              )}
            </div>
          </div>

          <div className="muted-note" style={{ marginBottom: 14 }}>Duración del bloque: {rows.length} ítems × {sec} s + {INTRO_OUTRO_SEC} s de entrada y salida = <b>{dur} s</b>.</div>

          <button className="btn primary" type="submit" disabled={saving || uploading || importing !== null} style={{ width: "100%", justifyContent: "center" }}>
            <Plus size={16} /> {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Guardar en el banco"}
          </button>
        </form>

        <div className="pm-col">
          <PreviewMonitor type="lista" data={buildData() as unknown as Record<string, unknown>} dur={dur} ready={!!title.trim() && rows.some((r) => r.title.trim())} />
          {items.length === 0 && <div className="card" style={{ padding: 18, color: "#6b7688" }}>Todavía no hay listas.</div>}
          {items.map((it) => {
            const d = it.data as ListaData;
            const n = d.items?.length ?? 0;
            const nAudio = d.items?.filter((x) => x.audio_url).length ?? 0;
            return (
              <div key={it.id} data-item={it.id} className="card" style={{ padding: 16, display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: "#0d2168", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ListChecks size={20} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4, display: "flex", gap: 12 }}>
                    <span>{n} ítem{n === 1 ? "" : "s"}</span>
                    {nAudio > 0 && <span>{nAudio} con audio</span>}
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
