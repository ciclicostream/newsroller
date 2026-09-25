import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Construction, Trash2 } from "lucide-react";
import type { ContentItem } from "@newsroller/shared";
import { TIPOS, TIPO_BY_KEY, CARD_OF } from "../lib/tipos";
import { contentItems } from "../lib/content-items";
import { parrilla } from "../lib/parrilla";
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
import { InformePlaca } from "./InformePlaca";
import { ListaPlaca } from "./ListaPlaca";
import { RetroPlaca } from "./RetroPlaca";
import { PublicidadPlaca } from "./PublicidadPlaca";
import { PromosPlaca } from "./PromosPlaca";

// Nombres cortos para el submenú (el resto usa el label del catálogo).
const MENU_LABEL: Record<string, string> = { declaraciones: "Textual", publicidad: "Publis" };

// Plantilla mostrada por defecto al entrar a Contenido.
const DEFAULT_TYPE = "placas";

// Submenú horizontal con todas las plantillas (y la papelera). Lo usan Contenido y la Papelera.
export function ContenidoNav({ active }: { active: string }) {
  // Cantidad de contenidos en la papelera (para el chip).
  const [trashCount, setTrashCount] = useState(0);
  useEffect(() => { contentItems.trash().then((l) => setTrashCount(l.length)).catch(() => {}); }, []);

  // Tipos de plantilla que tienen contenido en la PARRILLA (borrador que se edita en
  // Programación). Se refresca cada tanto y al volver a la pestaña.
  const [inGrid, setInGrid] = useState<Set<string>>(new Set());
  useEffect(() => {
    let on = true;
    const load = () =>
      Promise.all([parrilla.list(), contentItems.list()])
        .then(([rows, items]) => {
          if (!on) return;
          // Sólo cuentan los contenidos que siguen disponibles (interruptor "En parrilla" activo).
          const typeOf = new Map(items.filter((c) => c.in_parrilla !== false).map((c) => [c.id, c.type]));
          const set = new Set<string>();
          for (const r of rows) {
            const t = r.content_type === "content_item" && r.content_id ? typeOf.get(r.content_id) : null;
            if (t) set.add(t);
          }
          setInGrid(set);
        })
        .catch(() => {});
    load();
    const iv = setInterval(load, 10_000);
    window.addEventListener("focus", load);
    return () => { on = false; clearInterval(iv); window.removeEventListener("focus", load); };
  }, []);

  return (
      <nav className="tpl-subnav" aria-label="Plantillas">
        {TIPOS.filter((t) => !t.hidden).map((t) => {
          // Una card puede reunir varios tipos (Informes: Carrusel y Lista; Efemérides: Efemérides y Retro):
          // se ilumina si cualquiera de ellos está en la parrilla o en edición.
          const kids = Object.keys(CARD_OF).filter((k) => CARD_OF[k] === t.type);
          const air = inGrid.has(t.type) || kids.some((k) => inGrid.has(k));
          return (
            <Link
              key={t.type}
              to={`/contenido/${t.type}`}
              className={"tpl-chip" + (t.type === active || CARD_OF[active] === t.type ? " active" : "") + (air ? " on-air" : "")}
              title={t.desc}
            >
              <span className="tpl-chip-ic"><t.Icon size={16} /></span>
              <span className="tpl-chip-lbl">{(MENU_LABEL[t.type] ?? t.label).split(" ").filter((w) => w !== "/").map((w) => <span key={w}>{w}</span>)}</span>
            </Link>
          );
        })}
        {/* Papelera (30 días) */}
        <Link to="/contenido/papelera" className={"tpl-chip trash" + (active === "papelera" ? " active" : "")} title="Contenidos borrados: se conservan 30 días">
          <span className="tpl-chip-ic"><Trash2 size={16} /></span>
          <span className="tpl-chip-lbl"><span>Papelera</span>{trashCount ? <span>({trashCount})</span> : null}</span>
        </Link>
      </nav>
  );
}

export function NuevoContenido() {
  const { type: param } = useParams();
  const type = param ?? DEFAULT_TYPE;

  return (
    <>
      <ContenidoNav active={type} />

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
  if (type === "informe") return <InformePlaca />;
  if (type === "lista") return <ListaPlaca />;
  if (type === "retro") return <RetroPlaca />;
  if (type === "publicidad") return <PublicidadPlaca />;
  if (type === "promos") return <PromosPlaca />;
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
    if (!confirm("¿Enviar este contenido a la papelera?")) return;
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
