import { useEffect, useRef, useState } from "react";
import type { EfemeridesData, EfemeridesEntry } from "@newsroller/shared";
import { formatEfemeridesDate } from "@newsroller/shared";
import fondo from "../assets/fondo2.jpg";
import { Chrome } from "./Chrome";
import { useAutoFit } from "../lib/autofit";
import { IS_VERTICAL } from "../lib/orientation";

const WANT_AUDIO = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("audio");

const CUBE_MS = 900; // duración del giro entre efemérides
const FALL_MS = 850; // duración de la caída de salida
const HALF = IS_VERTICAL ? 480 : 900; // mitad del ancho de la escena: profundidad del cubo

// Texto que se escribe solo. El resto del texto se renderiza invisible para que el layout (y el auto-fit)
// no salte mientras se escribe; `ms` es lo que tarda en escribirse completo.
function Typed({ text, start, ms }: { text: string; start: boolean; ms: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!start) return;
    const t0 = performance.now();
    const id = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / ms);
      setN(Math.round(text.length * p));
      if (p >= 1) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [start, text, ms]);
  const typing = start && n < text.length;
  return (
    <>
      <span>{text.slice(0, n)}</span>
      {typing && <span className="ef-caret" />}
      <span style={{ visibility: "hidden" }}>{text.slice(n)}</span>
    </>
  );
}

// Una cara del cubo: panel blanco + foto + pill + fecha + título + cuerpo.
function Face({ entry, i, idx, slotMs, play }: { entry: EfemeridesEntry; i: number; idx: number; slotMs: number; play: boolean }) {
  const titleRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  useAutoFit(titleRef, IS_VERTICAL ? 100 : 118, 60, [entry.title]);
  useAutoFit(bodyRef, IS_VERTICAL ? 48 : 44, 26, [entry.body]);

  // El texto empieza a escribirse cuando la cara ya está de frente (la 1ª, tras la cascada de entrada).
  const active = idx === i;
  const [go, setGo] = useState(false);
  useEffect(() => {
    if (!active || !play || go) return;
    const t = setTimeout(() => setGo(true), i === 0 ? 1250 : CUBE_MS - 250);
    return () => clearTimeout(t);
  }, [active, play, go, i]);

  const typeMs = Math.min(Math.max((entry.body?.length ?? 0) * 26, 900), slotMs * 0.5);

  return (
    <div className={"ef-face" + (i === 0 ? " first" : "")} style={{ transform: `rotateY(${90 * i}deg) translateZ(${HALF}px)` }}>
      <div className="ef-panel" />
      <div className="ef-media ef-el">
        {entry.media_kind === "video" ? (
          <video src={entry.media_url} autoPlay muted={!WANT_AUDIO} loop playsInline />
        ) : (
          <img src={entry.media_url} alt="" />
        )}
      </div>
      <div className="ef-pill ef-el">UN DÍA COMO HOY</div>
      <div className="ef-date ef-el">{formatEfemeridesDate(entry)}</div>
      <div className="ef-text">
        <div className="ef-title ef-el" ref={titleRef}>{entry.title}</div>
        <div className="ef-body ef-el" ref={bodyRef}><Typed text={entry.body ?? ""} start={go} ms={typeMs} /></div>
      </div>
    </div>
  );
}

// Placa Efemérides ("Un día como hoy"): 1, 2 o 3 efemérides en el mismo pase. Cada una: media vertical
// a la izquierda; pill fija + fecha + título + cuerpo (que se escribe solo) a la derecha, sobre un panel
// blanco. Entre una y otra el bloque gira como un cubo. Al final TODO cae junto y sale por detrás del
// ticker. La duración del bloque se reparte en partes iguales entre las efemérides. Marco Chrome.
export function Efemerides({ data, durationSec }: { data: EfemeridesData; durationSec?: number }) {
  const entries: EfemeridesEntry[] = [data, ...(data.more ?? [])].slice(0, 3);
  const n = entries.length;
  const slotMs = ((durationSec ?? 10) * 1000) / n;

  const [play, setPlay] = useState(false);
  const [idx, setIdx] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setPlay(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Giros entre efemérides y salida final (la caída arranca justo antes de que termine el bloque).
  useEffect(() => {
    if (!durationSec) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let k = 1; k < n; k++) timers.push(setTimeout(() => setIdx(k), Math.max(1200, k * slotMs - CUBE_MS * 0.8)));
    timers.push(setTimeout(() => setExiting(true), Math.max(1000, durationSec * 1000 - FALL_MS - 50)));
    return () => timers.forEach(clearTimeout);
  }, [durationSec, n, slotMs]);

  return (
    <div className={"ef" + (play ? " play" : "") + (IS_VERTICAL ? " v" : "")} style={{ position: "absolute", inset: 0 }}>
      <style>{CSS + (IS_VERTICAL ? CSS_V : "")}</style>
      <img className="ef-bg" src={fondo} alt="" />
      <Chrome />

      <div className={"ef-fall" + (exiting ? " exit" : "")}>
        <div className="ef-scene">
          <div className="ef-cube" style={{ transform: `translateZ(-${HALF}px) rotateY(${-90 * idx}deg)` }}>
            {entries.map((e, i) => <Face key={i} entry={e} i={i} idx={idx} slotMs={slotMs} play={play} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// Vertical: el cubo pasa a ser una escena angosta y alta; la foto arriba y el texto debajo.
const CSS_V = `
.ef.v .ef-scene{left:60px;top:150px;width:960px;height:1620px;perspective:2200px}
.ef.v .ef-media{left:50px;top:50px;width:860px;height:640px}
.ef.v .ef-pill{left:50px;top:720px}
.ef.v .ef-date{left:56px;top:830px}
.ef.v .ef-text{left:50px;right:50px;top:900px;bottom:50px}
.ef.v .ef-title{max-height:300px}
`;

const CSS = `
.ef{font-family:Inter,system-ui,sans-serif}
.ef-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}

/* Todo el bloque (panel, foto, textos) va dentro de .ef-fall: al salir cae ENTERO, junto, por detrás del ticker. */
.ef-fall{position:absolute;inset:0;z-index:13}
.ef-fall.exit{transform:translateY(${IS_VERTICAL ? 2000 : 1150}px);transition:transform ${FALL_MS}ms cubic-bezier(.5,0,.9,.3)}

/* Cubo: cada efeméride es una cara; girar el cubo -90° trae la siguiente desde la derecha. */
.ef-scene{position:absolute;left:60px;top:88px;width:1800px;height:820px;perspective:3200px}
.ef-cube{position:absolute;inset:0;transform-style:preserve-3d;transition:transform ${CUBE_MS}ms cubic-bezier(.65,0,.35,1)}
.ef-face{position:absolute;inset:0;backface-visibility:hidden}

.ef-panel{position:absolute;inset:0;background:#fff;border-radius:40px;box-shadow:0 18px 40px rgba(0,0,0,.3)}
.ef-media{position:absolute;left:50px;top:62px;width:540px;height:700px;
  border-radius:24px;overflow:hidden;background:#c9ccd2}
.ef-media img,.ef-media video{width:100%;height:100%;object-fit:cover;display:block}

.ef-pill{position:absolute;left:646px;top:94px;background:#3b82f6;color:#fff;font-weight:800;
  font-size:38px;letter-spacing:.02em;padding:14px 34px;border-radius:16px;box-shadow:0 8px 20px rgba(0,0,0,.18)}
.ef-date{position:absolute;left:650px;top:212px;color:#2f80ed;font-weight:800;font-size:44px;letter-spacing:.02em}

/* Título y cuerpo en una columna: el cuerpo va pegado debajo del título, sea cual sea su alto. */
.ef-text{position:absolute;left:646px;right:120px;top:274px;bottom:60px;display:flex;flex-direction:column;gap:22px;min-height:0}
.ef-title{flex:0 0 auto;color:#0b2b6b;font-weight:800;font-size:118px;line-height:.96;letter-spacing:-.01em;max-height:230px;overflow:hidden}
.ef-body{flex:1 1 auto;min-height:0;margin-left:4px;color:#2f80ed;font-weight:600;font-size:44px;line-height:1.3;overflow:hidden;white-space:pre-wrap}
.ef-caret{display:inline-block;width:4px;height:.95em;margin-left:2px;background:#2f80ed;vertical-align:-.12em;animation:ef-blink .7s steps(1) infinite}
@keyframes ef-blink{50%{opacity:0}}

/* Entrada (sólo la 1ª cara; las demás llegan girando): panel, foto desde la izquierda, resto en cascada desde la derecha. */
.ef-face:not(.first) .ef-el{opacity:1}
.ef-face.first .ef-el{opacity:0}
.ef-face.first .ef-panel{opacity:0}
.ef.play .ef-face.first .ef-panel{animation:ef-fade .5s ease .1s forwards}
.ef.play .ef-face.first .ef-media{animation:ef-inLeft .6s cubic-bezier(.2,.8,.2,1) .35s forwards}
.ef.play .ef-face.first .ef-pill{animation:ef-inRight .5s cubic-bezier(.2,.8,.2,1) .55s forwards}
.ef.play .ef-face.first .ef-date{animation:ef-inRight .5s cubic-bezier(.2,.8,.2,1) .68s forwards}
.ef.play .ef-face.first .ef-title{animation:ef-inRight .5s cubic-bezier(.2,.8,.2,1) .81s forwards}
.ef.play .ef-face.first .ef-body{animation:ef-inRight .5s cubic-bezier(.2,.8,.2,1) .94s forwards}
@keyframes ef-fade{from{opacity:0}to{opacity:1}}
@keyframes ef-inLeft{from{opacity:0;transform:translateX(-100px)}to{opacity:1;transform:translateX(0)}}
@keyframes ef-inRight{from{opacity:0;transform:translateX(70px)}to{opacity:1;transform:translateX(0)}}
`;
