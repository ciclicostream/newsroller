import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import type { ContentItem, PlaylistItem } from "@newsroller/shared";
import { contentItems } from "../lib/content-items";
import { playlist } from "../lib/playlist";
import { OUTPUT_FRAME_BASE } from "../lib/parrilla";
import { TIPO_BY_KEY } from "../lib/tipos";

function titleOf(it: ContentItem): string {
  const d = it.data ?? {};
  return (d.text as string) || (d.title as string) || (d.cita as string) || `Contenido ${it.id.slice(0, 6)}`;
}

export function PlantillaContenidos() {
  const { type = "" } = useParams();
  const def = TIPO_BY_KEY[type];
  const [items, setItems] = useState<ContentItem[]>([]);
  const [live, setLive] = useState<PlaylistItem[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = () =>
    Promise.all([contentItems.list(type), playlist.list()])
      .then(([its, pl]) => { setItems(its); setLive(pl); })
      .catch((e) => setErr(e.message));
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [type]);

  const aireIds = new Set(live.filter((p) => p.content_type === "content_item").map((p) => p.content_id));

  async function toggle(it: ContentItem, key: "active" | "in_parrilla") {
    await contentItems.patch(it.id, { [key]: !it[key] } as any);
    await load();
  }
  async function remove(it: ContentItem) {
    if (!confirm("¿Enviar este contenido a la papelera?")) return;
    await contentItems.remove(it.id);
    await load();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{def?.label ?? type}</h1>
          <p>Contenidos que usaron esta plantilla. Para crear uno nuevo andá a Nuevo Contenido.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Link to="/plantillas" className="btn"><ArrowLeft size={16} /> Plantillas</Link>
          <Link to={`/contenido/${type}`} className="btn primary"><Plus size={16} /> Agregar contenido</Link>
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}

      {items.length === 0 ? (
        <div className="card" style={{ padding: 22, textAlign: "center" }}>
          <div className="muted-note">Todavía no hay contenidos generados con esta plantilla.</div>
        </div>
      ) : (
        <div className="prev-grid">
          {items.map((it) => {
            const onAir = aireIds.has(it.id);
            return (
              <div className={"prev-card" + (onAir ? " on-air" : "")} key={it.id}>
                <div className="prev-frame">
                  <iframe
                    src={`${OUTPUT_FRAME_BASE}/output/?preview=${it.id}`}
                    title={titleOf(it)}
                    scrolling="no"
                    tabIndex={-1}
                  />
                  <div className="prev-mask" />
                  {onAir && <span className="prev-air"><span className="live-dot" /> AL AIRE</span>}
                </div>
                <div className="prev-body">
                  <div className="prev-title" title={titleOf(it)}>{titleOf(it)}</div>
                  <div className="muted-note" style={{ fontSize: 11 }}>
                    {it.duration_sec}s · {new Date(it.created_at).toLocaleDateString("es-AR")}
                  </div>
                  <div className="prev-actions">
                    <button
                      className={"toggle-pill" + (it.in_parrilla ? " on" : "")}
                      onClick={() => toggle(it, "in_parrilla")}
                      title="Disponible en la parrilla"
                    >
                      {it.in_parrilla ? "En parrilla" : "Fuera"}
                    </button>
                    <button
                      className={"toggle-pill" + (it.active ? " on" : "")}
                      onClick={() => toggle(it, "active")}
                      title="Activo"
                    >
                      {it.active && <span className="live-dot" />}
                      {it.active ? "Activo" : "Inactivo"}
                    </button>
                    <button className="icon-btn" onClick={() => remove(it)} aria-label="Eliminar" style={{ marginLeft: "auto" }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
