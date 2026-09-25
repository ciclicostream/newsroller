import { useEffect, useState } from "react";
import type { ListaData, ListaItem } from "@newsroller/shared";
import fondo from "../assets/fondo2.jpg";
import { Chrome } from "./Chrome";
import { IS_VERTICAL } from "../lib/orientation";
import { useForcePlay } from "../lib/autoplay";

const WANT_AUDIO = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("audio");

const INTRO_MS = 1000; // el foco arranca en el 1º ítem y empieza a pasar cuando termina la entrada
const EXIT_MS = 900; // la salida arranca este tiempo antes de que termine el bloque

// Color de relleno de la miniatura/tapa cuando el ítem no tiene imagen (con las iniciales encima).
function fallbackBg(i: number): string {
  return `linear-gradient(160deg,hsl(${208 + (i % 10) * 7} 62% 52%),hsl(${222 + (i % 10) * 7} 66% 27%))`;
}
const initials = (t: string) => t.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function Art({ item, i, className }: { item: ListaItem; i: number; className: string }) {
  return item.image_url
    ? <div className={className} style={{ backgroundImage: `url(${item.image_url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
    : <div className={className} style={{ background: fallbackBg(i) }}>{initials(item.title)}</div>;
}

// El audio del ítem con foco: se monta al recibir el foco y se desmonta al perderlo (corta solo).
function ItemAudio({ src }: { src: string }) {
  const ref = useForcePlay<HTMLAudioElement>();
  return <audio ref={ref} src={src} autoPlay muted={!WANT_AUDIO} />;
}

// Placa Lista (vive en Informes): lista completa con foco. Panel blanco con dos zonas suaves: a la izquierda
// pill + título + foco (tapa, número o dato, nombre, descripción, audio); a la derecha la lista, con la fila
// del foco resaltada y su barra de progreso. Entrada en cascada; salida estándar (baja detrás del ticker).
export function Lista({ data, durationSec }: { data: ListaData; durationSec?: number }) {
  const items = (data.items ?? []).slice(0, 10);
  const n = items.length;
  const sec = data.sec_per_item ?? 5;
  const numbered = data.numbered !== false;
  const [play, setPlay] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setPlay(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (!durationSec) return;
    const t = setTimeout(() => setExiting(true), Math.max(1000, durationSec * 1000 - EXIT_MS - 50));
    return () => clearTimeout(t);
  }, [durationSec]);

  // El foco pasa de ítem en ítem (una sola vez, sin dar la vuelta) y se queda en el último hasta la salida.
  useEffect(() => {
    setIdx(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let k = 1; k < n; k++) timers.push(setTimeout(() => setIdx(k), INTRO_MS + k * sec * 1000));
    return () => timers.forEach(clearTimeout);
  }, [n, sec]);

  const cur = items[Math.min(idx, n - 1)];
  const curI = Math.min(idx, n - 1);

  return (
    <div className={"ls" + (play ? " play" : "") + (exiting ? " exit" : "") + (IS_VERTICAL ? " v" : "")} style={{ position: "absolute", inset: 0, ["--sec" as any]: sec + "s" }}>
      <style>{CSS + (IS_VERTICAL ? CSS_V : "")}</style>
      <img className="ls-bg" src={fondo} alt="" />
      <Chrome />

      <div className="ls-panel fx-up">
        <div className="ls-left">
          <div className="ls-pill fx-left">{data.kicker?.trim() || "LISTA"}</div>
          <h2 className="ls-title fx-left">{data.title}</h2>
          {cur && (
            <div className={"ls-zone ls-focus fx-left" + (numbered ? "" : " nonum")}>
              <div className="ls-fhead">
                <Art key={"c" + curI} item={cur} i={curI} className="ls-cover" />
                <div className="ls-fmeta" key={"m" + curI}>
                  <div className="ls-ftop">
                    {numbered ? <div className="ls-mark">{curI + 1}</div> : cur.value ? <div className="ls-mark">{cur.value}</div> : null}
                    <div className="ls-ftitle">{cur.title}</div>
                    {(cur.subtitle || (numbered && cur.value && !IS_VERTICAL)) && (
                      <div className="ls-fsub">{[cur.subtitle, numbered && !IS_VERTICAL ? cur.value : ""].filter(Boolean).join(" · ")}</div>
                    )}
                  </div>
                  {cur.value && <div className="ls-fdato">{cur.value}</div>}
                </div>
              </div>
              <div className="ls-fbody">
                {cur.text && <div className="ls-fdesc" key={"d" + curI}>{cur.text}</div>}
                {cur.audio_url && (
                  <div className="ls-audio">
                    <div className="eq"><i /><i /><i /><i /><i /><i /><i /></div>
                    <span>SONANDO</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="ls-zone ls-list fx-right">
          {items.map((it, i) => (
            <div key={i} className={"ls-row" + (i === curI ? " on" : "")} style={{ ["--i" as any]: i }}>
              {numbered && <div className="ls-rank">{i + 1}</div>}
              <Art item={it} i={i} className="ls-thumb" />
              <div className="ls-rt">
                <div className="ls-rtitle">{it.title}</div>
                {it.subtitle && <div className="ls-rsub">{it.subtitle}</div>}
              </div>
              {it.value && <div className="ls-val">{it.value}</div>}
              <div className="ls-prog"><i /></div>
            </div>
          ))}
        </div>
      </div>

      {cur?.audio_url && <ItemAudio key={curI} src={cur.audio_url} />}
    </div>
  );
}

const CSS_V = `
.ls.v .ls-panel{left:40px;top:170px;width:1000px;height:1605px;display:flex;flex-direction:column;gap:22px;padding:46px 46px 40px}
.ls.v .ls-left{display:contents}
.ls.v .ls-title{font-size:60px}
.ls.v .ls-focus{flex:none;height:452px}
.ls.v .ls-cover{width:240px;height:240px}
.ls.v .ls-fhead{align-items:stretch}
.ls.v .ls-fmeta{justify-content:space-between}
.ls.v .ls-mark{font-size:84px}
.ls.v .ls-focus.nonum .ls-mark{display:none}
.ls.v .ls-fdato{display:block;font-weight:800;font-size:50px;line-height:1;letter-spacing:-.02em;color:#0b4a9c;font-variant-numeric:tabular-nums}
.ls.v .ls-list{position:static;width:auto;flex:1;min-height:0}
.ls.v .ls-row{max-height:124px}
.ls.v .ls-thumb{width:46px;height:46px}
`;

const CSS = `
.ls{font-family:Inter,system-ui,sans-serif;color:#fff}
.ls-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}

/* Panel blanco > dos zonas en gris azulado suave. Radios: 44 panel, 30 zonas, 14 filas, 12 miniaturas. */
.ls-panel{position:absolute;left:85px;top:95px;width:1435px;height:850px;background:#fff;border-radius:44px;box-shadow:0 30px 70px rgba(0,0,0,.45),0 2px 0 rgba(255,255,255,.6) inset}
.ls-left{position:absolute;left:44px;top:44px;width:690px;bottom:44px;display:flex;flex-direction:column;gap:22px}
.ls-pill{align-self:flex-start;background:#3b82f6;color:#fff;font-weight:800;font-size:30px;letter-spacing:.06em;padding:9px 26px;border-radius:12px;box-shadow:0 8px 16px -8px rgba(59,130,246,.9)}
.ls-title{margin:0;color:#0b4a9c;font-weight:800;font-size:58px;line-height:1.04;letter-spacing:-.02em;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.ls-zone{background:#eef2f8;border:1px solid #e0e7f2;border-radius:30px}
.ls-focus{flex:1;min-height:0;padding:28px;display:flex;flex-direction:column;justify-content:space-between}
.ls-fhead{display:flex;gap:28px;align-items:center}
.ls-cover{width:274px;height:274px;flex:none;border-radius:20px;box-shadow:0 22px 30px -16px rgba(10,40,100,.6);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:92px;letter-spacing:-.02em;animation:ls-swap .45s cubic-bezier(.2,.8,.2,1)}
.ls-fmeta{display:flex;flex-direction:column;justify-content:center;min-width:0;animation:ls-swap .45s cubic-bezier(.2,.8,.2,1)}
.ls-ftop{display:flex;flex-direction:column;gap:10px}
.ls-fdato{display:none}
.ls-mark{color:#EE220C;font-weight:900;font-size:100px;line-height:.85;letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.ls-ftitle{color:#0b4a9c;font-weight:800;font-size:38px;line-height:1.06;letter-spacing:-.01em;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.ls-fsub{color:#4a78c4;font-weight:600;font-size:25px;line-height:1.15;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ls-focus.nonum .ls-mark{color:#4a78c4;font-size:36px;font-weight:800;letter-spacing:0;line-height:1}
.ls-focus.nonum .ls-ftitle{color:#EE220C;font-size:44px}
.ls-fbody{display:flex;flex-direction:column;gap:16px}
.ls-fdesc{color:#2a5fb8;font-size:26px;line-height:1.3;font-weight:500;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;animation:ls-swap .45s cubic-bezier(.2,.8,.2,1)}
.ls-audio{align-self:flex-start;display:inline-flex;align-items:center;gap:14px;background:#fff;border-radius:999px;padding:8px 22px 8px 18px;color:#1e56b3;font-weight:700;font-size:19px;letter-spacing:.1em;box-shadow:0 4px 10px -4px rgba(10,40,100,.25)}
.eq{display:flex;align-items:flex-end;gap:4px;height:26px}
.eq i{width:5px;border-radius:3px;background:#3b82f6;height:30%;animation:ls-eq .9s ease-in-out infinite}
.eq i:nth-child(2){animation-delay:-.2s}.eq i:nth-child(3){animation-delay:-.45s}.eq i:nth-child(4){animation-delay:-.1s}
.eq i:nth-child(5){animation-delay:-.6s}.eq i:nth-child(6){animation-delay:-.3s}.eq i:nth-child(7){animation-delay:-.75s}
@keyframes ls-eq{0%,100%{height:22%}50%{height:100%}}
@keyframes ls-swap{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}

.ls-list{position:absolute;left:770px;top:44px;width:621px;bottom:44px;padding:14px;display:flex;flex-direction:column;justify-content:center;gap:2px}
.ls-row{position:relative;flex:1 1 0;max-height:116px;display:flex;align-items:center;gap:16px;padding:0 18px 4px;border-radius:14px;color:#0b4a9c;transition:background .3s,color .3s}
.ls-row::after{content:"";position:absolute;left:18px;right:18px;bottom:-1px;height:1px;background:#d9e1ee}
.ls-row.on{background:#10408f;color:#fff}
.ls-row.on::after,.ls-row:last-child::after{display:none}
.ls-rank{width:44px;flex:none;font-weight:800;font-size:32px;color:#5f86c4;font-variant-numeric:tabular-nums;text-align:center}
.ls-row.on .ls-rank{color:#fff}
.ls-thumb{width:52px;height:52px;flex:none;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:19px;box-shadow:0 6px 10px -6px rgba(10,40,100,.6)}
.ls-rt{flex:1;min-width:0}
.ls-rtitle{font-weight:700;font-size:27px;line-height:1.1;letter-spacing:-.005em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ls-rsub{font-weight:500;font-size:19px;opacity:.72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ls-val{flex:none;font-weight:700;font-size:21px;font-variant-numeric:tabular-nums;color:#2f66c0}
.ls-row.on .ls-val{color:#bcd6ff}
.ls-prog{position:absolute;left:18px;right:18px;bottom:6px;height:4px;border-radius:2px}
.ls-row.on .ls-prog{background:rgba(255,255,255,.18)}
.ls-prog i{display:block;height:100%;width:0;background:#7db2ff;border-radius:2px}
.ls-row.on .ls-prog i{animation:ls-fill var(--sec,5s) linear forwards}
@keyframes ls-fill{to{width:100%}}

/* Entrada en cascada. Salida estándar: todo baja junto y desaparece detrás del ticker (el marco no se anima). */
.ls:not(.play) [class*="fx-"],.ls:not(.play) .ls-row{opacity:0}
.ls.play .fx-up{animation:ls-up .8s cubic-bezier(.2,.8,.2,1) both}
.ls.play .fx-left{animation:ls-left .8s cubic-bezier(.2,.8,.2,1) both;animation-delay:var(--d,0s)}
.ls.play .fx-right{animation:ls-right .8s cubic-bezier(.2,.8,.2,1) both;animation-delay:var(--d,0s)}
.ls.play .ls-row{animation:ls-right .6s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(.5s + var(--i,0)*.055s)}
@keyframes ls-up{from{opacity:0;transform:translateY(80px)}to{opacity:1;transform:none}}
@keyframes ls-left{from{opacity:0;transform:translateX(-80px)}to{opacity:1;transform:none}}
@keyframes ls-right{from{opacity:0;transform:translateX(80px)}to{opacity:1;transform:none}}
@keyframes ls-exit{to{opacity:0;transform:translateY(430px)}}
.ls-pill{--d:.14s}.ls-title{--d:.22s}.ls-focus{--d:.3s}.ls-list{--d:.24s}
.ls.exit .ls-panel{animation:ls-exit .9s cubic-bezier(.55,0,.9,.45) both}
`;
