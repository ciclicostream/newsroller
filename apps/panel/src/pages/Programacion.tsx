import { useEffect, useMemo, useRef, useState } from "react";
import {
  Zap, ArrowRight, PauseCircle, Volume2, VolumeX, RectangleHorizontal, RectangleVertical, Music,
} from "lucide-react";
import type { ContentItem, PlaylistItem, Camera, MusicSettings } from "@newsroller/shared";
import { contentHasAudio, MUSIC_DEFAULT } from "@newsroller/shared";
import { useMonitorAudio } from "../lib/monitorAudio";
import { useMonitorVertical } from "../lib/monitorOrientation";
import { parrilla, OUTPUT_FRAME_BASE } from "../lib/parrilla";
import { sessions as sessionsApi, type SessionRow } from "../lib/sessions";
import { contentItems as contentItemsApi } from "../lib/content-items";
import { settingsApi } from "../lib/settings";
import { camerasApi, youtubeTitle } from "../lib/cameras";
import { OutputLinksPicker } from "../components/OutputLinksPicker";
import { AvailablePanel } from "../components/AvailablePanel";
import { PlaylistRows } from "../components/PlaylistRows";
import { TYPE_LABEL } from "../lib/contentCatalog";

interface LiveStatus {
  updatedAt: string;
  fps: number;
  onAir: boolean;
  current: { id: string; itemType: string | null; hasAudio: boolean; durationSec: number } | null;
  next: { id: string; itemType: string | null; durationSec: number } | null;
}

// Hora (y fecha si no es hoy) del último mensaje de telemetría recibido, para "Última actualización".
function fmtUpdatedAt(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? time : `${d.toLocaleDateString("es-AR")} ${time}`;
}

// Duración del ciclo en un formato legible (no siempre segundos crudos).
function fmtCiclo(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), rem = s % 60;
  if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60), remM = m % 60;
  return remM ? `${h}h ${remM}m` : `${h}h`;
}

export function Programacion() {
  const [draft, setDraft] = useState<PlaylistItem[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [mode, setMode] = useState<"preview" | "aire" | "clip">("preview");
  const [clipId, setClipId] = useState<string | null>(null);
  const [onAir, setOnAirState] = useState(true);
  const [airSince, setAirSince] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);
  const [tick, setTick] = useState(0); // fuerza un re-render por segundo para el reloj
  const [publishing, setPublishing] = useState(false);
  const [airPausedAt, setAirPausedAt] = useState<string | null>(null);
  const [cams, setCams] = useState<Camera[]>([]);
  const [availableSessions, setAvailableSessions] = useState<SessionRow[]>([]); // Sesiones que se pueden meter como contenido
  const [music, setMusicState] = useState<MusicSettings>(MUSIC_DEFAULT); // canal de música de fondo (Ajustes → Música)
  const [musicBusy, setMusicBusy] = useState(false);
  const [ytTitles, setYtTitles] = useState<Record<string, string>>({});
  const [ins, setIns] = useState<number | null>(null); // hueco de inserción durante el arrastre
  const [cols, setCols] = useState<{ a: number; c: number }>(() => {
    try { const j = JSON.parse(localStorage.getItem("pv-cols") || ""); if (j.a > 0 && j.c > 0) return j; } catch { /* noop */ }
    return { a: 290, c: 560 };
  });
  const gridRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);

  // Estado real del corte de emisión y del reloj "al aire" (persistidos en
  // /api/settings, no locales) — sobreviven a un refresco del navegador.
  useEffect(() => {
    settingsApi.get().then((s) => { setOnAirState(s.onAir !== false); setAirSince(s.airSince || null); setAirPausedAt(s.onAir === false ? s.airPausedAt || null : null); setMusicState(s.music ?? MUSIC_DEFAULT); }).catch(() => {});
    camerasApi.list().then(setCams).catch(() => {});
    sessionsApi.list().then(setAvailableSessions).catch(() => {}); // si falta la migración 0020, sigue sin Sesiones
  }, []);
  // Canal de música de fondo: on/off desde el Monitor (qué tema suena se elige en Ajustes → Música).
  async function toggleMusic() {
    const next = { ...music, enabled: !music.enabled };
    const prev = music;
    setMusicState(next); setMusicBusy(true);
    try { const s = await settingsApi.update({ music: next }); setMusicState(s.music ?? MUSIC_DEFAULT); }
    catch (e) { setMusicState(prev); setErr(e instanceof Error ? e.message : "error"); }
    finally { setMusicBusy(false); }
  }
  // Al cortar se congela el reloj "al aire"; al reanudar se corre airSince por el
  // tiempo que estuvo cortado, así el reloj sigue donde se había quedado.
  async function toggleOnAir() {
    const next = !onAir;
    const now = new Date();
    let since = airSince;
    const patch: { onAir: boolean; airPausedAt: string; airSince?: string } = { onAir: next, airPausedAt: next ? "" : now.toISOString() };
    if (next && airSince && airPausedAt) {
      since = new Date(new Date(airSince).getTime() + (now.getTime() - new Date(airPausedAt).getTime())).toISOString();
      patch.airSince = since;
    }
    const prev = { onAir, airSince, airPausedAt };
    setOnAirState(next); setAirSince(since); setAirPausedAt(next ? null : patch.airPausedAt);
    try { await settingsApi.update(patch); }
    catch (e) { setOnAirState(prev.onAir); setAirSince(prev.airSince); setAirPausedAt(prev.airPausedAt); setErr(e instanceof Error ? e.message : "error"); }
  }

  // Telemetría en vivo que el output (embebido en AIRE) manda por postMessage.
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.source !== "ciclico-output") return;
      setLiveStatus(e.data as LiveStatus);
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const itemById = useMemo(() => new Map(items.map((c) => [c.id, c])), [items]);
  const sessionById = useMemo(() => new Map(availableSessions.map((s) => [s.id, s])), [availableSessions]);
  const camById = useMemo(() => new Map(cams.map((c) => [c.id, c])), [cams]);
  const ctx = useMemo(() => ({ cams: camById, yt: ytTitles }), [camById, ytTitles]);

  // Títulos de YouTube de videos guardados antes de que se persistiera `title`.
  useEffect(() => {
    items.forEach((ci) => {
      const d: any = ci.data || {};
      if (ci.type === "video_full" && d.media_kind === "youtube" && !d.title && !ytTitles[d.media_url]) {
        setYtTitles((m) => (m[d.media_url] ? m : { ...m, [d.media_url]: "" }));
        void youtubeTitle(d.media_url).then((t) => { if (t) setYtTitles((m) => ({ ...m, [d.media_url]: t })); });
      }
    });
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    try {
      const [d, ci] = await Promise.all([parrilla.list(), contentItemsApi.list()]);
      setDraft(d);
      setItems(ci);
      setSel((s) => s ?? d[0]?.id ?? null);
    } catch (e) { setErr(e instanceof Error ? e.message : "error"); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { const t = setInterval(() => setTick((s) => s + 1), 1000); return () => clearInterval(t); }, []);

  async function addItem(ci: ContentItem, atIdx?: number) {
    try {
      const row = await parrilla.add({ content_type: "content_item", content_id: ci.id, template: "custom", duration_sec: ci.duration_sec });
      const next = [...draft];
      next.splice(atIdx ?? next.length, 0, row);
      setDraft(next);
      setSel(row.id);
      if (atIdx != null) await reorderTo(next.map((r) => r.id));
    } catch (e) { setErr(e instanceof Error ? e.message : "error"); }
  }
  // Una Sesión como contenido: reproduce todos sus contenidos y sigue. La duración real la calcula el
  // output según lo que la Sesión tenga en cada momento; acá el número guardado es sólo un valor inicial.
  async function addSession(s: SessionRow, atIdx?: number) {
    try {
      const row = await parrilla.add({ content_type: "session", content_id: s.id, template: "custom", duration_sec: 8 });
      const next = [...draft];
      next.splice(atIdx ?? next.length, 0, row);
      setDraft(next);
      setSel(row.id);
      if (atIdx != null) await reorderTo(next.map((r) => r.id));
    } catch (e) { setErr(e instanceof Error ? e.message : "error"); }
  }
  async function reorderTo(ids: string[]) { try { setDraft(await parrilla.reorder(ids)); } catch (e) { setErr(e instanceof Error ? e.message : "error"); } }
  async function remove(id: string) { await parrilla.remove(id); setDraft((d) => d.filter((r) => r.id !== id)); if (sel === id) setSel(null); }
  async function setDur(id: string, v: number) { const dur = Math.max(1, v || 1); setDraft((d) => d.map((r) => (r.id === id ? { ...r, duration_sec: dur } : r))); await parrilla.patch(id, { duration_sec: dur }); }

  async function publish() {
    setPublishing(true); setErr(null);
    try { const r = await parrilla.publish(); setMsg(`Al aire: ${r.count} bloque(s)`); if (onAir) setAirSince(new Date().toISOString()); setTimeout(() => setMsg(null), 2500); }
    catch (e) { setErr(e instanceof Error ? e.message : "error"); }
    finally { setPublishing(false); }
  }

  // ---- drag & drop ----
  const dragRef = useRef<{ type: "disp"; ci: ContentItem } | { type: "session"; s: SessionRow } | { type: "row"; id: string } | null>(null);
  // Índice de inserción según la posición del cursor. Descuenta el alto del hueco
  // ya insertado para que las filas de abajo no "salten" y hagan parpadear el hueco.
  function calcIdx(clientY: number): number {
    const box = rowsRef.current; if (!box) return draft.length;
    const slot = box.querySelector(".pv-slot") as HTMLElement | null;
    const sh = slot ? slot.offsetHeight + 8 : 0;
    const els = Array.from(box.querySelectorAll("[data-rid]")) as HTMLElement[];
    for (let i = 0; i < els.length; i++) {
      const rc = els[i].getBoundingClientRect();
      const after = slot && (slot.compareDocumentPosition(els[i]) & Node.DOCUMENT_POSITION_FOLLOWING);
      const mid = rc.top + rc.height / 2 - (after ? sh : 0);
      if (clientY < mid) return i;
    }
    return els.length;
  }
  function onRowsDragOver(e: React.DragEvent) {
    if (!dragRef.current) return;
    e.preventDefault();
    const box = rowsRef.current!;
    const r = box.getBoundingClientRect(); const edge = 56;
    if (e.clientY < r.top + edge) box.scrollTop -= Math.ceil(((r.top + edge - e.clientY) / edge) * 18);
    else if (e.clientY > r.bottom - edge) box.scrollTop += Math.ceil(((e.clientY - (r.bottom - edge)) / edge) * 18);
    setIns(calcIdx(e.clientY));
  }
  function onRowsDrop(e: React.DragEvent) {
    e.preventDefault();
    const dg = dragRef.current; dragRef.current = null;
    const idx0 = ins ?? calcIdx(e.clientY); setIns(null);
    if (!dg) return;
    let idx = idx0;
    if (dg.type === "disp") { void addItem(dg.ci, idx); return; }
    if (dg.type === "session") { void addSession(dg.s, idx); return; }
    const from = draft.findIndex((r) => r.id === dg.id); if (from < 0) return;
    const next = [...draft]; const [it] = next.splice(from, 1); if (from < idx) idx--; next.splice(idx, 0, it);
    setDraft(next); setSel(it.id); void reorderTo(next.map((r) => r.id));
  }
  const endDrag = () => { dragRef.current = null; setIns(null); };

  // ---- pinzas de ancho de columnas ----
  function startResize(which: "a" | "c") {
    return (e: React.PointerEvent) => {
      e.preventDefault();
      const el = e.currentTarget as HTMLElement; el.setPointerCapture(e.pointerId);
      const x0 = e.clientX, start = cols; const total = gridRef.current?.clientWidth ?? 1400;
      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - x0;
        setCols(() => {
          let { a, c } = start;
          if (which === "a") a = start.a + dx; else c = start.c - dx;
          a = Math.max(220, a); c = Math.max(420, c);
          const room = total - 2 * 14 - 320; // lo que queda para la parrilla (mín 320)
          if (a + c > room) { if (which === "a") a = room - c; else c = room - a; }
          return { a: Math.max(220, a), c: Math.max(420, c) };
        });
      };
      const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); };
      el.addEventListener("pointermove", move); el.addEventListener("pointerup", up);
    };
  }
  useEffect(() => { try { localStorage.setItem("pv-cols", JSON.stringify(cols)); } catch { /* noop */ } }, [cols]);

  // ---- monitor ----
  // CLIP: un contenido suelto elegido a mano (botón "Monitor" de Contenidos disponibles), en loop y sin
  // el resto de la parrilla. PREVIEW: la parrilla BORRADOR completa rotando de verdad (con música y
  // todo), tal cual va a salir al publicar — no un solo contenido.
  const previewCi = (): ContentItem | null => (mode === "clip" && clipId ? itemById.get(clipId) ?? null : null);
  // AIRE siempre carga el output real (aunque esté cortado, el propio output
  // muestra la placa de "fuera del aire" — no hace falta un placeholder local).
  // Sonido: sólo en PREVIEW y CLIP. En AIRE no se escucha desde el panel (sería un eco desfasado del aire real).
  const [monSound, toggleMonSound] = useMonitorAudio();
  const soundOn = monSound && mode !== "aire";
  const [monVertical, toggleMonVertical] = useMonitorVertical(); // 16:9 o 9:16
  const monUrl = (() => {
    const orient = monVertical ? "orientation=vertical" : "";
    if (mode === "aire") return `${OUTPUT_FRAME_BASE}/output/${orient ? "?" + orient : ""}`;
    if (mode === "preview") {
      const params = new URLSearchParams({ borrador: "1", ...(soundOn ? { audio: "1" } : {}), ...(orient ? { orientation: "vertical" } : {}) });
      return `${OUTPUT_FRAME_BASE}/output/?${params.toString()}`;
    }
    const ci = previewCi();
    return ci ? `${OUTPUT_FRAME_BASE}/output/?preview=${ci.id}${soundOn ? "&audio=1" : ""}${orient ? "&" + orient : ""}` : null;
  })();
  // AIRE y PREVIEW cargan el output real (por telemetría postMessage sabemos si suena algo,
  // contenido propio o la música de fondo); CLIP es un contenido suelto sin telemetría.
  const monHasAudio = mode === "clip"
    ? (() => { const ci = previewCi(); return !!ci && contentHasAudio(ci.type, ci.data); })()
    : !!liveStatus?.current?.hasAudio;

  const cicloSec = draft.filter((r) => r.enabled).reduce((a, r) => a + r.duration_sec, 0);

  const fmt = (s: number) => [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
  // Tiempo real al aire desde la última publicación (persiste entre refrescos:
  // se calcula contra airSince, no contra un contador local que arranca de 0).
  void tick; // sólo dispara el re-render de 1x/seg; el valor en sí no se usa
  const airRef = !onAir && airPausedAt ? new Date(airPausedAt).getTime() : Date.now(); // cortado = reloj congelado
  const airSec = airSince ? Math.max(0, Math.floor((airRef - new Date(airSince).getTime()) / 1000)) : 0;

  return (
    <div className="pv">

      <div className="pv-head">
        <h1>Programación</h1>
        <div className="pv-hint">Arrastrá contenidos a la parrilla, ordená y deslizá el tirador del monitor para salir al aire.</div>
        <span />
      </div>
      {err && <div className="pv-alert err">{err}</div>}
      {msg && <div className="pv-alert ok">{msg}</div>}

      <div className="pv-grid" ref={gridRef} style={{ gridTemplateColumns: `${cols.a}px 14px minmax(0,1fr) 14px ${cols.c}px` }}>
        <AvailablePanel
          items={items} draft={draft} camById={camById} ytTitles={ytTitles}
          onDragStart={(ci) => (dragRef.current = { type: "disp", ci })} onDragEnd={endDrag}
          onPreviewClip={(id) => { setClipId(id); setMode("clip"); }}
          sessions={availableSessions} onDragStartSession={(s) => (dragRef.current = { type: "session", s })}
        />

        <div className="pv-rz" onPointerDown={startResize("a")} onDoubleClick={() => setCols((c) => ({ ...c, a: 290 }))} title="Arrastrar para cambiar el ancho (doble clic: restablecer)"><i /></div>

        <PlaylistRows
          title="Parrilla" draft={draft} itemById={itemById} ctx={ctx} sel={sel} ins={ins} rowsRef={rowsRef} sessionById={sessionById}
          onSelect={setSel} onRemove={(id) => void remove(id)} onDur={setDur}
          onDragStart={(id) => (dragRef.current = { type: "row", id })} onDragEnd={endDrag}
          onRowsDragOver={onRowsDragOver}
          onRowsDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIns(null); }}
          onRowsDrop={onRowsDrop}
          onPreviewClip={(id) => { setClipId(id); setMode("clip"); }}
        />

        <div className="pv-rz" onPointerDown={startResize("c")} onDoubleClick={() => setCols((c) => ({ ...c, c: 560 }))} title="Arrastrar para cambiar el ancho (doble clic: restablecer)"><i /></div>

        {/* col3 monitor */}
        <div className="pv-col">
          <div className="pv-mon-wrap">
            <div className="pv-card pv-mon-card">
              <div className="pv-mon-hd">
                <span className="pv-ct">Monitor</span>
                <div className="pv-seg">
                  {(["preview", "aire", "clip"] as const).map((m) => (
                    <button key={m} className={"pv-segb" + (mode === m ? " on " + m : "")} onClick={() => setMode(m)}>{m.toUpperCase()}</button>
                  ))}
                </div>
                <button type="button" className={"pv-snd" + (monVertical ? " on" : "")} onClick={toggleMonVertical} aria-pressed={monVertical}
                  aria-label={monVertical ? "Ver el monitor en horizontal" : "Ver el monitor en vertical"} title={monVertical ? "Ver en 16:9 (horizontal)" : "Ver en 9:16 (vertical)"}>
                  {monVertical ? <RectangleVertical size={15} /> : <RectangleHorizontal size={15} />}
                </button>
              </div>
              <div className={"pv-mon" + (monVertical ? " v" : "")}>
                {/* AIRE muestra el output real tal cual: si está cortado, la propia
                    placa off_air.jpg ya lo dice — no le agregamos texto encima. */}
                {monUrl ? <iframe key={monUrl} src={monUrl} title="monitor" allow="autoplay; encrypted-media" /> : <div className="pv-ph">Elegí un contenido para previsualizarlo.</div>}
              </div>
            </div>

            <div className="pv-card pv-sndcard">
              <button type="button" className={"pv-snd" + (soundOn ? " on" : "")} onClick={toggleMonSound} disabled={mode === "aire"}
                aria-pressed={soundOn} aria-label={soundOn ? "Silenciar el monitor" : "Escuchar el monitor"}
                title={mode === "aire" ? "En AIRE no se escucha desde el panel (evita el eco con el aire real)" : soundOn ? "Silenciar el monitor" : "Escuchar el monitor (PREVIEW y CLIP)"}>
                {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>
              <button type="button" className={"pv-snd" + (music.enabled ? " on" : "")} onClick={toggleMusic} disabled={musicBusy || !music.activeId}
                aria-pressed={music.enabled} aria-label={music.enabled ? "Apagar la música de fondo" : "Encender la música de fondo"}
                title={!music.activeId ? "Elegí un tema en Ajustes → Música primero" : music.enabled ? "Apagar la música de fondo" : "Encender la música de fondo (fadeout automático con contenido con audio)"}>
                <Music size={14} />
              </button>
              <Vu audio={monHasAudio} />
            </div>
          </div>

          <div className="pv-card pv-fadercard"><Fader onPublish={publish} publishing={publishing} /></div>

          <OutputLinksPicker title="Enlaces para transmitir" />

          <div className="pv-airrow">
            <div className="pv-airmeta">
              <div>Última actualización: <b>{liveStatus ? fmtUpdatedAt(liveStatus.updatedAt) : "—"}</b></div>
              <div>Próximo item: <b>{
                liveStatus?.next
                  ? (TYPE_LABEL[liveStatus.next.itemType ?? ""] ?? liveStatus.next.itemType ?? "—") + " · " + liveStatus.next.durationSec + "s"
                  : draft[0] ? (itemById.get(draft[0].content_id ?? "") ? TYPE_LABEL[itemById.get(draft[0].content_id!)!.type] : draft[0].content_type) + " · " + draft[0].duration_sec + "s" : "—"
              }</b></div>
              <div>Salida: <b>1920×1080</b> · FPS: <b>{liveStatus ? liveStatus.fps : "—"}</b></div>
            </div>
            <div className="pv-clock"><span className="lb">al aire</span><span className="dg">{fmt(airSec)}</span></div>
          </div>

          <div className="pv-kpis">
            <div className="pv-kpi"><div className="v">{items.length}</div><div className="l">en el banco</div></div>
            <div className="pv-kpi"><div className="v">{draft.length}</div><div className="l">en parrilla</div></div>
            <div className="pv-kpi"><div className="v">{fmtCiclo(cicloSec)}</div><div className="l">Ciclo</div></div>
            <div className={"pv-kpi live" + (onAir ? "" : " off")} onClick={() => void toggleOnAir()} style={{ cursor: "pointer" }}>
              {onAir ? <><div className="v"><span className="pv-dot" />Vivo</div><div className="l">tocar para cortar</div></>
                : <><div className="v off"><PauseCircle size={16} />Fuera de aire</div><div className="l">tocar para reanudar</div></>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

}

function Fader({ onPublish, publishing }: { onPublish: () => void; publishing: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  const [drag, setDrag] = useState(false);
  const set = (x: number) => setP(Math.max(0, Math.min(1, x)));
  return (
    <div className="pv-fader">
      <div className="pv-track" ref={track}>
        <div className="pv-fill" style={{ width: `${p * 100}%` }} />
        <span className="pv-arrow"><ArrowRight size={18} /></span>
        <div className="pv-handle" style={{ left: `calc(${p} * (100% - 156px) + 3px)`, transition: drag ? "none" : "left .35s ease" }}
          onPointerDown={(e) => { setDrag(true); (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { if (!drag || !track.current) return; const r = track.current.getBoundingClientRect(); set((e.clientX - r.left - 78) / (r.width - 156)); }}
          onPointerUp={() => { setDrag(false); if (p >= 0.9) { onPublish(); setP(1); setTimeout(() => setP(0), 600); } else setP(0); }}>
          <Zap size={15} /> {publishing ? "ENVIANDO…" : "ENVIAR A VIVO"}
        </div>
      </div>
    </div>
  );
}

// Siempre visible; cuando el clip/vivo no tiene audio, se queda quieto en cero
// (no desaparece). VU simulado (no lee el audio real del iframe, el navegador
// no lo permite cross-origin).
function Vu({ audio }: { audio: boolean }) {
  const [lvl, setLvl] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setLvl((l) => (audio ? Math.max(0.12, Math.min(1, l + (Math.random() - 0.42) * 0.55)) : 0)), 110);
    return () => clearInterval(t);
  }, [audio]);
  const n = 22; const lit = Math.round(lvl * n);
  const color = (i: number) => { const q = i / n; return q > 0.8 ? "#f87171" : q > 0.55 ? "#fbbf24" : "#4ade80"; };
  return (
    <div className="pv-vu">
      <div className="pv-vubars">
        {Array.from({ length: n }).map((_, i) => (
          <i key={i} style={{ background: i < lit ? color(i) : "#e6e9f0" }} />
        ))}
      </div>
      <div className="pv-vulb">{audio ? "AUDIO" : "SIN\nAUDIO"}</div>
    </div>
  );
}


