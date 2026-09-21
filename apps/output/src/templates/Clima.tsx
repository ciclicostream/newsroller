import { useEffect, useMemo, useState } from "react";
import type { ClimaData, ClimaPayload, ClimaCiudad, ClimaIconKey, ClimaIconsConfig, ClimaSlotKey } from "@newsroller/shared";
import { weatherIconKey, climaSlotKey, CLIMA_SLOTS } from "@newsroller/shared";
import { API_BASE } from "../lib/scene";
import fondo from "../assets/fondo2.jpg";
import { Chrome } from "./Chrome";

import icSoleado from "../assets/clima/ic-soleado.png";
import icNublado from "../assets/clima/ic-nublado.png";
import icLluvia from "../assets/clima/ic-lluvia.png";
import icLlovizna from "../assets/clima/ic-llovizna.png";
import icNieve from "../assets/clima/ic-nieve.png";
import icTormenta from "../assets/clima/ic-tormenta.png";

// Íconos BIG: cada slot (situación del cielo) tiene una imagen predeterminada en /public/clima y el
// editor puede reemplazarla desde Ajustes (settings.climaIcons). Si un slot no tiene ninguna, se usa
// la del slot de reserva (ej. niebla → nublado).
const DEFAULT_BIG = (k: ClimaSlotKey) => `${import.meta.env.BASE_URL}clima/big-${k}.png`;
function resolveBig(key: ClimaSlotKey, custom: ClimaIconsConfig): string {
  let k: ClimaSlotKey | null = key;
  const seen = new Set<string>();
  while (k && !seen.has(k)) {
    seen.add(k);
    const slot = CLIMA_SLOTS.find((x) => x.key === k)!;
    if (custom[k]) return custom[k]!;
    if (slot.hasDefault) return DEFAULT_BIG(k);
    k = slot.fallback;
  }
  return DEFAULT_BIG("nublado");
}

const ICON: Record<ClimaIconKey, string> = {
  soleado: icSoleado, nublado: icNublado, lluvia: icLluvia,
  llovizna: icLlovizna, nieve: icNieve, tormenta: icTormenta,
};

const DIAS = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

// Placa Clima: BIG grande a la izquierda (se superpone levemente, con flotado) +
// card principal (temp gigante+ciudad+chips de máx/mín/sensación/humedad/viento)
// + franja de condición + nota "EL CLIMA" + 3 días (HOY/MAÑANA/+2) en cards
// celestes con ícono. Entrada tipo carta (flip). Salida: fade. Header: sólo
// hora. Dato en vivo de la fuente `clima` (no se congela). Usa <Chrome/>.
export function Clima({ data, live, durationSec }: { data: ClimaData; live?: ClimaPayload; durationSec?: number }) {
  const city: ClimaCiudad | undefined = useMemo(
    () => live?.cities.find((c) => c.city === data.city) ?? live?.cities[0],
    [live, data.city],
  );

  const [play, setPlay] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [custom, setCustom] = useState<ClimaIconsConfig>({});
  // Íconos cargados en Ajustes (si falla el fetch se usan los predeterminados).
  useEffect(() => {
    let on = true;
    fetch(`${API_BASE}/api/settings`).then((r) => r.json()).then((s) => on && setCustom(s?.climaIcons ?? {})).catch(() => {});
    return () => { on = false; };
  }, []);
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

  const bigKey = climaSlotKey(city.code, city.isDay);
  const days = city.days.slice(0, 3);

  return (
    <div className={"cw" + (play ? " play" : "") + (exiting ? " exit" : "")} style={{ position: "absolute", inset: 0 }}>
      <style>{CSS}</style>
      <img className="cw-bg" src={fondo} alt="" />
      <Chrome hideTemp />

      <img className="cw-big" src={resolveBig(bigKey, custom)} alt="" />

      <div className="cw-main cw-flip">
        <div className="cw-t">{city.tempC != null ? `${city.tempC}°` : "--"}</div>
        <div className="cw-city">{city.city.toUpperCase()}</div>
        <div className="cw-stats">
          <div className="cw-chip">Máx <b>{days[0]?.max ?? "--"}°</b> · Mín <b>{days[0]?.min ?? "--"}°</b></div>
          <div className="cw-chip">Sensación <b>{city.feelsLike != null ? `${city.feelsLike}°` : "--"}</b></div>
          <div className="cw-chip">Humedad <b>{city.humidity != null ? `${city.humidity}%` : "--"}</b></div>
          <div className="cw-chip">Viento <b>{city.windKmh != null ? `${city.windKmh} km/h` : "--"}</b></div>
        </div>
      </div>

      <div className="cw-cond cw-flip"><span>{city.desc.toUpperCase()}</span></div>
      <div className="cw-note cw-flip">Pronóstico actualizado en vivo.</div>
      <div className="cw-pill cw-flip">EL CLIMA</div>

      {days.map((d, i) => {
        const dKey = weatherIconKey(d.code);
        const label = i === 0 ? "HOY" : i === 1 ? "MAÑANA" : DIAS[new Date(d.date + "T12:00:00").getDay()];
        return (
          <div key={d.date} className={`cw-day cw-day-d${i + 1} cw-flip`}>
            <img className="cw-day-ic" src={ICON[dKey]} alt="" />
            <div className="cw-day-tmp">{d.max ?? "--"}°</div>
            <div className="cw-day-name">{label}</div>
          </div>
        );
      })}
    </div>
  );
}

const CSS = `
.cw{font-family:Inter,system-ui,sans-serif}
.cw-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}

.cw-big{position:absolute;left:-40px;top:20px;width:940px;z-index:6;
  opacity:0;filter:drop-shadow(0 20px 40px rgba(0,0,0,.35))}
.cw.play .cw-big{animation:cw-float-in 1s cubic-bezier(.2,.8,.2,1) .1s forwards, cw-float 4s ease-in-out 1.1s infinite}
@keyframes cw-float-in{from{opacity:0}to{opacity:1}}
@keyframes cw-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-16px)}}

.cw-flip{opacity:0;transform:perspective(1000px) rotateY(-90deg);transform-origin:left center}
.cw.play .cw-flip{animation:cw-flip .6s cubic-bezier(.2,.8,.2,1) forwards}
.cw.play .cw-main{animation-delay:.25s}
.cw.play .cw-cond{animation-delay:.45s}
.cw.play .cw-note{animation-delay:.6s}
.cw.play .cw-pill{animation-delay:.72s}
.cw.play .cw-day-d1{animation-delay:.8s}
.cw.play .cw-day-d2{animation-delay:.92s}
.cw.play .cw-day-d3{animation-delay:1.04s}
@keyframes cw-flip{from{opacity:0;transform:perspective(1000px) rotateY(-90deg)}to{opacity:1;transform:perspective(1000px) rotateY(0)}}

.cw-main{position:absolute;left:940px;top:96px;width:900px;height:452px;z-index:14;
  background:#fff;border-radius:32px;box-sizing:border-box;padding:34px 46px;color:#2f80ed;
  box-shadow:0 18px 36px rgba(0,0,0,.3)}
.cw-t{font-weight:800;font-size:190px;line-height:.9;letter-spacing:-.02em}
.cw-city{font-weight:800;font-size:46px;color:#2f80ed;letter-spacing:.01em;margin-top:2px}
.cw-stats{display:flex;gap:14px;margin-top:22px;flex-wrap:wrap}
.cw-chip{background:#eaf2fe;color:#0b2b6b;font-weight:700;font-size:26px;padding:10px 18px;border-radius:12px}
.cw-chip b{color:#2f80ed}

.cw-cond{position:absolute;left:940px;top:566px;width:900px;height:60px;z-index:14;background:#0b1f52;
  border-radius:12px;display:flex;align-items:center;justify-content:center}
.cw-cond span{color:#fff;font-weight:800;font-size:28px;letter-spacing:.04em}

.cw-note{position:absolute;left:60px;top:648px;width:330px;height:196px;z-index:14;background:#fff;
  border-radius:24px;box-sizing:border-box;padding:26px;display:flex;align-items:center;justify-content:center;
  text-align:center;color:#0b2b6b;font-weight:600;font-size:26px;line-height:1.3;box-shadow:0 12px 26px rgba(0,0,0,.24)}
.cw-pill{position:absolute;left:60px;top:864px;width:330px;z-index:14;box-sizing:border-box;text-align:center;
  background:#3b82f6;color:#fff;font-weight:800;font-size:34px;letter-spacing:.02em;padding:14px 0;border-radius:14px}

.cw-day{position:absolute;top:648px;width:430px;height:292px;z-index:14;background:#5aa2f2;border-radius:24px;
  box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
  color:#fff;box-shadow:0 12px 26px rgba(0,0,0,.24)}
.cw-day-d1{left:450px}
.cw-day-d2{left:940px}
.cw-day-d3{left:1430px}
.cw-day-ic{height:120px;width:auto;display:block}
.cw-day-tmp{font-weight:800;font-size:64px;line-height:1}
.cw-day-name{font-weight:800;font-size:44px;color:#0b2b6b;margin-top:8px}

.cw.exit .cw-big,.cw.exit .cw-main,.cw.exit .cw-cond,.cw.exit .cw-note,.cw.exit .cw-pill,.cw.exit .cw-day{
  transition:opacity .6s ease;opacity:0!important;animation:none!important;transform:none!important}
`;
