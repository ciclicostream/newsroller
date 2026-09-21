import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as Icons from "lucide-react";
import type { CifrasData } from "@newsroller/shared";
import fondo from "../assets/fondo2.jpg";
import { Chrome } from "./Chrome";

function useCountUp(target: number, start: boolean, ms = 900): number {
  const [val, setVal] = useState(0);
  const raf = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!start) return;
    const t0 = performance.now();
    function tick(now: number) {
      const p = Math.min(1, (now - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [start, target, ms]);
  return val;
}

// Ancho máximo de la cifra: centrada en la card y sin pisar las píldoras de hora/temperatura del marco
// (esquina superior derecha, desde x≈1550 con la cifra centrada en x=960).
const MAX_NUM_W = 1180;

// Formatea el valor animado igual que la cifra final: punto de miles siempre (también en 4 cifras,
// donde es-AR no agrupa) y tantos decimales (con coma) como tenga la cifra escrita ("5,25" → 2).
// Ojo: "40.000.000" no tiene decimales (los puntos son de miles); sólo cuenta lo que va tras una coma.
function fmt(n: number, like: string): string {
  const m = /,(\d+)/.exec(like);
  const decimals = m ? Math.min(3, m[1]!.length) : 0;
  const [int, frac] = n.toFixed(decimals).split(".");
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return frac ? `${grouped},${frac}` : grouped;
}

// Placa Cifras: dato destacado (API o manual) + fuente + explicación. Marco Chrome.
export function Cifras({ data, durationSec }: { data: CifrasData; durationSec?: number }) {
  const [stage, setStage] = useState(0); // 0 idle,1 cifra in,2 cuenta,3 azul in,4 chica+pill in
  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), 150),
      setTimeout(() => setStage(2), 650),
      setTimeout(() => setStage(3), 1450),
      setTimeout(() => setStage(4), 1950),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const [exiting, setExiting] = useState(false);
  useEffect(() => {
    if (!durationSec) return;
    const t = setTimeout(() => setExiting(true), Math.max(1000, durationSec * 1000 - 900));
    return () => clearTimeout(t);
  }, [durationSec]);

  const count = useCountUp(data.valueNum, stage >= 2, 900);

  // Prefijo + número (+ sufijo corto pegado) en grande; una unidad larga ("toneladas de carne") va
  // debajo, chica, para no quitarle lugar a la cifra. Si la cifra no entra en el ancho de la card se
  // achica su tamaño de letra (medido sobre el valor final, ancho máx. MAX_NUM_W).
  const suffix = data.suffix ?? "";
  const shortSuffix = suffix.trim().length <= 3;
  const prefix = data.prefix ? `${data.prefix} ` : "";
  const finalNum = fmt(data.valueNum, data.value);
  const measureRef = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1);
  useLayoutEffect(() => {
    const fit = () => {
      const el = measureRef.current;
      if (el) setK(Math.min(1, MAX_NUM_W / Math.max(1, el.scrollWidth)));
    };
    fit();
    void document.fonts?.ready.then(fit);
  }, [data.value, data.valueNum, data.prefix, data.suffix]);
  const numText = (n: string) => `${prefix}${n}${shortSuffix ? suffix : ""}`;
  const Ic = data.icon ? (Icons as unknown as Record<string, Icons.LucideIcon>)[data.icon] : null;

  return (
    <div className={"cf" + (exiting ? " exit" : "")} style={{ position: "absolute", inset: 0 }}>
      <style>{CSS}</style>
      <img className="cf-bg" src={fondo} alt="" />
      <Chrome />

      <div className={"cf-main cf-card" + (stage >= 1 ? " in" : "")}>
        <div className="cf-num cf-measure" ref={measureRef} aria-hidden="true">{numText(finalNum)}</div>
        <div className="cf-figure">
          <div className="cf-num" style={{ fontSize: 210 * k }}>{numText(stage >= 2 ? fmt(count, data.value) : "0")}</div>
          {!shortSuffix && suffix.trim() && <div className="cf-unit">{suffix.trim()}</div>}
        </div>
        <div className="cf-subtitle">{data.subtitle}</div>
      </div>

      <div className={"cf-source cf-card" + (stage >= 4 ? " in" : "")}>
        <div className="cf-source-label">FUENTE</div>
        <div className="cf-source-text">{data.source}</div>
      </div>
      <div className={"cf-pill" + (stage >= 4 ? " in" : "")}>LA CIFRA</div>

      <div className={"cf-explain cf-card" + (stage >= 3 ? " in" : "")}>
        {Ic && <div className="cf-icon"><Ic size={100} strokeWidth={1.8} /></div>}
        <div className="cf-explain-text">{data.explanation}</div>
      </div>
    </div>
  );
}

const CSS = `
.cf{font-family:Inter,system-ui,sans-serif}
.cf-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.cf-card{opacity:0;transition:opacity .6s ease, transform .6s cubic-bezier(.2,.8,.2,1)}
.cf-card.in{opacity:1}

.cf-main{position:absolute;left:60px;top:90px;width:1800px;height:460px;z-index:15;
  background:#fff;border-radius:40px;box-shadow:0 16px 34px rgba(0,0,0,.28);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;
  transform:translateY(-120px)}
.cf-main.in{transform:translateY(0)}
.cf-figure{display:flex;flex-direction:column;align-items:center;gap:4px}
.cf-num{color:#2f80ed;font-weight:800;font-size:210px;line-height:1;letter-spacing:-.01em;white-space:nowrap}
.cf-measure{position:absolute;visibility:hidden;pointer-events:none;left:0;top:0}
.cf-unit{color:#2f80ed;font-size:68px;font-weight:700;line-height:1.1;text-align:center;white-space:nowrap}
.cf-subtitle{color:#2f80ed;font-weight:700;font-size:50px;text-align:center;max-width:1500px}

.cf-source{position:absolute;left:60px;top:578px;width:340px;height:250px;z-index:14;
  background:#fff;border-radius:26px;box-shadow:0 12px 28px rgba(0,0,0,.24);
  display:flex;flex-direction:column;justify-content:center;gap:10px;padding:0 34px;
  transform:translateX(-160px)}
.cf-source.in{transform:translateX(0)}
.cf-source-label{color:#e8542f;font-weight:800;font-size:16px;letter-spacing:.14em}
.cf-source-text{color:#0b2b6b;font-weight:600;font-size:30px;line-height:1.3}
.cf-pill{position:absolute;left:60px;top:848px;z-index:15;background:#3b82f6;
  color:#fff;font-weight:800;font-size:40px;letter-spacing:.02em;padding:16px 40px;border-radius:16px;
  box-shadow:0 8px 18px rgba(0,0,0,.25);opacity:0;transition:opacity .5s ease .1s}
.cf-pill.in{opacity:1}

.cf-explain{position:absolute;left:430px;top:578px;width:1390px;height:318px;z-index:14;
  background:#3b82f6;border-radius:32px;box-shadow:0 12px 28px rgba(0,0,0,.28);
  display:flex;align-items:center;gap:26px;padding:0 60px;color:#fff;
  transform:translateX(160px)}
.cf-explain.in{transform:translateX(0)}
.cf-icon{flex:none;width:150px;height:150px;display:flex;align-items:center;justify-content:center}
.cf-explain-text{font-weight:600;font-size:44px;line-height:1.28}

.cf.exit .cf-card,.cf.exit .cf-pill{transition:opacity .7s ease;opacity:0!important;transform:none!important}
`;
