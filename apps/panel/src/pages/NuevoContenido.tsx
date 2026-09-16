import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Construction, Trash2 } from "lucide-react";
import type { ContentItem } from "@newsroller/shared";
import { TIPOS, TIPO_BY_KEY } from "../lib/tipos";
import { contentItems } from "../lib/content-items";
import { UltimaHora } from "./UltimaHora";

export function NuevoContenido() {
  const { type } = useParams();

  // Hub: elegir tipo de placa
  if (!type) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Nuevo contenido</h1>
            <p>Elegí una plantilla para cargar sus datos. Cada una acepta información distinta.</p>
          </div>
        </div>
        <div className="tipo-grid">
          {TIPOS.map((t) => (
            <Link key={t.type} to={`/contenido/${t.type}`} className="tipo-card">
              <span className="tipo-ic"><t.Icon size={22} /></span>
              <span className="tipo-main">
                <span className="tipo-name">{t.label}{!t.ready && <span className="tipo-soon">pronto</span>}</span>
                <span className="tipo-desc">{t.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </>
    );
  }

  // Última Hora: formulario real
  if (type === "ultima_hora") return <UltimaHora />;

  // Resto: placeholder + listado de lo ya cargado
  const def = TIPO_BY_KEY[type];
  return <TipoEnConstruccion type={type} label={def?.label ?? type} />;
}

function TipoEnConstruccion({ type, label }: { type: string; label: string }) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = () => contentItems.list(type).then(setItems).catch((e) => setErr(e.message));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  async function remove(id: string) {
    if (!confirm("¿Eliminar este contenido?")) return;
    await contentItems.remove(id);
    await load();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{label}</h1>
          <p>Cargá los datos de esta placa y administrá los contenidos guardados.</p>
        </div>
        <Link to="/contenido" className="btn">← Todas las plantillas</Link>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 18 }}>
        <div className="muted-note" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Construction size={16} /> Formulario en construcción — lo diseñamos en el próximo paso.
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}
      {items.length > 0 && (
        <div className="card">
          {items.map((it) => (
            <div className="placa-item" key={it.id}>
              <div className="placa-main">
                <div className="placa-title">{(it.data?.text as string) || (it.data?.title as string) || `#${it.id.slice(0, 6)}`}</div>
                <div className="placa-body">{it.duration_sec}s · {it.in_parrilla ? "en parrilla" : "fuera de parrilla"}</div>
              </div>
              <button className="icon-btn" onClick={() => remove(it.id)} aria-label="Eliminar">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
