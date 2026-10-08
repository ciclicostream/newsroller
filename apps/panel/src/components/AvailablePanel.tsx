import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, LayoutGrid, MonitorPlay } from "lucide-react";
import type { Camera, ContentItem, PlaylistItem } from "@newsroller/shared";
import { CAT, CAT_ICON, CAT_ORDER, TYPE_LABEL, catOf, catVar, iconOf, itemText, SESSION_ICON } from "../lib/contentCatalog";
import type { SessionRow } from "../lib/sessions";

// "Contenidos disponibles": interruptor Todos / Sin uso, selector de categoría (cada una con su color), lista arrastrable y vista
// expandida con botón de Monitor. Lo usan Programación (Emisión) y el editor de Sesiones, con el mismo código, para que se vean y
// funcionen exactamente igual en las dos. `sessions` es opcional: sólo Emisión las ofrece como contenido (una Sesión no puede
// contener a otra, así que el editor de Sesiones no las pasa). El color de cada fila es el de su categoría, el mismo de la parrilla.
export function AvailablePanel({ items, draft, camById, ytTitles, onDragStart, onDragEnd, onPreviewClip, sessions, onDragStartSession }: {
  items: ContentItem[];
  draft: PlaylistItem[];
  camById: Map<string, Camera>;
  ytTitles: Record<string, string>;
  onDragStart: (ci: ContentItem) => void;
  onDragEnd: () => void;
  onPreviewClip?: (id: string) => void;
  sessions?: SessionRow[];
  onDragStartSession?: (s: SessionRow) => void;
}) {
  const [filter, setFilter] = useState("all");
  const [onlyUnused, setOnlyUnused] = useState(false); // "Sin uso": lo que todavía no está en la parrilla
  const [ddOpen, setDdOpen] = useState(false);
  const [exp, setExp] = useState<string | null>(null);
  const ddRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ddOpen) return;
    const close = (e: MouseEvent) => { if (!ddRef.current?.contains(e.target as Node)) setDdOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setDdOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [ddOpen]);

  const countIn = (id: string) => draft.filter((r) => r.content_id === id).length;
  const disponibles = items.filter((c) => c.in_parrilla !== false && (filter === "all" || catOf(c.type) === filter) && (!onlyUnused || countIn(c.id) === 0));
  // Sólo las que se ofrecen como contenido (independiente de si están en vivo en su propio link).
  const availableSessions = sessions?.filter((s) => s.in_parrilla !== false) ?? [];
  const shownSessions = availableSessions.filter((s) => !onlyUnused || countIn(s.id) === 0);
  const showSessions = !!sessions && (filter === "all" || filter === "sesion");

  // Cantidades: las de cada categoría respetan el interruptor (Todos / Sin uso); los dos totales del interruptor no.
  const catCount = useMemo(() => {
    const inDraft = new Set(draft.map((r) => r.content_id));
    const by: Record<string, number> = { all: 0, sin: 0, sesion: 0 };
    const unusedSessions = availableSessions.filter((x) => !inDraft.has(x.id)).length;
    for (const c of items) {
      if (c.in_parrilla === false) continue;
      by.all++;
      const unused = !inDraft.has(c.id);
      if (unused) by.sin++;
      if (onlyUnused && !unused) continue;
      const k = catOf(c.type); by[k] = (by[k] || 0) + 1; by.cats = (by.cats || 0) + 1;
    }
    by.sesion = onlyUnused ? unusedSessions : availableSessions.length;
    by.cats = (by.cats || 0) + by.sesion;
    by.all += availableSessions.length;
    by.sin += unusedSessions;
    return by;
  }, [draft, items, availableSessions, onlyUnused]); // eslint-disable-line react-hooks/exhaustive-deps

  // Un tipo sin categoría asignada aparece como "Otros" (para que se note).
  const catList = [...(sessions ? CAT_ORDER : CAT_ORDER.filter((k) => k !== "sesion")), ...((catCount.otros ?? 0) > 0 ? ["otros"] : [])];

  const txt = (ci: ContentItem) => itemText(ci, { cams: camById, yt: ytTitles });

  return (
    <div className="pv-card pv-disp">
      <div className="pv-ct">Contenidos disponibles</div>
      <div className="pv-filters">
        <div className="pv-sw" role="group" aria-label="Mostrar">
          <button type="button" className={onlyUnused ? "" : "on"} onClick={() => setOnlyUnused(false)}>Todos<span className="pv-cn">{catCount.all ?? 0}</span></button>
          <button type="button" className={onlyUnused ? "on" : ""} onClick={() => setOnlyUnused(true)} title="Sólo lo que todavía no está en la parrilla">Sin uso<span className="pv-cn">{catCount.sin ?? 0}</span></button>
        </div>
        <div className="pv-dd" ref={ddRef}>
          <button className={"pv-ddb" + (filter !== "all" ? " on" : "")} style={filter !== "all" ? catVar(filter) : undefined} onClick={() => setDdOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={ddOpen}>
            {(() => { const I = filter === "all" ? LayoutGrid : CAT_ICON[filter] ?? CAT[filter]!.Icon; return <I size={14} color={filter === "all" ? undefined : CAT[filter]!.color} />; })()}
            <span className="pv-ddl">{filter === "all" ? "Todas las categorías" : CAT[filter]!.label}</span>
            <span className="pv-cn">{filter === "all" ? catCount.cats ?? 0 : catCount[filter] ?? 0}</span>
            <ChevronDown size={14} className={ddOpen ? "pv-up" : ""} />
          </button>
          {ddOpen && (
            <div className="pv-ddm" role="listbox">
              {[["all", "Todas las categorías", LayoutGrid, "#5b6678"] as const, ...catList.map((k) => [k, CAT[k]!.label, CAT_ICON[k] ?? CAT[k]!.Icon, CAT[k]!.color] as const)].map(([id, lb, I, col], i) => (
                <div key={id} style={{ display: "contents" }}>
                  {i === 1 && <div className="pv-dds" />}
                  <button role="option" aria-selected={filter === id} className={"pv-ddi" + (filter === id ? " sel" : "")} style={id !== "all" ? catVar(id) : undefined} onClick={() => { setFilter(id); setDdOpen(false); }}>
                    <I size={14} color={col} /><span className="pv-ddl">{lb}</span>
                    <span className="pv-cn">{id === "all" ? catCount.cats ?? 0 : catCount[id] ?? 0}</span>
                    {filter === id && <Check size={14} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="pv-displist">
        {disponibles.length === 0 && !(showSessions && shownSessions.length > 0) && <div className="pv-empty">Sin contenidos. Cargá desde "Nuevo contenido".</div>}
        {showSessions && shownSessions.map((s) => (
          <div key={s.id} className="pv-chip pv-tint" style={catVar("sesion")} draggable onDragStart={() => onDragStartSession?.(s)}>
            <span className="pv-t">
              <span className="pv-k"><SESSION_ICON size={14} color={CAT.sesion!.color} /> Sesión</span>
              <span className="pv-x">{s.name} · {s.item_count} contenido{s.item_count === 1 ? "" : "s"}{!s.active ? " · detenida" : ""}</span>
            </span>
          </div>
        ))}
        {disponibles.map((ci) => {
          const c = CAT[catOf(ci.type)]!; const n = countIn(ci.id); const ex = exp === ci.id; const Ic = iconOf(ci.type);
          return (
            <div key={ci.id} className={"pv-chip pv-tint" + (n ? " inuse" : "") + (ex ? " exp" : "")} style={catVar(catOf(ci.type))}
              draggable onDragStart={() => onDragStart(ci)} onDragEnd={onDragEnd}
              onClick={() => setExp(ex ? null : ci.id)}>
              <span className="pv-t">
                <span className="pv-k"><Ic size={14} color={c.color} /> {TYPE_LABEL[ci.type] || ci.type}</span>
                <span className={"pv-x" + (ex ? " full" : "")}>{txt(ci)}</span>
                {ex && onPreviewClip && <button className="pv-monbtn" onClick={(e) => { e.stopPropagation(); onPreviewClip(ci.id); }}><MonitorPlay size={14} /> Monitor</button>}
                {ex && <span className="pv-dr">arrastrá para agregar</span>}
              </span>
              {n > 0 && !ex && <span className="pv-tag">×{n}</span>}
              <span className={"pv-chev" + (ex ? " up" : "")}><ChevronDown size={16} /></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
