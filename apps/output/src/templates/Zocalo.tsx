import { useEffect, useRef, useState } from "react";
import { API_BASE } from "../lib/scene";
import { IS_VERTICAL } from "../lib/orientation";
import type { ZocaloItem } from "@newsroller/shared";

// Zócalo del newsticker (Ajustes → Newsticker → Zócalo): un PNG + pastilla de texto que entra sobre
// el newsticker real del feed de somosciclico.com. Vive DENTRO de Chrome (el marco que dibuja ese
// newsticker), así que se apaga solo en las placas que no lo montan: Última Hora, Video Full,
// Obituario (clásicos y modernos) y el bloque "Ahora" de Modernas (que usa un ticker de alerta,
// no el del feed). Sólo en horizontal: el newsticker de Zócalo no existe en el output vertical.
const DEFAULT_HOLD_SEC = 15;   // tiempo en pantalla de cada entrada
const DEFAULT_GAP_SEC = 60;    // pausa entre una salida y la siguiente entrada
const FIXED_MS = 2 * 60_000;   // últimos 2 min antes de su hora de salida: queda fijo
const EDGE_MS = 450;           // duración de la animación de entrada/salida (con efecto)
const BLINK_EVERY_MS = 5_000;  // parpadeo cada 5s mientras está mostrado (con efecto)
const BLINK_MS = 380;

let cache: ZocaloItem[] = [];
let holdSecCache = DEFAULT_HOLD_SEC;
let gapSecCache = DEFAULT_GAP_SEC;
let effectsCache = true;

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
  const [holdSec, setHoldSec] = useState(holdSecCache);
  const [gapSec, setGapSec] = useState(gapSecCache);
  const [effects, setEffects] = useState(effectsCache);
  const [, setTick] = useState(0);
  const [overlap, setOverlap] = useState(0); // cuánto se mete el PNG sobre la pastilla (mitad de su ancho)
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let on = true;
    const load = () => {
      fetch(`${API_BASE}/api/settings`).then((r) => r.json()).then((d) => {
        if (!on) return;
        const list = Array.isArray(d?.zocalos) ? (d.zocalos as ZocaloItem[]) : [];
        cache = list;
        setItems(list);
        holdSecCache = Number(d?.zocaloDurationSec) > 0 ? Number(d.zocaloDurationSec) : DEFAULT_HOLD_SEC;
        gapSecCache = Number(d?.zocaloIntervalSec) > 0 ? Number(d.zocaloIntervalSec) : DEFAULT_GAP_SEC;
        effectsCache = d?.zocaloEffects !== false;
        setHoldSec(holdSecCache); setGapSec(gapSecCache); setEffects(effectsCache);
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

  const HOLD_MS = holdSec * 1000;
  const GAP_MS = gapSec * 1000;
  const CYCLE_MS = HOLD_MS + GAP_MS;

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
    blink = effects && Date.now() % BLINK_EVERY_MS < BLINK_MS;
  } else {
    const nowMs = Date.now();
    const within = nowMs % CYCLE_MS;
    if (within < HOLD_MS) {
      const slot = Math.floor(nowMs / CYCLE_MS);
      item = on[slot % on.length];
      const edge = effects ? EDGE_MS : 0;
      phase = within < edge ? "in" : within > HOLD_MS - edge ? "out" : "hold";
      const sinceIn = within - edge;
      blink = effects && phase === "hold" && sinceIn > 0 && sinceIn % BLINK_EVERY_MS < BLINK_MS;
    }
  }

  if (!item || !phase) return null;

  const cls = [
    "zc-wrap",
    `zc-${item.position}`,
    effects ? `zc-${phase}` : "zc-noeffect",
    blink ? "zc-blink" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={cls} key={item.id}>
      <style>{CSS}</style>
      {/* La "cola" de la pastilla (paddingRight extra) se compensa 1 a 1 con el margen negativo: lo que se
          agrega de un lado se resta del otro, así el PNG le come SOLO la cola (que asoma por su transparencia)
          y nunca el texto, que queda siempre afuera del solapamiento. */}
      <div className="zc-pill" style={{ paddingRight: 26 + overlap, marginRight: -overlap }}>{item.pillText}</div>
      <img
        ref={imgRef}
        className="zc-img"
        src={item.imageUrl}
        alt=""
        onLoad={(e) => setOverlap(e.currentTarget.getBoundingClientRect().width / 2)}
      />
    </div>
  );
}

const CSS = `
.zc-wrap{position:absolute;bottom:110px;display:flex;align-items:flex-end;z-index:27;pointer-events:none}
.zc-wrap.zc-derecha{right:5%}
.zc-wrap.zc-centro{left:50%;transform:translateX(-50%)}
.zc-pill{position:relative;z-index:1;background:linear-gradient(90deg,rgba(0,4,40,.75) 0%,rgba(0,4,40,0) 46px),#0d2fe0;color:#fff;font-weight:700;font-size:20px;letter-spacing:.01em;padding:10px 26px 10px 30px;border-radius:0;box-shadow:0 3px 10px rgba(0,0,0,.2);white-space:nowrap}
.zc-img{position:relative;z-index:2;max-height:216px;width:auto;display:block;filter:drop-shadow(0 6px 16px rgba(0,0,0,.3));box-shadow:inset 0 -16px 18px -12px rgba(0,0,0,.55)}
.zc-blink{animation:zc-flash ${BLINK_MS}ms ease}
@keyframes zc-flash{0%,100%{filter:brightness(1)}50%{filter:brightness(1.35) drop-shadow(0 0 14px rgba(255,255,255,.4))}}
.zc-wrap.zc-derecha.zc-in{animation:zc-in-r ${EDGE_MS}ms cubic-bezier(.2,.9,.3,1) both}
.zc-wrap.zc-derecha.zc-out{animation:zc-out-r ${EDGE_MS}ms cubic-bezier(.4,0,.8,.2) both}
@keyframes zc-in-r{from{opacity:0;transform:translateY(46px)}to{opacity:1;transform:translateY(0)}}
@keyframes zc-out-r{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(46px)}}
.zc-wrap.zc-centro.zc-in{animation:zc-in-c ${EDGE_MS}ms cubic-bezier(.2,.9,.3,1) both}
.zc-wrap.zc-centro.zc-out{animation:zc-out-c ${EDGE_MS}ms cubic-bezier(.4,0,.8,.2) both}
@keyframes zc-in-c{from{opacity:0;transform:translate(-50%,46px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes zc-out-c{from{opacity:1;transform:translate(-50%,0)}to{opacity:0;transform:translate(-50%,46px)}}
`;
