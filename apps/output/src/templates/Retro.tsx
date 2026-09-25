import { useEffect, useState } from "react";
import type { RetroData } from "@newsroller/shared";
import { Chrome } from "./Chrome";
import { IS_VERTICAL } from "../lib/orientation";
import { useForcePlay } from "../lib/autoplay";

const WANT_AUDIO = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("audio");
const EXIT_MS = 900;

// Tamaño máximo de la imagen/video dentro del marco (sin contar el borde crema), según orientación.
const MAX_W = IS_VERTICAL ? 900 : 720;
const MAX_H = IS_VERTICAL ? 720 : 700;

// Placa Retro: un programa (o afiche/tapa) viejo. A la izquierda la imagen o el video, en un marco tipo copia
// impresa con un giro leve; a la derecha una ficha de vidrio oscuro con año grande + etiqueta, título,
// subtítulo y descripción. Fondo azul petróleo con líneas de barrido y barras de color arriba.
// Entrada: la imagen gira desde la izquierda y la ficha viene de la derecha. Salida estándar (baja detrás del ticker).
export function Retro({ data, durationSec }: { data: RetroData; durationSec?: number }) {
  const [play, setPlay] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null); // tamaño natural de la media
  const videoRef = useForcePlay<HTMLVideoElement>();

  useEffect(() => {
    const id = requestAnimationFrame(() => setPlay(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (!durationSec) return;
    const t = setTimeout(() => setExiting(true), Math.max(1000, durationSec * 1000 - EXIT_MS - 50));
    return () => clearTimeout(t);
  }, [durationSec]);
  useEffect(() => { setSize(null); }, [data.media_url]);

  // La media se ajusta a la caja máxima sin deformarse (crece o achica hasta llenarla).
  const fit = size ? Math.min(MAX_W / size.w, MAX_H / size.h) : 1;
  const mediaStyle = size ? { width: Math.round(size.w * fit), height: Math.round(size.h * fit) } : { width: MAX_W, height: Math.round(MAX_W * 0.75), visibility: "hidden" as const };

  const chip = data.chip === undefined ? "PROGRAMA" : data.chip.trim();
  const year = data.year?.trim();

  return (
    <div className={"rt" + (play ? " play" : "") + (exiting ? " exit" : "") + (IS_VERTICAL ? " v" : "")} style={{ position: "absolute", inset: 0 }}>
      <style>{CSS + (IS_VERTICAL ? CSS_V : "")}</style>
      <div className="rt-bg" />
      <div className="rt-bars">
        {["#c8c8c8", "#c9c229", "#2bb3b3", "#3cb04a", "#b93fb0", "#c8382f", "#2f45c9"].map((c) => <i key={c} style={{ background: c }} />)}
      </div>
      <Chrome />

      <div className="rt-body">
        <div className="rt-img">
          <div className="rt-print fx-print">
            {data.media_kind === "video" ? (
              <video
                key={data.media_url} ref={videoRef} src={data.media_url} autoPlay muted={!WANT_AUDIO} loop playsInline
                className="rt-media" style={mediaStyle}
                onLoadedMetadata={(e) => setSize({ w: e.currentTarget.videoWidth || 4, h: e.currentTarget.videoHeight || 3 })}
              />
            ) : (
              <img
                key={data.media_url} src={data.media_url} alt="" className="rt-media" style={mediaStyle}
                onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth || 4, h: e.currentTarget.naturalHeight || 3 })}
              />
            )}
          </div>
        </div>

        <div className="rt-info fx-right">
          {(year || chip) && (
            <div className="rt-headrow fx-rise">
              {year && <div className={"rt-year" + (year.length > 5 ? " long" : "")}>{year}</div>}
              {chip && <div className="rt-chip">{chip}</div>}
            </div>
          )}
          <h2 className="rt-title fx-rise">{data.title}</h2>
          {data.subtitle && <div className="rt-sub fx-rise">{data.subtitle}</div>}
          {data.text && <div className="rt-text fx-rise">{data.text}</div>}
        </div>
      </div>
    </div>
  );
}

const CSS_V = `
.rt.v .rt-body{left:50px;top:150px;width:980px;height:1630px;flex-direction:column;align-items:stretch;gap:26px}
.rt.v .rt-img{width:auto;height:auto;flex:1;min-height:0}
.rt.v .rt-info{width:auto;flex:none;max-height:none;padding:40px 44px;gap:20px}
.rt.v .rt-year{font-size:150px}.rt.v .rt-year.long{font-size:96px}
.rt.v .rt-chip{font-size:28px}
.rt.v .rt-title{font-size:80px}
.rt.v .rt-sub{font-size:36px}
.rt.v .rt-text{font-size:38px}
`;

const CSS = `
.rt{font-family:Inter,system-ui,sans-serif;color:#fff}
.rt-bg{position:absolute;inset:0;background:radial-gradient(ellipse at 28% 45%,#25405c 0%,#152233 55%,#0c141f 100%)}
.rt-bg::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.028) 0 2px,transparent 2px 4px)}
.rt-bars{position:absolute;left:0;right:0;top:0;height:18px;display:flex;z-index:5}
.rt-bars i{flex:1}
.rt-body{position:absolute;left:100px;top:118px;width:1420px;height:830px;display:flex;align-items:center;gap:36px}
.rt-img{width:800px;height:830px;flex:none;display:flex;align-items:center;justify-content:center}
.rt-print{background:#f1ead9;padding:18px;box-shadow:0 30px 60px -10px rgba(0,0,0,.65);transform:rotate(-1.4deg)}
.rt-media{display:block;background:#1a2a44;object-fit:cover}
.rt-info{flex:none;width:584px;max-height:830px;padding:38px 40px;display:flex;flex-direction:column;gap:18px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.13);border-radius:32px;box-shadow:0 30px 60px -30px rgba(0,0,0,.6);overflow:hidden}
.rt-headrow{display:flex;flex-wrap:wrap;align-items:center;gap:10px 22px}
.rt-chip{background:#f2b632;color:#1a1208;font-weight:800;font-size:24px;letter-spacing:.14em;padding:7px 18px;border-radius:8px}
.rt-year{font-family:"Alfa Slab One",Georgia,serif;font-size:128px;line-height:.95;color:#f2b632;text-shadow:4px 4px 0 rgba(194,67,43,.9);letter-spacing:.01em}
.rt-year.long{font-size:84px}
.rt-title{margin:0;font-weight:900;font-size:68px;line-height:1.02;color:#f7f1e1;letter-spacing:-.02em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rt-sub{font-weight:500;font-size:31px;color:#b7c4d8;line-height:1.15;margin-top:-6px}
.rt-text{font-size:32px;line-height:1.36;color:#d3dbe8;font-weight:500;display:-webkit-box;-webkit-line-clamp:9;-webkit-box-orient:vertical;overflow:hidden}

/* Entrada en cascada. Salida estándar: todo baja junto y desaparece detrás del ticker (el marco no se anima). */
.rt:not(.play) [class*="fx-"]{opacity:0}
.rt.play .fx-print{animation:rt-print .95s cubic-bezier(.2,.8,.2,1) both}
.rt.play .fx-right{animation:rt-right .8s cubic-bezier(.2,.8,.2,1) both;animation-delay:.2s}
.rt.play .fx-rise{animation:rt-rise .7s cubic-bezier(.2,.8,.2,1) both;animation-delay:var(--d,0s)}
.rt-headrow{--d:.5s}.rt-title{--d:.6s}.rt-sub{--d:.68s}.rt-text{--d:.76s}
@keyframes rt-print{from{opacity:0;transform:translateX(-160px) rotate(-7deg)}to{opacity:1;transform:rotate(-1.4deg)}}
@keyframes rt-right{from{opacity:0;transform:translateX(80px)}to{opacity:1;transform:none}}
@keyframes rt-rise{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}
@keyframes rt-exit{to{opacity:0;transform:translateY(430px)}}
.rt.exit .rt-body{animation:rt-exit .9s cubic-bezier(.55,0,.9,.45) both}
`;
