import { useEffect, useRef, useState } from "react";
import type { RetroData } from "@newsroller/shared";
import { IS_VERTICAL } from "../../lib/orientation";
import { P } from "../../lib/params";
import { useForcePlay } from "../../lib/autoplay";
import { NM_CSS, useFit, useLife } from "./base";
import { ModernChrome } from "./Chrome";

const WANT_AUDIO = P.has("audio");

// Retro, colección Modernas: fondo azul petróleo con líneas de barrido y barras de color arriba. El televisor (el
// único módulo girado) se enciende como un CRT con la imagen o el video del programa adentro; el año aparece con
// el corrimiento de color de las pantallas viejas. Etiqueta (si hay), título, subtítulo y descripción a la
// izquierda. Sale con estática y el televisor se apaga.
function Static() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const x = c?.getContext("2d");
    if (!c || !x) return;
    const img = x.createImageData(c.width, c.height);
    let raf = 0;
    const draw = () => {
      for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      x.putImageData(img, 0, 0);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="nmr-static" width={200} height={150} />;
}

export function Retro({ data, durationSec }: { data: RetroData; durationSec?: number }) {
  const { cls } = useLife(durationSec, 1.3);
  const dRef = useRef<HTMLDivElement>(null);
  const tRef = useRef<HTMLDivElement>(null);
  const [portrait, setPortrait] = useState(false); // afiche vertical: se ve entero dentro del televisor
  const videoRef = useForcePlay<HTMLVideoElement>();
  useFit(tRef, 84, 44, [data.title]);
  useFit(dRef, IS_VERTICAL ? 30 : 27, 18, [data.text, data.title]);
  const bars = ["#C0C0C0", "#C0C000", "#00C0C0", "#00C000", "#C000C0", "#C00000", "#0000C0"];
  return (
    <div className={"nm nmr" + cls + (IS_VERTICAL ? " v" : "")}>
      <style>{NM_CSS + CSS + (IS_VERTICAL ? CSS_V : "")}</style>
      <div className="nmr-bg" />
      <div className="nm-sc nmr-sc">
        <div className="nmr-bars">{bars.map((c) => <span key={c} style={{ background: c }} />)}</div>
        <div className="nmr-l">
          {data.chip?.trim() && <div className="nmr-chip">{data.chip.trim()}</div>}
          {data.year?.trim() && <div className="nmr-year">{data.year.trim()}</div>}
          <div className="nmr-ti" ref={tRef}>{data.title}</div>
          {data.subtitle?.trim() && <div className="nmr-sub">{data.subtitle.trim()}</div>}
          {data.text?.trim() && <div className="nmr-d" ref={dRef}>{data.text.trim()}</div>}
        </div>
        <div className="nmr-tv">
          <div className="nmr-crt">
            <div className={"nmr-in" + (portrait ? " portrait" : "")}>
              {data.media_kind === "video"
                ? <video key={data.media_url} ref={videoRef} src={data.media_url} autoPlay muted={!WANT_AUDIO} loop playsInline onLoadedMetadata={(e) => setPortrait(e.currentTarget.videoHeight > e.currentTarget.videoWidth)} />
                : <img src={data.media_url} alt="" onLoad={(e) => setPortrait(e.currentTarget.naturalHeight > e.currentTarget.naturalWidth)} />}
            </div>
            <Static />
          </div>
        </div>
        <div className="nmr-scan" />
      </div>
      <ModernChrome />
    </div>
  );
}

const CSS = `
.nmr-bg{position:absolute;inset:0;background:radial-gradient(1100px 700px at 30% 30%,#15505E,transparent 70%),linear-gradient(160deg,#0D3B47,#051C24 75%)}
.nmr-sc{transform-style:flat}
.nmr-scan{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.22) 0 2px,transparent 2px 4px)}
.nmr-bars{position:absolute;left:96px;right:96px;top:128px;height:10px;display:flex;border-radius:3px;overflow:hidden;transform-origin:0 50%}
.nmr-bars span{flex:1}
.in .nmr-bars{animation:nm-growX .5s cubic-bezier(.2,.8,.2,1) .15s both}
.nmr-l{position:absolute;left:96px;top:196px;width:700px;height:690px;display:flex;flex-direction:column;gap:18px}
.nmr-chip{align-self:flex-start;background:#F2C230;color:#1A1400;font-family:var(--display);font-weight:800;font-stretch:115%;font-size:17px;letter-spacing:.3em;padding:9px 14px 8px;border-radius:4px;text-transform:uppercase;opacity:0}
.nmr-year{font-family:"Alfa Slab One",Georgia,serif;font-size:150px;line-height:.95;color:#F2C230;text-shadow:-5px 0 #FF3D6E,5px 0 #25E2FF;opacity:0}
.nmr-ti{flex:none;max-height:2.1em;max-height:176px;overflow:hidden;font-family:var(--display);font-weight:800;font-stretch:90%;font-size:84px;line-height:1;color:#F4F6FB;opacity:0}
.nmr-sub{font-family:var(--display);font-weight:600;font-stretch:112%;font-size:18px;letter-spacing:.26em;text-transform:uppercase;color:#8FD3DE;opacity:0}
.nmr-d{flex:1;min-height:0;overflow:hidden;font-size:27px;line-height:1.45;color:#B7D3D9;opacity:0}
.in .nmr-chip{animation:nm-fade .3s steps(2) .9s forwards}
.in .nmr-year{animation:nmr-chroma .7s cubic-bezier(.2,.8,.2,1) 1s both}
@keyframes nmr-chroma{from{opacity:0;text-shadow:-40px 0 #FF3D6E,40px 0 #25E2FF;transform:scaleX(1.3)}to{opacity:1;text-shadow:-5px 0 #FF3D6E,5px 0 #25E2FF;transform:none}}
.in .nmr-ti,.in .nmr-sub{animation:nm-up .6s cubic-bezier(.2,.8,.2,1) 1.25s both}
.in .nmr-d{animation:nm-up .7s cubic-bezier(.2,.8,.2,1) 1.45s both}
.nmr-tv{position:absolute;left:850px;top:170px;width:974px;height:720px;border-radius:34px;background:#141414;transform-origin:100% 50%;transform:perspective(2400px) rotateY(-11deg);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.18),inset 0 0 0 1px rgba(255,255,255,.08),0 70px 140px -30px rgba(0,0,0,.85)}
.nmr-crt{position:absolute;inset:26px;border-radius:26px;overflow:hidden;background:#000}
.nmr-in{position:absolute;inset:0;transform:scale(0,.004)}
.nmr-in img,.nmr-in video{width:100%;height:100%;object-fit:cover;display:block;animation:nmr-jit 3s steps(1) infinite}
.nmr-in.portrait img,.nmr-in.portrait video{object-fit:contain}
@keyframes nmr-jit{0%,92%,100%{transform:none}94%{transform:translateX(3px)}96%{transform:translateX(-2px)}}
.nmr-crt::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:2;background:repeating-linear-gradient(0deg,rgba(0,0,0,.28) 0 2px,transparent 2px 4px),radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.7) 100%)}
.in .nmr-in{animation:nmr-on 1s cubic-bezier(.2,.8,.2,1) .3s both}
@keyframes nmr-on{0%{transform:scale(0,.004);filter:brightness(8)}30%{transform:scale(1,.004);filter:brightness(8)}100%{transform:none;filter:brightness(1)}}
.nmr-static{position:absolute;inset:0;width:100%;height:100%;opacity:0;z-index:3;mix-blend-mode:screen}
.out .nmr-static{animation:nm-fade .15s ease both}
.out .nmr-l{animation:nm-fadeOut .3s steps(3) .1s both}
.out .nmr-in{animation:nmr-off .45s cubic-bezier(.7,0,.3,1) .55s both}
@keyframes nmr-off{0%{transform:none;filter:brightness(1)}60%{transform:scale(1,.004);filter:brightness(8)}100%{transform:scale(0,.004);filter:brightness(8)}}
.out .nmr-tv,.out .nmr-bars{animation:nm-fadeOut .3s ease .95s both}
`;

const CSS_V = `
.nmr-bars{left:60px;right:60px;top:160px}
.nmr-tv{left:60px;top:210px;width:960px;height:720px;transform:perspective(2400px) rotateY(-8deg)}
.nmr-l{left:60px;top:990px;width:960px;height:730px}
.nmr-year{font-size:140px}
`;
