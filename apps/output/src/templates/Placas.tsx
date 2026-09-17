import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PlacasData } from "@newsroller/shared";
import fondo from "../assets/fondo-placas.jpg";
import { Chrome } from "./Chrome";

const WANT_AUDIO = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("audio");

function renderText(t: string): string {
  const esc = (t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}

// Achica la fuente de un elemento hasta que entre en su alto disponible.
function useAutoFit(ref: React.RefObject<HTMLElement>, base: number, min: number, deps: unknown[]) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let px = base;
    el.style.fontSize = px + "px";
    let guard = 0;
    while (el.scrollHeight > el.clientHeight && px > min && guard++ < 50) {
      px -= 2;
      el.style.fontSize = px + "px";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// Placa de noticia (marco estándar Chrome): volanta + título + foto a la izquierda, cuerpo a la derecha.
export function Placas({ data, durationSec }: { data: PlacasData; durationSec?: number }) {
  const hasMedia = !!data.media_url;
  const [play, setPlay] = useState(false);
  const [exiting, setExiting] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setPlay(true));
    return () => cancelAnimationFrame(id);
  }, []);
  // Salida por fade (card por card) poco antes de que termine la duración.
  useEffect(() => {
    if (!durationSec) return;
    const start = Math.max(1000, durationSec * 1000 - 1600);
    const t = setTimeout(() => setExiting(true), start);
    return () => clearTimeout(t);
  }, [durationSec]);

  useAutoFit(titleRef, 56, 32, [data.title]);
  useAutoFit(bodyRef, 42, 24, [data.body]);

  return (
    <div className={"pl" + (play ? " play" : "") + (exiting ? " exit" : "") + (hasMedia ? " has-media" : "")} style={{ position: "absolute", inset: 0 }}>
      <style>{CSS}</style>

      {/* Fondo + marco estándar persistente (pills, ticker en vivo, QR) */}
      <img className="pl-bg" src={fondo} alt="" />
      <Chrome />

      {/* Contenido (anima in/out) */}
      {data.label && <div className="pl-date pl-card">{data.label.toUpperCase()}</div>}
      <div className="pl-titlecard pl-card">
        <div className="pl-title" ref={titleRef} dangerouslySetInnerHTML={{ __html: renderText(data.title) }} />
      </div>
      {hasMedia && (
        <div className="pl-photo pl-card">
          {data.media_kind === "video" ? (
            <video src={data.media_url!} autoPlay muted={!WANT_AUDIO} loop playsInline />
          ) : (
            <img src={data.media_url!} alt="" />
          )}
        </div>
      )}
      <div className="pl-bodycard pl-card">
        <div className="pl-body" ref={bodyRef} dangerouslySetInnerHTML={{ __html: renderText(data.body ?? "") }} />
      </div>
    </div>
  );
}

const CSS = `
.pl{font-family:Inter,system-ui,sans-serif}
.pl-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}

/* --- Cards de contenido --- */
.pl-date{position:absolute;top:150px;right:1068px;z-index:15;background:#0b1f52;color:#fff;font-weight:800;font-size:34px;letter-spacing:.02em;padding:12px 26px;border-radius:14px;box-shadow:0 8px 20px rgba(0,0,0,.28)}
.pl-titlecard{position:absolute;left:248px;top:232px;width:604px;height:250px;z-index:14;background:#fff;border-radius:22px;box-shadow:0 12px 30px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:flex-end;padding:26px 34px}
.pl:not(.has-media) .pl-titlecard{height:300px}
.pl-title{font-weight:800;color:#1a3aa8;line-height:1.02;text-align:right;width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;overflow:hidden}
.pl-title b{font-weight:900}
.pl-photo{position:absolute;left:248px;top:505px;width:604px;height:397px;z-index:14;background:#c9ccd2;border-radius:22px;overflow:hidden;box-shadow:0 12px 30px rgba(0,0,0,.28)}
.pl-photo img,.pl-photo video{width:100%;height:100%;object-fit:cover;display:block}
.pl-bodycard{position:absolute;left:884px;top:175px;width:736px;height:727px;z-index:14;background:#fff;border-radius:22px;box-shadow:0 12px 30px rgba(0,0,0,.28);padding:44px 48px}
.pl-body{color:#101317;font-weight:500;line-height:1.24;white-space:pre-wrap;width:100%;height:100%;overflow:hidden}
.pl-body b{font-weight:800}

/* --- Entrada: card por card, de afuera hacia adentro --- */
.pl-card{opacity:0}
.pl.play .pl-date{animation:pl-inLeft .6s cubic-bezier(.2,.8,.2,1) .15s forwards}
.pl.play .pl-titlecard{animation:pl-inLeft .6s cubic-bezier(.2,.8,.2,1) .30s forwards}
.pl.play .pl-photo{animation:pl-inLeft .6s cubic-bezier(.2,.8,.2,1) .45s forwards}
.pl.play .pl-bodycard{animation:pl-inRight .6s cubic-bezier(.2,.8,.2,1) .60s forwards}
@keyframes pl-inLeft{from{opacity:0;transform:translateX(-140px)}to{opacity:1;transform:translateX(0)}}
@keyframes pl-inRight{from{opacity:0;transform:translateX(160px)}to{opacity:1;transform:translateX(0)}}

/* --- Salida: fade una a una (más lenta) --- */
.pl.exit .pl-date{animation:pl-out .8s ease 0s forwards}
.pl.exit .pl-titlecard{animation:pl-out .8s ease .18s forwards}
.pl.exit .pl-photo{animation:pl-out .8s ease .36s forwards}
.pl.exit .pl-bodycard{animation:pl-out .8s ease .54s forwards}
@keyframes pl-out{from{opacity:1}to{opacity:0}}
`;
