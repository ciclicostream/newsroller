import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Save, Type, Image as ImageIcon, Film, CloudSun, BarChart3, Hexagon, Zap, Search, Video } from "lucide-react";
import {
  CANVAS_W,
  CANVAS_H,
  DATA_BLOCKS,
  type Camera,
  type ElementType,
  type Template,
  type TemplateElement,
} from "@newsroller/shared";
import { templatesApi } from "../lib/templates";
import { camerasApi } from "../lib/cameras";
import { uploadMedia } from "../lib/content";

const DISPLAY_W = 760;
const SCALE = DISPLAY_W / CANVAS_W;

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

function newElement(type: ElementType, z: number): TemplateElement {
  const common = { id: uid(), type, x: 660, y: 420, w: 600, h: 240, z };
  switch (type) {
    case "text":
      return { ...common, props: { text: "Título", kicker: "", size: 72, weight: 600, color: "#10151f", align: "left", uppercase: false } };
    case "image":
      return { ...common, w: 400, h: 400, props: { src: "", fit: "cover", radius: 16 } };
    case "video":
      return { ...common, w: 405, h: 720, props: { src: "", sourceKind: "short", fit: "cover", radius: 16 } };
    case "weather":
      return { ...common, w: 380, h: 560, props: { city: "Buenos Aires", lat: -34.61, lon: -58.38 } };
    case "data":
      return { ...common, w: 520, h: 220, props: { source: "dolar" } };
    case "logo":
      return { ...common, w: 240, h: 90, props: {} };
    case "shape":
      return { ...common, w: 320, h: 120, props: { shape: "rect", color: "#e8542f", radius: 8 } };
    case "camera":
      return { ...common, w: 900, h: 506, props: { mode: "active", cameraId: null } };
  }
}

export function Plantillas() {
  const [list, setList] = useState<Template[]>([]);
  const [cur, setCur] = useState<Template | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const drag = useRef<null | { mode: "move" | "resize"; id: string; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number }>(null);

  const load = () => templatesApi.list().then(setList).catch((e) => setErr(e.message));
  useEffect(() => {
    void load();
    camerasApi.list().then(setCameras).catch(() => {});
  }, []);

  async function openTpl(id: string) {
    setCur(await templatesApi.get(id));
    setSelId(null);
  }
  async function createTpl(preset?: "ultima-hora") {
    const t = await templatesApi.create(
      preset === "ultima-hora"
        ? {
            name: "Última hora",
            background: { type: "gradient", value: "linear-gradient(135deg,#0f1420,#3a0d0d)" },
            elements: [
              { id: uid(), type: "shape", x: 160, y: 470, w: 90, h: 150, z: 1, props: { shape: "rect", color: "#e8542f", radius: 6 } },
              { id: uid(), type: "text", x: 290, y: 430, w: 1400, h: 260, z: 2, props: { text: "ÚLTIMA HORA", kicker: "", size: 120, weight: 600, color: "#ffffff", align: "left", uppercase: true } },
              { id: uid(), type: "logo", x: 160, y: 120, w: 240, h: 90, z: 3, props: {} },
            ],
          }
        : { name: "Nueva plantilla", background: { type: "gradient", value: "linear-gradient(135deg,#1b3a8f,#0b1f4d)" }, elements: [] },
    );
    await load();
    setCur(t);
    setSelId(null);
  }
  async function removeTpl(id: string) {
    if (!confirm("¿Eliminar esta plantilla?")) return;
    await templatesApi.remove(id);
    if (cur?.id === id) setCur(null);
    await load();
  }

  function patchCur(p: Partial<Template>) {
    setCur((c) => (c ? { ...c, ...p } : c));
  }
  function updateEl(id: string, partial: Partial<TemplateElement>) {
    setCur((c) => (c ? { ...c, elements: c.elements.map((e) => (e.id === id ? { ...e, ...partial } : e)) } : c));
  }
  function updateProps(id: string, pp: Record<string, any>) {
    setCur((c) => (c ? { ...c, elements: c.elements.map((e) => (e.id === id ? { ...e, props: { ...e.props, ...pp } } : e)) } : c));
  }
  function addEl(type: ElementType) {
    if (!cur) return;
    const z = Math.max(0, ...cur.elements.map((e) => e.z)) + 1;
    const el = newElement(type, z);
    patchCur({ elements: [...cur.elements, el] });
    setSelId(el.id);
  }
  function delEl(id: string) {
    if (!cur) return;
    patchCur({ elements: cur.elements.filter((e) => e.id !== id) });
    if (selId === id) setSelId(null);
  }

  // Drag / resize con eventos de puntero.
  function onPointerDownEl(e: React.PointerEvent, el: TemplateElement, mode: "move" | "resize") {
    e.stopPropagation();
    setSelId(el.id);
    drag.current = { mode, id: el.id, sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y, ow: el.w, oh: el.h };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }
  function onPointerMove(e: PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / SCALE;
    const dy = (e.clientY - d.sy) / SCALE;
    if (d.mode === "move") {
      updateEl(d.id, { x: Math.round(d.ox + dx), y: Math.round(d.oy + dy) });
    } else {
      updateEl(d.id, { w: Math.max(40, Math.round(d.ow + dx)), h: Math.max(40, Math.round(d.oh + dy)) });
    }
  }
  function onPointerUp() {
    drag.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  }

  async function save() {
    if (!cur) return;
    setSaving(true);
    setErr(null);
    try {
      await templatesApi.update(cur.id, { name: cur.name, background: cur.background, elements: cur.elements });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error al guardar");
    } finally {
      setSaving(false);
    }
  }

  const sel = cur?.elements.find((e) => e.id === selId) ?? null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Plantillas</h1>
          <p>Diseñá tus placas: fondo + elementos que acomodás a mano. Después las agregás a la Programación.</p>
        </div>
        {cur && (
          <button className="btn primary" onClick={save} disabled={saving}>
            <Save size={16} /> {saving ? "Guardando…" : "Guardar"}
          </button>
        )}
      </div>

      {err && <div className="alert error">{err}</div>}

      <div className="tpl-layout">
        {/* Lista */}
        <div>
          <div className="addbar">
            <button className="btn" onClick={() => createTpl()}><Plus size={14} /> Nueva</button>
            <button className="btn" onClick={() => createTpl("ultima-hora")}><Zap size={14} /> Última hora</button>
          </div>
          <div className="tpl-list card" style={{ padding: 6 }}>
            {list.map((t) => (
              <div key={t.id} className={"tpl-item" + (cur?.id === t.id ? " active" : "")} onClick={() => openTpl(t.id)}>
                {t.name}
                <Trash2 size={14} onClick={(e) => { e.stopPropagation(); removeTpl(t.id); }} />
              </div>
            ))}
            {list.length === 0 && <div className="muted-note" style={{ padding: 10 }}>Sin plantillas.</div>}
          </div>
        </div>

        {/* Lienzo */}
        <div className="canvas-wrap">
          {!cur ? (
            <div className="muted-note" style={{ padding: 40, textAlign: "center" }}>Elegí o creá una plantilla.</div>
          ) : (
            <>
              <div className="addbar">
                <button className="btn" onClick={() => addEl("text")}><Type size={14} /> Texto</button>
                <button className="btn" onClick={() => addEl("image")}><ImageIcon size={14} /> Imagen</button>
                <button className="btn" onClick={() => addEl("video")}><Film size={14} /> Video/Short</button>
                <button className="btn" onClick={() => addEl("weather")}><CloudSun size={14} /> Clima</button>
                <button className="btn" onClick={() => addEl("data")}><BarChart3 size={14} /> Dato</button>
                <button className="btn" onClick={() => addEl("logo")}>Logo</button>
                <button className="btn" onClick={() => addEl("shape")}><Hexagon size={14} /> Forma</button>
                <button className="btn" onClick={() => addEl("camera")}><Video size={14} /> Cámara</button>
              </div>
              <div
                className="canvas"
                style={{ width: DISPLAY_W, height: CANVAS_H * SCALE, background: bgCss(cur.background) }}
                onPointerDown={() => setSelId(null)}
              >
                {[...cur.elements].sort((a, b) => a.z - b.z).map((el) => (
                  <div
                    key={el.id}
                    className={"el" + (selId === el.id ? " sel" : "")}
                    style={{ left: el.x * SCALE, top: el.y * SCALE, width: el.w * SCALE, height: el.h * SCALE, zIndex: el.z }}
                    onPointerDown={(e) => onPointerDownEl(e, el, "move")}
                  >
                    <ElPreview el={el} />
                    {selId === el.id && <div className="handle" onPointerDown={(e) => onPointerDownEl(e, el, "resize")} />}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Propiedades */}
        <div className="card" style={{ padding: 16 }}>
          {!cur ? (
            <div className="muted-note">—</div>
          ) : sel ? (
            <ElementProps
              el={sel}
              cameras={cameras}
              onProps={(pp) => updateProps(sel.id, pp)}
              onEl={(p) => updateEl(sel.id, p)}
              onDelete={() => delEl(sel.id)}
              setErr={setErr}
            />
          ) : (
            <TemplateProps cur={cur} patchCur={patchCur} setErr={setErr} />
          )}
        </div>
      </div>
    </>
  );
}

function bgCss(bg: Template["background"]): string {
  if (bg.type === "image") return `#000 url(${bg.value}) center/cover no-repeat`;
  if (bg.type === "gradient") return bg.value;
  return bg.value || "#ffffff";
}

function ElPreview({ el }: { el: TemplateElement }) {
  const p = el.props;
  if (el.type === "text") {
    return (
      <div style={{ width: "100%", padding: 4 * SCALE, textAlign: p.align, color: p.color, textTransform: p.uppercase ? "uppercase" : "none" }}>
        {p.kicker && <div style={{ fontSize: 26 * SCALE, letterSpacing: ".12em", color: "#e8542f", marginBottom: 6 * SCALE }}>{p.kicker}</div>}
        <div style={{ fontSize: (p.size ?? 64) * SCALE, fontWeight: p.weight ?? 600, lineHeight: 1.05 }}>{p.text}</div>
      </div>
    );
  }
  if (el.type === "image") {
    return p.src ? <img src={p.src} style={{ width: "100%", height: "100%", objectFit: p.fit, borderRadius: (p.radius ?? 0) * SCALE }} /> : <Placeholder label="Imagen" />;
  }
  if (el.type === "video") {
    return <div style={{ width: "100%", height: "100%", background: "#0b0e15", borderRadius: (p.radius ?? 0) * SCALE, color: "#8a94a6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{p.sourceKind === "short" ? "Short 9:16" : "Video"}</div>;
  }
  if (el.type === "weather") {
    return (
      <div style={{ width: "100%", height: "100%", background: "linear-gradient(180deg,#7ec8f0,#efe6c8)", borderRadius: 16 * SCALE, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#0b3a63" }}>
        <div style={{ fontSize: 60 * SCALE, fontWeight: 700 }}>13°</div>
        <div style={{ fontSize: 22 * SCALE, fontWeight: 600 }}>{p.city}</div>
      </div>
    );
  }
  if (el.type === "camera") return <Placeholder label={p.mode === "fixed" ? "Cámara (fija)" : "Cámara activa"} />;
  if (el.type === "data") return <Placeholder label={`Dato: ${DATA_BLOCKS.find((d) => d.id === p.source)?.label ?? p.source}`} />;
  if (el.type === "logo") return <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, letterSpacing: ".06em" }}>CÍCLICO</div>;
  if (el.type === "shape")
    return <div style={{ width: "100%", height: "100%", background: p.color, borderRadius: (p.shape === "line" ? 0 : p.radius ?? 0) * SCALE }} />;
  return null;
}

function Placeholder({ label }: { label: string }) {
  return <div style={{ width: "100%", height: "100%", background: "#f0f2f5", border: "1px dashed #c7ccd3", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7688", fontSize: 12, textAlign: "center", padding: 4 }}>{label}</div>;
}

function TemplateProps({ cur, patchCur, setErr }: { cur: Template; patchCur: (p: Partial<Template>) => void; setErr: (s: string | null) => void }) {
  async function uploadBg(file: File) {
    try {
      const url = await uploadMedia(file, "background");
      patchCur({ background: { type: "image", value: url } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    }
  }
  const bg = cur.background;
  return (
    <div className="props">
      <h3>Plantilla</h3>
      <div className="field">
        <label>Nombre</label>
        <input value={cur.name} onChange={(e) => patchCur({ name: e.target.value })} />
      </div>
      <div className="field">
        <label>Fondo</label>
        <select value={bg.type} onChange={(e) => patchCur({ background: { type: e.target.value as any, value: e.target.value === "color" ? "#0b1f4d" : e.target.value === "gradient" ? "linear-gradient(135deg,#1b3a8f,#0b1f4d)" : "" } })}>
          <option value="gradient">Gradiente</option>
          <option value="color">Color</option>
          <option value="image">Imagen</option>
        </select>
      </div>
      {bg.type === "color" && (
        <div className="field"><label>Color</label><input type="color" value={bg.value} onChange={(e) => patchCur({ background: { type: "color", value: e.target.value } })} style={{ height: 40 }} /></div>
      )}
      {bg.type === "gradient" && (
        <div className="field"><label>CSS del gradiente</label><input value={bg.value} onChange={(e) => patchCur({ background: { type: "gradient", value: e.target.value } })} /></div>
      )}
      {bg.type === "image" && (
        <div className="field"><label>Imagen de fondo</label><input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadBg(e.target.files[0])} />{bg.value && <img src={bg.value} style={{ marginTop: 8, width: "100%", borderRadius: 8 }} />}</div>
      )}
      <div className="muted-note">Tocá un elemento para editarlo, o agregá con la barra de arriba.</div>
    </div>
  );
}

function ElementProps({
  el,
  cameras,
  onProps,
  onEl,
  onDelete,
  setErr,
}: {
  el: TemplateElement;
  cameras: Camera[];
  onProps: (pp: Record<string, any>) => void;
  onEl: (p: Partial<TemplateElement>) => void;
  onDelete: () => void;
  setErr: (s: string | null) => void;
}) {
  const p = el.props;
  const TYPE_LABEL: Record<ElementType, string> = { text: "Texto", image: "Imagen", video: "Video/Short", weather: "Clima", data: "Dato", logo: "Logo", shape: "Forma", camera: "Cámara" };

  async function upload(file: File) {
    try {
      const url = await uploadMedia(file, "ad");
      onProps({ src: url });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    }
  }
  async function geocode(city: string) {
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=es`);
      const d = await r.json();
      const hit = d.results?.[0];
      if (hit) onProps({ city: hit.name, lat: hit.latitude, lon: hit.longitude });
      else setErr("Ciudad no encontrada");
    } catch {
      setErr("No se pudo buscar la ciudad");
    }
  }

  return (
    <div className="props">
      <h3>{TYPE_LABEL[el.type]}</h3>

      {el.type === "text" && (
        <>
          <div className="field"><label>Kicker (opcional)</label><input value={p.kicker ?? ""} onChange={(e) => onProps({ kicker: e.target.value })} /></div>
          <div className="field"><label>Texto</label><textarea value={p.text ?? ""} rows={3} onChange={(e) => onProps({ text: e.target.value })} /></div>
          <div className="field xy"><div><label>Tamaño</label><input type="number" value={p.size ?? 64} onChange={(e) => onProps({ size: +e.target.value })} /></div><div><label>Peso</label><select value={p.weight ?? 600} onChange={(e) => onProps({ weight: +e.target.value })}><option value={400}>Normal</option><option value={600}>Negrita</option></select></div></div>
          <div className="field xy"><div><label>Color</label><input type="color" value={p.color ?? "#10151f"} onChange={(e) => onProps({ color: e.target.value })} style={{ height: 38 }} /></div><div><label>Alineación</label><select value={p.align ?? "left"} onChange={(e) => onProps({ align: e.target.value })}><option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option></select></div></div>
          <label className="switch"><input type="checkbox" checked={!!p.uppercase} onChange={(e) => onProps({ uppercase: e.target.checked })} /> Mayúsculas</label>
        </>
      )}

      {el.type === "image" && (
        <>
          <div className="field"><label>Imagen</label><input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></div>
          <div className="field"><label>Ajuste</label><select value={p.fit ?? "cover"} onChange={(e) => onProps({ fit: e.target.value })}><option value="cover">Cubrir</option><option value="contain">Contener</option></select></div>
          <div className="field"><label>Borde redondeado</label><input type="number" value={p.radius ?? 0} onChange={(e) => onProps({ radius: +e.target.value })} /></div>
        </>
      )}

      {el.type === "video" && (
        <>
          <div className="field"><label>Origen</label><select value={p.sourceKind ?? "short"} onChange={(e) => onProps({ sourceKind: e.target.value })}><option value="short">Short de YouTube (con audio)</option><option value="asset">Video subido</option></select></div>
          {p.sourceKind === "short" ? (
            <div className="field"><label>ID del video de YouTube</label><input value={p.src ?? ""} onChange={(e) => onProps({ src: e.target.value })} placeholder="ej: dQw4w9WgXcQ" /></div>
          ) : (
            <div className="field"><label>Archivo de video</label><input type="file" accept="video/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></div>
          )}
          <div className="field"><label>Ajuste</label><select value={p.fit ?? "cover"} onChange={(e) => onProps({ fit: e.target.value })}><option value="cover">Cubrir</option><option value="contain">Contener (respeta proporción)</option></select></div>
        </>
      )}

      {el.type === "weather" && (
        <div className="field">
          <label>Ciudad</label>
          <div className="row" style={{ gap: 6 }}>
            <input value={p.city ?? ""} onChange={(e) => onProps({ city: e.target.value })} />
            <button className="btn" onClick={() => geocode(p.city)}><Search size={14} /></button>
          </div>
          <div className="muted-note" style={{ marginTop: 6 }}>{p.lat ? `lat ${p.lat}, lon ${p.lon}` : "buscá para fijar la ubicación"}</div>
        </div>
      )}

      {el.type === "data" && (
        <div className="field"><label>Dato</label><select value={p.source ?? "dolar"} onChange={(e) => onProps({ source: e.target.value })}>{DATA_BLOCKS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></div>
      )}

      {el.type === "camera" && (
        <>
          <div className="field"><label>Cámara</label>
            <select value={p.mode ?? "active"} onChange={(e) => onProps({ mode: e.target.value })}>
              <option value="active">La activa (se cambia en Cámaras)</option>
              <option value="fixed">Una fija</option>
            </select>
          </div>
          {p.mode === "fixed" && (
            <div className="field"><label>Elegir cámara</label>
              <select value={p.cameraId ?? ""} onChange={(e) => onProps({ cameraId: e.target.value })}>
                <option value="">(elegí una)</option>
                {cameras.map((c) => <option key={c.id} value={c.id}>{c.name}{c.city ? ` · ${c.city}` : ""}</option>)}
              </select>
            </div>
          )}
        </>
      )}

      {el.type === "shape" && (
        <>
          <div className="field"><label>Forma</label><select value={p.shape ?? "rect"} onChange={(e) => onProps({ shape: e.target.value })}><option value="rect">Rectángulo</option><option value="line">Línea</option></select></div>
          <div className="field"><label>Color</label><input type="color" value={p.color ?? "#e8542f"} onChange={(e) => onProps({ color: e.target.value })} style={{ height: 38 }} /></div>
        </>
      )}

      <div className="field xy">
        <div><label>X</label><input type="number" value={el.x} onChange={(e) => onEl({ x: +e.target.value })} /></div>
        <div><label>Y</label><input type="number" value={el.y} onChange={(e) => onEl({ y: +e.target.value })} /></div>
      </div>
      <div className="field xy">
        <div><label>Ancho</label><input type="number" value={el.w} onChange={(e) => onEl({ w: +e.target.value })} /></div>
        <div><label>Alto</label><input type="number" value={el.h} onChange={(e) => onEl({ h: +e.target.value })} /></div>
      </div>
      <button className="btn danger-ghost" onClick={onDelete} style={{ width: "100%", justifyContent: "center" }}><Trash2 size={15} /> Eliminar elemento</button>
    </div>
  );
}
