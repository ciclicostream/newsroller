import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Construction, Trash2 } from "lucide-react";
import type { ContentItem } from "@newsroller/shared";
import { TIPOS, TIPO_BY_KEY } from "../lib/tipos";
import { contentItems } from "../lib/content-items";
import { OUTPUT_BASE } from "../lib/parrilla";
import { UltimaHora } from "./UltimaHora";
import { Placas } from "./Placas";
import { Dolar } from "./Dolar";
import { Cifras } from "./Cifras";
import { Efemerides } from "./Efemerides";
import { Cartelera } from "./Cartelera";
import { Declaraciones } from "./Declaraciones";
import { Clima } from "./Clima";
import { ShortsPlaca } from "./ShortsPlaca";
import { CamarasPlaca } from "./CamarasPlaca";
import { VideoFullPlaca } from "./VideoFullPlaca";

// Plantilla mostrada por defecto al entrar a Contenido.
const DEFAULT_TYPE = "placas";

export function NuevoContenido() {
  const { type: param } = useParams();
  const type = param ?? DEFAULT_TYPE;

  // Tipos de plantilla que tienen contenido AL AIRE ahora (playlist en vivo).
  const [onAir, setOnAir] = useState<Set<string>>(new Set());
  useEffect(() => {
    let on = true;
    const load = () =>
      fetch(`${OUTPUT_BASE}/api/output/scene`)
        .then((r) => r.json())
        .then((s) => {
          if (!on) return;
          const set = new Set<string>();
          for (const it of s?.items ?? []) {
            if (it.content_type === "content_item" && it.item?.type) set.add(it.item.type);
          }
          setOnAir(set);
        })
        .catch(() => {});
    load();
    const iv = setInterval(load, 20_000);
    return () => { on = false; clearInterval(iv); };
  }, []);

  return (
    <>
      {/* Submenú horizontal: todas las plantillas para generar contenido. */}
      <nav className="tpl-subnav" aria-label="Plantillas">
        {TIPOS.map((t) => {
          const air = onAir.has(t.type);
          return (
            <Link
              key={t.type}
              to={`/contenido/${t.type}`}
              className={"tpl-chip" + (t.type === type ? " active" : "") + (air ? " on-air" : "")}
              title={t.desc}
            >
              <span className="tpl-chip-ic"><t.Icon size={16} /></span>
              <span className="tpl-chip-lbl">{t.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Plantilla elegida (por defecto, Placas). */}
      <TemplateForm type={type} />
    </>
  );
}

function TemplateForm({ type }: { type: string }) {
  if (type === "ultima_hora") return <UltimaHora />;
  if (type === "placas") return <Placas />;
  if (type === "dolar") return <Dolar />;
  if (type === "cifras") return <Cifras />;
  if (type === "efemerides") return <Efemerides />;
  if (type === "cartelera") return <Cartelera />;
  if (type === "declaraciones") return <Declaraciones />;
  if (type === "clima") return <Clima />;
  if (type === "shorts") return <ShortsPlaca />;
  if (type === "camaras") return <CamarasPlaca />;
  if (type === "video_full") return <VideoFullPlaca />;
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
