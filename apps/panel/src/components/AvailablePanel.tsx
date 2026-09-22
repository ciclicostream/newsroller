import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check, LayoutGrid, Inbox, MonitorPlay } from "lucide-react";
import type { Camera, ContentItem, PlaylistItem } from "@newsroller/shared";
import { CAT, CAT_ICON, CAT_ORDER, TYPE_LABEL, catOf, iconOf, itemText, SESSION_ICON, SESSION_COLOR } from "../lib/contentCatalog";
import type { SessionRow } from "../lib/sessions";

// "Contenidos disponibles": filtro (Todos/Sin asignar/categoría), lista arrastrable y vista expandida
// con botón de Monitor. Lo usan Programación (Emisión) y el editor de Sesiones, con el mismo código,
// para que se vean y funcionen exactamente igual en las dos. `sessions` es opcional: sólo Emisión las
// ofrece como contenido (una Sesión no puede contener a otra, así que el editor de Sesiones no las pasa).
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
  const disponibles = items.filter((c) => c.in_parrilla !== false && (filter === "all" || (filter === "sin" ? countIn(c.id) === 0 : catOf(c.type) === filter)));
  // Sólo las que se ofrecen como contenido (independiente de si están en vivo en su propio link).
  const availableSessions = sessions?.filter((s) => s.in_parrilla !== false) ?? [];
  const showSessions = !!sessions && (filter === "all" || filter === "sesion");
  const catList = sessions ? CAT_ORDER : CAT_ORDER.filter((k) => k !== "sesion");

  // Cantidades por categoría (respetan "disponible", igual que antes).
  const catCount = useMemo(() => {
    const inDraft = new Set(draft.map((r) => r.content_id));
    const by: Record<string, number> = { all: 0, sin: 0, sesion: availableSessions.length };
    for (const c of items) {
      if (c.in_parrilla === false) continue;
      const k = catOf(c.type); by[k] = (by[k] || 0) + 1; by.all++;
      if (!inDraft.has(c.id)) by.sin++;
    }
    by.all += availableSessions.length;
    return by;
  }, [draft, items, availableSessions]); // eslint-disable-line react-hooks/exhaustive-deps

  const txt = (ci: ContentItem) => itemText(ci, { cams: camById, yt: ytTitles });

  return (
    <div className="pv-card pv-disp">
      <div className="pv-ct">Contenidos disponibles</div>
      <div className="pv-filters">
        <div className="pv-dd" ref={ddRef}>
          <button className={"pv-ddb" + (filter !== "all" ? " on" : "")} onClick={() => setDdOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={ddOpen}>
            {(() => { const I = filter === "all" ? LayoutGrid : filter === "sin" ? Inbox : CAT_ICON[filter]; return <I size={14} color={filter === "all" || filter === "sin" ? undefined : CAT[filter]!.color} />; })()}
            <span className="pv-ddl">{filter === "all" ? "Todos" : filter === "sin" ? "Sin asignar" : CAT[filter]!.label}</span>
            <span className="pv-cn">{catCount[filter] ?? 0}</span>
            <ChevronDown size={14} className={ddOpen ? "pv-up" : ""} />
          </button>
          {ddOpen && (
            <div className="pv-ddm" role="listbox">
              {[["all", "Todos", LayoutGrid, "#5b6678"] as const, ["sin", "Sin asignar", Inbox, "#5b6678"] as const, ...catList.map((k) => [k, CAT[k]!.label, CAT_ICON[k], CAT[k]!.color] as const)].map(([id, lb, I, col], i) => (
                <div key={id} style={{ display: "contents" }}>
                  {i === 2 && <div className="pv-dds" />}
                  <button role="option" aria-selected={filter === id} className={"pv-ddi" + (filter === id ? " sel" : "")} onClick={() => { setFilter(id); setDdOpen(false); }}>
                    <I size={14} color={col} /><span className="pv-ddl">{lb}</span>
                    <span className="pv-cn">{catCount[id] ?? 0}</span>
                    {filter === id && <Check size={14} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="pv-displist">
        {disponibles.length === 0 && !showSessions && <div className="pv-empty">Sin contenidos. Cargá desde "Nuevo contenido".</div>}
        {showSessions && availableSessions.map((s) => (
          <div key={s.id} className="pv-chip" draggable onDragStart={() => onDragStartSession?.(s)}>
            <span className="pv-t">
              <span className="pv-k"><SESSION_ICON size={14} color={SESSION_COLOR} /> Sesión</span>
              <span className="pv-x">{s.name} · {s.item_count} contenido{s.item_count === 1 ? "" : "s"}{!s.active ? " · detenida" : ""}</span>
            </span>
          </div>
        ))}
        {disponibles.map((ci) => {
          const c = CAT[catOf(ci.type)]!; const n = countIn(ci.id); const ex = exp === ci.id; const Ic = iconOf(ci.type);
          return (
            <div key={ci.id} className={"pv-chip" + (n ? " inuse" : "") + (ex ? " exp" : "")}
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
