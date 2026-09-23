import { useEffect, useRef, useState } from "react";
import { PreviewMonitor } from "../components/PreviewMonitor";
import { Plus, Trash2, Check, X, Loader2, Clapperboard, Pencil, Tv } from "lucide-react";
import type { ContentItem, CarteleraData, CarteleraKind, Plataforma, Short } from "@newsroller/shared";
import { PLATAFORMAS_DEFAULT } from "@newsroller/shared";
import { contentItems } from "../lib/content-items";
import { uploadMedia, content } from "../lib/content";
import { settingsApi } from "../lib/settings";
import { youtubeId } from "../lib/cameras";
import { youtubeDuration } from "../lib/youtube";

const T_MAX = 90;
const KINDS: { key: CarteleraKind; label: string }[] = [{ key: "teatro", label: "Teatro" }, { key: "cine", label: "Cine" }, { key: "evento", label: "Eventos" }];
const kindOf = (d: CarteleraData): CarteleraKind => d.kind ?? "teatro"; // las ya guardadas son de teatro
const isYtId = (s: string) => /^[\w-]{11}$/.test(s);
const isJpgOrPng = (f: File) =>
  ["image/jpeg", "image/png"].includes(f.type) || /\.(jpe?g|png)$/i.test(f.name);
const fmtMin = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function Cartelera() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [kind, setKind] = useState<CarteleraKind>("teatro");
  // Cine (película o serie)
  const [synopsis, setSynopsis] = useState("");
  const [durText, setDurText] = useState("");
  const [genre, setGenre] = useState("");
  const [isSeries, setIsSeries] = useState(false);
  const [platformId, setPlatformId] = useState("");
  const [seasons, setSeasons] = useState("");
  const [episodes, setEpisodes] = useState("");
  const [tickerKind, setTickerKind] = useState<"" | "recomendada" | "estreno" | "clasico">("");
  const [side, setSide] = useState<"poster" | "short" | "none">("poster");
  const [shortId, setShortId] = useState("");
  const [plataformas, setPlataformas] = useState<Plataforma[]>(PLATAFORMAS_DEFAULT);
  const [shorts, setShorts] = useState<Short[]>([]);
  const [trailerInfo, setTrailerInfo] = useState<{ id: string; sec: number | null } | null>(null); // duración leída del trailer
  const [durTouched, setDurTouched] = useState(false); // el editor cambió la duración a mano
  const [trailer, setTrailer] = useState(""); // cine: link o id de YouTube
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const posterRef = useRef<HTMLInputElement>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [cast, setCast] = useState("");
  const [venue, setVenue] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [days, setDays] = useState("");
  const [time, setTime] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [dur, setDur] = useState(10);
  const [saving, setSaving] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    settingsApi.get().then((s) => { if (s.plataformas?.length) setPlataformas(s.plataformas); }).catch(() => {});
    content.listShorts().then((sh) => setShorts(sh.filter((x) => x.active))).catch(() => {});
  }, []);

  // Duración sugerida (sólo Cine): sin short = lo que dura el trailer; con short = lo que más dure entre ambos.
  const trailerId = youtubeId(trailer);
  useEffect(() => {
    if (kind !== "cine" || !isYtId(trailerId)) return;
    let on = true;
    const t = setTimeout(() => { void youtubeDuration(trailerId).then((sec) => { if (on) setTrailerInfo({ id: trailerId, sec }); }); }, 400);
    return () => { on = false; clearTimeout(t); };
  }, [trailerId, kind]);
  const trailerLoading = kind === "cine" && isYtId(trailerId) && trailerInfo?.id !== trailerId;
  const trailerSec = trailerInfo?.id === trailerId ? trailerInfo.sec : null;
  const shortSec = side === "short" ? shorts.find((x) => x.id === shortId)?.duration_sec ?? null : null;
  const suggested = kind !== "cine" ? null : (side === "short" && shortSec ? Math.max(trailerSec ?? 0, shortSec) : trailerSec ?? null) || null;
  useEffect(() => {
    if (suggested && !durTouched) setDur(Math.max(2, suggested));
  }, [suggested, durTouched]);

  const load = () => contentItems.list("cartelera").then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { void load(); }, []);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null); setUploadingPhoto(true);
    try { setPhotoUrl(await uploadMedia(file, "media")); }
    catch (e) { setErr(e instanceof Error ? e.message : "error subiendo"); }
    finally { setUploadingPhoto(false); }
  }
  async function onPoster(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    if (!isJpgOrPng(file)) {
      setErr("El póster tiene que ser un archivo JPG o PNG.");
      if (posterRef.current) posterRef.current.value = "";
      return;
    }
    setUploadingPoster(true);
    try { setPosterUrl(await uploadMedia(file, "media")); }
    catch (e) { setErr(e instanceof Error ? e.message : "error subiendo"); }
    finally { setUploadingPoster(false); }
  }
  async function onVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null); setUploadingVideo(true);
    try { setVideoUrl(await uploadMedia(file, "media")); }
    catch (e) { setErr(e instanceof Error ? e.message : "error subiendo"); }
    finally { setUploadingVideo(false); }
  }

  // Datos según la pestaña: sólo viajan los campos que le corresponden a cada tipo.
  function buildData(): CarteleraData {
    const base = { kind, title: title.trim().slice(0, T_MAX), venue: venue.trim(), address: address.trim(), city: city.trim(), days: days.trim(), time: time.trim() };
    if (kind === "cine") {
      const sh = side === "short" ? shorts.find((x) => x.id === shortId) : undefined;
      const plat = isSeries ? plataformas.find((p) => p.id === platformId) : undefined;
      return {
        ...base, venue: "", address: "", city: "", days: "", time: "",
        photo_url: "", author: author.trim(), cast: cast.trim(), video_url: null,
        trailer_id: youtubeId(trailer), synopsis: synopsis.trim(), duration_text: durText.trim(), genre: genre.trim(),
        is_series: isSeries || undefined,
        ...(plat ? { platform: plat.id, platform_name: plat.name } : {}),
        ...(isSeries && Number(seasons) > 0 ? { seasons: Number(seasons) } : {}),
        ...(isSeries && Number(episodes) > 0 ? { episodes: Number(episodes) } : {}),
        ticker: tickerKind || null,
        ...(side === "poster" && posterUrl ? { poster_url: posterUrl } : {}),
        ...(sh ? { short_id: sh.id, short_thumb: sh.thumbnail_url ?? undefined } : {}),
      };
    }
    if (kind === "evento") return { ...base, photo_url: photoUrl ?? "", author: "", cast: "", description: synopsis.trim(), video_url: videoUrl };
    return { ...base, photo_url: photoUrl ?? "", author: author.trim(), cast: cast.trim(), video_url: videoUrl, ticker: tickerKind || null };
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    const tid = youtubeId(trailer);
    if (kind === "cine") {
      if (!isYtId(tid)) return setErr("El trailer es obligatorio: pegá el link (o el ID) del video de YouTube.");
      if (!title.trim() || !synopsis.trim() || !author.trim() || !cast.trim() || !durText.trim() || !genre.trim()) {
        return setErr("Título, sinopsis, director, actores, duración y género son obligatorios.");
      }
      if (isSeries && !platformId) return setErr("Elegí la plataforma de la serie.");
      if (side === "short" && !shortId) return setErr("Elegí el short de Cíclico (o cambiá el recurso lateral).");
    } else {
      if (!photoUrl) return setErr("La foto horizontal es obligatoria.");
      if (kind === "evento" && !synopsis.trim()) return setErr("La descripción del evento es obligatoria.");
      const persona = kind !== "evento" && (!author.trim() || !cast.trim());
      if (!title.trim() || persona || !venue.trim() || !address.trim() || !city.trim() || !days.trim() || !time.trim()) {
        return setErr("Todos los campos son obligatorios (salvo el video).");
      }
    }
    setSaving(true);
    try {
      const data = buildData();
      if (editingId) {
        await contentItems.patch(editingId, { data, duration_sec: dur });
        setMsg("Cambios guardados.");
      } else {
        await contentItems.create({ type: "cartelera", data, duration_sec: dur });
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
    const d = it.data as CarteleraData;
    setEditingId(it.id);
    setKind(kindOf(d));
    setTrailer(d.trailer_id ?? "");
    setPosterUrl(d.poster_url ?? null);
    setSynopsis(d.synopsis ?? d.description ?? ""); setDurText(d.duration_text ?? ""); setGenre(d.genre ?? "");
    setIsSeries(!!d.is_series); setPlatformId(d.platform ?? ""); setSeasons(d.seasons ? String(d.seasons) : ""); setEpisodes(d.episodes ? String(d.episodes) : "");
    setTickerKind(d.ticker ?? "");
    setShortId(d.short_id ?? "");
    setSide(d.short_id ? "short" : d.poster_url ? "poster" : "none");
    setDurTouched(true); // se respeta la duración ya guardada
    setPhotoUrl(d.photo_url ? d.photo_url : null);
    setTitle(d.title ?? "");
    setAuthor(d.author ?? "");
    setCast(d.cast ?? "");
    setVenue(d.venue ?? "");
    setAddress(d.address ?? "");
    setCity(d.city ?? "");
    setDays(d.days ?? "");
    setTime(d.time ?? "");
    setVideoUrl(d.video_url ?? null);
    setDur(it.duration_sec);
    setErr(null); setMsg(null);
  }
  function cancelEdit() {
    setEditingId(null);
    setTrailer(""); setPosterUrl(null); if (posterRef.current) posterRef.current.value = "";
    setDurTouched(false);
    setSynopsis(""); setDurText(""); setGenre(""); setIsSeries(false); setPlatformId(""); setSeasons(""); setEpisodes(""); setTickerKind(""); setSide("poster"); setShortId("");
    setPhotoUrl(null); setTitle(""); setAuthor(""); setCast(""); setVenue(""); setAddress(""); setCity(""); setDays(""); setTime(""); setVideoUrl(null);
    if (photoRef.current) photoRef.current.value = "";
    if (videoRef.current) videoRef.current.value = "";
    setDur(10);
  }

  async function remove(it: ContentItem) {
    if (!confirm("¿Enviar esta cartelera a la papelera?")) return;
    await contentItems.remove(it.id);
    if (editingId === it.id) cancelEdit();
    await load();
  }
  const shownItems = items.filter((it) => kindOf(it.data as CarteleraData) === kind);

  async function toggleDisponible(it: ContentItem) {
    await contentItems.patch(it.id, { in_parrilla: !(it.in_parrilla !== false) });
    await load();
  }

  return (
    <>
      <div className="page-head pm-head">
        <div>
          <h1>Cartelera</h1>
          <p>Teatro, cine o eventos con ficha completa. Todos los campos son obligatorios salvo el video vertical (teatro y eventos), el póster y los datos de temporadas y capítulos.</p>
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      <div className="pm-layout">
        <form className="card cfm" style={{ padding: 18 }} onSubmit={save}>
          <style>{FORM_CSS}</style>
          <div style={{ fontWeight: 500, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {editingId ? "Editar cartelera" : "Nueva cartelera"}
            {editingId && <button type="button" className="btn" onClick={cancelEdit}>Cancelar</button>}
          </div>

          <div className="field">
            <div className="tabs" style={{ marginBottom: 0 }}>
              {KINDS.map((k) => {
                const n = items.filter((it) => kindOf(it.data as CarteleraData) === k.key).length;
                return <button key={k.key} type="button" className={"tab" + (kind === k.key ? " active" : "")} onClick={() => setKind(k.key)}>{k.label}{n ? ` (${n})` : ""}</button>;
              })}
            </div>
          </div>

          {kind === "cine" ? (
            <>
              <section className="cfm-sec">
                <h4>Trailer y título</h4>
                <div className="field">
                  <label>Trailer (link de YouTube)</label>
                  <input value={trailer} onChange={(e) => setTrailer(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
                  {isYtId(youtubeId(trailer)) ? (
                    <img src={`https://img.youtube.com/vi/${youtubeId(trailer)}/hqdefault.jpg`} alt="" style={{ marginTop: 8, width: 160, height: 90, objectFit: "cover", borderRadius: 8 }} />
                  ) : trailer.trim() ? <div className="muted-note" style={{ marginTop: 4, color: "#c0392b" }}>No se reconoce el link de YouTube.</div> : null}
                </div>
                <div className="field">
                  <label>Título</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, T_MAX))} maxLength={T_MAX} required />
                </div>
                <div className="field">
                  <label>Sinopsis</label>
                  <textarea value={synopsis} onChange={(e) => setSynopsis(e.target.value.slice(0, 260))} rows={3} maxLength={260} required />
                  <div className="cfm-count">{synopsis.length}/260</div>
                </div>
              </section>

              <section className="cfm-sec">
                <h4>Ficha</h4>
                <div className="field"><label>Director/a</label><input value={author} onChange={(e) => setAuthor(e.target.value)} required /></div>
                <div className="field"><label>Actores</label><input value={cast} onChange={(e) => setCast(e.target.value)} required /></div>
                <div className="cfm-two">
                  <div className="field"><label>Duración</label><input value={durText} onChange={(e) => setDurText(e.target.value)} placeholder="148 min" required /></div>
                  <div className="field"><label>Género</label><input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Ciencia ficción" required /></div>
                </div>
              </section>

              <section className="cfm-sec">
                <h4>Película o serie</h4>
                <div className="cfm-seg">
                  <button type="button" className={!isSeries ? "on" : ""} onClick={() => setIsSeries(false)}><Clapperboard size={15} /> Película</button>
                  <button type="button" className={isSeries ? "on" : ""} onClick={() => setIsSeries(true)}><Tv size={15} /> Serie</button>
                </div>
                {isSeries && (
                  <div className="cfm-sub">
                    <div className="field">
                      <label>Plataforma</label>
                      <select value={platformId} onChange={(e) => setPlatformId(e.target.value)} required>
                        <option value="">Elegí una…</option>
                        {plataformas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <div className="muted-note" style={{ marginTop: 4 }}>Las plataformas y sus logos se administran en Ajustes → Plataformas.</div>
                    </div>
                    <div className="cfm-two">
                      <div className="field"><label>Temporadas <i>(opcional)</i></label><input type="number" min={1} value={seasons} onChange={(e) => setSeasons(e.target.value)} placeholder="2" /></div>
                      <div className="field"><label>Capítulos <i>(opcional)</i></label><input type="number" min={1} value={episodes} onChange={(e) => setEpisodes(e.target.value)} placeholder="8" /></div>
                    </div>
                  </div>
                )}
              </section>

              <section className="cfm-sec">
                <h4>Recurso lateral</h4>
                <div className="cfm-seg">
                  <button type="button" className={side === "poster" ? "on" : ""} onClick={() => setSide("poster")}>Póster</button>
                  <button type="button" className={side === "short" ? "on" : ""} onClick={() => setSide("short")}>Short de Cíclico</button>
                  <button type="button" className={side === "none" ? "on" : ""} onClick={() => setSide("none")}>Ninguno</button>
                </div>
                {side === "poster" && (
                  <div className="cfm-sub">
                    <div className="field">
                      <label>Póster <i>(opcional, JPG o PNG)</i></label>
                      {posterUrl ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <img src={posterUrl} alt="" style={{ width: 44, height: 66, objectFit: "cover", borderRadius: 6 }} />
                          <button type="button" className="btn" onClick={() => { setPosterUrl(null); if (posterRef.current) posterRef.current.value = ""; }}><X size={14} /> quitar</button>
                        </div>
                      ) : (
                        <input ref={posterRef} type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" onChange={onPoster} disabled={uploadingPoster} />
                      )}
                      {uploadingPoster && <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4 }}><Loader2 size={13} className="spin" /> subiendo…</div>}
                    </div>
                  </div>
                )}
                {side === "short" && (
                  <div className="cfm-sub">
                    <div className="field">
                      <label>Short del columnista <i>(de la ingesta de Shorts)</i></label>
                      <select value={shortId} onChange={(e) => setShortId(e.target.value)} required>
                        <option value="">Elegí un short…</option>
                        {shorts.map((x) => <option key={x.id} value={x.id}>{(x.custom_title ?? x.title).slice(0, 60)}{x.duration_sec ? ` · ${x.duration_sec}s` : ""}</option>)}
                      </select>
                      {(() => { const sh = shorts.find((x) => x.id === shortId); return sh ? (
                        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
                          {sh.thumbnail_url && <img src={sh.thumbnail_url} alt="" style={{ width: 60, height: 34, objectFit: "cover", borderRadius: 6 }} />}
                          <div className="muted-note" style={{ fontSize: 12 }}>
                            Habla el columnista {sh.duration_sec ? `${sh.duration_sec}s` : ""} y el trailer se repite mudo; después el trailer activa la voz.
                          </div>
                        </div>
                      ) : null; })()}
                    </div>
                  </div>
                )}
              </section>

              <section className="cfm-sec">
                <h4>Emisión</h4>
                <div className="cfm-two">
                  <div className="field">
                    <label>Newsticker <i>(encima del título)</i></label>
                    <select value={tickerKind} onChange={(e) => setTickerKind(e.target.value as "" | "recomendada" | "estreno" | "clasico")}>
                      <option value="">Nada</option>
                      <option value="recomendada">Recomendada</option>
                      <option value="estreno">Estreno</option>
                      <option value="clasico">Clásico</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Duración (segundos)</label>
                    <input type="number" min={2} value={dur} onChange={(e) => { setDurTouched(true); setDur(Math.max(2, Number(e.target.value) || 10)); }} />
                  </div>
                </div>
                <div className="muted-note" style={{ margin: "-4px 0 12px" }}>
                  {trailerLoading ? (
                    <><Loader2 size={12} className="spin" /> Calculando la duración del trailer…</>
                  ) : suggested ? (
                    <>
                      Sugerida: <b>{fmtMin(suggested)}</b> ({side === "short" && shortSec ? "lo que más dura entre el short y el trailer" : "lo que dura el trailer"}).
                      {dur !== suggested && <> <button type="button" className="cfm-link" onClick={() => { setDurTouched(false); setDur(Math.max(2, suggested)); }}>Usar la sugerida</button></>}
                    </>
                  ) : isYtId(youtubeId(trailer)) ? "No se pudo leer la duración del trailer: poné la duración a mano." : "Pegá el trailer para calcular la duración sugerida."}
                </div>
              </section>
            </>
          ) : (
            <>
              <div className="field">
              <label>Foto horizontal (obligatoria)</label>
              {photoUrl ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <img src={photoUrl} alt="" style={{ width: 72, height: 40, objectFit: "cover", borderRadius: 6 }} />
                  <button type="button" className="btn" onClick={() => { setPhotoUrl(null); if (photoRef.current) photoRef.current.value = ""; }}><X size={14} /> quitar</button>
                </div>
              ) : (
                <input ref={photoRef} type="file" accept="image/*" onChange={onPhoto} disabled={uploadingPhoto} required />
              )}
              {uploadingPhoto && <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4 }}><Loader2 size={13} className="spin" /> subiendo…</div>}
            </div>

              <div className="field">
                <label>{kind === "evento" ? "Título del evento" : "Título de la obra"}</label>
                <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, T_MAX))} maxLength={T_MAX} required />
              </div>
              {kind === "evento" && (
                <div className="field">
                  <label>Descripción</label>
                  <textarea value={synopsis} onChange={(e) => setSynopsis(e.target.value.slice(0, 260))} rows={3} maxLength={260} required />
                  <div className="cfm-count">{synopsis.length}/260</div>
                </div>
              )}
              {kind === "teatro" && (
                <>
                  <div className="field"><label>Autor (se muestra "De …")</label><input value={author} onChange={(e) => setAuthor(e.target.value)} required /></div>
                  <div className="field"><label>Elenco (se muestra "Con: …")</label><input value={cast} onChange={(e) => setCast(e.target.value)} required /></div>
                </>
              )}

              <div className="field xy" style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}><label>Lugar</label><input value={venue} onChange={(e) => setVenue(e.target.value)} required /></div>
                <div style={{ flex: 1 }}><label>Ciudad/barrio</label><input value={city} onChange={(e) => setCity(e.target.value)} required /></div>
              </div>
              <div className="field">
                <label>Dirección</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} required />
              </div>
              <div className="field xy" style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}><label>Día(s)</label><input value={days} onChange={(e) => setDays(e.target.value)} placeholder="Vie y sáb" required /></div>
                <div style={{ flex: 1 }}><label>Horario</label><input value={time} onChange={(e) => setTime(e.target.value)} placeholder="21:00 hs" required /></div>
              </div>

              <div className="field">
                <label>Video vertical (opcional, 9:16)</label>
                {videoUrl ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <video src={videoUrl} style={{ width: 30, height: 54, objectFit: "cover", borderRadius: 6 }} muted />
                    <button type="button" className="btn" onClick={() => { setVideoUrl(null); if (videoRef.current) videoRef.current.value = ""; }}><X size={14} /> quitar</button>
                  </div>
                ) : (
                  <input ref={videoRef} type="file" accept="video/*" onChange={onVideo} disabled={uploadingVideo} />
                )}
                {uploadingVideo && <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4 }}><Loader2 size={13} className="spin" /> subiendo…</div>}
              </div>

              <div className={kind === "teatro" ? "cfm-two" : undefined}>
                {kind === "teatro" && (
                  <div className="field">
                    <label>Newsticker <i>(encima del título)</i></label>
                    <select value={tickerKind} onChange={(e) => setTickerKind(e.target.value as "" | "recomendada" | "estreno" | "clasico")}>
                      <option value="">Nada</option>
                      <option value="recomendada">Recomendada</option>
                      <option value="estreno">Estreno</option>
                      <option value="clasico">Clásico</option>
                    </select>
                  </div>
                )}
                <div className="field">
                  <label>Duración (segundos)</label>
                  <input type="number" min={2} value={dur} onChange={(e) => setDur(Math.max(2, Number(e.target.value) || 10))} />
                </div>
              </div>
            </>
          )}

          <button className="btn primary" type="submit" disabled={saving || uploadingPhoto || uploadingVideo || uploadingPoster} style={{ width: "100%", justifyContent: "center" }}>
            <Plus size={16} /> {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Guardar en el banco"}
          </button>
        </form>

        <div className="pm-col">
          <PreviewMonitor type="cartelera" data={buildData() as unknown as Record<string, unknown>} dur={dur} ready={!!title.trim() && (kind === "cine" ? isYtId(youtubeId(trailer)) : !!photoUrl)} />
          {shownItems.length === 0 && <div className="card" style={{ padding: 18, color: "#6b7688" }}>Todavía no hay carteleras de {KINDS.find((k) => k.key === kind)!.label.toLowerCase()}.</div>}
          {shownItems.map((it) => {
            const d = it.data as CarteleraData;
            return (
              <div key={it.id} data-item={it.id} className="card" style={{ padding: 16, display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 90, height: 56, borderRadius: 8, background: "#0d2168", flex: "0 0 auto", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {(d.poster_url || d.short_thumb || d.photo_url || (d.trailer_id ? `https://img.youtube.com/vi/${d.trailer_id}/mqdefault.jpg` : "")) ? <img src={d.poster_url || d.short_thumb || d.photo_url || `https://img.youtube.com/vi/${d.trailer_id}/mqdefault.jpg`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Clapperboard size={20} color="#fff" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4, display: "flex", gap: 12 }}>
                    <span>{d.kind === "cine" ? (d.is_series ? "serie" : "película") : d.venue}</span>
                    <span>{d.kind === "cine" ? (d.short_id ? "con short" : d.poster_url ? "con póster" : "solo trailer") : d.video_url ? "con video" : "sin video"}</span>
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

const FORM_CSS = `
.cfm-sec{background:#f6f7fa;border:1px solid #eceff5;border-radius:14px;padding:14px 14px 4px;margin-bottom:12px}
.cfm-sec h4{margin:0 0 12px;font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#8a93a6}
.cfm-sec .field{margin-bottom:12px}
.cfm-sec input,.cfm-sec select,.cfm-sec textarea{background:#fff}
.cfm-sec label i{font-style:normal;font-weight:500;color:#9aa3b8;text-transform:none}
.cfm-link{border:0;background:none;padding:0;font:inherit;color:#2f6bff;font-weight:700;cursor:pointer;text-decoration:underline}
.cfm-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.cfm-count{font-size:12px;color:#8a93a6;text-align:right;margin-top:4px}
.cfm-seg{display:flex;gap:4px;background:#e9ecf3;border-radius:11px;padding:3px;margin-bottom:12px}
.cfm-seg button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;background:transparent;color:#6b7688;font:inherit;font-size:13px;font-weight:600;padding:8px 6px;white-space:nowrap;border-radius:9px;cursor:pointer;transition:background .15s,color .15s,box-shadow .15s}
.cfm-seg button:hover:not(.on){color:#1a2235}
.cfm-seg button.on{background:#fff;color:#1a2235;box-shadow:0 1px 4px rgba(20,30,60,.14)}
.cfm-sub{background:#fff;border:1px solid #eceff5;border-radius:11px;padding:12px 12px 2px;margin-bottom:12px;animation:cfmIn .18s ease-out}
.cfm-sub .field{margin-bottom:10px}
@keyframes cfmIn{from{opacity:0;transform:translateY(-4px)}}
`;
