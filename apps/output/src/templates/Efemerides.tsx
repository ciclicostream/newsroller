import { useEffect, useRef, useState } from "react";
import type { EfemeridesData } from "@newsroller/shared";
import { formatEfemeridesDate } from "@newsroller/shared";
import fondo from "../assets/fondo2.jpg";
import { Chrome } from "./Chrome";
import { useAutoFit } from "../lib/autofit";

const WANT_AUDIO = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("audio");

// Placa Efemérides ("Un día como hoy"): media vertical obligatoria a la izquierda,
// pill fija + fecha + título + cuerpo a la derecha, sobre un panel blanco. Marco
// Chrome. Salida estándar: todo baja junto y desaparece detrás del ticker.
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

  useAutoFit(titleRef, 118, 60, [data.title]);
  useAutoFit(bodyRef, 44, 26, [data.body]);

  const fecha = formatEfemeridesDate(data);

  return (
    <div className={"ef" + (play ? " play" : "") + (exiting ? " exit" : "")} style={{ position: "absolute", inset: 0 }}>
      <style>{CSS}</style>
      <img className="ef-bg" src={fondo} alt="" />
      <Chrome />

      <div className="ef-panel ef-el" />
      <div className="ef-media ef-el">
        {data.media_kind === "video" ? (
          <video src={data.media_url} autoPlay muted={!WANT_AUDIO} loop playsInline />
        ) : (
          <img src={data.media_url} alt="" />
        )}
      </div>
      <div className="ef-pill ef-el">UN DÍA COMO HOY</div>
      <div className="ef-date ef-el">{fecha}</div>
      <div className="ef-title ef-el" ref={titleRef}>{data.title}</div>
      <div className="ef-body ef-el" ref={bodyRef}>{data.body}</div>
    </div>
  );
}

const CSS = `
.ef{font-family:Inter,system-ui,sans-serif}
.ef-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.ef-el{opacity:0}

.ef-panel{position:absolute;left:60px;top:88px;width:1800px;height:820px;z-index:13;
  background:#fff;border-radius:40px;box-shadow:0 18px 40px rgba(0,0,0,.3)}

.ef-media{position:absolute;left:110px;top:150px;width:540px;height:700px;z-index:14;
  border-radius:24px;overflow:hidden;background:#c9ccd2}
.ef-media img,.ef-media video{width:100%;height:100%;object-fit:cover;display:block}

.ef-pill{position:absolute;left:706px;top:182px;z-index:14;background:#3b82f6;color:#fff;font-weight:800;
  font-size:38px;letter-spacing:.02em;padding:14px 34px;border-radius:16px;box-shadow:0 8px 20px rgba(0,0,0,.18)}
.ef-date{position:absolute;left:710px;top:300px;z-index:14;color:#2f80ed;font-weight:800;font-size:44px;letter-spacing:.02em}
.ef-title{position:absolute;left:706px;top:362px;right:120px;z-index:14;color:#0b2b6b;font-weight:800;
  font-size:118px;line-height:.96;letter-spacing:-.01em;max-height:230px;overflow:hidden}
.ef-body{position:absolute;left:710px;top:600px;right:120px;z-index:14;color:#2f80ed;font-weight:600;
  font-size:44px;line-height:1.3;max-height:290px;overflow:hidden;white-space:pre-wrap}

/* Entrada: panel, luego foto desde la izquierda, luego el resto en cascada desde la derecha. */
.ef.play .ef-panel{animation:ef-fade .5s ease .1s forwards}
.ef.play .ef-media{animation:ef-inLeft .6s cubic-bezier(.2,.8,.2,1) .35s forwards}
.ef.play .ef-pill{animation:ef-inRight .5s cubic-bezier(.2,.8,.2,1) .55s forwards}
.ef.play .ef-date{animation:ef-inRight .5s cubic-bezier(.2,.8,.2,1) .68s forwards}
.ef.play .ef-title{animation:ef-inRight .5s cubic-bezier(.2,.8,.2,1) .81s forwards}
.ef.play .ef-body{animation:ef-inRight .5s cubic-bezier(.2,.8,.2,1) .94s forwards}
@keyframes ef-fade{from{opacity:0}to{opacity:1}}
@keyframes ef-inLeft{from{opacity:0;transform:translateX(-100px)}to{opacity:1;transform:translateX(0)}}
@keyframes ef-inRight{from{opacity:0;transform:translateX(70px)}to{opacity:1;transform:translateX(0)}}

/* Salida estándar: todo baja junto y desaparece detrás del ticker (z-index menor que .ck-ticker). */
.ef.exit .ef-panel,.ef.exit .ef-media,.ef.exit .ef-pill,.ef.exit .ef-date,.ef.exit .ef-title,.ef.exit .ef-body{
  transition:transform .8s cubic-bezier(.4,0,.8,.2), opacity .8s ease;
  transform:translateY(260px);opacity:0}
`;
