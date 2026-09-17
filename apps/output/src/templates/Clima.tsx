import { useEffect, useMemo, useState } from "react";
import type { ClimaData, ClimaPayload, ClimaCiudad, ClimaIconKey } from "@newsroller/shared";
import { weatherIconKey } from "@newsroller/shared";
import fondo from "../assets/fondo2.jpg";
import { Chrome } from "./Chrome";

import bigSoleado from "../assets/clima/big-soleado.png";
import bigNublado from "../assets/clima/big-nublado.png";
import bigLluvia from "../assets/clima/big-lluvia.png";
import bigLlovizna from "../assets/clima/big-llovizna.png";
import bigNieve from "../assets/clima/big-nieve.png";
import bigTormenta from "../assets/clima/big-tormenta.png";
import icSoleado from "../assets/clima/ic-soleado.png";
import icNublado from "../assets/clima/ic-nublado.png";
import icLluvia from "../assets/clima/ic-lluvia.png";
import icLlovizna from "../assets/clima/ic-llovizna.png";
import icNieve from "../assets/clima/ic-nieve.png";
import icTormenta from "../assets/clima/ic-tormenta.png";

const BIG: Record<ClimaIconKey, string> = {
  soleado: bigSoleado, nublado: bigNublado, lluvia: bigLluvia,
  llovizna: bigLlovizna, nieve: bigNieve, tormenta: bigTormenta,
};
const ICON: Record<ClimaIconKey, string> = {
  soleado: icSoleado, nublado: icNublado, lluvia: icLluvia,
  llovizna: icLlovizna, nieve: icNieve, tormenta: icTormenta,
};

const DIAS = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

// Placa Clima: BIG flotante arriba-izquierda + card principal (temp+condición+
// datos) a la derecha + 3 días (HOY/MAÑANA/+2) abajo con ícono. Dato en vivo de
// la fuente `clima` (no se congela: el pronóstico debe seguir actualizado).
// Entrada: cards tipo carta (flip). Salida: fade. Marco Chrome.
export function Clima({ data, live, durationSec }: { data: ClimaData; live?: ClimaPayload; durationSec?: number }) {
  const city: ClimaCiudad | undefined = useMemo(
    () => live?.cities.find((c) => c.city === data.city) ?? live?.cities[0],
    [live, data.city],
  );

  const [play, setPlay] = useState(false);
  const [exiting, setExiting] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setPlay(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (!durationSec) return;
    const t = setTimeout(() => setExiting(true), Math.max(1000, durationSec * 1000 - 700));
    return () => clearTimeout(t);
  }, [durationSec]);

  if (!city) {
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        <img src={fondo} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        <Chrome />
      </div>
    );
  }

  const key = weatherIconKey(city.code);
  const days = city.days.slice(0, 3);

  return (
    <div className={"cw" + (play ? " play" : "") + (exiting ? " exit" : "")} style={{ position: "absolute", inset: 0 }}>
      <style>{CSS}</style>
      <img className="cw-bg" src={fondo} alt="" />
      <Chrome />

      <img className="cw-big" src={BIG[key]} alt="" />

      <div className="cw-main cw-flip">
        <div className="cw-temp">{city.tempC != null ? `${city.tempC}°` : "--"}</div>
        <div className="cw-city">{city.city.toUpperCase()}</div>
        <div className="cw-cond">{city.desc.toUpperCase()}</div>
        <div className="cw-extra">
          <div><span>MÁX/MÍN</span><b>{days[0]?.max ?? "--"}° / {days[0]?.min ?? "--"}°</b></div>
          <div><span>SENSACIÓN</span><b>{city.feelsLike != null ? `${city.feelsLike}°` : "--"}</b></div>
          <div><span>HUMEDAD</span><b>{city.humidity != null ? `${city.humidity}%` : "--"}</b></div>
          <div><span>VIENTO</span><b>{city.windKmh != null ? `${city.windKmh} km/h` : "--"}</b></div>
        </div>
      </div>

      <div className="cw-note cw-flip">EL CLIMA</div>

      {days.map((d, i) => {
        const dKey = weatherIconKey(d.code);
        const label = i === 0 ? "HOY" : i === 1 ? "MAÑANA" : DIAS[new Date(d.date + "T12:00:00").getDay()];
        return (
          <div key={d.date} className={`cw-day cw-day-${i} cw-flip`}>
            <div className="cw-day-label">{label}</div>
            <img className="cw-day-icon" src={ICON[dKey]} alt="" />
            <div className="cw-day-temp">{d.max ?? "--"}°/{d.min ?? "--"}°</div>
          </div>
        );
      })}
    </div>
  );
}

const CSS = `
.cw{font-family:Inter,system-ui,sans-serif}
.cw-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}

.cw-big{position:absolute;left:60px;top:40px;width:560px;z-index:13;filter:drop-shadow(0 20px 30px rgba(0,0,0,.35));
  opacity:0;transform:translateY(20px)}
.cw.play .cw-big{animation:cw-float-in 1s cubic-bezier(.2,.8,.2,1) .1s forwards, cw-float 4s ease-in-out 1.1s infinite}
@keyframes cw-float-in{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes cw-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-16px)}}

.cw-flip{opacity:0;transform:perspective(1000px) rotateY(-90deg);transform-origin:left center}
.cw.play .cw-flip{animation:cw-flip .6s cubic-bezier(.2,.8,.2,1) forwards}
.cw.play .cw-main{animation-delay:.25s}
.cw.play .cw-note{animation-delay:.55s}
.cw.play .cw-day-0{animation-delay:.65s}
.cw.play .cw-day-1{animation-delay:.78s}
.cw.play .cw-day-2{animation-delay:.91s}
@keyframes cw-flip{from{opacity:0;transform:perspective(1000px) rotateY(-90deg)}to{opacity:1;transform:perspective(1000px) rotateY(0)}}

.cw-main{position:absolute;left:900px;top:100px;width:620px;height:430px;z-index:14;
  background:#fff;border-radius:26px;box-shadow:0 18px 36px rgba(0,0,0,.3);
  padding:36px 48px;display:flex;flex-direction:column;justify-content:center;gap:6px}
.cw-temp{color:#2f80ed;font-weight:800;font-size:110px;line-height:1}
.cw-city{color:#0b2b6b;font-weight:800;font-size:30px;letter-spacing:.03em}
.cw-cond{color:#e8542f;font-weight:700;font-size:20px;letter-spacing:.06em;margin-bottom:10px}
.cw-extra{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;border-top:1px solid #e3e6ea;padding-top:16px}
.cw-extra span{display:block;color:#6b7688;font-size:13px;font-weight:600;letter-spacing:.04em}
.cw-extra b{display:block;color:#10151f;font-size:22px;font-weight:800;margin-top:4px}

.cw-note{position:absolute;left:900px;top:560px;z-index:14;background:linear-gradient(180deg,#3b82f6,#2f6bff);
  color:#fff;font-weight:800;font-size:18px;letter-spacing:.06em;padding:10px 22px;border-radius:11px;
  box-shadow:0 8px 18px rgba(0,0,0,.22)}

.cw-day{position:absolute;top:640px;width:230px;height:200px;z-index:14;background:#fff;border-radius:20px;
  box-shadow:0 12px 26px rgba(0,0,0,.24);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px}
.cw-day-0{left:900px}
.cw-day-1{left:1150px}
.cw-day-2{left:1400px}
.cw-day-label{color:#0b2b6b;font-weight:800;font-size:18px;letter-spacing:.04em}
.cw-day-icon{width:64px;height:64px;object-fit:contain}
.cw-day-temp{color:#1a3aa8;font-weight:700;font-size:20px}

.cw.exit .cw-big,.cw.exit .cw-main,.cw.exit .cw-note,.cw.exit .cw-day{
  transition:opacity .6s ease;opacity:0!important;animation:none!important;transform:none!important}
`;
