import { useEffect, useRef, useState } from "react";
import type { CarteleraData } from "@newsroller/shared";
import fondo from "../assets/fondo-cartelera.jpg";
import { Chrome } from "./Chrome";
import { useAutoFit } from "../lib/autofit";

const WANT_AUDIO = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("audio");

// Placa Cartelera ("En cartelera"): foto horizontal + título/autor/elenco a la
// izquierda; pill "EN CARTELERA" + datos del evento a la derecha. Con video
// (opcional, 9:16) la tarjeta derecha crece hacia arriba y oculta hora/temp del
// Chrome (queda liberada la esquina). Salida estándar (baja detrás del ticker).
export function Cartelera({ data, durationSec }: { data: CarteleraData; durationSec?: number }) {
  const hasVideo = !!data.video_url;
  const [play, setPlay] = useState(false);
  const [exiting, setExiting] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setPlay(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (!durationSec) return;
    const t = setTimeout(() => setExiting(true), Math.max(1000, durationSec * 1000 - 900));
    return () => clearTimeout(t);
  }, [durationSec]);

  useAutoFit(titleRef, 34, 20, [data.title]);

  return (
    <div className={"cl" + (play ? " play" : "") + (exiting ? " exit" : "") + (hasVideo ? " has-video" : "")} style={{ position: "absolute", inset: 0 }}>
      <style>{CSS}</style>
      <img className="cl-bg" src={fondo} alt="" />
      <Chrome hideClockTemp={hasVideo} />

      <div className="cl-left cl-el">
        <img className="cl-photo" src={data.photo_url} alt="" />
        <div className="cl-strip">
          <div className="cl-title" ref={titleRef}>{data.title}</div>
          <div className="cl-author">De {data.author}</div>
          <div className="cl-cast">Con: {data.cast}</div>
        </div>
      </div>

      <div className="cl-right">
        {hasVideo && (
          <div className="cl-video">
            <video src={data.video_url!} autoPlay muted={!WANT_AUDIO} loop playsInline />
          </div>
        )}
        <div className="cl-pill">EN CARTELERA</div>
        <div className="cl-data">
          <div className="cl-row"><b>{data.venue}</b></div>
          <div className="cl-row">{data.address}</div>
          <div className="cl-row">{data.city}</div>
          <div className="cl-row">{data.days}</div>
          <div className="cl-row cl-time">{data.time}</div>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.cl{font-family:Inter,system-ui,sans-serif}
.cl-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.cl-el{opacity:0}

/* --- Sin video: header completo, cards por debajo de las pills --- */
.cl-left{position:absolute;left:210px;top:230px;width:820px;height:700px;z-index:14;
  background:#fff;border-radius:26px;box-shadow:0 16px 34px rgba(0,0,0,.28);overflow:hidden;
  display:flex;flex-direction:column}
.cl-photo{width:100%;height:60%;object-fit:cover;display:block}
.cl-strip{flex:1;background:#eaf4fb;padding:26px 36px;display:flex;flex-direction:column;justify-content:center;gap:8px}
.cl-title{color:#0b2b6b;font-weight:800;line-height:1.1}
.cl-author,.cl-cast{color:#1a3aa8;font-weight:600;font-size:20px}

.cl-right{position:absolute;left:1084px;top:230px;width:626px;height:700px;z-index:14;
  background:#fff;border-radius:26px;box-shadow:0 16px 34px rgba(0,0,0,.28);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:32px}
.cl-pill{background:linear-gradient(180deg,#3b82f6,#2f6bff);color:#fff;font-weight:800;font-size:20px;
  letter-spacing:.06em;padding:11px 24px;border-radius:11px;box-shadow:0 8px 18px rgba(0,0,0,.22)}
.cl-data{display:flex;flex-direction:column;gap:8px;text-align:center;color:#10151f;font-weight:600;font-size:22px}
.cl-time{color:#e8542f;font-weight:800}
.cl-video{display:none}

/* --- Con video: header sin hora/temp; cards suben y se agrandan; derecha ~20% más angosta --- */
.cl.has-video .cl-left,.cl.has-video .cl-right{top:88px;height:820px}
.cl.has-video .cl-left{left:170px;width:820px}
.cl.has-video .cl-right{left:1050px;width:500px;justify-content:flex-start;padding-top:26px}
.cl.has-video .cl-video{display:block;width:280px;aspect-ratio:9/16;border-radius:16px;overflow:hidden;
  box-shadow:0 10px 22px rgba(0,0,0,.25);background:#000}
.cl.has-video .cl-video video{width:100%;height:100%;object-fit:cover;display:block}

/* --- Entrada --- */
.cl.play .cl-left{animation:cl-inLeft .6s cubic-bezier(.2,.8,.2,1) .2s forwards}
.cl.play .cl-video{animation:cl-fade .5s ease .45s forwards}
.cl.play .cl-pill{animation:cl-fade .5s ease .6s forwards}
.cl.play .cl-data{animation:cl-inRight .5s cubic-bezier(.2,.8,.2,1) .75s forwards}
@keyframes cl-fade{from{opacity:0}to{opacity:1}}
@keyframes cl-inLeft{from{opacity:0;transform:translateX(-110px)}to{opacity:1;transform:translateX(0)}}
@keyframes cl-inRight{from{opacity:0;transform:translateX(70px)}to{opacity:1;transform:translateX(0)}}

/* --- Salida estándar: todo baja y desaparece detrás del ticker --- */
.cl.exit .cl-left,.cl.exit .cl-right{transition:transform .8s cubic-bezier(.4,0,.8,.2), opacity .8s ease;
  transform:translateY(260px);opacity:0}
`;
