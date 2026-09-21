import { useEffect, useMemo, useRef, useState } from "react";
import type { DolarData, DolarPayload } from "@newsroller/shared";
import { DOLAR_CASAS } from "@newsroller/shared";
import fondo from "../assets/fondo-dolar.jpg";
import { Chrome } from "./Chrome";
import { IS_VERTICAL } from "../lib/orientation";

const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
// Punto de miles siempre (1.403), también con 4 cifras (Intl en es-AR no agrupa los de 4 dígitos).
const miles = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
// "18 SEP 2026" en hora argentina.
function fmtFecha(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(d).split("-");
  return `${Number(parts[2])} ${MESES[Number(parts[1]) - 1]} ${parts[0]}`;
}

// Cuenta 0→target con ease-out.
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

// Ícono de la última variación: sube (verde), baja (rojo) o igual (gris).
function VarIcon({ dir }: { dir: "up" | "down" | "flat" }) {
  return (
    <svg className="dl-vi" viewBox="0 0 24 24" aria-hidden="true">
      {dir === "up" && <path d="M12 4 L22 19 H2 Z" fill="currentColor" />}
      {dir === "down" && <path d="M12 20 L22 5 H2 Z" fill="currentColor" />}
      {dir === "flat" && <rect x="3" y="10" width="18" height="4.5" rx="2" fill="currentColor" />}
    </svg>
  );
}

interface CardData {
  id: string;
  nombre: string;
  venta: number | null;
  diffPct: number | null; // variación % vs la última cotización distinta (null = sin dato o valor manual)
  dir: "up" | "down" | "flat" | null;
  fecha: string; // fecha de la cotización (la de la API; si es manual, hoy)
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
    // Contra la última cotización DISTINTA (no la del poll anterior): 0 = nunca varió.
    const known = venta != null && prev != null && prev !== 0 && override == null;
    const raw = known ? ((venta! - prev!) / prev!) * 100 : null;
    // La dirección sale de la diferencia real (no del % redondeado): un cambio chico igual muestra ▲/▼.
    const dir: CardData["dir"] = raw == null ? null : Math.abs(venta! - prev!) < 0.005 ? "flat" : raw > 0 ? "up" : "down";
    const diffPct = raw == null ? null : Math.abs(raw) >= 1 ? Math.round(raw * 10) / 10 : Math.round(raw * 100) / 100;
    return { id, nombre: DOLAR_CASAS[id] ?? id.toUpperCase(), venta, diffPct, dir, fecha: fmtFecha(override != null ? null : c?.fecha) };
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
    <div className={"dl" + (exiting ? " exit" : "") + (IS_VERTICAL ? " v" : "")} style={{ position: "absolute", inset: 0 }}>
      <style>{CSS + (IS_VERTICAL ? CSS_V : "")}</style>
      <img className="dl-bg" src={fondo} alt="" />
      <Chrome />

      {cards.map((c, i) => {
        const isMid = i === 1;
        const shown = isMid ? stage >= 1 : stage >= 3;
        return (
          <div key={c.id} className={`dl-card dl-card-${i} v-${c.dir ?? "none"}` + (isMid ? " mid" : "") + (shown ? " in" : "")}>
            {isMid && <div className="dl-pill">EL DÓLAR</div>}
            <div className="dl-val">{c.venta != null ? miles(vals[i]) : "—"}</div>
            <div className={"dl-var " + (c.dir ?? "none")}>
              {c.dir && <VarIcon dir={c.dir} />}
              {c.dir && (c.dir === "flat" ? "SIN CAMBIOS" : `${Math.abs(c.diffPct ?? 0).toString().replace(".", ",")}%`)}
            </div>
            <div className="dl-foot"><div className="dl-lbl">DOLAR</div><div className="dl-name">{c.nombre.toUpperCase()}</div><div className="dl-date">{c.fecha}</div></div>
          </div>
        );
      })}
    </div>
  );
}

// Vertical: las tres cotizaciones apiladas, a todo el ancho; las de arriba y abajo emergen desde detrás de la del medio.
const CSS_V = `
.dl.v .dl-card{left:60px;width:960px;height:480px}
.dl.v .dl-card-0{top:190px;transform:translateY(530px)}
.dl.v .dl-card-1{top:720px}
.dl.v .dl-card-2{top:1250px;transform:translateY(-530px)}
.dl.v .dl-card-0.in,.dl.v .dl-card-2.in{transform:translateY(0)}
.dl.v .dl-val{font-size:150px}
.dl.v .dl-foot{margin-top:34px}
`;

const CSS = `
.dl{font-family:Inter,system-ui,sans-serif}
.dl-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}

.dl-card{position:absolute;top:95px;width:430px;height:850px;border-radius:34px;background:#fff;
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.04), 0 16px 34px rgba(0,0,0,.28);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;
  transition:transform .7s cubic-bezier(.2,.8,.2,1), opacity .7s cubic-bezier(.2,.8,.2,1)}
/* Sombra interna leve del color de la variación: verde sube, rojo baja, gris igual */
.dl-card.v-up{--tint:22,163,74}
.dl-card.v-down{--tint:224,50,42}
.dl-card.v-flat{--tint:110,122,150}
.dl-card.v-up,.dl-card.v-down,.dl-card.v-flat{
  box-shadow:inset 0 0 70px 6px rgba(var(--tint),.20), inset 0 0 0 2px rgba(var(--tint),.16), 0 16px 34px rgba(0,0,0,.28)}
.dl-card-0{left:230px;z-index:14;transform:translateX(515px);opacity:0}
.dl-card-1{left:745px;z-index:16;transition:opacity .5s ease;opacity:0}
.dl-card-2{left:1260px;z-index:14;transform:translateX(-515px);opacity:0}
.dl-card-0.in,.dl-card-2.in{transform:translateX(0);opacity:1}
.dl-card-1.in{opacity:1}

.dl-pill{position:absolute;top:-30px;left:50%;transform:translateX(-50%);background:#3b82f6;color:#fff;font-weight:800;
  font-size:34px;letter-spacing:.02em;padding:14px 34px;border-radius:16px;white-space:nowrap;box-shadow:0 8px 18px rgba(0,0,0,.25)}
.dl-val{color:#2f80ed;font-weight:800;font-size:132px;white-space:nowrap;line-height:1;letter-spacing:-.01em}
.dl-var{margin-top:14px;font-weight:800;font-size:38px;height:46px;display:flex;align-items:center;gap:12px}
.dl-vi{width:34px;height:34px;flex:none}
.dl-var.up{color:#16a34a}
.dl-var.down{color:#e0322a}
.dl-var.flat{color:#8894ab;font-size:30px;letter-spacing:.04em}
.dl-foot{margin-top:70px;text-align:center;line-height:1.05}
.dl-lbl{font-weight:800;font-size:44px;color:#2f80ed}
.dl-name{font-weight:800;font-size:44px;color:#0b2b6b}
.dl-date{margin-top:16px;font-weight:600;font-size:30px;letter-spacing:.04em;color:#6b7fa3}

.dl.exit .dl-card{transition:opacity .7s ease;opacity:0!important;transform:none!important}
`;
