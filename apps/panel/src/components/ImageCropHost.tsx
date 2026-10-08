import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { MAX_BYTES, MAX_SIDE, cropAndEncode, fmtSize, mergeGuides, mountCropHost, unionAspect, type CropRequest, type Rect } from "../lib/imageCrop";

// Encuadrador de fotos (lo abre uploadMedia). Se arrastra la foto y se acerca/aleja con el control o la rueda;
// lo que queda dentro del marco es lo que se sube, ya liviano (≤ 1 MB). Se monta una sola vez en el Layout.
const ASPECTS: { label: string; v: number | null }[] = [
  { label: "Original", v: null }, { label: "16:9", v: 16 / 9 }, { label: "9:16", v: 9 / 16 }, { label: "4:5", v: 4 / 5 },
  { label: "1:1", v: 1 }, { label: "3:4", v: 3 / 4 }, { label: "2:3", v: 2 / 3 },
];
const LOW_PX = 1000; // por debajo de este lado mayor (en px reales de la foto) se avisa que puede verse borrosa
const PAD = 16; // margen del marco dentro de la zona de trabajo (su tamaño se mide: depende de la pantalla)

export function ImageCropHost() {
  const queue = useRef<CropRequest[]>([]);
  const [req, setReq] = useState<CropRequest | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [aspect, setAspect] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 }); // desplazamiento del centro de la foto respecto del centro del marco (px de pantalla)
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 560, h: 340 });

  // Zona de trabajo: todo el ancho disponible y un alto que deja ver los botones aun en pantallas bajas.
  useLayoutEffect(() => {
    if (!req) return;
    const measure = () => setBox({ w: boxRef.current?.clientWidth || 560, h: Math.round(Math.min(380, Math.max(200, window.innerHeight * 0.94 - 330))) });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [req]);

  const next = useCallback(() => {
    const r = queue.current.shift() ?? null;
    setReq(r); setNat(null); setZoom(1); setOff({ x: 0, y: 0 }); setErr(null); setBusy(false);
    setAspect(r ? r.opts.aspect ?? unionAspect(mergeGuides(r.opts.guides)) : null);
  }, []);

  useEffect(() => {
    const un = mountCropHost();
    const onReq = (e: Event) => {
      queue.current.push((e as CustomEvent<CropRequest>).detail);
      setReq((cur) => { if (!cur) queueMicrotask(next); return cur; });
    };
    window.addEventListener("ciclico:crop", onReq);
    return () => { window.removeEventListener("ciclico:crop", onReq); un(); };
  }, [next]);

  // Vista previa de la foto elegida.
  useEffect(() => {
    if (!req) { setUrl(null); return; }
    const u = URL.createObjectURL(req.file);
    setUrl(u);
    const im = new Image();
    im.onload = () => setNat({ w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => setErr("No se pudo leer la imagen. Usá un JPG, PNG o WebP.");
    im.src = u;
    return () => URL.revokeObjectURL(u);
  }, [req]);

  if (!req) return null;

  // Geometría: el marco (proporción elegida, centrado) y la foto (cubre el marco; `zoom` la acerca).
  const ratio = aspect ?? (nat ? nat.w / nat.h : 16 / 9);
  const fh = Math.min((box.w - PAD * 2) / ratio, box.h - PAD * 2);
  const fw = ratio * fh;
  const base = nat ? Math.max(fw / nat.w, fh / nat.h) : 1;
  const s = base * zoom;
  const clamp = (o: { x: number; y: number }) => {
    if (!nat) return o;
    const mx = Math.max(0, (nat.w * s - fw) / 2), my = Math.max(0, (nat.h * s - fh) / 2);
    return { x: Math.min(mx, Math.max(-mx, o.x)), y: Math.min(my, Math.max(-my, o.y)) };
  };
  const o = clamp(off);

  const rect = (): Rect | null => {
    if (!nat) return null;
    const w = fw / s, h = fh / s;
    return { x: nat.w / 2 - o.x / s - w / 2, y: nat.h / 2 - o.y / s - h / 2, w, h };
  };

  const finish = (f: File | Error) => {
    const r = req;
    if (f instanceof Error) r.reject(f); else r.resolve(f);
    next();
  };
  async function accept() {
    const r = rect();
    if (!r || busy || !req) return;
    setBusy(true); setErr(null);
    try { finish(await cropAndEncode(req.file, r)); }
    catch (e) { setErr(e instanceof Error ? e.message : "No se pudo procesar la imagen."); setBusy(false); }
  }
  // Cancelar corta la subida con un error de mensaje vacío: los formularios muestran el mensaje del error, y vacío no muestra nada.
  const cancel = () => { if (!busy) finish(new Error("")); };

  const pick = (v: number | null) => { setAspect(v); setZoom(1); setOff({ x: 0, y: 0 }); };
  const left = box.w / 2 + o.x - ((nat?.w ?? 0) * s) / 2;
  const top = box.h / 2 + o.y - ((nat?.h ?? 0) * s) / 2;
  // Foto chica para el encuadre elegido: el output no la agranda de verdad, la estira (al aire se vería borrosa).
  const cr = rect();
  const lowRes = !!cr && Math.max(cr.w, cr.h) < LOW_PX;
  const guides = mergeGuides(req.opts.guides);
  const union = unionAspect(guides);
  const aspects = union != null ? [{ label: "Ambas zonas", v: union }, ...ASPECTS.filter((a) => a.v == null || Math.abs(a.v - union) > 0.01)] : ASPECTS;
  const tooBig = req.file.size > MAX_BYTES || (nat ? Math.max(nat.w, nat.h) > MAX_SIDE : false);

  return (
    <div className="modal-back" onClick={cancel} style={{ zIndex: 200 }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620, width: "100%", maxHeight: "94vh" }}>
        <div className="modal-head">
          <b>Encuadrar foto</b>
          <button type="button" className="icon-btn" onClick={cancel} aria-label="Cancelar"><X size={18} /></button>
        </div>
        <div style={{ padding: 16, display: "grid", gap: 12, overflow: "auto" }}>
          <div className="muted-note" style={{ fontSize: 12 }}>
            {req.file.name} · {nat ? `${nat.w}×${nat.h}` : "…"} · {fmtSize(req.file.size)}
            {tooBig ? ` → se guarda de hasta ${MAX_SIDE} px y ${fmtSize(MAX_BYTES)}` : " → ya entra en el límite"}
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {aspects.map((a) => (
              <button key={a.label} type="button" className={"toggle-pill" + ((aspect ?? null) === a.v ? " on" : "")} onClick={() => pick(a.v)} style={{ padding: "4px 10px" }}>{a.label}</button>
            ))}
          </div>

          <div
            ref={boxRef}
            style={{ position: "relative", width: "100%", height: box.h, overflow: "hidden", borderRadius: 10, background: "#10151f", touchAction: "none", cursor: "grab", userSelect: "none" }}
            onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, ox: o.x, oy: o.y }; }}
            onPointerMove={(e) => { const d = drag.current; if (d) setOff(clamp({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y })); }}
            onPointerUp={() => { drag.current = null; }}
            onWheel={(e) => setZoom((z) => Math.min(4, Math.max(1, z - e.deltaY * 0.002)))}
          >
            {url && nat && (
              <img src={url} alt="" draggable={false} style={{ position: "absolute", left, top, width: nat.w * s, height: nat.h * s, maxWidth: "none", pointerEvents: "none" }} />
            )}
            {/* marco: lo de afuera se oscurece */}
            <div style={{ position: "absolute", left: (box.w - fw) / 2, top: (box.h - fh) / 2, width: fw, height: fh, boxShadow: "0 0 0 9999px rgba(8,12,20,.62)", border: "2px solid #fff", borderRadius: 2, pointerEvents: "none" }}>
              {/* zonas donde la plantilla muestra la foto (centradas: lo que sobra se corta) */}
              {guides.map((g, i) => {
                const w = g.aspect >= ratio ? fw : fh * g.aspect, h = g.aspect >= ratio ? fw / g.aspect : fh;
                const col = i === 0 ? "#ffd24a" : "#4ad0ff";
                return (
                  <div key={g.label} style={{ position: "absolute", left: (fw - w) / 2, top: (fh - h) / 2, width: w, height: h, border: `2px dashed ${col}`, boxSizing: "border-box" }}>
                    <span style={{ position: "absolute", left: 4, top: 4, background: col, color: "#10151f", fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 4, whiteSpace: "nowrap" }}>{g.label}</span>
                  </div>
                );
              })}
            </div>
            {!nat && !err && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><Loader2 size={22} className="spin" /></div>}
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
            <span style={{ width: 52 }}>Zoom</span>
            <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ flex: 1 }} />
          </label>
          <div className="muted-note" style={{ fontSize: 12 }}>Arrastrá la foto para encuadrarla. Lo que queda dentro del marco es lo que se sube.{guides.length > 0 && " Las líneas punteadas son lo que se ve en cada versión: poné lo importante dentro de todas."}</div>

          {lowRes && cr && (
            <div className="alert" style={{ margin: 0, background: "#fff7e0", borderColor: "#f0dba0", color: "#7a5b00" }}>
              Con este encuadre la foto queda de {Math.round(cr.w)}×{Math.round(cr.h)} px. Es chica para la pantalla (1920 px de ancho) y puede verse borrosa al aire.
            </div>
          )}
          {err && <div className="alert error" style={{ margin: 0 }}>{err}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" className="btn" onClick={cancel} disabled={busy}>Cancelar</button>
            <button type="button" className="btn primary" onClick={accept} disabled={!nat || busy}>{busy ? "Procesando…" : "Usar esta foto"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
