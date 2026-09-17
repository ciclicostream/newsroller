import { useEffect, useRef, useState } from "react";
import type { DeclaracionesData } from "@newsroller/shared";
import fondo from "../assets/fondo2.jpg";
import { Chrome } from "./Chrome";
import { useAutoFit } from "../lib/autofit";

const WANT_AUDIO = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("audio");

// Placa Declaraciones: foto cuadrada + placas nombre/cargo/lugar a la izquierda;
// cita en tarjeta azul (con comillas en placa navy separada, efecto máquina de
// escribir) a la derecha; barra de titular + tarjeta "Entrevista en…" abajo
// (ambas opcionales). Header: sólo hora (sin temp). Salida estándar (baja
// detrás del ticker). No genera reporte.
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

  useAutoFit(quoteRef, 54, 28, [data.quote]);

  return (
    <div className={"dc" + (play ? " play" : "") + (exiting ? " exit" : "")} style={{ position: "absolute", inset: 0 }}>
      <style>{CSS}</style>
      <img className="dc-bg" src={fondo} alt="" />
      <Chrome hideTemp />

      <img className="dc-photo dc-el" src={data.photo_url} alt="" />
      <div className="dc-idcard dc-idcard-name dc-el">{data.name.toUpperCase()}</div>
      <div className="dc-idcard dc-idcard-role dc-el">{data.role.toUpperCase()}</div>
      <div className="dc-idcard dc-idcard-place dc-el">{data.place.toUpperCase()}</div>

      <div className="dc-quote dc-el"><div className="dc-cita" ref={quoteRef}>{data.quote.slice(0, typed)}</div></div>
      <div className="dc-qmark dc-el">&ldquo;</div>

      {data.headline && <div className="dc-titbar dc-el">{data.headline}</div>}
      {data.interview_program && (
        <div className="dc-epa dc-el">Entrevista completa en <b>{data.interview_program}</b></div>
      )}

      {data.audio_url && <audio src={data.audio_url} autoPlay muted={!WANT_AUDIO} />}
    </div>
  );
}

const CSS = `
.dc{font-family:Inter,system-ui,sans-serif}
.dc-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.dc-el{opacity:0}

.dc-photo{position:absolute;left:210px;top:105px;width:330px;height:330px;z-index:14;
  border-radius:14px;object-fit:cover;background:#cfd3da;box-shadow:0 12px 26px rgba(0,0,0,.25)}
.dc-idcard{position:absolute;left:210px;width:330px;text-align:center;z-index:14}
.dc-idcard-name{top:445px;background:#0b1f52;color:#fff;font-weight:800;font-size:40px;line-height:1.05;padding:18px 14px;border-radius:12px}
.dc-idcard-role{top:595px;background:#fff;color:#0b2b6b;font-weight:800;font-size:38px;padding:12px 14px;border-radius:12px}
.dc-idcard-place{top:667px;background:#fff;color:#0b2b6b;font-weight:800;font-size:34px;line-height:1.08;padding:12px 14px;border-radius:12px}

.dc-quote{position:absolute;left:600px;top:105px;width:1270px;height:650px;z-index:13;
  background:#3b82f6;border-radius:34px;box-shadow:0 18px 36px rgba(0,0,0,.3);
  padding:70px 60px;box-sizing:border-box;overflow:hidden}
.dc-cita{color:#fff;font-weight:600;font-size:54px;line-height:1.34;white-space:pre-wrap;max-height:100%;overflow:hidden}
.dc-qmark{position:absolute;left:620px;top:64px;width:150px;height:122px;z-index:15;background:#0b1f52;
  border-radius:20px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;
  font-size:150px;font-family:Georgia,serif;line-height:1;box-shadow:0 10px 22px rgba(0,0,0,.3)}

.dc-titbar{position:absolute;left:600px;top:779px;width:1030px;height:104px;z-index:14;background:#fff;
  border-radius:16px;box-sizing:border-box;padding:12px 28px;display:flex;align-items:center;overflow:hidden;
  color:#0b2b6b;font-weight:800;font-size:34px;line-height:1.08;box-shadow:0 10px 22px rgba(0,0,0,.22)}
.dc-epa{position:absolute;left:1650px;top:779px;width:222px;height:104px;z-index:14;background:#fff;
  border-radius:16px;box-sizing:border-box;padding:12px 20px;display:flex;align-items:center;overflow:hidden;
  color:#0b2b6b;font-weight:800;font-size:28px;line-height:1.12;box-shadow:0 10px 22px rgba(0,0,0,.22)}

.dc.play .dc-el{transition:opacity .5s ease;opacity:1}

/* Salida estándar: todo baja junto y desaparece detrás del ticker. */
.dc.exit .dc-el{transition:transform .8s cubic-bezier(.4,0,.8,.2), opacity .8s ease;
  transform:translateY(260px);opacity:0}
`;
