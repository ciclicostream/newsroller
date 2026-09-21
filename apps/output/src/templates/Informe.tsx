import { useEffect, useState } from "react";
import type { InformeData } from "@newsroller/shared";
import fondo from "../assets/fondo2.jpg";
import { Chrome } from "./Chrome";
import { IS_VERTICAL } from "../lib/orientation";

// Placa Informe Cíclico: carrusel de hasta 10 slides (imágenes 4:5) con
// título fijo (pill + card azul) a la izquierda mientras rotan solas.
// Transición: deslizamiento horizontal. Indicador: barra de progreso segmentada.
// Salida estándar: el bloque baja y desaparece detrás del ticker.
export function Informe({ data, durationSec }: { data: InformeData; durationSec?: number }) {
  const [idx, setIdx] = useState(0);
  const [play, setPlay] = useState(false);
  const [exiting, setExiting] = useState(false);
  const secPerSlide = data.sec_per_slide ?? 5;
  const n = data.slides.length;

  useEffect(() => {
    const id = requestAnimationFrame(() => setPlay(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (!durationSec) return;
    const t = setTimeout(() => setExiting(true), Math.max(1000, durationSec * 1000 - 900));
    return () => clearTimeout(t);
  }, [durationSec]);

  useEffect(() => {
    if (n <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % n), secPerSlide * 1000);
    return () => clearInterval(t);
  }, [n, secPerSlide]);

  return (
    <div className={"in" + (play ? " play" : "") + (exiting ? " exit" : "") + (IS_VERTICAL ? " v" : "")} style={{ position: "absolute", inset: 0 }}>
      <style>{CSS + (IS_VERTICAL ? CSS_V : "")}</style>
      <img className="in-bg" src={fondo} alt="" />
      <Chrome />

      <div className="in-pill in-el">INFORME CÍCLICO</div>
      <div className="in-titlecard in-el">{data.title}</div>

      <div className="in-carousel in-el">
        <div className="in-viewport">
          <div className="in-track" style={{ transform: `translateX(-${idx * SLIDE_W}px)` }}>
            {data.slides.map((s, i) => (
              <div className="in-slide" key={i}>
                <img src={s} alt="" />
              </div>
            ))}
          </div>
        </div>
        <div className="in-progress">
          {data.slides.map((_, i) => (
            <div className="in-seg" key={i}>
              <div
                className="in-fill"
                style={i === idx ? { width: "100%", transition: `width ${secPerSlide}s linear` } : { width: i < idx ? "100%" : "0%" }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const SLIDE_W = IS_VERTICAL ? 860 : 620; // ancho de cada slide (4:5)

// Vertical: el carrusel 4:5 grande arriba y el título debajo, a todo el ancho.
const CSS_V = `
.in.v .in-carousel{left:110px;top:160px;width:860px;height:1075px;transform:translateX(0)}
.in.v .in-slide{flex:0 0 860px;height:1075px}
.in.v .in-pill{left:60px;top:1330px}
.in.v .in-titlecard{left:60px;top:1402px;width:960px;min-height:260px;font-size:58px}
`;

const CSS = `
.in{font-family:Inter,system-ui,sans-serif}
.in-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.in-el{opacity:0;transition:opacity .6s ease, transform .6s cubic-bezier(.2,.8,.2,1)}
.in.play .in-el{opacity:1;transform:none}

.in-pill{position:absolute;left:300px;top:576px;background:#fff;color:#0b2b6b;font-weight:800;font-size:38px;
  letter-spacing:.02em;padding:14px 34px;border-radius:14px;box-shadow:0 8px 20px rgba(0,0,0,.18);transform:translateY(20px)}
.in-titlecard{position:absolute;left:300px;top:648px;width:560px;min-height:270px;background:#1e56b3;border-radius:24px;
  box-sizing:border-box;padding:40px 44px;display:flex;align-items:flex-start;color:#fff;font-weight:800;font-size:56px;line-height:1.1;transform:translateY(20px)}
.in-carousel{position:absolute;left:940px;top:110px;width:620px;height:775px;transform:translateX(60px)}
.in-viewport{position:absolute;inset:0;border-radius:20px;overflow:hidden;box-shadow:0 16px 40px rgba(0,0,0,.45)}
.in-track{display:flex;height:100%;will-change:transform;transition:transform .6s cubic-bezier(.4,0,.2,1)}
.in-slide{flex:0 0 620px;height:775px;background:#fff}
.in-slide img{width:100%;height:100%;object-fit:cover;display:block}
.in-progress{position:absolute;left:0;right:0;bottom:-30px;display:flex;gap:8px}
.in-seg{flex:1;height:8px;background:rgba(255,255,255,.28);border-radius:4px;overflow:hidden}
.in-fill{height:100%;width:0;background:#fff;border-radius:4px}

.in.exit .in-el{transition:transform .8s cubic-bezier(.4,0,.8,.2), opacity .8s ease;transform:translateY(260px)!important;opacity:0}
`;
