import { useEffect, useMemo, useRef, useState } from "react";
import type { DolarData, DolarPayload } from "@newsroller/shared";
import { DOLAR_CASAS } from "@newsroller/shared";
import fondo from "../assets/fondo-dolar.jpg";
import { Chrome } from "./Chrome";

// Cuenta 0→target con ease-out. Sin separador de miles (spec: "1490").
function useCountUp(target: number | null, start: boolean, ms = 900): number {
  const [val, setVal] = useState(0);
  const raf = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!start || target == null) return;
    const goal = target;
    const t0 = performance.now();
    function tick(now: number) {
      const p = Math.min(1, (now - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(goal * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [start, target, ms]);
  return val;
}

interface CardData {
  id: string;
  nombre: string;
  venta: number | null;
  diff: number | null;
}

// Placa Dólar: 3 cotizaciones elegidas por el editor (casas[1] = ancla, va al medio
// con la pill "EL DÓLAR"). Valor en vivo de la fuente `dolar` (con override manual
// opcional por casa) + variación ▲/▼ vs el día anterior. Marco estándar (Chrome).
export function Dolar({ data, live, durationSec }: { data: DolarData; live?: DolarPayload; durationSec?: number }) {
  const byId = useMemo(() => new Map((live?.casas ?? []).map((c) => [c.casa, c])), [live]);
  const ids = data.casas?.length === 3 ? data.casas : (["oficial", "blue", "bolsa"] as [string, string, string]);

  const cards: CardData[] = ids.map((id) => {
    const c = byId.get(id);
    const override = data.overrides?.[id];
    const venta = override ?? c?.venta ?? null;
    const prev = c?.ventaPrev ?? null;
    const diff = venta != null && prev != null && override == null ? Math.round(venta - prev) : null;
    return { id, nombre: DOLAR_CASAS[id] ?? id.toUpperCase(), venta, diff };
  });

  // Coreografía: fade del medio → cuenta el medio → los laterales emergen desde
  // detrás del medio hacia los costados → cuentan los laterales.
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), 150),
      setTimeout(() => setStage(2), 650),
      setTimeout(() => setStage(3), 1550),
      setTimeout(() => setStage(4), 2250),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const [exiting, setExiting] = useState(false);
  useEffect(() => {
    if (!durationSec) return;
    const t = setTimeout(() => setExiting(true), Math.max(1000, durationSec * 1000 - 900));
    return () => clearTimeout(t);
  }, [durationSec]);

  const vLeft = useCountUp(cards[0]?.venta ?? null, stage >= 4, 900);
  const vMid = useCountUp(cards[1]?.venta ?? null, stage >= 2, 900);
  const vRight = useCountUp(cards[2]?.venta ?? null, stage >= 4, 900);
  const vals = [vLeft, vMid, vRight];

  return (
    <div className={"dl" + (exiting ? " exit" : "")} style={{ position: "absolute", inset: 0 }}>
      <style>{CSS}</style>
      <img className="dl-bg" src={fondo} alt="" />
      <Chrome />

      {cards.map((c, i) => {
        const isMid = i === 1;
        const shown = isMid ? stage >= 1 : stage >= 3;
        return (
          <div key={c.id} className={`dl-card dl-card-${i}` + (isMid ? " mid" : "") + (shown ? " in" : "")}>
            {isMid && <div className="dl-pill">EL DÓLAR</div>}
            <div className="dl-val">{c.venta != null ? vals[i] : "—"}</div>
            {c.diff != null && c.diff !== 0 && (
              <div className={"dl-var " + (c.diff > 0 ? "up" : "down")}>
                {c.diff > 0 ? "▲" : "▼"} {Math.abs(c.diff)}
              </div>
            )}
            <div className="dl-label">DOLAR<br />{c.nombre.toUpperCase()}</div>
          </div>
        );
      })}
    </div>
  );
}

const CSS = `
.dl{font-family:Inter,system-ui,sans-serif}
.dl-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}

.dl-card{position:absolute;top:97px;width:426px;height:848px;border-radius:26px;background:#fff;
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.04), 0 16px 34px rgba(0,0,0,.28);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;
  transition:transform .7s cubic-bezier(.2,.8,.2,1), opacity .7s cubic-bezier(.2,.8,.2,1)}
.dl-card-0{left:258px;z-index:14;transform:translateX(514px);opacity:0}
.dl-card-1{left:772px;z-index:16;transition:opacity .5s ease;opacity:0}
.dl-card-2{left:1284px;z-index:14;transform:translateX(-512px);opacity:0}
.dl-card-0.in,.dl-card-2.in{transform:translateX(0);opacity:1}
.dl-card-1.in{opacity:1}

.dl-pill{position:absolute;top:-26px;background:linear-gradient(180deg,#3b82f6,#2f6bff);color:#fff;font-weight:800;
  font-size:24px;letter-spacing:.02em;padding:12px 30px;border-radius:12px;box-shadow:0 8px 18px rgba(0,0,0,.25)}
.dl-val{color:#2f80ed;font-weight:800;font-size:120px;line-height:1;letter-spacing:-.01em}
.dl-var{font-weight:800;font-size:26px;display:flex;align-items:center;gap:6px}
.dl-var.up{color:#16a34a}
.dl-var.down{color:#c0392b}
.dl-label{color:#0b2b6b;font-weight:800;font-size:28px;line-height:1.25;text-align:center;letter-spacing:.01em}

.dl.exit .dl-card{transition:opacity .7s ease;opacity:0!important;transform:none!important}
`;
