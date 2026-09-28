import { useEffect, useState } from "react";
import { API_BASE } from "../lib/scene";
import { IS_VERTICAL } from "../lib/orientation";
import type { ZocaloItem } from "@newsroller/shared";

// Zócalo del newsticker (Ajustes → Newsticker → Zócalo): un PNG + pastilla de texto que entra sobre
// el newsticker real del feed de somosciclico.com. Vive DENTRO de Chrome (el marco que dibuja ese
// newsticker), así que se apaga solo en las placas que no lo montan: Última Hora, Video Full,
// Obituario (clásicos y modernos) y el bloque "Ahora" de Modernas (que usa un ticker de alerta,
// no el del feed). Sólo en horizontal: el newsticker de Zócalo no existe en el output vertical.
const HOLD_MS = 15_000;   // tiempo en pantalla de cada entrada
const GAP_MS = 60_000;    // pausa entre una salida y la siguiente entrada
const CYCLE_MS = HOLD_MS + GAP_MS;
const FIXED_MS = 2 * 60_000; // últimos 2 min antes de su hora de salida: queda fijo
const EDGE_MS = 450;         // duración de la animación de entrada/salida
const BLINK_EVERY_MS = 5_000; // parpadeo cada 5s mientras está mostrado
const BLINK_MS = 380;

let cache: ZocaloItem[] = [];

function hmToMs(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s || "");
  if (!m) return NaN;
  return (Number(m[1]) * 60 + Number(m[2])) * 60_000;
}
function dayMs(d: Date): number {
  return ((d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds()) * 1000 + d.getMilliseconds();
}
function isEligible(it: ZocaloItem, now: Date): boolean {
  if (!it.active || !it.imageUrl || !it.pillText) return false;
  if (it.days?.length && !it.days.includes(now.getDay())) return false;
  const start = hmToMs(it.startTime), end = hmToMs(it.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === end) return false;
  const t = dayMs(now);
  return start < end ? t >= start && t < end : t >= start || t < end;
}
function msToEnd(it: ZocaloItem, now: Date): number {
  const end = hmToMs(it.endTime);
  const t = dayMs(now);
  return end >= t ? end - t : 24 * 60 * 60_000 - t + end;
}

export function ZocaloOverlay() {
  const [items, setItems] = useState<ZocaloItem[]>(cache);
  const [, setTick] = useState(0);

  useEffect(() => {
    let on = true;
    const load = () => {
      fetch(`${API_BASE}/api/settings`).then((r) => r.json()).then((d) => {
        if (!on) return;
        const list = Array.isArray(d?.zocalos) ? (d.zocalos as ZocaloItem[]) : [];
        cache = list;
        setItems(list);
      }).catch(() => {});
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => { on = false; clearInterval(iv); };
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(iv);
  }, []);

  if (IS_VERTICAL || !items.length) return null;

  const now = new Date();
  const on = items.filter((it) => isEligible(it, now));
  if (!on.length) return null;

  // El que está por cerrar (últimos 2 min de su ventana) queda fijo en pantalla, sin entrar en el loop.
  const closing = on.filter((it) => msToEnd(it, now) <= FIXED_MS).sort((a, b) => msToEnd(a, now) - msToEnd(b, now))[0];

  let item: ZocaloItem | undefined;
  let phase: "in" | "hold" | "out" | undefined;
  let blink = false;

  if (closing) {
    item = closing;
    phase = "hold";
    blink = Date.now() % BLINK_EVERY_MS < BLINK_MS;
  } else {
    const nowMs = Date.now();
    const within = nowMs % CYCLE_MS;
    if (within < HOLD_MS) {
      const slot = Math.floor(nowMs / CYCLE_MS);
      item = on[slot % on.length];
      phase = within < EDGE_MS ? "in" : within > HOLD_MS - EDGE_MS ? "out" : "hold";
      const sinceIn = within - EDGE_MS;
      blink = phase === "hold" && sinceIn > 0 && sinceIn % BLINK_EVERY_MS < BLINK_MS;
    }
  }

  if (!item || !phase) return null;

  return (
    <div className={`zc-wrap zc-${item.position} zc-${phase}${blink ? " zc-blink" : ""}`} key={item.id}>
      <style>{CSS}</style>
      <div className="zc-pill">{item.pillText}</div>
      <img className="zc-img" src={item.imageUrl} alt="" />
    </div>
  );
}

const CSS = `
.zc-wrap{position:absolute;bottom:110px;display:flex;align-items:flex-end;gap:14px;z-index:27;pointer-events:none}
.zc-wrap.zc-derecha{right:5%}
.zc-wrap.zc-centro{left:50%;transform:translateX(-50%)}
.zc-pill{background:#2f6bff;color:#fff;font-weight:700;font-size:20px;letter-spacing:.01em;padding:10px 20px;border-radius:999px;box-shadow:0 6px 16px rgba(0,0,0,.28);white-space:nowrap}
.zc-img{max-height:216px;width:auto;display:block;filter:drop-shadow(0 6px 16px rgba(0,0,0,.3))}
.zc-blink{animation:zc-flash ${BLINK_MS}ms ease}
@keyframes zc-flash{0%,100%{opacity:1}50%{opacity:.25}}
.zc-wrap.zc-derecha.zc-in{animation:zc-in-r ${EDGE_MS}ms cubic-bezier(.2,.9,.3,1) both}
.zc-wrap.zc-derecha.zc-out{animation:zc-out-r ${EDGE_MS}ms cubic-bezier(.4,0,.8,.2) both}
@keyframes zc-in-r{from{opacity:0;transform:translateY(46px)}to{opacity:1;transform:translateY(0)}}
@keyframes zc-out-r{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(46px)}}
.zc-wrap.zc-centro.zc-in{animation:zc-in-c ${EDGE_MS}ms cubic-bezier(.2,.9,.3,1) both}
.zc-wrap.zc-centro.zc-out{animation:zc-out-c ${EDGE_MS}ms cubic-bezier(.4,0,.8,.2) both}
@keyframes zc-in-c{from{opacity:0;transform:translate(-50%,46px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes zc-out-c{from{opacity:1;transform:translate(-50%,0)}to{opacity:0;transform:translate(-50%,46px)}}
`;
