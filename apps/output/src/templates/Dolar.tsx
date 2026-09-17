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
  diffPct: number | null; // variación % vs día anterior
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
    const diffPct = venta != null && prev != null && prev !== 0 && override == null
      ? Math.round(((venta - prev) / prev) * 1000) / 10
      : null;
    return { id, nombre: DOLAR_CASAS[id] ?? id.toUpperCase(), venta, diffPct };
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
            <div className={"dl-var " + (c.diffPct != null && c.diffPct < 0 ? "down" : "up")} style={{ opacity: c.diffPct != null && c.diffPct !== 0 ? 1 : 0 }}>
              {c.diffPct != null && c.diffPct !== 0 ? `${c.diffPct > 0 ? "▲" : "▼"} ${Math.abs(c.diffPct).toString().replace(".", ",")}%` : "—"}
            </div>
            <div className="dl-foot"><div className="dl-lbl">DOLAR</div><div className="dl-name">{c.nombre.toUpperCase()}</div></div>
          </div>
        );
      })}
    </div>
  );
}

const CSS = `
.dl{font-family:Inter,system-ui,sans-serif}
.dl-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}

.dl-card{position:absolute;top:95px;width:430px;height:850px;border-radius:34px;background:#fff;
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.04), 0 16px 34px rgba(0,0,0,.28);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;
  transition:transform .7s cubic-bezier(.2,.8,.2,1), opacity .7s cubic-bezier(.2,.8,.2,1)}
.dl-card-0{left:230px;z-index:14;transform:translateX(515px);opacity:0}
.dl-card-1{left:745px;z-index:16;transition:opacity .5s ease;opacity:0}
.dl-card-2{left:1260px;z-index:14;transform:translateX(-515px);opacity:0}
.dl-card-0.in,.dl-card-2.in{transform:translateX(0);opacity:1}
.dl-card-1.in{opacity:1}

.dl-pill{position:absolute;top:-30px;left:50%;transform:translateX(-50%);background:#3b82f6;color:#fff;font-weight:800;
  font-size:34px;letter-spacing:.02em;padding:14px 34px;border-radius:16px;white-space:nowrap;box-shadow:0 8px 18px rgba(0,0,0,.25)}
.dl-val{color:#2f80ed;font-weight:800;font-size:150px;line-height:1;letter-spacing:-.01em}
.dl-var{margin-top:14px;font-weight:800;font-size:38px}
.dl-var.up{color:#16a34a}
.dl-var.down{color:#e0322a}
.dl-foot{margin-top:70px;text-align:center;line-height:1.05}
.dl-lbl{font-weight:800;font-size:44px;color:#2f80ed}
.dl-name{font-weight:800;font-size:44px;color:#0b2b6b}

.dl.exit .dl-card{transition:opacity .7s ease;opacity:0!important;transform:none!important}
`;
