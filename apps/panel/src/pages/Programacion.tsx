import { useEffect, useMemo, useState } from "react";
import { ChevronUp, ChevronDown, Trash2, Plus, GripVertical } from "lucide-react";
import {
  LAYOUTS,
  DATA_BLOCKS,
  type Asset,
  type ContentType,
  type Placa,
  type PlaylistItem,
  type Short,
  type Template,
} from "@newsroller/shared";
import { playlist } from "../lib/playlist";
import { content } from "../lib/content";
import { templatesApi } from "../lib/templates";

const TYPE_LABEL: Record<ContentType, string> = {
  template: "Plantilla",
  short: "Short",
  placa: "Placa",
  ad: "Publicidad",
  background: "Fondo",
  data: "Dato",
};

export function Programacion() {
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [shorts, setShorts] = useState<Short[]>([]);
  const [placas, setPlacas] = useState<Placa[]>([]);
  const [ads, setAds] = useState<Asset[]>([]);
  const [backgrounds, setBackgrounds] = useState<Asset[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [it, sh, pl, ad, bg, tpl] = await Promise.all([
        playlist.list(),
        content.listShorts(),
        content.listPlacas(),
        content.listAssets("ad"),
        content.listAssets("background"),
        templatesApi.list().catch(() => [] as Template[]), // tolerante si falta la migración 0006
      ]);
      setItems(it);
      setShorts(sh);
      setPlacas(pl);
      setAds(ad);
      setBackgrounds(bg);
      setTemplates(tpl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    }
  }
  useEffect(() => {
    void loadAll();
  }, []);

  function resolve(item: PlaylistItem): { label: string; thumb?: string } {
    switch (item.content_type) {
      case "template": {
        const t = templates.find((x) => x.id === item.content_id);
        return { label: t?.name ?? "(plantilla eliminada)" };
      }
      case "short": {
        const s = shorts.find((x) => x.id === item.content_id);
        return s ? { label: s.custom_title ?? s.title, thumb: s.thumbnail_url ?? undefined } : { label: "(short eliminado)" };
      }
      case "placa": {
        const p = placas.find((x) => x.id === item.content_id);
        return { label: p?.title ?? "(placa eliminada)" };
      }
      case "ad": {
        const a = ads.find((x) => x.id === item.content_id);
        return a ? { label: a.name ?? "publicidad", thumb: a.url } : { label: "(publicidad eliminada)" };
      }
      case "background": {
        const a = backgrounds.find((x) => x.id === item.content_id);
        return a ? { label: a.name ?? "fondo", thumb: a.url } : { label: "(fondo eliminado)" };
      }
      case "data":
        return { label: DATA_BLOCKS.find((d) => d.id === item.content_id)?.label ?? item.content_id ?? "dato" };
    }
  }

  async function move(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= items.length) return;
    const ids = items.map((i) => i.id);
    [ids[idx], ids[next]] = [ids[next]!, ids[idx]!];
    setItems(await playlist.reorder(ids));
  }
  async function patch(id: string, p: Partial<Pick<PlaylistItem, "template" | "duration_sec" | "enabled">>) {
    await playlist.patch(id, p);
    await loadAll();
  }
  async function remove(id: string) {
    await playlist.remove(id);
    await loadAll();
  }

  const totalSec = items.filter((i) => i.enabled).reduce((a, i) => a + i.duration_sec, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Programación</h1>
          <p>El guion del autopilot: bloques en orden, cada uno con su plantilla y duración. Se emite en loop.</p>
        </div>
        <div className="muted-note">
          {items.length} bloques · {totalSec}s por vuelta
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}

      <AddBlock shorts={shorts} placas={placas} ads={ads} backgrounds={backgrounds} templates={templates} onAdded={loadAll} setErr={setErr} />

      <div className="card" style={{ marginTop: 18 }}>
        {items.map((item, idx) => {
          const r = resolve(item);
          const layouts = LAYOUTS.filter((t) => t.appliesTo.includes(item.content_type));
          return (
            <div className={"pl-row" + (item.enabled ? "" : " off")} key={item.id}>
              <div className="pl-order">
                <button className="icon-btn" onClick={() => move(idx, -1)} aria-label="Subir"><ChevronUp size={16} /></button>
                <span>{idx + 1}</span>
                <button className="icon-btn" onClick={() => move(idx, 1)} aria-label="Bajar"><ChevronDown size={16} /></button>
              </div>
              <div className="pl-thumb">
                {r.thumb ? <img src={r.thumb} alt="" /> : <GripVertical size={16} />}
              </div>
              <div className="pl-main">
                <span className="pl-badge">{TYPE_LABEL[item.content_type]}</span>
                <span className="pl-label">{r.label}</span>
              </div>
              {item.content_type === "template" ? (
                <span className="muted-note" style={{ width: 190 }}>plantilla propia</span>
              ) : (
                <select value={item.template} onChange={(e) => patch(item.id, { template: e.target.value })} style={{ width: 190 }}>
                  {layouts.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              )}
              <div className="pl-dur">
                <input
                  type="number"
                  min={1}
                  value={item.duration_sec}
                  onChange={(e) => patch(item.id, { duration_sec: Math.max(1, +e.target.value) })}
                  style={{ width: 64 }}
                />
                <span className="muted-note">seg</span>
              </div>
              <button className={"toggle-pill" + (item.enabled ? " on" : "")} onClick={() => patch(item.id, { enabled: !item.enabled })}>
                {item.enabled && <span className="live-dot" />}
                {item.enabled ? "Activo" : "Pausado"}
              </button>
              <button className="icon-btn" onClick={() => remove(item.id)} aria-label="Quitar"><Trash2 size={16} /></button>
            </div>
          );
        })}
        {items.length === 0 && <div className="muted-note" style={{ padding: 18 }}>La programación está vacía. Agregá el primer bloque arriba.</div>}
      </div>
    </>
  );
}

function AddBlock({
  shorts,
  placas,
  ads,
  backgrounds,
  templates,
  onAdded,
  setErr,
}: {
  shorts: Short[];
  placas: Placa[];
  ads: Asset[];
  backgrounds: Asset[];
  templates: Template[];
  onAdded: () => Promise<void>;
  setErr: (s: string | null) => void;
}) {
  const [type, setType] = useState<ContentType>("template");
  const [contentId, setContentId] = useState<string>("");
  const [template, setTemplate] = useState<string>("");

  const options = useMemo(() => {
    switch (type) {
      case "template": return templates.map((t) => ({ id: t.id, label: t.name }));
      case "short": return shorts.map((s) => ({ id: s.id, label: s.custom_title ?? s.title }));
      case "placa": return placas.map((p) => ({ id: p.id, label: p.title }));
      case "ad": return ads.map((a) => ({ id: a.id, label: a.name ?? "publicidad" }));
      case "background": return backgrounds.map((a) => ({ id: a.id, label: a.name ?? "fondo" }));
      case "data": return DATA_BLOCKS.map((d) => ({ id: d.id, label: d.label }));
    }
  }, [type, shorts, placas, ads, backgrounds, templates]);

  const layouts = LAYOUTS.filter((t) => t.appliesTo.includes(type));
  const [duration, setDuration] = useState(8);

  // Mantener una selección válida cuando cambian las opciones (incluye la carga async).
  useEffect(() => {
    setContentId((cur) => (options.some((o) => o.id === cur) ? cur : options[0]?.id ?? ""));
  }, [options]);
  // Al cambiar de tipo, fijar el layout por defecto.
  useEffect(() => {
    setTemplate(layouts[0]?.id ?? "custom");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  async function add() {
    setErr(null);
    if (!contentId) return setErr(`No hay ${TYPE_LABEL[type].toLowerCase()} disponible para agregar.`);
    const tmpl = type === "template" ? "custom" : template;
    if (!tmpl) return setErr("Elegí una plantilla.");
    try {
      await playlist.add({ content_type: type, content_id: contentId, template: tmpl, duration_sec: duration });
      await onAdded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error al agregar");
    }
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div style={{ minWidth: 130 }}>
          <label>Contenido</label>
          <select value={type} onChange={(e) => setType(e.target.value as ContentType)}>
            {(["template", "short", "placa", "ad", "background", "data"] as ContentType[]).map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label>Elemento</label>
          <select value={contentId} onChange={(e) => setContentId(e.target.value)}>
            {options.length === 0 && <option value="">(no hay)</option>}
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
        {type !== "template" && (
          <div style={{ minWidth: 190 }}>
            <label>Layout</label>
            <select value={template} onChange={(e) => setTemplate(e.target.value)}>
              {layouts.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
        )}
        <div style={{ width: 90 }}>
          <label>Duración</label>
          <input type="number" min={1} value={duration} onChange={(e) => setDuration(Math.max(1, +e.target.value))} />
        </div>
        <button className="btn primary" onClick={add}><Plus size={16} /> Agregar</button>
      </div>
    </div>
  );
}
