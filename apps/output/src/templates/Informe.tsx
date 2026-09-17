import { useEffect, useState } from "react";
import type { InformeData } from "@newsroller/shared";
import { Chrome } from "./Chrome";

// Placa Informe Cíclico: carrusel de hasta 10 slides (imágenes 4:5) con
// título fijo (pill + card azul) a la izquierda mientras rotan solas.
// Transición: deslizamiento horizontal. Indicador: barra de progreso segmentada.
export function Informe({ data }: { data: InformeData }) {
  const [idx, setIdx] = useState(0);
  const secPerSlide = data.sec_per_slide ?? 5;
  const n = data.slides.length;

  useEffect(() => {
    if (n <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % n), secPerSlide * 1000);
    return () => clearInterval(t);
  }, [n, secPerSlide]);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <style>{CSS}</style>
      <Chrome />

      <div className="in-pill">INFORME CÍCLICO</div>
      <div className="in-titlecard">{data.title}</div>

      <div className="in-carousel">
        <div className="in-viewport">
          <div className="in-track" style={{ transform: `translateX(-${idx * 620}px)` }}>
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

const CSS = `
.in-pill{position:absolute;left:300px;top:576px;background:#fff;color:#0b2b6b;font-weight:800;font-size:38px;
  letter-spacing:.02em;padding:14px 34px;border-radius:14px;box-shadow:0 8px 20px rgba(0,0,0,.18)}
.in-titlecard{position:absolute;left:300px;top:648px;width:560px;min-height:270px;background:#1e56b3;border-radius:24px;
  box-sizing:border-box;padding:40px 44px;display:flex;align-items:flex-start;color:#fff;font-weight:800;font-size:56px;line-height:1.1}
.in-carousel{position:absolute;left:940px;top:110px;width:620px;height:775px}
.in-viewport{position:absolute;inset:0;border-radius:20px;overflow:hidden;box-shadow:0 16px 40px rgba(0,0,0,.45)}
.in-track{display:flex;height:100%;will-change:transform;transition:transform .6s cubic-bezier(.4,0,.2,1)}
.in-slide{flex:0 0 620px;height:775px;background:#fff}
.in-slide img{width:100%;height:100%;object-fit:cover;display:block}
.in-progress{position:absolute;left:0;right:0;bottom:-30px;display:flex;gap:8px}
.in-seg{flex:1;height:8px;background:rgba(255,255,255,.28);border-radius:4px;overflow:hidden}
.in-fill{height:100%;width:0;background:#fff;border-radius:4px}
`;
