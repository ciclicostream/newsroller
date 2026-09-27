import { useEffect, useMemo, useRef, useState } from "react";
import { PreviewMonitor } from "../components/PreviewMonitor";
import { Plus, Trash2, Check, X, Loader2, Music, Disc3, Pencil, Crosshair, Undo2, Eraser } from "lucide-react";
import type { ContentItem, MusicaData, MusicaLine } from "@newsroller/shared";
import { GENEROS_MUSICALES_DEFAULT, MUSICA_MAX_GENEROS, MUSICA_MAX_FOTOS } from "@newsroller/shared";
import { contentItems } from "../lib/content-items";
import { settingsApi } from "../lib/settings";
import { uploadMedia } from "../lib/content";

const ALBUM_MAX = 60;
const TITLE_MAX = 70;
const CREDITS_MAX = 300;
const DESC_MAX = 350;
const LYRICS_MAX = 6000;

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const stamp = (t: number) => `${mmss(t)}.${String(Math.round((t % 1) * 10)).padStart(1, "0")}`;

// Duración de un audio (segundos) a partir de su URL.
function audioDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) ? a.duration : null);
    a.onerror = () => resolve(null);
    a.src = url;
  });
}

// Si TODAS las líneas con texto empiezan con una marca LRC ([mm:ss.xx]) la letra viene sincronizada: se separa texto y tiempos.
function parseLrc(raw: string): { text: string; times: number[] } | null {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const re = /^\[(\d+):(\d+(?:\.\d+)?)\]\s*/;
  if (!lines.every((l) => re.test(l))) return null;
  const times: number[] = [], texts: string[] = [];
  for (const l of lines) {
    const m = re.exec(l)!;
    times.push(Number(m[1]) * 60 + Number(m[2]));
    texts.push(l.replace(re, "").trim());
  }
  return { text: texts.join("\n"), times };
}

// Música: una canción con portada, ficha y letra por línea sincronizada con el audio (sin resaltado, una línea a la vez).
// La duración del bloque es la del audio. La sincronización se hace acá: se reproduce el tema y se marca con una tecla
// cuándo empieza cada línea (o se pega la letra ya en formato LRC).
export function MusicaPlaca() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [generos, setGeneros] = useState<string[]>(GENEROS_MUSICALES_DEFAULT);

  const [albumKey, setAlbumKey] = useState(""); // álbum elegido de la lista ("" = nuevo)
  const [syncOthers, setSyncOthers] = useState(false);
  const [album, setAlbum] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [date, setDate] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [credits, setCredits] = useState("");
  const [instagram, setInstagram] = useState("");
  const [lyricsText, setLyricsText] = useState("");
  const [times, setTimes] = useState<(number | null)[]>([]); // uno por línea con texto
  const [cursor, setCursor] = useState(0); // próxima línea a marcar
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [dur, setDur] = useState(180);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [saving, setSaving] = useState(false);
  const coverRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const playerRef = useRef<HTMLAudioElement>(null);

  const lines = useMemo(() => lyricsText.split("\n").map((l) => l.trim()).filter(Boolean), [lyricsText]);
  const synced = times.slice(0, lines.length).filter((t) => t != null).length;

  // Álbumes ya cargados (uno por nombre, con los datos del tema más reciente).
  const albumKeyOf = (name?: string) => (name ?? "").trim().toLowerCase();
  const albums = useMemo(() => {
    const m = new Map<string, { key: string; name: string; item: ContentItem; count: number }>();
    for (const it of [...items].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))) {
      const d = it.data as MusicaData;
      const key = albumKeyOf(d.album);
      if (!key) continue;
      const cur = m.get(key);
      if (cur) cur.count++; else m.set(key, { key, name: d.album, item: it, count: 1 });
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [items]);
  const otherCount = items.filter((it) => it.id !== editingId && albumKeyOf((it.data as MusicaData).album) === albumKey).length;

  function fillAlbum(d: MusicaData | null) {
    setAlbum(d?.album ?? ""); setCoverUrl(d?.cover_url ?? null); setPhotos(d?.photos ?? []); setDescription(d?.description ?? "");
    setDate(d?.release_date ?? ""); setGenres(d?.genres ?? []); setInstagram(d?.instagram ?? "");
    if (coverRef.current) coverRef.current.value = "";
  }
  function pickAlbum(key: string) {
    setAlbumKey(key); setSyncOthers(false);
    fillAlbum(key ? (albums.find((a) => a.key === key)?.item.data as MusicaData) : null);
  }
  // Datos del álbum (iguales en todos sus temas).
  const albumFields = () => ({
    album: album.trim(), cover_url: coverUrl ?? "", photos: photos.length ? photos : undefined, description: description.trim() || undefined,
    release_date: date || undefined, genres, instagram: instagram.trim() ? "@" + instagram.trim().replace(/^@+/, "") : undefined,
  });
  // Vacía sólo lo del tema (para seguir con el próximo del mismo álbum).
  function resetSong() {
    setEditingId(null); setTitle(""); setArtist(""); setCredits(""); setLyricsText(""); setTimes([]); setCursor(0); setDur(180); clearAudio();
  }

  const load = () => contentItems.list("musica").then(setItems).catch((e) => setErr(e.message));
  useEffect(() => {
    void load();
    settingsApi.get().then((s) => setGeneros(s.generos ?? GENEROS_MUSICALES_DEFAULT)).catch(() => {});
  }, []);

  // Los tiempos acompañan a las líneas por posición: si cambia la cantidad, se completa o recorta.
  useEffect(() => {
    setTimes((t) => (t.length === lines.length ? t : Array.from({ length: lines.length }, (_, i) => t[i] ?? null)));
    setCursor((c) => Math.min(c, lines.length));
  }, [lines.length]);

  function onLyrics(raw: string) {
    const v = raw.slice(0, LYRICS_MAX);
    const lrc = parseLrc(v);
    if (lrc) { setLyricsText(lrc.text); setTimes(lrc.times); setCursor(lrc.times.length); return; }
    setLyricsText(v);
  }

  async function onCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null); setUploadingCover(true);
    try { setCoverUrl(await uploadMedia(file, "media")); }
    catch (er) { setErr(er instanceof Error ? er.message : "error subiendo"); }
    finally { setUploadingCover(false); }
  }
  async function onPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, Math.max(0, MUSICA_MAX_FOTOS - photos.length));
    e.target.value = "";
    if (!files.length) return;
    setErr(null); setUploadingPhotos(true);
    try {
      const urls: string[] = [];
      for (const f of files) urls.push(await uploadMedia(f, "media"));
      setPhotos((cur) => [...cur, ...urls].slice(0, MUSICA_MAX_FOTOS));
    } catch (er) { setErr(er instanceof Error ? er.message : "error subiendo"); }
    finally { setUploadingPhotos(false); }
  }
  async function onAudio(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null); setUploadingAudio(true);
    try {
      const url = await uploadMedia(file, "media");
      setAudioUrl(url);
      const d = await audioDuration(url);
      if (d) setDur(Math.max(2, Math.ceil(d)));
    } catch (er) { setErr(er instanceof Error ? er.message : "error subiendo"); }
    finally { setUploadingAudio(false); }
  }
  function clearAudio() {
    setAudioUrl(null);
    if (audioRef.current) audioRef.current.value = "";
  }

  function toggleGenre(g: string) {
    setGenres((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : cur.length >= MUSICA_MAX_GENEROS ? cur : [...cur, g]));
  }

  // --- Sincronización ---
  function mark() {
    const a = playerRef.current;
    if (!a || cursor >= lines.length) return;
    const t = Math.round(a.currentTime * 10) / 10;
    setTimes((cur) => cur.map((x, i) => (i === cursor ? t : x)));
    setCursor((c) => c + 1);
  }
  function undo() {
    if (cursor <= 0) return;
    setTimes((cur) => cur.map((x, i) => (i === cursor - 1 ? null : x)));
    setCursor((c) => c - 1);
    const t = times[cursor - 2];
    if (playerRef.current && t != null) playerRef.current.currentTime = Math.max(0, t);
  }
  function nudge(i: number, delta: number) {
    setTimes((cur) => cur.map((x, k) => (k === i && x != null ? Math.max(0, Math.round((x + delta) * 10) / 10) : x)));
  }
  function jump(i: number) {
    setCursor(i);
    const t = times[i];
    if (playerRef.current && t != null) playerRef.current.currentTime = Math.max(0, t - 1.5);
  }
  function resetSync() {
    setTimes(lines.map(() => null));
    setCursor(0);
  }

  const buildData = (): MusicaData => ({
    album: album.trim(),
    cover_url: coverUrl ?? "",
    photos: photos.length ? photos : undefined,
    description: description.trim() || undefined,
    release_date: date || undefined,
    genres,
    title: title.trim(),
    artist: artist.trim(),
    credits: credits.trim() || undefined,
    instagram: instagram.trim() ? "@" + instagram.trim().replace(/^@+/, "") : undefined,
    lyrics: lines.length ? lines.map((text, i): MusicaLine => ({ t: times[i] ?? null, text })) : undefined,
    audio_url: audioUrl ?? "",
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (!album.trim() || !title.trim() || !artist.trim()) return setErr("Álbum, nombre del tema y artista son obligatorios.");
    if (!coverUrl) return setErr("La portada es obligatoria.");
    if (!genres.length) return setErr("Elegí al menos un género.");
    if (!audioUrl) return setErr("La pista de audio es obligatoria.");
    if (lines.length && synced > 0 && synced < lines.length) return setErr(`La letra está a medio sincronizar: faltan ${lines.length - synced} líneas. Terminá de marcarlas o reiniciá la sincronización.`);
    setSaving(true);
    try {
      const data = buildData() as unknown as Record<string, any>;
      const editing = !!editingId;
      if (editingId) {
        await contentItems.patch(editingId, { data, duration_sec: dur });
        setMsg("Cambios guardados.");
      } else {
        await contentItems.create({ type: "musica", data, duration_sec: dur });
        setMsg("Guardado en el banco.");
      }
      let updated = 0;
      if (syncOthers && albumKey) {
        const others = items.filter((it) => it.id !== editingId && albumKeyOf((it.data as MusicaData).album) === albumKey);
        for (const it of others) { await contentItems.patch(it.id, { data: { ...it.data, ...albumFields() } }); updated++; }
        if (updated) setMsg((m) => `${m ?? "Guardado."} Datos del álbum actualizados en ${updated} tema${updated === 1 ? "" : "s"} más.`);
      }
      if (editing) { cancelEdit(); }
      else {
        // Sigue el mismo álbum: quedan sus datos cargados y sólo se vacía el tema.
        resetSong();
        setAlbumKey(albumFields().album ? albumKeyOf(albumFields().album) : "");
        setSyncOthers(false);
      }
      await load();
    } catch (er) {
      setErr(er instanceof Error ? er.message : "error");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(it: ContentItem) {
    const d = it.data as MusicaData;
    setEditingId(it.id);
    setAlbumKey(albumKeyOf(d.album)); setSyncOthers(false);
    setAlbum(d.album ?? ""); setDescription(d.description ?? ""); setCoverUrl(d.cover_url ?? null); setPhotos(d.photos ?? []); setDate(d.release_date ?? "");
    setGenres(d.genres ?? []); setTitle(d.title ?? ""); setArtist(d.artist ?? ""); setCredits(d.credits ?? ""); setInstagram(d.instagram ?? "");
    const ls = d.lyrics ?? [];
    setLyricsText(ls.map((l) => l.text).join("\n"));
    setTimes(ls.map((l) => l.t));
    setCursor(ls.length);
    setAudioUrl(d.audio_url ?? null); setDur(it.duration_sec);
    setErr(null); setMsg(null);
  }
  function cancelEdit() {
    setEditingId(null);
    setAlbumKey(""); setSyncOthers(false);
    setAlbum(""); setDescription(""); setCoverUrl(null); setPhotos([]); setDate(""); setGenres([]); setTitle(""); setArtist(""); setCredits(""); setInstagram("");
    setLyricsText(""); setTimes([]); setCursor(0); setDur(180);
    if (coverRef.current) coverRef.current.value = "";
    clearAudio();
  }

  async function remove(it: ContentItem) {
    if (!confirm("¿Enviar esta canción a la papelera?")) return;
    await contentItems.remove(it.id);
    if (editingId === it.id) cancelEdit();
    await load();
  }
  async function toggleDisponible(it: ContentItem) {
    await contentItems.patch(it.id, { in_parrilla: !(it.in_parrilla !== false) });
    await load();
  }

  // Los géneros ya cargados que salieron de la lista siguen apareciendo (para poder quitarlos).
  const opciones = [...new Set([...genres, ...generos])].sort((a, b) => a.localeCompare(b, "es"));
  const ready = !!album.trim() && !!title.trim() && !!artist.trim() && !!coverUrl && genres.length > 0;

  return (
    <>
      <style>{CSS}</style>
      <div className="page-head pm-head">
        <div>
          <h1>Música</h1>
          <p>Elegí un álbum ya cargado o creá uno nuevo, y sumale los temas. Álbum, portada, géneros, nombre del tema y pista de audio son obligatorios. Descripción, fecha, créditos y letra son opcionales. La duración es la del audio.</p>
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      <div className="pm-layout">
        <form className="card" style={{ padding: 18 }} onSubmit={save}>
          <div style={{ fontWeight: 500, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {editingId ? "Editar canción" : "Nueva canción"}
            {editingId && <button type="button" className="btn" onClick={cancelEdit}>Cancelar</button>}
          </div>

          <div className="mu-sec">Álbum</div>
          <div className="field">
            <label>Álbum</label>
            <select value={albumKey} onChange={(e) => pickAlbum(e.target.value)} disabled={!!editingId}>
              <option value="">— Álbum nuevo —</option>
              {albums.map((a) => <option key={a.key} value={a.key}>{a.name} ({a.count} tema{a.count === 1 ? "" : "s"})</option>)}
            </select>
            <div className="mu-hint">Si el álbum ya tiene temas cargados, elegilo y se completan sus datos: sólo cargás el tema nuevo.</div>
          </div>

          <div className="field"><label>Nombre del álbum</label><input value={album} maxLength={ALBUM_MAX} onChange={(e) => setAlbum(e.target.value)} required /></div>

          <div className="field">
            <label>Portada (obligatoria, cuadrada)</label>
            {coverUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <img src={coverUrl} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6 }} />
                <button type="button" className="btn" onClick={() => { setCoverUrl(null); if (coverRef.current) coverRef.current.value = ""; }}><X size={14} /> quitar</button>
              </div>
            ) : (
              <input ref={coverRef} type="file" accept="image/*" onChange={onCover} disabled={uploadingCover} />
            )}
            {uploadingCover && <div className="mu-hint"><Loader2 size={13} className="spin" /> subiendo…</div>}
          </div>

          <div className="field">
            <label>Más fotos (opcional, hasta {MUSICA_MAX_FOTOS}) · rotan con la portada</label>
            {photos.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                {photos.map((u, i) => (
                  <div key={u + i} style={{ position: "relative" }}>
                    <img src={u} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, display: "block" }} />
                    <button type="button" className="btn" style={{ position: "absolute", top: -6, right: -6, padding: 2, minHeight: 0, borderRadius: "50%" }} onClick={() => setPhotos((cur) => cur.filter((_, k) => k !== i))} title="Quitar"><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
            {photos.length < MUSICA_MAX_FOTOS && <input ref={photosRef} type="file" accept="image/*" multiple onChange={onPhotos} disabled={uploadingPhotos} />}
            {uploadingPhotos && <div className="mu-hint"><Loader2 size={13} className="spin" /> subiendo…</div>}
          </div>

          <div className="field">
            <label>Descripción del álbum (opcional)</label>
            <textarea value={description} rows={4} maxLength={DESC_MAX} onChange={(e) => setDescription(e.target.value)} />
            <div className="mu-hint" style={{ textAlign: "right" }}>{description.length}/{DESC_MAX}</div>
          </div>

          <div className="field"><label>Fecha de lanzamiento (opcional)</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>

          <div className="field">
            <label>Géneros musicales (hasta {MUSICA_MAX_GENEROS}) · {genres.length}/{MUSICA_MAX_GENEROS}</label>
            <div className="mu-genres">
              {opciones.map((g) => {
                const on = genres.includes(g);
                return (
                  <button type="button" key={g} className={"mu-g" + (on ? " on" : "")} disabled={!on && genres.length >= MUSICA_MAX_GENEROS} onClick={() => toggleGenre(g)}>
                    {on && <Check size={12} />} {g}
                  </button>
                );
              })}
            </div>
            <div className="mu-hint">La lista se administra en Ajustes → Géneros musicales.</div>
          </div>

          <div className="field">
            <label>Instagram de la banda (opcional)</label>
            <input value={instagram} maxLength={31} onChange={(e) => setInstagram(e.target.value.replace(/\s/g, ""))} placeholder="@usuario" />
          </div>

          {albumKey && otherCount > 0 && (
            <label className="mu-chk">
              <input type="checkbox" checked={syncOthers} onChange={(e) => setSyncOthers(e.target.checked)} />
              Aplicar los cambios de los datos del álbum a los otros {otherCount} tema{otherCount === 1 ? "" : "s"}
            </label>
          )}

          <div className="mu-sec">Tema</div>
          <div className="field"><label>Nombre del tema</label><input value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} required /></div>
          <div className="field"><label>Artista</label><input value={artist} maxLength={TITLE_MAX} onChange={(e) => setArtist(e.target.value)} placeholder="Quién lo interpreta" required /></div>

          <div className="field">
            <label>Pista de audio (obligatoria)</label>
            {audioUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <audio ref={playerRef} src={audioUrl} controls style={{ height: 36, flex: 1, minWidth: 220 }} />
                <button type="button" className="btn" onClick={clearAudio}><X size={14} /> quitar</button>
              </div>
            ) : (
              <input ref={audioRef} type="file" accept="audio/*" onChange={onAudio} disabled={uploadingAudio} />
            )}
            {uploadingAudio && <div className="mu-hint"><Loader2 size={13} className="spin" /> subiendo…</div>}
          </div>

          <div className="field">
            <label>Créditos (opcional)</label>
            <textarea value={credits} rows={3} maxLength={CREDITS_MAX} onChange={(e) => setCredits(e.target.value)} placeholder={"Letra y música: …\nProducción: …"} />
            <div className="mu-hint" style={{ textAlign: "right" }}>{credits.length}/{CREDITS_MAX}</div>
          </div>

          <div className="field">
            <label>Letra (opcional, una línea por renglón)</label>
            <textarea value={lyricsText} rows={8} onChange={(e) => onLyrics(e.target.value)} placeholder={"Pegá la letra acá.\nCada renglón se muestra de a uno.\nSi ya la tenés en formato LRC ([01:23.45] texto), pegala igual: toma los tiempos."} />
            <div className="mu-hint">{lines.length} línea{lines.length === 1 ? "" : "s"}{lines.length > 0 && ` · ${synced}/${lines.length} sincronizadas${synced === 0 ? " (sin sincronizar se reparte parejo en toda la canción)" : ""}`}</div>
          </div>

          {lines.length > 0 && (
            <div className="field mu-sync" tabIndex={0} onKeyDown={(e) => { if (e.code === "Space" && (e.target as HTMLElement).tagName !== "BUTTON" && (e.target as HTMLElement).tagName !== "AUDIO") { e.preventDefault(); mark(); } }}>
              <label>Sincronizar la letra</label>
              {!audioUrl ? (
                <div className="mu-hint">Cargá primero la pista de audio para poder sincronizar.</div>
              ) : (
                <>
                  <div className="mu-hint" style={{ marginBottom: 8 }}>
                    Dale play al tema y tocá <b>Marcar</b> (o la barra espaciadora con este recuadro seleccionado) justo cuando empieza a cantarse la línea resaltada. Podés corregir cada tiempo con ±0,1 s.
                  </div>
                  <div className="mu-actions">
                    <button type="button" className="btn primary" onClick={mark} disabled={cursor >= lines.length}><Crosshair size={15} /> Marcar</button>
                    <button type="button" className="btn" onClick={undo} disabled={cursor <= 0}><Undo2 size={15} /> Deshacer</button>
                    <button type="button" className="btn" onClick={resetSync}><Eraser size={15} /> Reiniciar</button>
                  </div>
                  <div className="mu-lines">
                    {lines.map((l, i) => (
                      <div key={i} className={"mu-line" + (i === cursor ? " cur" : "") + (times[i] != null ? " done" : "")}>
                        <button type="button" className="mu-t" onClick={() => jump(i)} title="Ir a esta línea">{times[i] != null ? stamp(times[i]!) : "—"}</button>
                        <span className="mu-x">{l}</span>
                        {times[i] != null && (
                          <span className="mu-n">
                            <button type="button" onClick={() => nudge(i, -0.1)}>−</button>
                            <button type="button" onClick={() => nudge(i, 0.1)}>+</button>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="field">
            <label>Duración (segundos){audioUrl ? ` · el audio dura ${mmss(dur)}` : ""}</label>
            <input type="number" min={2} value={dur} onChange={(e) => setDur(Math.max(2, Number(e.target.value) || 2))} />
          </div>

          <button className="btn primary" type="submit" disabled={saving || uploadingCover || uploadingAudio || uploadingPhotos} style={{ width: "100%", justifyContent: "center" }}>
            <Plus size={16} /> {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Guardar en el banco"}
          </button>
        </form>

        <div className="pm-col">
          <PreviewMonitor type="musica" data={{ ...buildData(), audio_url: audioUrl } as unknown as Record<string, unknown>} dur={dur} ready={ready} />
          {items.length === 0 && <div className="card" style={{ padding: 18, color: "#6b7688" }}>Todavía no hay canciones.</div>}
          {items.map((it) => {
            const d = it.data as MusicaData;
            const n = d.lyrics?.length ?? 0;
            const s = d.lyrics?.filter((l) => l.t != null).length ?? 0;
            return (
              <div key={it.id} data-item={it.id} className="card" style={{ padding: 16, display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: 8, background: "#0d2168", flex: "0 0 auto", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {d.cover_url ? <img src={d.cover_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Disc3 size={22} color="#fff" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title} — {d.album}</div>
                  <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Music size={12} /> {mmss(it.duration_sec)} · {(d.genres ?? []).join(", ")}{n > 0 ? ` · letra ${s === n ? "sincronizada" : s === 0 ? "sin sincronizar" : `${s}/${n}`}` : ""}
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

const CSS = `
.mu-sec{font-weight:700;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7c869b;margin:4px 0 12px;padding-bottom:6px;border-bottom:1px solid #e5e9f2}
.mu-chk{display:flex;align-items:center;gap:8px;font-size:13px;margin:0 0 18px;cursor:pointer}
.mu-hint{font-size:12px;color:#6b7688;margin-top:4px}
.mu-genres{display:flex;flex-wrap:wrap;gap:6px;max-height:190px;overflow:auto;padding:2px}
.mu-g{display:inline-flex;align-items:center;gap:4px;padding:5px 11px;border-radius:999px;border:1px solid #d5dbe8;background:#fff;color:#39445c;font-size:12.5px;font-weight:600;cursor:pointer}
.mu-g:hover:not(:disabled){border-color:#2f6bff}
.mu-g.on{background:#2f6bff;border-color:#2f6bff;color:#fff}
.mu-g:disabled{opacity:.4;cursor:not-allowed}
.mu-sync{border:1px solid #d5dbe8;border-radius:10px;padding:12px;background:#f7f9fd;outline:none}
.mu-sync:focus-within{border-color:#2f6bff}
.mu-actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.mu-lines{max-height:300px;overflow:auto;display:flex;flex-direction:column;gap:2px}
.mu-line{display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:6px;font-size:13px}
.mu-line.cur{background:#dbe6ff;font-weight:700}
.mu-line.done .mu-x{color:#39445c}
.mu-line:not(.done):not(.cur) .mu-x{color:#8a94a8}
.mu-t{flex:0 0 52px;text-align:left;border:0;background:transparent;font-variant-numeric:tabular-nums;color:#2f6bff;font-weight:700;cursor:pointer;padding:0}
.mu-x{flex:1;min-width:0}
.mu-n{display:inline-flex;gap:2px}
.mu-n button{width:24px;height:22px;border:1px solid #d5dbe8;background:#fff;border-radius:5px;cursor:pointer;line-height:1}
.spin{animation:muspin 1s linear infinite}@keyframes muspin{to{transform:rotate(360deg)}}
`;
