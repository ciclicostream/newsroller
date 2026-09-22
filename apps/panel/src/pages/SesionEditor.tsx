import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, Loader2, Power, RectangleHorizontal, RectangleVertical, Volume2, VolumeX,
} from "lucide-react";
import type { Camera, ContentItem, PlaylistItem } from "@newsroller/shared";
import { contentHasAudio } from "@newsroller/shared";
import { useMonitorAudio } from "../lib/monitorAudio";
import { useMonitorVertical } from "../lib/monitorOrientation";
import { contentItems as contentItemsApi } from "../lib/content-items";
import { camerasApi, youtubeTitle } from "../lib/cameras";
import { sessions, type SessionRow } from "../lib/sessions";
import { OUTPUT_FRAME_BASE } from "../lib/parrilla";
import { OutputLinksPicker } from "../components/OutputLinksPicker";
import { AvailablePanel } from "../components/AvailablePanel";
import { PlaylistRows } from "../components/PlaylistRows";
import { toast } from "../lib/toast";

// Editor de una Sesión: playlist propia, independiente del aire principal. "Contenidos disponibles" y la
// lista ordenada son EXACTAMENTE los mismos componentes que usa Emisión (mismo arrastrar y soltar, mismos
// filtros). Sin fader ni corte de aire general: acá el corte es el botón "Detener sesión", que puede usar
// cualquier manager asignado, no hace falta ser Admin.
export function SesionEditor() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [draft, setDraft] = useState<PlaylistItem[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [cams, setCams] = useState<Camera[]>([]);
  const [ytTitles, setYtTitles] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [mode, setMode] = useState<"preview" | "clip">("preview");
  const [clipId, setClipId] = useState<string | null>(null);
  const [ins, setIns] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const rowsRef = useRef<HTMLDivElement>(null);
  const [soundOn, toggleSound] = useMonitorAudio();
  const [monVertical, toggleMonVertical] = useMonitorVertical();

  const itemById = useMemo(() => new Map(items.map((c) => [c.id, c])), [items]);
  const camById = useMemo(() => new Map(cams.map((c) => [c.id, c])), [cams]);
  const ctx = useMemo(() => ({ cams: camById, yt: ytTitles }), [camById, ytTitles]);

  async function load() {
    if (!id) return;
    try {
      const [all, d, ci] = await Promise.all([sessions.list(), sessions.items(id), contentItemsApi.list()]);
      setSession(all.find((s) => s.id === id) ?? null);
      setDraft(d);
      setItems(ci);
      setSel((s) => s ?? d[0]?.id ?? null);
    } catch (e) { setErr(e instanceof Error ? e.message : "error"); }
  }
  useEffect(() => { void load(); camerasApi.list().then(setCams).catch(() => {}); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Títulos de YouTube de videos guardados antes de que se persistiera `title` (igual que en Emisión).
  useEffect(() => {
    items.forEach((ci) => {
      const d: any = ci.data || {};
      if (ci.type === "video_full" && d.media_kind === "youtube" && !d.title && !ytTitles[d.media_url]) {
        setYtTitles((m) => (m[d.media_url] ? m : { ...m, [d.media_url]: "" }));
        void youtubeTitle(d.media_url).then((t) => { if (t) setYtTitles((m) => ({ ...m, [d.media_url]: t })); });
      }
    });
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleActive() {
    if (!session) return;
    setBusy(true);
    try { setSession(await sessions.toggle(session.id, !session.active)); toast(session.active ? "Sesión detenida." : "Sesión reanudada.", "ok"); }
    catch (e) { toast(e instanceof Error ? e.message : "no se pudo cambiar el estado", "error"); }
    finally { setBusy(false); }
  }

  async function addItem(ci: ContentItem, atIdx?: number) {
    if (!id) return;
    try {
      const row = await sessions.addItem(id, { content_type: "content_item", content_id: ci.id, template: "custom", duration_sec: ci.duration_sec });
      const next = [...draft];
      next.splice(atIdx ?? next.length, 0, row);
      setDraft(next);
      setSel(row.id);
      if (atIdx != null) await reorderTo(next.map((r) => r.id));
    } catch (e) { setErr(e instanceof Error ? e.message : "error"); }
  }
  async function reorderTo(ids: string[]) { if (!id) return; try { setDraft(await sessions.reorderItems(id, ids)); } catch (e) { setErr(e instanceof Error ? e.message : "error"); } }
  async function remove(itemId: string) { if (!id) return; await sessions.removeItem(id, itemId); setDraft((d) => d.filter((r) => r.id !== itemId)); if (sel === itemId) setSel(null); }
  async function setDur(itemId: string, v: number) {
    if (!id) return;
    const dur = Math.max(1, v || 1);
    setDraft((d) => d.map((r) => (r.id === itemId ? { ...r, duration_sec: dur } : r)));
    await sessions.patchItem(id, itemId, { duration_sec: dur });
  }

  // ---- arrastrar y soltar: idéntico a Emisión ----
  const dragRef = useRef<{ type: "disp"; ci: ContentItem } | { type: "row"; id: string } | null>(null);
  function calcIdx(clientY: number): number {
    const box = rowsRef.current; if (!box) return draft.length;
    const slot = box.querySelector(".pv-slot") as HTMLElement | null;
    const sh = slot ? slot.offsetHeight + 8 : 0;
    const els = Array.from(box.querySelectorAll("[data-rid]")) as HTMLElement[];
    for (let i = 0; i < els.length; i++) {
      const rc = els[i]!.getBoundingClientRect();
      const after = slot && (slot.compareDocumentPosition(els[i]!) & Node.DOCUMENT_POSITION_FOLLOWING);
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
    const from = draft.findIndex((r) => r.id === dg.id); if (from < 0) return;
    const next = [...draft]; const [it] = next.splice(from, 1); if (from < idx) idx--; next.splice(idx, 0, it);
    setDraft(next); setSel(it.id); void reorderTo(next.map((r) => r.id));
  }
  const endDrag = () => { dragRef.current = null; setIns(null); };

  const previewCi = (): ContentItem | null => {
    if (mode === "clip") return clipId ? itemById.get(clipId) ?? null : null;
    const row = draft.find((r) => r.id === sel);
    return row?.content_id ? itemById.get(row.content_id) ?? null : null;
  };
  const monUrl = (() => {
    if (!id) return null;
    const orient = monVertical ? "orientation=vertical" : "";
    if (mode === "clip") { const ci = previewCi(); return ci ? `${OUTPUT_FRAME_BASE}/output/?preview=${ci.id}${soundOn ? "&audio=1" : ""}${orient ? "&" + orient : ""}` : null; }
    return `${OUTPUT_FRAME_BASE}/output/?session=${id}${soundOn ? "&audio=1" : ""}${orient ? "&" + orient : ""}`;
  })();
  const monHasAudio = (() => { const ci = previewCi(); return !!ci && contentHasAudio(ci.type, ci.data); })();
  void monHasAudio;

  if (!id) return null;

  return (
    <div className="pv">
      <div className="pv-head" style={{ display: "flex", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link to="/sesiones" className="btn"><ArrowLeft size={15} /></Link>
          <h1>{session?.name ?? "Sesión"}</h1>
        </div>
        {session && (
          <button className="btn primary" disabled={busy} onClick={toggleActive} style={!session.active ? { background: "#c0392b", borderColor: "#c0392b" } : undefined}>
            {busy ? <Loader2 size={15} className="spin" /> : <Power size={15} />} {session.active ? "Detener sesión" : "Reanudar sesión"}
          </button>
        )}
      </div>
      {err && <div className="pv-alert err">{err}</div>}

      <div className="pv-grid" style={{ gridTemplateColumns: "290px 14px minmax(0,1fr) 14px 460px" }}>
        <AvailablePanel
          items={items} draft={draft} camById={camById} ytTitles={ytTitles}
          onDragStart={(ci) => (dragRef.current = { type: "disp", ci })} onDragEnd={endDrag}
          onPreviewClip={(itemId) => { setClipId(itemId); setMode("clip"); }}
        />

        <div />

        <PlaylistRows
          title="Contenidos de la sesión" draft={draft} itemById={itemById} ctx={ctx} sel={sel} ins={ins} rowsRef={rowsRef}
          onSelect={setSel} onRemove={(itemId) => void remove(itemId)} onDur={setDur}
          onDragStart={(itemId) => (dragRef.current = { type: "row", id: itemId })} onDragEnd={endDrag}
          onRowsDragOver={onRowsDragOver}
          onRowsDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIns(null); }}
          onRowsDrop={onRowsDrop}
        />

        <div />

        <div className="pv-col">
          <div className="pv-card pv-mon-card">
            <div className="pv-mon-hd">
              <span className="pv-ct">Monitor</span>
              <div className="pv-seg">
                {(["preview", "clip"] as const).map((m) => (
                  <button key={m} className={"pv-segb" + (mode === m ? " on " + m : "")} onClick={() => setMode(m)}>{m.toUpperCase()}</button>
                ))}
              </div>
              <button type="button" className={"pv-snd" + (monVertical ? " on" : "")} onClick={toggleMonVertical} title={monVertical ? "Ver en 16:9" : "Ver en 9:16"}>
                {monVertical ? <RectangleVertical size={15} /> : <RectangleHorizontal size={15} />}
              </button>
              <button type="button" className={"pv-snd" + (soundOn ? " on" : "")} onClick={toggleSound} title={soundOn ? "Silenciar" : "Escuchar"}>
                {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
            </div>
            <div className="pv-mon-row">
              <div className={"pv-mon" + (monVertical ? " v" : "")}>
                {monUrl ? <iframe key={monUrl} src={monUrl} title="monitor" allow="autoplay; encrypted-media" /> : <div className="pv-ph">Elegí un contenido para previsualizarlo.</div>}
              </div>
            </div>
          </div>

          <OutputLinksPicker title="Enlaces para transmitir esta sesión" extraParams={{ session: id }} />
        </div>
      </div>
    </div>
  );
}
