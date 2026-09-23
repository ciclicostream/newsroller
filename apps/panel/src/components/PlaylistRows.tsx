import type { RefObject } from "react";
import { AlertTriangle, GripVertical, MonitorPlay, X } from "lucide-react";
import type { ContentItem, PlaylistItem } from "@newsroller/shared";
import { CAT, TYPE_LABEL, catOf, iconOf, itemText, SESSION_ICON, SESSION_COLOR, type TextCtx } from "../lib/contentCatalog";
import type { SessionRow } from "../lib/sessions";

// Lista ordenada de bloques ("Parrilla" en Emisión, "Contenidos de la sesión" en Sesiones): misma fila,
// mismo arrastrar-y-soltar, mismo aviso de contenido retirado en las dos pantallas. `sessionById` es
// opcional: sólo hace falta en Emisión, que es la única que puede tener bloques "sesión".
export function PlaylistRows({
  title, draft, itemById, ctx, sel, ins, rowsRef, sessionById,
  onSelect, onRemove, onDur, onDragStart, onDragEnd, onRowsDragOver, onRowsDragLeave, onRowsDrop, onPreviewClip,
}: {
  title: string;
  draft: PlaylistItem[];
  itemById: Map<string, ContentItem>;
  ctx: TextCtx;
  sel: string | null;
  ins: number | null;
  rowsRef: RefObject<HTMLDivElement>;
  sessionById?: Map<string, SessionRow>;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onDur: (id: string, v: number) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onRowsDragOver: (e: React.DragEvent) => void;
  onRowsDragLeave: (e: React.DragEvent) => void;
  onRowsDrop: (e: React.DragEvent) => void;
  onPreviewClip?: (id: string) => void;
}) {
  const txt = (ci: ContentItem) => itemText(ci, ctx);
  return (
    <div className="pv-card pv-par">
      <div className="pv-ct" style={{ padding: "0 16px 10px" }}>{title}</div>
      <div className="pv-rows" ref={rowsRef} onDragOver={onRowsDragOver} onDragLeave={onRowsDragLeave} onDrop={onRowsDrop}>
        {draft.length === 0 && ins === null && <div className="pv-empty">Arrastrá acá los contenidos disponibles.</div>}
        {draft.map((r, i) => {
          const isSession = r.content_type === "session";
          const sess = isSession ? sessionById?.get(r.content_id ?? "") : undefined;
          const ci = !isSession && r.content_id ? itemById.get(r.content_id) : null;
          const missing = (r.content_type === "content_item" && (!ci || ci.in_parrilla === false)) || (isSession && (!sess || sess.in_parrilla === false));
          const cat = ci ? catOf(ci.type) : "media"; const cc = isSession ? CAT.sesion! : CAT[cat]!;
          const Ic = missing ? AlertTriangle : isSession ? SESSION_ICON : ci ? iconOf(ci.type) : cc.Icon;
          const label = isSession
            ? (sess ? `Sesión · ${sess.name}` : "Sesión eliminada")
            : ci ? txt(ci) : (r.content_type === "content_item" ? "Contenido eliminado" : r.content_type);
          return (
            <div key={r.id} style={{ display: "contents" }}>
              {ins === i && <div className="pv-slot" />}
              <div data-rid={r.id} className={"pv-row" + (r.enabled ? "" : " off") + (sel === r.id ? " sel" : "") + (missing ? " missing" : "")}
                draggable onDragStart={() => onDragStart(r.id)} onDragEnd={onDragEnd}
                onClick={() => onSelect(r.id)}
                title={missing ? "No disponible: se eliminó o se retiró" : isSession ? "Reproduce todos los contenidos de esa Sesión y sigue" : undefined}>
                <GripVertical size={14} className="pv-grip" />
                <span className="pv-badge" style={{ background: missing ? "#EE220C" : isSession ? SESSION_COLOR : cc.color }} title={isSession ? "Sesión" : ci ? TYPE_LABEL[ci.type] : ""}><Ic size={13} color="#fff" /></span>
                <span className="pv-lbl">
                  {label}{missing && !isSession && ci ? " (retirado)" : ""}
                  {isSession && sess && !sess.active ? " (detenida)" : ""}
                  {isSession && sess?.in_parrilla === false ? " (retirada)" : ""}
                </span>
                {isSession ? (
                  <span className="pv-durfixed" title="Dura lo que sume la Sesión">según la sesión</span>
                ) : (
                  <input className="pv-dur" type="number" value={r.duration_sec} onClick={(e) => e.stopPropagation()} onChange={(e) => onDur(r.id, +e.target.value)} />
                )}
                {!isSession && ci && onPreviewClip && (
                  <button className="pv-monrow" title="Ver en el monitor (CLIP)" onClick={(e) => { e.stopPropagation(); onPreviewClip(ci.id); }}><MonitorPlay size={13} /></button>
                )}
                <button className="pv-rmv" onClick={(e) => { e.stopPropagation(); onRemove(r.id); }}><X size={13} /></button>
              </div>
            </div>
          );
        })}
        {ins !== null && ins >= draft.length && <div className="pv-slot" />}
      </div>
    </div>
  );
}
