import { useEffect, useRef, useState } from "react";
import type { CarteleraData } from "@newsroller/shared";
import fondo from "../assets/fondo-cartelera.jpg";
import { Chrome } from "./Chrome";
import { useAutoFit } from "../lib/autofit";

const WANT_AUDIO = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("audio");

// Placa Cartelera ("En cartelera"): tarjeta blanca izquierda (foto horizontal +
// título en franja celeste + autor + elenco) y tarjeta blanca derecha (pill "EN
// CARTELERA" + datos del evento). Con video (opcional, 9:16): la tarjeta
// izquierda se corre, la derecha crece hacia arriba y se angosta, el video se
// apoya encima de la pill, y el Chrome oculta hora Y temp (queda liberada esa
// esquina). Salida estándar: todo baja detrás del ticker. No genera reporte.
export function Cartelera({ data, durationSec }: { data: CarteleraData; durationSec?: number }) {
  const hasVideo = !!data.video_url;
  const [play, setPlay] = useState(false);
  const [exiting, setExiting] = useState(false);
  const titleRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setPlay(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (!durationSec) return;
    const t = setTimeout(() => setExiting(true), Math.max(1000, durationSec * 1000 - 900));
    return () => clearTimeout(t);
  }, [durationSec]);

  useAutoFit(titleRef, 64, 34, [data.title]);

  return (
    <div className={"cl" + (play ? " play" : "") + (exiting ? " exit" : "") + (hasVideo ? " has-video" : "")} style={{ position: "absolute", inset: 0 }}>
      <style>{CSS}</style>
      <img className="cl-bg" src={fondo} alt="" />
      <Chrome hideClock={hasVideo} hideTemp={hasVideo} />

      <div className="cl-left cl-el">
        <img className="cl-photo" src={data.photo_url} alt="" />
        <div className="cl-obra"><span ref={titleRef}>{data.title}</span></div>
        <div className="cl-autor">De {data.author}</div>
        <div className="cl-elenco">Con: {data.cast}</div>
      </div>

      {hasVideo && (
        <div className="cl-video cl-el">
          <video src={data.video_url!} autoPlay muted={!WANT_AUDIO} loop playsInline />
        </div>
      )}

      <div className="cl-venue cl-el">
        <div className="cl-pill2">EN CARTELERA</div>
        <div className="cl-data">
          <div className="cl-lugar">{data.venue}</div>
          <div className="cl-row">{data.address}</div>
          <div className="cl-row">{data.city}</div>
          <div className="cl-row">{data.days}</div>
          <div className="cl-row">{data.time}</div>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.cl{font-family:Inter,system-ui,sans-serif}
.cl-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.cl-el{opacity:0}

.cl-left{position:absolute;left:60px;top:88px;width:1260px;height:820px;z-index:13;
  background:#fff;border-radius:40px;box-shadow:inset 0 0 40px rgba(0,0,0,.06), 0 16px 34px rgba(0,0,0,.25);
  transform:translateX(-70px)}
.cl.has-video .cl-left{left:100px}
.cl-photo{position:absolute;left:48px;top:40px;width:1164px;height:520px;border-radius:16px;
  object-fit:cover;background:#cfd3da}
.cl-obra{position:absolute;left:48px;top:420px;right:120px}
.cl-obra span{background:#4ea0f5;color:#fff;box-decoration-break:clone;-webkit-box-decoration-break:clone;
  padding:8px 18px;font-weight:800;font-size:64px;line-height:1.5;text-transform:uppercase;letter-spacing:.01em}
.cl-autor{position:absolute;left:52px;top:640px;color:#2f80ed;font-weight:800;font-size:44px;text-transform:uppercase}
.cl-elenco{position:absolute;left:52px;top:698px;right:48px;color:#0b2b6b;font-weight:600;font-size:24px;line-height:1.25}

.cl-video{position:absolute;left:1444px;top:108px;width:281px;height:500px;z-index:15;border-radius:20px;
  overflow:hidden;background:#c9ccd2;box-shadow:0 12px 30px rgba(0,0,0,.35);transform:translateX(70px)}
.cl-video video{width:100%;height:100%;object-fit:cover;display:block}

.cl-venue{position:absolute;left:1400px;top:548px;width:460px;height:360px;z-index:14;background:#fff;
  border-radius:30px;box-sizing:border-box;padding:40px 38px 52px;display:flex;flex-direction:column;
  justify-content:center;gap:16px;color:#0b2b6b;box-shadow:inset 0 0 30px rgba(0,0,0,.05), 0 16px 34px rgba(0,0,0,.25);
  transform:translateX(70px)}
.cl.has-video .cl-venue{top:88px;left:1400px;width:368px;height:820px;justify-content:flex-start;padding:540px 30px 24px}
.cl-pill2{align-self:flex-start;background:#3b82f6;color:#fff;font-weight:800;font-size:28px;letter-spacing:.02em;
  padding:10px 24px;border-radius:14px}
.cl.has-video .cl-pill2{font-size:26px;padding:9px 22px;align-self:center}
.cl-data{display:flex;flex-direction:column;gap:2px}
.cl-lugar{font-weight:800;font-size:32px;line-height:1.04;margin-bottom:8px}
.cl-row{font-weight:600;font-size:26px;line-height:1.2}
.cl.has-video .cl-lugar{font-size:28px}
.cl.has-video .cl-row{font-size:24px}

.cl.play .cl-el{transition:opacity .5s ease, transform .5s cubic-bezier(.2,.8,.2,1);opacity:1;transform:translateX(0)}

/* Salida estándar: todo baja junto y desaparece detrás del ticker. */
.cl.exit .cl-el{transition:transform .8s cubic-bezier(.4,0,.8,.2), opacity .8s ease;
  transform:translateY(260px)!important;opacity:0}
`;
