import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, TrendingUp, Newspaper, Megaphone, Video, GripVertical, X,
  MonitorPlay, Zap, ArrowRight, ChevronDown, PauseCircle,
} from "lucide-react";
import type { ContentItem, PlaylistItem, Camera } from "@newsroller/shared";
import { contentHasAudio } from "@newsroller/shared";
import { parrilla, OUTPUT_FRAME_BASE } from "../lib/parrilla";
import { contentItems as contentItemsApi } from "../lib/content-items";
import { settingsApi } from "../lib/settings";
import { camerasApi, youtubeTitle } from "../lib/cameras";

// ---- catálogo de tipos ----
const TYPE_CAT: Record<string, string> = {
  ultima_hora: "ultima", dolar: "datos", cifras: "datos", clima: "datos",
  efemerides: "editorial", cartelera: "editorial", declaraciones: "editorial", informe: "editorial",
  publicidad: "media", promos: "media", video_full: "media", shorts: "media", camaras: "camaras",
};
const TYPE_LABEL: Record<string, string> = {
  ultima_hora: "Última Hora", dolar: "Dólar", cifras: "Cifras", clima: "Clima",
  efemerides: "Efemérides", cartelera: "Cartelera", declaraciones: "Declaraciones", informe: "Informe",
  publicidad: "Publicidad", promos: "Promo", video_full: "Video", shorts: "Shorts", camaras: "Cámara",
};
const CAT: Record<string, { label: string; color: string; Icon: any }> = {
  ultima: { label: "Última Hora", color: "#EE220C", Icon: AlertTriangle },
  datos: { label: "Datos", color: "#0ea5a3", Icon: TrendingUp },
  editorial: { label: "Editorial", color: "#2f6bff", Icon: Newspaper },
  media: { label: "Media", color: "#8b5cf6", Icon: Megaphone },
  camaras: { label: "Cámaras", color: "#e08a1e", Icon: Video },
};
const FILTERS = [["all", "Todos"], ["ultima", "Última Hora"], ["datos", "Datos"], ["editorial", "Editorial"], ["media", "Media"], ["camaras", "Cámaras"]];

interface TextCtx { cams: Map<string, Camera>; yt: Record<string, string> }
const fileName = (u: string) => { try { return decodeURIComponent(u.split("?")[0].split("/").pop() || ""); } catch { return u; } };

// Referencia corta de un contenido (lo que se ve en chips y filas de la parrilla).
function itemText(ci: ContentItem, ctx: TextCtx): string {
  const d = ci.data || {};
  const fallback = TYPE_LABEL[ci.type] || ci.type || "";
  switch (ci.type) {
    case "clima": return d.city ? String(d.city) : fallback;
    case "camaras": {
      const cam = ctx.cams.get(d.camera_id);
      const name = cam?.name ?? "(cámara eliminada)";
      return d.location ? `${name} · ${d.location}` : name;
    }
    case "video_full": {
      if (d.media_kind === "youtube") return d.title || ctx.yt[d.media_url] || `YouTube · ${d.media_url}`;
      return d.media_url ? fileName(d.media_url) : fallback;
    }
    case "publicidad": return d.media_url ? fileName(d.media_url) : fallback;
    case "cifras": return (d.subtitle || d.value || fallback).toString();
    case "declaraciones": return (d.name ? `${d.name}${d.headline ? " · " + d.headline : ""}` : fallback).toString();
    case "dolar": return fallback;
  }
  return (d.text || d.title || d.subt || d.name || fallback).toString();
}
const catOf = (t: string) => TYPE_CAT[t] || "media";

interface LiveStatus {
  updatedAt: string;
  fps: number;
  onAir: boolean;
  current: { id: string; itemType: string | null; hasAudio: boolean; durationSec: number } | null;
  next: { id: string; itemType: string | null; durationSec: number } | null;
}

// Cuántos segundos/minutos/horas pasaron (para "Última actualización").
function relAgo(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 2) return "ahora";
  if (s < 60) return `hace ${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m}min`;
  return `hace ${Math.round(m / 60)}h`;
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
  const [filter, setFilter] = useState("all");
  const [exp, setExp] = useState<string | null>(null);
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
    settingsApi.get().then((s) => { setOnAirState(s.onAir !== false); setAirSince(s.airSince || null); setAirPausedAt(s.onAir === false ? s.airPausedAt || null : null); }).catch(() => {});
    camerasApi.list().then(setCams).catch(() => {});
  }, []);
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
  const camById = useMemo(() => new Map(cams.map((c) => [c.id, c])), [cams]);
  const txt = (ci: ContentItem) => itemText(ci, { cams: camById, yt: ytTitles });

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

  const disponibles = items.filter((c) => c.in_parrilla !== false && (filter === "all" || catOf(c.type) === filter));
  const countIn = (id: string) => draft.filter((r) => r.content_id === id).length;

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
  const dragRef = useRef<{ type: "disp" | "row"; id: string } | null>(null);
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
    if (dg.type === "disp") { const ci = itemById.get(dg.id); if (ci) void addItem(ci, idx); return; }
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
  const selRow = draft.find((r) => r.id === sel) || null;
  const previewCi = (): ContentItem | null => {
    if (mode === "clip") return clipId ? itemById.get(clipId) ?? null : null;
    if (mode === "aire") return null;
    return selRow?.content_type === "content_item" && selRow.content_id ? itemById.get(selRow.content_id) ?? null : null;
  };
  // AIRE siempre carga el output real (aunque esté cortado, el propio output
  // muestra la placa de "fuera del aire" — no hace falta un placeholder local).
  const monUrl = (() => {
    if (mode === "aire") return `${OUTPUT_FRAME_BASE}/output/`;
    const ci = previewCi();
    return ci ? `${OUTPUT_FRAME_BASE}/output/?preview=${ci.id}` : null;
  })();
  const monHasAudio = mode === "aire"
    ? !!liveStatus?.current?.hasAudio
    : (() => { const ci = previewCi(); return !!ci && contentHasAudio(ci.type, ci.data); })();

  // cantidad en parrilla por categoría (se muestra en los filtros de Disponibles)
  const catCount = useMemo(() => {
    const by: Record<string, number> = { all: draft.length };
    draft.forEach((r) => { const ci = r.content_id ? itemById.get(r.content_id) : null; if (ci) { const c = catOf(ci.type); by[c] = (by[c] || 0) + 1; } });
    return by;
  }, [draft, itemById]);
  const cicloSec = draft.filter((r) => r.enabled).reduce((a, r) => a + r.duration_sec, 0);

  const fmt = (s: number) => [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
  // Tiempo real al aire desde la última publicación (persiste entre refrescos:
  // se calcula contra airSince, no contra un contador local que arranca de 0).
  void tick; // sólo dispara el re-render de 1x/seg; el valor en sí no se usa
  const airRef = !onAir && airPausedAt ? new Date(airPausedAt).getTime() : Date.now(); // cortado = reloj congelado
  const airSec = airSince ? Math.max(0, Math.floor((airRef - new Date(airSince).getTime()) / 1000)) : 0;

  return (
    <div className="pv">
      <style>{CSS}</style>

      <div className="pv-head">
        <h1>Programación</h1>
        <div className="pv-hint">Arrastrá contenidos a la parrilla, ordená y deslizá el tirador del monitor para salir al aire.</div>
        <span />
      </div>
      {err && <div className="pv-alert err">{err}</div>}
      {msg && <div className="pv-alert ok">{msg}</div>}

      <div className="pv-grid" ref={gridRef} style={{ gridTemplateColumns: `${cols.a}px 14px minmax(0,1fr) 14px ${cols.c}px` }}>
        {/* col1 disponibles */}
        <div className="pv-card pv-disp">
          <div className="pv-ct">Contenidos disponibles</div>
          <div className="pv-cats">
            {FILTERS.map(([id, lb]) => (
              <button key={id} className={"pv-cat" + (filter === id ? " on" : "")} onClick={() => setFilter(id)}>{lb}{catCount[id] ? <span className="pv-cn">{catCount[id]}</span> : null}</button>
            ))}
          </div>
          <div className="pv-displist">
            {disponibles.length === 0 && <div className="pv-empty">Sin contenidos. Cargá desde "Nuevo contenido".</div>}
            {disponibles.map((ci) => {
              const c = CAT[catOf(ci.type)]; const n = countIn(ci.id); const ex = exp === ci.id; const Ic = c.Icon;
              return (
                <div key={ci.id} className={"pv-chip" + (n ? " inuse" : "") + (ex ? " exp" : "")}
                  draggable onDragStart={() => (dragRef.current = { type: "disp", id: ci.id })} onDragEnd={endDrag}
                  onClick={() => setExp(ex ? null : ci.id)}>
                  <span className="pv-t">
                    <span className="pv-k"><Ic size={14} color={c.color} /> {TYPE_LABEL[ci.type] || ci.type}</span>
                    <span className={"pv-x" + (ex ? " full" : "")}>{txt(ci)}</span>
                    {ex && <button className="pv-monbtn" onClick={(e) => { e.stopPropagation(); setClipId(ci.id); setMode("clip"); }}><MonitorPlay size={14} /> Monitor</button>}
                    {ex && <span className="pv-dr">arrastrá para agregar a la parrilla</span>}
                  </span>
                  {n > 0 && !ex && <span className="pv-tag">×{n}</span>}
                  <span className={"pv-chev" + (ex ? " up" : "")}><ChevronDown size={16} /></span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pv-rz" onPointerDown={startResize("a")} onDoubleClick={() => setCols((c) => ({ ...c, a: 290 }))} title="Arrastrar para cambiar el ancho (doble clic: restablecer)"><i /></div>

        {/* col2 parrilla */}
        <div className="pv-card pv-par">
          <div className="pv-ct" style={{ padding: "0 16px 10px" }}>Parrilla</div>
          <div className="pv-rows" ref={rowsRef}
            onDragOver={onRowsDragOver}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIns(null); }}
            onDrop={onRowsDrop}>
            {draft.length === 0 && ins === null && <div className="pv-empty">Arrastrá acá los contenidos disponibles.</div>}
            {draft.map((r, i) => {
              const ci = r.content_id ? itemById.get(r.content_id) : null;
              // Contenido borrado (o retirado de la parrilla): la fila se marca en rojo.
              const missing = r.content_type === "content_item" && (!ci || ci.in_parrilla === false);
              const cat = ci ? catOf(ci.type) : "media"; const cc = CAT[cat]; const Ic = missing ? AlertTriangle : cc.Icon;
              const label = ci ? txt(ci) : (r.content_type === "content_item" ? "Contenido eliminado" : r.content_type);
              return (
                <div key={r.id} style={{ display: "contents" }}>
                  {ins === i && <div className="pv-slot" />}
                  <div data-rid={r.id} className={"pv-row" + (r.enabled ? "" : " off") + (sel === r.id ? " sel" : "") + (missing ? " missing" : "")}
                    draggable onDragStart={() => (dragRef.current = { type: "row", id: r.id })} onDragEnd={endDrag}
                    onClick={() => setSel(r.id)}
                    title={missing ? "No disponible: el contenido se eliminó o se retiró de la parrilla" : undefined}>
                    <GripVertical size={14} className="pv-grip" />
                    <span className="pv-badge" style={{ background: missing ? "#EE220C" : cc.color }} title={ci ? TYPE_LABEL[ci.type] : ""}><Ic size={13} color="#fff" /></span>
                    <span className="pv-lbl">{label}{missing && ci ? " (retirado)" : ""}</span>
                    <input className="pv-dur" type="number" value={r.duration_sec} onClick={(e) => e.stopPropagation()} onChange={(e) => setDur(r.id, +e.target.value)} />
                    <button className="pv-rmv" onClick={(e) => { e.stopPropagation(); void remove(r.id); }}><X size={13} /></button>
                  </div>
                </div>
              );
            })}
            {ins !== null && ins >= draft.length && <div className="pv-slot" />}
          </div>
        </div>

        <div className="pv-rz" onPointerDown={startResize("c")} onDoubleClick={() => setCols((c) => ({ ...c, c: 560 }))} title="Arrastrar para cambiar el ancho (doble clic: restablecer)"><i /></div>

        {/* col3 monitor */}
        <div className="pv-col">
          <div className="pv-card pv-mon-card">
            <div className="pv-mon-hd">
              <span className="pv-ct">Monitor</span>
              <div className="pv-seg">
                {(["preview", "aire", "clip"] as const).map((m) => (
                  <button key={m} className={"pv-segb" + (mode === m ? " on " + m : "")} onClick={() => setMode(m)}>{m.toUpperCase()}</button>
                ))}
              </div>
            </div>
            <div className="pv-mon-row">
              <div className="pv-mon">
                {/* AIRE muestra el output real tal cual: si está cortado, la propia
                    placa off_air.jpg ya lo dice — no le agregamos texto encima. */}
                {monUrl ? <iframe key={monUrl} src={monUrl} title="monitor" /> : <div className="pv-ph">Elegí un contenido para previsualizarlo.</div>}
              </div>
              <Vu audio={monHasAudio} />
            </div>
          </div>

          <div className="pv-card pv-fadercard"><Fader onPublish={publish} publishing={publishing} /></div>

          <div className="pv-airrow">
            <div className="pv-airmeta">
              <div>Última actualización: <b>{liveStatus ? relAgo(Date.now() - new Date(liveStatus.updatedAt).getTime()) : "—"}</b></div>
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

const CSS = `
.pv{--ac:#2f6bff;--acs:#e8efff;--rd:#EE220C;--ln:#e3e7ef;--dim:#7c869b;--tx:#1a2235}
.pv{color:var(--tx)}
.pv-head{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;margin-bottom:14px}
.pv-head h1{font-size:20px;margin:0;color:#fff}
.pv-hint{background:#fff;color:var(--tx);border-radius:999px;padding:9px 22px;font-size:13px;text-align:center;box-shadow:0 4px 14px rgba(5,15,42,.18)}
@media (max-width:1180px){.pv-head{grid-template-columns:1fr}.pv-head h1{text-align:center}.pv-head span{display:none}}
.pv-alert{padding:9px 14px;border-radius:9px;font-size:13px;margin-bottom:12px}
.pv-alert.err{background:#fdecea;color:#c0392b}.pv-alert.ok{background:#e9f8ef;color:#16a34a}
.pv-grid{display:grid;grid-template-columns:290px minmax(0,1fr) 560px;gap:0;align-items:stretch}
.pv-rz{align-self:stretch;cursor:col-resize;display:flex;justify-content:center;touch-action:none}
.pv-rz i{width:3px;margin:24px 0;border-radius:3px;background:transparent;transition:background .15s}
.pv-rz:hover i{background:#c9d2e6}.pv-rz:active i{background:var(--ac)}
.pv-card{background:#fff;border:1px solid var(--ln);border-radius:16px;box-shadow:0 4px 16px rgba(20,30,60,.05)}
.pv-ct{font-weight:800;font-size:12px;color:var(--dim);text-transform:uppercase;letter-spacing:.05em}
.pv-col{display:flex;flex-direction:column;gap:14px;min-height:0}
.pv-empty{color:var(--dim);font-size:13px;padding:26px;text-align:center;border:1.5px dashed var(--ln);border-radius:12px;margin:6px 0}

.pv-disp{display:flex;flex-direction:column;min-height:0;padding:14px 0 0;height:0;min-height:100%}
.pv-disp .pv-ct{padding:0 16px}
.pv-cats{display:flex;flex-wrap:wrap;gap:6px;padding:12px 16px}
.pv-cat{border:1px solid var(--ln);background:#fff;color:var(--dim);border-radius:8px;padding:6px 11px;font-size:11.5px;font-weight:700;cursor:pointer}
.pv-cat.on{background:var(--tx);color:#fff;border-color:var(--tx)}
.pv-cn{margin-left:6px;font-size:10px;font-weight:800;background:#e8efff;color:var(--ac);border-radius:6px;padding:1px 6px}
.pv-cat.on .pv-cn{background:rgba(255,255,255,.22);color:#fff}
.pv-displist{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:8px;padding:0 14px 14px}
.pv-chip{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--ln);border-left:4px solid var(--ln);border-radius:8px;padding:8px 10px;cursor:grab;font-size:12px}
.pv-chip:hover{border-color:var(--ac)}
.pv-chip.inuse{border-left-color:var(--ac);background:var(--acs)}
.pv-chip.exp{cursor:default;box-shadow:0 2px 10px rgba(20,30,60,.08)}
.pv-t{flex:1;overflow:hidden;display:flex;flex-direction:column}
.pv-k{font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:.05em;font-weight:700;display:flex;gap:6px;align-items:center}
.pv-x{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:3px}.pv-x.full{white-space:normal}
.pv-monbtn{margin-top:8px;align-self:flex-start;border:1px solid var(--ac);background:var(--acs);color:var(--ac);font:inherit;font-weight:800;font-size:11.5px;padding:6px 10px;border-radius:8px;cursor:pointer;display:inline-flex;gap:6px;align-items:center}
.pv-dr{font-size:10px;color:var(--dim);margin-top:6px}
.pv-tag{font-size:10px;font-weight:800;color:#fff;background:var(--ac);border-radius:6px;padding:3px 9px}
.pv-chev{color:var(--dim);display:inline-flex;flex:none;transition:transform .15s}.pv-chev.up{transform:rotate(180deg)}

.pv-par{display:flex;flex-direction:column;min-height:0;padding:14px 0 0;height:0;min-height:100%}
.pv-fader{padding:0}
.pv-fadercard{padding:10px 12px}
.pv-track{position:relative;height:46px;background:linear-gradient(90deg,#f2f4f9,#ffe9e6);border:1px solid var(--ln);border-radius:10px;overflow:hidden;touch-action:none}
.pv-fill{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,rgba(238,34,12,.14),rgba(238,34,12,.34))}
.pv-arrow{position:absolute;right:14px;top:0;bottom:0;display:flex;align-items:center;color:var(--rd);opacity:.5}
.pv-handle{position:absolute;top:3px;bottom:3px;width:150px;background:var(--rd);color:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:11px;font-weight:800;letter-spacing:.04em;cursor:grab;box-shadow:0 3px 10px rgba(238,34,12,.4)}
.pv-rows{flex:1;min-height:0;overflow:auto;padding:2px 14px 14px}
.pv-row{display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:10px;cursor:grab;background:#fff;border:1px solid var(--ln)}
.pv-row{margin-bottom:8px}
.pv-slot{height:38px;margin-bottom:8px;border:2px dashed var(--ac);background:var(--acs);border-radius:10px;animation:pvslot .14s ease-out}
@keyframes pvslot{from{height:0;margin-bottom:0;opacity:0}}
.pv-row.missing{background:#fdecea;border-color:#f3b4ac}.pv-row.missing .pv-lbl{color:#c0392b}.pv-row.sel{outline:2px solid var(--ac);outline-offset:-1px}.pv-row.off{opacity:.5}
.pv-grip{color:#b8c0d4;flex:none}
.pv-badge{border-radius:6px;padding:3px 5px;display:inline-flex;flex:none}
.pv-lbl{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px;font-weight:500}
.pv-dur{width:48px;background:#f4f5f7;border:1px solid var(--ln);color:var(--tx);border-radius:7px;padding:4px 6px;font:inherit;font-size:12px;text-align:center;flex:none;-moz-appearance:textfield}
.pv-dur::-webkit-inner-spin-button,.pv-dur::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.pv-rmv{background:#fff;border:1px solid var(--ln);color:var(--dim);cursor:pointer;border-radius:8px;padding:5px 7px;display:inline-flex;flex:none}
.pv-rmv:hover{color:#fff;background:var(--rd);border-color:var(--rd)}

.pv-mon-card{padding:14px;box-shadow:0 4px 16px rgba(20,30,60,.05),inset 0 2px 14px rgba(20,30,60,.07)}
.pv-mon-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.pv-seg{display:inline-flex;background:#eef1f6;border-radius:9px;padding:3px}
.pv-segb{border:0;background:transparent;color:var(--dim);font:inherit;font-weight:800;font-size:11px;padding:5px 12px;border-radius:7px;cursor:pointer;letter-spacing:.04em}
.pv-segb.on{background:#fff;color:var(--tx);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.pv-segb.on.aire{background:var(--rd);color:#fff}.pv-segb.on.clip{background:var(--ac);color:#fff}
.pv-mon-row{display:flex;gap:10px;align-items:stretch}
.pv-mon{flex:1;aspect-ratio:16/9;background:#05081a;border-radius:12px;overflow:hidden;position:relative}
.pv-mon iframe{width:100%;height:100%;border:0;display:block}
.pv-ph,.pv-standby{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#8a93a6;font-size:13px;text-align:center;padding:20px}
.pv-standby{flex-direction:column;gap:16px;color:#cbd5e1;font-weight:800;letter-spacing:.14em}
.pv-vu{width:36px;background:#fff;border:1px solid var(--ln);border-radius:10px;display:flex;flex-direction:column;align-items:center;padding:8px 0 6px;gap:6px}
.pv-vubars{flex:1;width:18px;display:flex;flex-direction:column-reverse;gap:3px}
.pv-vubars i{flex:0 0 3px;background:#e6e9f0;border-radius:2px;transition:background .09s}
.pv-vulb{font-size:8.5px;color:var(--dim);font-weight:800;text-align:center;line-height:1.15;white-space:pre-line}

.pv-airrow{display:flex;gap:12px;align-items:stretch}
.pv-airmeta{flex:1;display:flex;flex-direction:column;justify-content:center;gap:6px;font-size:12.5px;color:var(--dim);background:#fff;border:1px solid var(--ln);border-radius:14px;padding:12px 16px}
.pv-airmeta b{color:var(--tx);font-weight:700}
.pv-clock{background:#160404;border:1px solid #3a0d0d;border-radius:14px;display:flex;align-items:center;gap:14px;padding:12px 22px}
.pv-clock .lb{font-size:10px;color:#a15;letter-spacing:.12em;font-weight:800;text-transform:uppercase}
.pv-clock .dg{font-family:"Share Tech Mono",ui-monospace,monospace;font-size:36px;color:#ff2b2b;letter-spacing:4px;text-shadow:0 0 10px rgba(255,43,43,.7)}
.pv-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.pv-kpi{background:#fff;border:1px solid var(--ln);border-radius:12px;padding:10px;text-align:center;box-shadow:0 3px 12px rgba(20,30,60,.05)}
.pv-kpi .v{font-size:22px;font-weight:800;line-height:1}.pv-kpi .l{font-size:10px;color:var(--dim);margin-top:3px;font-weight:600}
.pv-kpi.live .v{color:var(--rd);display:inline-flex;align-items:center;gap:6px;font-size:16px}
.pv-kpi.live.off{background:#f2f4f8}.pv-kpi.live .v.off{color:var(--dim)}
.pv-dot{width:9px;height:9px;border-radius:50%;background:var(--rd);animation:pvpulse 1.4s infinite}
@keyframes pvpulse{0%,100%{opacity:1}50%{opacity:.35}}
`;
