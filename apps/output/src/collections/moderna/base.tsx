import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { P } from "../../lib/params";
import { IS_VERTICAL } from "../../lib/orientation";

// Base común de la colección "Modernas": fondo de tinta, paneles 3D con canto y reflejo, luces de entrada y salida,
// y los textos compartidos (volanta con línea, título que sube palabra por palabra, cuerpo).
// Todas las clases llevan el prefijo nm- para no chocar con las de la colección Clásicas (que usa otros nombres y
// puede estar montada unos segundos a la vez durante el cambio de colección).
export const NM_CSS = `
.nm{position:absolute;inset:0;overflow:hidden;background:#050B1F;color:#F4F6FB;font-family:"Instrument Sans","Helvetica Neue",Arial,sans-serif;
  --ink:#050B1F;--ink2:#0A1636;--blue:#2F6BFF;--blue-soft:#7FA2FF;--paper:#F4F6FB;--mist:#A9B6D6;--line:rgba(169,182,214,.18);--red:#EE220C;--red-lit:#FF4B38;
  --display:"Archivo","Helvetica Neue",Arial,sans-serif;--text:"Instrument Sans","Helvetica Neue",Arial,sans-serif}
.nm-bg{position:absolute;inset:0;background:
  radial-gradient(1200px 700px at 88% -10%,rgba(47,107,255,.28),transparent 60%),
  radial-gradient(900px 600px at -10% 110%,rgba(47,107,255,.10),transparent 60%),
  linear-gradient(180deg,#061030 0%,#050B1F 55%,#03081A 100%)}
.nm-grain{position:absolute;inset:0;width:100%;height:100%;opacity:.07;mix-blend-mode:screen}

/* Escena: perspectiva común. Nada se ve hasta que arranca la entrada. */
.nm-sc{position:absolute;inset:0;z-index:20;perspective:2400px;perspective-origin:50% 42%;transform-style:preserve-3d}
.nm:not(.in) .nm-sc{visibility:hidden}

/* Panel 3D: canto (pe) detrás, cara (pf) con borde de luz y reflejo, y un brillo que cruza al entrar. */
.nm-card{position:absolute;transform-style:preserve-3d;transform:rotateY(var(--ry,0deg)) rotateX(var(--rx,0deg))}
.nm-float{position:absolute;inset:0;transform-style:preserve-3d;animation:nm-float 9s ease-in-out 2s infinite alternate}
@keyframes nm-float{from{transform:rotateY(0) translateZ(0)}to{transform:rotateY(-1.6deg) translateZ(18px)}}
.nm-pe{position:absolute;inset:0;border-radius:18px;background:linear-gradient(90deg,#0E2256,#040918);transform:translateZ(-22px);
  box-shadow:0 70px 140px -30px rgba(0,0,0,.85),0 40px 80px -30px rgba(47,107,255,.35)}
.nm-pf{position:absolute;inset:0;border-radius:18px;overflow:hidden;
  background:linear-gradient(155deg,rgba(26,46,104,.96) 0%,rgba(10,20,52,.97) 45%,rgba(6,12,34,.98) 100%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.28),inset 0 0 0 1px rgba(127,162,255,.16),inset 0 -40px 80px -40px rgba(47,107,255,.25)}
.nm-pf::after{content:"";position:absolute;inset:0;pointer-events:none;border-radius:inherit;z-index:6;background:linear-gradient(115deg,rgba(255,255,255,.10) 0%,rgba(255,255,255,0) 32%)}
.nm-sheen{position:absolute;inset:-10%;z-index:7;pointer-events:none;mix-blend-mode:screen;opacity:0;transform:translateX(-80%);
  background:linear-gradient(105deg,transparent 38%,rgba(160,190,255,.35) 46%,rgba(255,255,255,.95) 50%,rgba(160,190,255,.35) 54%,transparent 62%)}
.nm-card .nm-pf,.nm-card .nm-pe{opacity:0}
.in .nm-card{animation:nm-cardIn 1.1s cubic-bezier(.16,.9,.2,1) var(--d,0s) both}
.in .nm-card .nm-pf,.in .nm-card .nm-pe{animation:nm-lightUp 1.1s ease-out calc(var(--d,0s) + .08s) both}
.in .nm-card .nm-sheen{animation:nm-sheen 1s cubic-bezier(.4,0,.2,1) calc(var(--d,0s) + .3s) both}
.out .nm-card{animation:nm-cardOut 1s cubic-bezier(.6,0,.8,.3) var(--od,0s) both}
.out .nm-card .nm-pf,.out .nm-card .nm-pe{animation:nm-lightDown 1s ease-in var(--od,0s) both}
@keyframes nm-cardIn{from{transform:translateZ(-700px) translateY(40px) rotateY(calc(var(--ry,0deg) * -5)) rotateX(8deg)}to{transform:rotateY(var(--ry,0deg)) rotateX(var(--rx,0deg))}}
@keyframes nm-cardOut{from{transform:rotateY(var(--ry,0deg)) rotateX(var(--rx,0deg))}to{transform:translateZ(-600px) translateY(-20px) rotateY(calc(var(--ry,0deg) * 5)) rotateX(-6deg)}}
@keyframes nm-lightUp{0%{opacity:0;filter:brightness(0)}45%{opacity:1;filter:brightness(2.4)}100%{opacity:1;filter:brightness(1)}}
@keyframes nm-lightDown{0%{opacity:1;filter:brightness(1)}40%{opacity:1;filter:brightness(2.6)}100%{opacity:0;filter:brightness(3)}}
@keyframes nm-sheen{0%{opacity:1;transform:translateX(-80%)}100%{opacity:1;transform:translateX(80%)}}

/* Panel plano (de frente, sin canto): mismo material que la cara de los paneles 3D. */
.nm-panel{position:absolute;border-radius:18px;overflow:hidden;
  background:linear-gradient(155deg,rgba(26,46,104,.96) 0%,rgba(10,20,52,.97) 45%,rgba(6,12,34,.98) 100%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.28),inset 0 0 0 1px rgba(127,162,255,.16),inset 0 -40px 80px -40px rgba(47,107,255,.25),0 50px 100px -30px rgba(0,0,0,.8)}
.nm-panel.solid{background:linear-gradient(150deg,#4A82FF 0%,#2F6BFF 45%,#1C48C9 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.45),inset 0 0 0 1px rgba(255,255,255,.18),0 50px 100px -30px rgba(0,0,0,.8)}
.nm-panel.paper{background:linear-gradient(160deg,#FFFFFF,#E6ECF8);color:#0A1433;box-shadow:inset 0 1px 0 #fff,0 0 0 1px rgba(255,255,255,.6),0 50px 100px -30px rgba(0,0,0,.8)}
.nm-inner{position:absolute;inset:0;padding:44px 50px;display:flex;flex-direction:column;gap:18px}
.nm-lab{font-family:var(--display);font-weight:700;font-stretch:115%;font-size:15px;letter-spacing:.28em;text-transform:uppercase;color:var(--mist)}
.nm-caret{display:inline-block;width:.07em;height:.85em;margin-left:.04em;vertical-align:-.06em;animation:nm-blink .8s steps(1) infinite}

/* Luces: columna de luz, halo y destello horizontal. */
.nm-lights{position:absolute;inset:0;z-index:25;pointer-events:none;overflow:hidden}
.nm-beam{position:absolute;top:-20%;left:0;width:260px;height:140%;opacity:0;mix-blend-mode:screen;filter:blur(6px);transform:translateX(-400px) skewX(-14deg);
  background:linear-gradient(90deg,transparent,rgba(47,107,255,.25) 30%,rgba(190,210,255,.9) 48%,#fff 50%,rgba(190,210,255,.9) 52%,rgba(47,107,255,.25) 70%,transparent)}
.nm-halo{position:absolute;top:-10%;left:0;width:900px;height:120%;opacity:0;mix-blend-mode:screen;transform:translateX(-900px);background:radial-gradient(closest-side,rgba(47,107,255,.45),transparent)}
.nm-streak{position:absolute;left:0;right:0;top:50%;height:3px;margin-top:-1px;opacity:0;mix-blend-mode:screen;transform:scaleX(0);
  background:linear-gradient(90deg,transparent,rgba(127,162,255,.8) 20%,#fff 50%,rgba(127,162,255,.8) 80%,transparent);box-shadow:0 0 30px 6px rgba(47,107,255,.6)}
.in .nm-beam{animation:nm-beamLR 1.3s cubic-bezier(.45,0,.25,1) .05s forwards}
.in .nm-halo{animation:nm-haloLR 1.3s cubic-bezier(.45,0,.25,1) .05s forwards}
.in .nm-streak{animation:nm-streak .9s ease-out .3s forwards}
.out .nm-beam{animation:nm-beamRL 1.1s cubic-bezier(.45,0,.25,1) forwards}
.out .nm-halo{animation:nm-haloRL 1.1s cubic-bezier(.45,0,.25,1) forwards}
@keyframes nm-beamLR{0%{opacity:0;transform:translateX(-400px) skewX(-14deg)}12%{opacity:1}85%{opacity:1}100%{opacity:0;transform:translateX(2200px) skewX(-14deg)}}
@keyframes nm-haloLR{0%{opacity:0;transform:translateX(-900px)}20%{opacity:1}80%{opacity:.8}100%{opacity:0;transform:translateX(1900px)}}
@keyframes nm-streak{0%{opacity:0;transform:scaleX(0)}25%{opacity:1;transform:scaleX(1)}100%{opacity:0;transform:scaleX(1.2)}}
@keyframes nm-beamRL{0%{opacity:0;transform:translateX(2200px) skewX(14deg)}15%{opacity:1}85%{opacity:1}100%{opacity:0;transform:translateX(-400px) skewX(14deg)}}
@keyframes nm-haloRL{0%{opacity:0;transform:translateX(1900px)}20%{opacity:1}100%{opacity:0;transform:translateX(-900px)}}

/* Textos comunes */
.nm-kick{display:flex;align-items:center;gap:18px;font-family:var(--display);font-weight:700;font-stretch:115%;font-size:18px;letter-spacing:.3em;text-transform:uppercase;color:var(--blue-soft)}
.nm-kick .rule{width:56px;height:3px;background:var(--blue);transform-origin:left;box-shadow:0 0 14px rgba(47,107,255,.9);transform:scaleX(0)}
.nm-kick .date{color:var(--mist);font-weight:500}
.nm-ttl{font-family:var(--display);font-weight:800;font-stretch:88%;font-size:60px;line-height:1.02;letter-spacing:-.012em;color:var(--paper);text-wrap:balance}
.nm-ttl b{color:var(--blue-soft);font-weight:800}
.nm-w{display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.06em;margin-bottom:-.06em}
.nm-w>span{display:inline-block;transform:translateY(108%)}
.nm-body{flex:1;min-height:0;overflow:hidden;font-family:var(--text);font-weight:400;font-size:28px;line-height:1.42;color:var(--mist);white-space:pre-line}
.nm-body b{color:var(--paper);font-weight:600}
.nm-col{position:absolute;inset:0;padding:56px 60px 44px;display:flex;flex-direction:column;gap:28px}
.nm-kick,.nm-body{opacity:0}
.in .nm-kick{animation:nm-fade .5s ease 1s forwards}
.in .nm-kick .rule{animation:nm-draw .6s cubic-bezier(.2,.8,.2,1) 1s forwards}
.in .nm-w>span{animation:nm-rise .7s cubic-bezier(.2,.8,.2,1) forwards;animation-delay:calc(var(--t0,1.1s) + var(--i) * 28ms)}
.in .nm-body{animation:nm-up .8s cubic-bezier(.2,.8,.2,1) 1.5s forwards}
.out .nm-kick,.out .nm-ttl,.out .nm-body{transition:opacity .25s;opacity:0!important}
@keyframes nm-fade{to{opacity:1}}
@keyframes nm-fadeOut{from{opacity:1}to{opacity:0}}
@keyframes nm-draw{to{transform:scaleX(1)}}
@keyframes nm-rise{to{transform:translateY(0)}}
@keyframes nm-up{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
@keyframes nm-growX{from{transform:scaleX(0)}to{transform:none}}
@keyframes nm-kb{from{transform:scale(1.12)}to{transform:scale(1.02)}}
@keyframes nm-tick{to{transform:translateX(-50%)}}
@keyframes nm-blink{50%{opacity:0}}
`;

// Ciclo de vida de un contenido: entra al montarse y arranca la salida `lead` segundos antes del final.
export function useLife(durationSec: number | undefined, lead = 1.4): { cls: string } {
  const [phase, setPhase] = useState<"pre" | "in" | "out">("pre");
  useEffect(() => {
    const id = requestAnimationFrame(() => setPhase("in"));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (!durationSec) return;
    const t = setTimeout(() => setPhase("out"), Math.max(1000, (durationSec - lead) * 1000));
    return () => clearTimeout(t);
  }, [durationSec, lead]);
  return { cls: phase === "pre" ? "" : phase === "out" ? " in out" : " in" };
}

// Grano muy leve sobre el fondo (se dibuja una vez por contenido).
export function Grain() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const x = c?.getContext("2d");
    if (!c || !x) return;
    const img = x.createImageData(c.width, c.height);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    x.putImageData(img, 0, 0);
  }, []);
  return <canvas ref={ref} className="nm-grain" width={480} height={IS_VERTICAL ? 853 : 270} />;
}

export function Lights() {
  return <div className="nm-lights"><div className="nm-halo" /><div className="nm-beam" /><div className="nm-streak" /></div>;
}

// Panel 3D en coordenadas del lienzo (1920×1080 o 1080×1920). d/od: retardo de entrada y de salida.
export function Card({ x, y, w, h, ry = 0, rx = 0, d = 0, od = 0, cls = "", style, children }: {
  x: number; y: number; w: number; h: number; ry?: number; rx?: number; d?: number; od?: number; cls?: string; style?: CSSProperties; children?: ReactNode;
}) {
  const st = { left: x, top: y, width: w, height: h, "--ry": `${ry}deg`, "--rx": `${rx}deg`, "--d": `${d}s`, "--od": `${od}s`, ...style } as CSSProperties;
  return (
    <div className={"nm-card " + cls} style={st}>
      <div className="nm-float">
        <div className="nm-pe" />
        <div className="nm-pf">{children}<div className="nm-sheen" /></div>
      </div>
    </div>
  );
}

// Volanta con línea; `date` opcional a la derecha (en gris).
export function Kick({ text, date }: { text: string; date?: string }) {
  return <div className="nm-kick"><span className="rule" />{text}{date ? <span className="date">· {date}</span> : null}</div>;
}

// Título que sube palabra por palabra. Admite **negrita** (en celeste).
export function Words({ text, className = "nm-ttl", t0, style }: { text: string; className?: string; t0?: number; style?: CSSProperties }) {
  let i = 0;
  const parts = (text ?? "").split(/(\*\*.+?\*\*)/).filter(Boolean);
  const st = (t0 != null ? { ...style, "--t0": `${t0}s` } : style) as CSSProperties | undefined;
  return (
    <div className={className} style={st}>
      {parts.map((part, pi) => {
        const bold = part.startsWith("**") && part.endsWith("**");
        const txt = bold ? part.slice(2, -2) : part;
        return txt.split(/(\s+)/).filter(Boolean).map((w, wi) => {
          if (/^\s+$/.test(w)) return " ";
          const inner = <span style={{ ["--i" as any]: i++ }}>{w}</span>;
          return <span key={`${pi}-${wi}`} className="nm-w">{bold ? <b>{inner}</b> : inner}</span>;
        });
      })}
    </div>
  );
}

// Texto con **negrita** (escapado).
export function richHTML(t: string): string {
  const esc = (t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}

// Achica la fuente hasta que el texto entra en su caja.
export function useFit(ref: React.RefObject<HTMLElement>, max: number, min: number, deps: unknown[]): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let s = max;
    el.style.fontSize = s + "px";
    let guard = 0;
    while (el.scrollHeight > el.clientHeight + 1 && s > min && guard++ < 80) { s -= 2; el.style.fontSize = s + "px"; }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

// Como useFit, pero para textos sin caja de alto fijo: achica hasta que el alto del texto no pase de `limit` px.
export function useFitMax(ref: React.RefObject<HTMLElement>, max: number, min: number, limit: number, deps: unknown[]): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let s = max;
    el.style.fontSize = s + "px";
    while (el.scrollHeight > limit && s > min) { s -= 2; el.style.fontSize = s + "px"; }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}
const MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const fechaLarga = (iso?: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getDate()} de ${MESES_LARGO[d.getMonth()]}`;
};
export const horaCorta = (iso?: string): string => {
  const d = iso ? new Date(iso) : new Date();
  return Number.isNaN(d.getTime()) ? "" : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// Máquina de escribir: devuelve el texto escrito hasta ahora (arranca `startMs` después de montar o de cambiar el texto).
export function useTypewriter(text: string, startMs: number, totalMs: number): string {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const per = Math.max(12, Math.min(40, totalMs / Math.max(1, text.length)));
    let iv: ReturnType<typeof setInterval> | undefined;
    const t = setTimeout(() => { iv = setInterval(() => setN((k) => { if (k >= text.length) { clearInterval(iv); return k; } return k + 1; }), per); }, startMs);
    return () => { clearTimeout(t); if (iv) clearInterval(iv); };
  }, [text, startMs, totalMs]);
  return text.slice(0, n);
}

// Cuenta 0→objetivo con ease-out, a partir de `delayMs`.
// ?freeze (revisión de demos): los contadores muestran directo el valor final.
const FREEZE = P.has("freeze");

export function useCount(target: number, delayMs: number, ms = 1200): number {
  const [v, setV] = useState(FREEZE ? target : 0);
  useEffect(() => {
    if (FREEZE) { setV(target); return; }
    let raf = 0;
    const t0 = performance.now() + delayMs;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0) / ms));
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, delayMs, ms]);
  return v;
}

// Punto de miles siempre (1.403) y coma decimal, con los decimales de `like` ("2,9" → 1 decimal).
export function fmtNum(n: number, like = ""): string {
  const m = /,(\d+)/.exec(like);
  const dec = m ? Math.min(3, m[1]!.length) : 0;
  const [int, frac] = n.toFixed(dec).split(".");
  const g = int!.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return frac ? `${g},${frac}` : g;
}
