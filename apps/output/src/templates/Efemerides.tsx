import { useEffect, useRef, useState } from "react";
import type { EfemeridesData } from "@newsroller/shared";
import { formatEfemeridesDate } from "@newsroller/shared";
import fondo from "../assets/fondo2.jpg";
import { Chrome } from "./Chrome";
import { useAutoFit } from "../lib/autofit";

const WANT_AUDIO = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("audio");

// Placa Efemérides ("Un día como hoy"): media vertical obligatoria a la izquierda,
// pill fija + fecha + título + cuerpo a la derecha. Marco Chrome. Salida estándar:
// todo baja y desaparece detrás del ticker.
export function Efemerides({ data, durationSec }: { data: EfemeridesData; durationSec?: number }) {
  const [play, setPlay] = useState(false);
  const [exiting, setExiting] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setPlay(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (!durationSec) return;
    const t = setTimeout(() => setExiting(true), Math.max(1000, durationSec * 1000 - 900));
    return () => clearTimeout(t);
  }, [durationSec]);

  useAutoFit(titleRef, 52, 30, [data.title]);
  useAutoFit(bodyRef, 32, 20, [data.body]);

  const fecha = formatEfemeridesDate(data);

  return (
    <div className={"ef" + (play ? " play" : "") + (exiting ? " exit" : "")} style={{ position: "absolute", inset: 0 }}>
      <style>{CSS}</style>
      <img className="ef-bg" src={fondo} alt="" />
      <Chrome />

      <div className="ef-panel ef-el">
        <div className="ef-media ef-el">
          {data.media_kind === "video" ? (
            <video src={data.media_url} autoPlay muted={!WANT_AUDIO} loop playsInline />
          ) : (
            <img src={data.media_url} alt="" />
          )}
        </div>
        <div className="ef-right">
          <div className="ef-pill ef-el">UN DÍA COMO HOY</div>
          <div className="ef-date ef-el">{fecha}</div>
          <div className="ef-title ef-el" ref={titleRef}>{data.title}</div>
          <div className="ef-body ef-el" ref={bodyRef}>{data.body}</div>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.ef{font-family:Inter,system-ui,sans-serif}
.ef-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}

.ef-panel{position:absolute;left:210px;top:230px;width:1500px;height:700px;z-index:14;
  background:#fff;border-radius:28px;box-shadow:0 18px 40px rgba(0,0,0,.3);
  display:flex;gap:0;overflow:hidden}
.ef-media{width:520px;height:100%;flex:none;background:#c9ccd2}
.ef-media img,.ef-media video{width:100%;height:100%;object-fit:cover;display:block}
.ef-right{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:16px;padding:56px 64px;position:relative}

.ef-pill{align-self:flex-start;background:linear-gradient(180deg,#3b82f6,#2f6bff);color:#fff;font-weight:800;
  font-size:20px;letter-spacing:.06em;padding:11px 24px;border-radius:11px;box-shadow:0 8px 18px rgba(0,0,0,.22)}
.ef-date{color:#e8542f;font-weight:800;font-size:24px;letter-spacing:.08em}
.ef-title{color:#0b2b6b;font-weight:800;font-size:52px;line-height:1.08;max-height:160px;overflow:hidden}
.ef-body{color:#1a3aa8;font-weight:500;font-size:32px;line-height:1.32;max-height:280px;overflow:hidden;white-space:pre-wrap}

/* Entrada: panel, luego foto desde la izquierda, luego el resto en cascada desde la derecha. */
.ef-el{opacity:0}
.ef.play .ef-panel{animation:ef-fade .5s ease .1s forwards}
.ef.play .ef-media{animation:ef-inLeft .6s cubic-bezier(.2,.8,.2,1) .35s forwards}
.ef.play .ef-pill{animation:ef-inRight .5s cubic-bezier(.2,.8,.2,1) .55s forwards}
.ef.play .ef-date{animation:ef-inRight .5s cubic-bezier(.2,.8,.2,1) .68s forwards}
.ef.play .ef-title{animation:ef-inRight .5s cubic-bezier(.2,.8,.2,1) .81s forwards}
.ef.play .ef-body{animation:ef-inRight .5s cubic-bezier(.2,.8,.2,1) .94s forwards}
@keyframes ef-fade{from{opacity:0}to{opacity:1}}
@keyframes ef-inLeft{from{opacity:0;transform:translateX(-100px)}to{opacity:1;transform:translateX(0)}}
@keyframes ef-inRight{from{opacity:0;transform:translateX(80px)}to{opacity:1;transform:translateX(0)}}

/* Salida estándar: todo baja y desaparece detrás del ticker (z-index menor que .ck-ticker). */
.ef.exit .ef-panel{transition:transform .8s cubic-bezier(.4,0,.8,.2), opacity .8s ease;
  transform:translateY(260px);opacity:0}
`;
