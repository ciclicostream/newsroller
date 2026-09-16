import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import type { ContentItem, PlaylistItem } from "@newsroller/shared";
import { contentItems } from "../lib/content-items";
import { playlist } from "../lib/playlist";
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
    if (!confirm("¿Eliminar este contenido?")) return;
    await contentItems.remove(it.id);
    await load();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{def?.label ?? type}</h1>
          <p>Contenidos generados con esta plantilla. Para crear uno nuevo andá a Nuevo Contenido.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Link to="/plantillas" className="btn"><ArrowLeft size={16} /> Plantillas</Link>
          <Link to={`/contenido/${type}`} className="btn primary"><Plus size={16} /> Agregar contenido</Link>
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}

      {items.length === 0 ? (
        <div className="card" style={{ padding: 22, textAlign: "center" }}>
          <div className="muted-note" style={{ marginBottom: 12 }}>Todavía no hay contenidos con esta plantilla.</div>
          <Link to={`/contenido/${type}`} className="btn primary" style={{ display: "inline-flex" }}>
            <Plus size={16} /> Crear el primero
          </Link>
        </div>
      ) : (
        <div className="card">
          {items.map((it) => {
            const onAir = aireIds.has(it.id);
            return (
              <div className="placa-item" key={it.id}>
                <div className="placa-main">
                  <div className="placa-title">{titleOf(it)}</div>
                  <div className="placa-body">
                    {it.duration_sec}s · {new Date(it.created_at).toLocaleDateString("es-AR")}
                  </div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  {onAir && <span className="tpl-stat on"><span className="live-dot" /> al aire</span>}
                  <button
                    className={"toggle-pill" + (it.in_parrilla ? " on" : "")}
                    onClick={() => toggle(it, "in_parrilla")}
                    title="Disponible en la parrilla"
                  >
                    {it.in_parrilla ? "En parrilla" : "Fuera de parrilla"}
                  </button>
                  <button
                    className={"toggle-pill" + (it.active ? " on" : "")}
                    onClick={() => toggle(it, "active")}
                    title="Activo"
                  >
                    {it.active && <span className="live-dot" />}
                    {it.active ? "Activo" : "Inactivo"}
                  </button>
                  <button className="icon-btn" onClick={() => remove(it)} aria-label="Eliminar">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
