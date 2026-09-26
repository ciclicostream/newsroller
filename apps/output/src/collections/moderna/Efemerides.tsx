import { useEffect, useRef, useState } from "react";
import type { EfemeridesData, EfemeridesEntry } from "@newsroller/shared";
import { formatEfemeridesDate } from "@newsroller/shared";
import { IS_VERTICAL } from "../../lib/orientation";
import { P } from "../../lib/params";
import { useForcePlay } from "../../lib/autoplay";
import { Grain, Kick, NM_CSS, useFit, useLife, useTypewriter } from "./base";
import { ModernChrome } from "./Chrome";

const WANT_AUDIO = P.has("audio");

// Efemérides, colección Modernas: la foto (o el video) vertical va adelante, apenas girada y pisando el panel de
// texto; adentro la imagen se mueve lento, como detrás de una ventana. El título es de un solo color y se escribe
// a máquina. Con 2 o 3 efemérides, la duración se reparte en partes iguales: en cada cambio gira la foto y se
// reescribe el texto. Entra y sale con una luz de película quemada. En 9:16, la foto va arriba, de frente y del
// mismo ancho que el panel.
function Media({ e }: { e: EfemeridesEntry }) {
  const ref = useForcePlay<HTMLVideoElement>();
  return e.media_kind === "video"
    ? <video key={e.media_url} ref={ref} src={e.media_url} autoPlay muted={!WANT_AUDIO} loop playsInline />
    : <img key={e.media_url} src={e.media_url} alt="" />;
}

export function Efemerides({ data, durationSec }: { data: EfemeridesData; durationSec?: number }) {
  const entries: EfemeridesEntry[] = [data, ...(data.more ?? [])].slice(0, 3);
  const n = entries.length;
  const { cls } = useLife(durationSec, 1.1);
  const [idx, setIdx] = useState(0);
  const [flip, setFlip] = useState(0); // cuenta de giros (reinicia la animación)
  const [shownIdx, setShownIdx] = useState(0); // la foto cambia a mitad del giro
  const bodyRef = useRef<HTMLDivElement>(null);
  const e = entries[idx]!;
  const title = useTypewriter(e.title ?? "", idx === 0 ? 1100 : 500, 1300);
  useFit(bodyRef, IS_VERTICAL ? 32 : 30, 20, [e.body, idx]);

  useEffect(() => {
    if (!durationSec || n < 2) return;
    const slot = (durationSec * 1000) / n;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let k = 1; k < n; k++) {
      timers.push(setTimeout(() => { setFlip((f) => f + 1); setIdx(k); }, k * slot));
      timers.push(setTimeout(() => setShownIdx(k), k * slot + 450));
    }
    return () => timers.forEach(clearTimeout);
  }, [durationSec, n]);

  return (
    <div className={"nm nme" + cls + (IS_VERTICAL ? " v" : "")}>
      <style>{NM_CSS + CSS + (IS_VERTICAL ? CSS_V : "")}</style>
      <div className="nm-bg" /><Grain />
      <div className="nm-sc nme-sc">
        <div className="nm-panel nme-p">
          <div className="nm-inner">
            {n > 1 && <div className="nme-dots">{entries.map((_, i) => <i key={i} className={i === idx ? "on" : ""} />)}</div>}
            <Kick text="Un día como hoy" />
            <div className="nme-date" key={"d" + idx}>{formatEfemeridesDate(e)}</div>
            <div className="nme-tt">{title}<span className="nm-caret" style={{ background: "#F2B880" }} /></div>
            <div className="nm-body nme-body" key={"b" + idx} ref={bodyRef}>{e.body}</div>
          </div>
        </div>
        <div className="nme-m">
          <div className={"nme-win" + (flip ? " flip" : "")} key={"f" + flip}><Media e={entries[shownIdx]!} /></div>
        </div>
        <div className="nme-leak" />
      </div>
      <ModernChrome />
    </div>
  );
}

const CSS = `
.nme-sc{transform-style:flat}
.nme-p{left:520px;top:170px;width:1304px;height:700px;opacity:0}
.in .nme-p{animation:nm-up .8s cubic-bezier(.2,.8,.2,1) .1s both}
.nme-p .nm-inner{padding:56px 64px 48px 210px;gap:22px}
.nme-dots{position:absolute;right:40px;top:40px;display:flex;gap:8px}
.nme-dots i{width:34px;height:4px;border-radius:2px;background:rgba(169,182,214,.3)}
.nme-dots i.on{background:#F2B880}
.nme-date{font-family:var(--display);font-weight:800;font-stretch:118%;font-size:30px;letter-spacing:.1em;color:#F2B880;opacity:0;animation:nm-fade .6s ease .9s forwards}
.nme-tt{font-family:var(--display);font-weight:800;font-stretch:88%;font-size:76px;line-height:1.04;letter-spacing:-.012em;color:#F4F6FB;min-height:2.1em}
.nme-body{font-size:30px;line-height:1.45}
.nme-m{position:absolute;left:150px;top:140px;width:470px;height:740px;border-radius:18px;overflow:hidden;transform-origin:0 50%;transform:perspective(2400px) rotateY(15deg);opacity:0;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 70px 140px -30px rgba(0,0,0,.85),0 40px 80px -30px rgba(47,107,255,.35);background:#0A1636}
.in .nme-m{animation:nm-fade .9s ease .3s both}
.nme-win{position:absolute;inset:0;overflow:hidden}
.nme-win img,.nme-win video{position:absolute;left:-6%;top:-4%;width:112%;height:108%;object-fit:cover;animation:nme-drift 14s ease-in-out infinite alternate}
@keyframes nme-drift{from{transform:translate(0,0) scale(1)}to{transform:translate(4%,3%) scale(1.04)}}
.nme-win.flip{animation:nme-flip .9s cubic-bezier(.6,0,.4,1)}
@keyframes nme-flip{0%{transform:rotateY(0)}50%{transform:rotateY(90deg);filter:brightness(1.6)}100%{transform:rotateY(0)}}
.nme-leak{position:absolute;inset:-20%;pointer-events:none;mix-blend-mode:screen;opacity:0;transform:translateX(-60%);
  background:radial-gradient(38% 50% at 22% 52%,rgba(255,128,48,.6),transparent 70%),radial-gradient(26% 36% at 52% 36%,rgba(255,214,130,.45),transparent 70%),radial-gradient(20% 30% at 70% 70%,rgba(255,70,40,.35),transparent 70%)}
.in .nme-leak{animation:nme-leak 2.4s ease-out .1s both}
.out .nme-leak{animation:nme-burn 1.1s ease-in both}
.out .nme-p,.out .nme-m{animation:nm-fadeOut .45s ease .45s both}
@keyframes nme-leak{0%{opacity:0;transform:translateX(-60%)}25%{opacity:1}100%{opacity:0;transform:translateX(55%)}}
@keyframes nme-burn{0%{opacity:0;transform:translateX(10%) scale(1)}55%{opacity:1;transform:translateX(0) scale(1.4)}100%{opacity:0;transform:translateX(-10%) scale(1.8)}}
`;

const CSS_V = `
.nme-m{left:60px;top:190px;width:960px;height:640px;transform:none}
.nme-p{left:60px;top:860px;width:960px;height:860px}
.nme-p .nm-inner{padding:50px 56px 48px}
.nme-tt{font-size:72px}
`;
