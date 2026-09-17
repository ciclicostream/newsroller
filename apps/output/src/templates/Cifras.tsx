import { useEffect, useRef, useState } from "react";
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

// Formatea el valor animado igual que la cifra final (decimales con coma).
function fmt(n: number, like: string): string {
  const hasDecimal = /[.,]\d/.test(like);
  return hasDecimal ? n.toFixed(1).replace(".", ",") : Math.round(n).toLocaleString("es-AR");
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
  const Ic = data.icon ? (Icons as unknown as Record<string, Icons.LucideIcon>)[data.icon] : null;

  return (
    <div className={"cf" + (exiting ? " exit" : "")} style={{ position: "absolute", inset: 0 }}>
      <style>{CSS}</style>
      <img className="cf-bg" src={fondo} alt="" />
      <Chrome />

      <div className={"cf-main cf-card" + (stage >= 1 ? " in" : "")}>
        <div className="cf-num">{stage >= 2 ? fmt(count, data.value) : "0"}{data.suffix}</div>
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
.cf-num{color:#2f80ed;font-weight:800;font-size:210px;line-height:1;letter-spacing:-.01em}
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
