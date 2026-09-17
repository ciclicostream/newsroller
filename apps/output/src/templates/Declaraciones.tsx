import { useEffect, useRef, useState } from "react";
import type { DeclaracionesData } from "@newsroller/shared";
import fondo from "../assets/fondo2.jpg";
import { Chrome } from "./Chrome";
import { useAutoFit } from "../lib/autofit";

// Placa Declaraciones: foto cuadrada + nombre/cargo/lugar a la izquierda; cita
// (tarjeta azul, efecto máquina de escribir) a la derecha; barra de titular +
// tarjeta "Entrevista completa en…" abajo (ambas opcionales). Header: sólo hora
// (sin temp, sin logo). Animación propia: todo en fade, salida en fade card por
// card (NO la salida estándar detrás del ticker). No genera reporte.
export function Declaraciones({ data, durationSec }: { data: DeclaracionesData; durationSec?: number }) {
  const [play, setPlay] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [typed, setTyped] = useState(0);
  const raf = useRef<number | undefined>(undefined);
  const quoteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setPlay(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Máquina de escribir: arranca cuando el resto ya entró (≈900ms).
  useEffect(() => {
    const start = setTimeout(() => {
      const t0 = performance.now();
      const CPS = 34; // caracteres por segundo
      function tick(now: number) {
        const n = Math.min(data.quote.length, Math.floor(((now - t0) / 1000) * CPS));
        setTyped(n);
        if (n < data.quote.length) raf.current = requestAnimationFrame(tick);
      }
      raf.current = requestAnimationFrame(tick);
    }, 900);
    return () => { clearTimeout(start); if (raf.current) cancelAnimationFrame(raf.current); };
  }, [data.quote]);

  useEffect(() => {
    if (!durationSec) return;
    const t = setTimeout(() => setExiting(true), Math.max(1000, durationSec * 1000 - 900));
    return () => clearTimeout(t);
  }, [durationSec]);

  useAutoFit(quoteRef, 34, 20, [data.quote]);

  const hasBottom = !!data.headline || !!data.interview_program;

  return (
    <div className={"dc" + (play ? " play" : "") + (exiting ? " exit" : "")} style={{ position: "absolute", inset: 0 }}>
      <style>{CSS}</style>
      <img className="dc-bg" src={fondo} alt="" />
      <Chrome hideTemp />

      <img className="dc-photo dc-el" src={data.photo_url} alt="" style={{ transitionDelay: "0s" }} />
      <div className="dc-chip dc-chip-name dc-el" style={{ transitionDelay: ".12s" }}>{data.name}</div>
      <div className="dc-chip dc-chip-role dc-el" style={{ transitionDelay: ".22s" }}>{data.role}</div>
      <div className="dc-chip dc-chip-place dc-el" style={{ transitionDelay: ".32s" }}>{data.place}</div>

      <div className="dc-quote dc-el" style={{ transitionDelay: ".18s" }}>
        <div className="dc-quotemark">&ldquo;</div>
        <div className="dc-quote-text" ref={quoteRef}>{data.quote.slice(0, typed)}</div>
      </div>

      {hasBottom && data.headline && (
        <div className="dc-headline dc-el" style={{ transitionDelay: ".45s" }}>{data.headline}</div>
      )}
      {hasBottom && data.interview_program && (
        <div className="dc-interview dc-el" style={{ transitionDelay: ".55s" }}>
          <div className="dc-interview-label">Entrevista completa en</div>
          <div className="dc-interview-name">{data.interview_program}</div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.dc{font-family:Inter,system-ui,sans-serif}
.dc-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.dc-el{opacity:0;transition:opacity .6s ease}
.dc.play .dc-el{opacity:1}

.dc-photo{position:absolute;left:210px;top:100px;width:430px;height:430px;z-index:14;
  object-fit:cover;border-radius:24px;box-shadow:0 16px 32px rgba(0,0,0,.28)}
.dc-chip{position:absolute;left:210px;width:430px;border-radius:12px;font-weight:700;text-align:center;
  padding:14px 10px;box-shadow:0 6px 16px rgba(0,0,0,.2)}
.dc-chip-name{top:546px;background:#0b2b6b;color:#fff;font-size:30px;font-weight:800}
.dc-chip-role{top:610px;background:#fff;color:#0b2b6b;font-size:24px}
.dc-chip-place{top:668px;background:#fff;color:#1a3aa8;font-size:22px}

.dc-quote{position:absolute;left:680px;top:100px;width:850px;height:650px;z-index:14;
  background:linear-gradient(160deg,#2f6bff,#1a3aa8);border-radius:26px;box-shadow:0 18px 36px rgba(0,0,0,.3);
  padding:64px 60px;overflow:hidden}
.dc-quotemark{position:absolute;top:18px;left:32px;font-size:140px;font-weight:800;color:rgba(255,255,255,.18);
  font-family:Georgia,serif;line-height:1}
.dc-quote-text{position:relative;color:#fff;font-weight:600;font-size:34px;line-height:1.35;white-space:pre-wrap;
  max-height:100%;overflow:hidden}

.dc-headline{position:absolute;left:680px;top:800px;width:520px;height:100px;z-index:14;
  background:#fff;border-radius:16px;display:flex;align-items:center;padding:0 30px;
  color:#0b2b6b;font-weight:800;font-size:26px;line-height:1.15;box-shadow:0 10px 22px rgba(0,0,0,.24)}
.dc-interview{position:absolute;left:1230px;top:800px;width:300px;height:100px;z-index:14;
  background:linear-gradient(180deg,#3b82f6,#2f6bff);border-radius:16px;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:4px;box-shadow:0 10px 22px rgba(0,0,0,.24)}
.dc-interview-label{color:#dbe6ff;font-size:14px;font-weight:600;letter-spacing:.03em}
.dc-interview-name{color:#fff;font-size:26px;font-weight:800}

/* Salida: fade, card por card (no slide). */
.dc.exit .dc-el{opacity:0!important;transition:opacity .6s ease}
.dc.exit .dc-photo{transition-delay:0s}
.dc.exit .dc-chip-name{transition-delay:.08s}
.dc.exit .dc-chip-role{transition-delay:.16s}
.dc.exit .dc-chip-place{transition-delay:.24s}
.dc.exit .dc-quote{transition-delay:.32s}
.dc.exit .dc-headline{transition-delay:.4s}
.dc.exit .dc-interview{transition-delay:.48s}
`;
