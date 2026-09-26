import { useEffect, useRef, useState } from "react";
import type { InformeData } from "@newsroller/shared";
import { IS_VERTICAL } from "../../lib/orientation";
import { Grain, Kick, NM_CSS, Words, useFitMax, useLife } from "./base";
import { ModernChrome } from "./Chrome";

// Informe Cíclico, colección Modernas: a la izquierda el título sin caja y un contador grande (01 / 05) que gira
// con cada slide; a la derecha el carrusel en profundidad (la actual adelante, las siguientes esperan atrás y
// oscurecidas) con un flash de cámara en cada cambio y la barra de progreso segmentada. Las slides pasan solas cada
// `sec_per_slide` segundos y vuelven a empezar. Sale bajando.
export function Informe({ data, durationSec }: { data: InformeData; durationSec?: number }) {
  const { cls } = useLife(durationSec, 1);
  const slides = (data.slides ?? []).slice(0, 10);
  const n = slides.length;
  const sec = data.sec_per_slide ?? 5;
  const [idx, setIdx] = useState(0);
  const [flash, setFlash] = useState(0);
  const tRef = useRef<HTMLDivElement>(null);
  useFitMax(tRef, IS_VERTICAL ? 70 : 74, 40, IS_VERTICAL ? 230 : 430, [data.title]);

  useEffect(() => {
    if (n <= 1) return;
    const t = setInterval(() => { setIdx((i) => (i + 1) % n); setFlash((f) => f + 1); }, sec * 1000);
    return () => clearInterval(t);
  }, [n, sec]);

  const pos = (i: number) => {
    const d = (i - idx + n) % n;
    return d === 0 ? " cur" : d === 1 ? " nx" : d === 2 ? " nx2" : d === n - 1 ? " pv" : "";
  };
  const pad = (k: number) => String(k).padStart(2, "0");

  return (
    <div className={"nm nmi" + cls + (IS_VERTICAL ? " v" : "")} style={{ ["--sec" as string]: `${sec}s` }}>
      <style>{NM_CSS + CSS + (IS_VERTICAL ? CSS_V : "")}</style>
      <div className="nm-bg" /><Grain />
      <div className="nm-sc nmi-sc">
        <div className="nmi-t">
          <Kick text="Informe Cíclico" />
          <div className="nmi-tt" ref={tRef}><Words text={data.title} /></div>
          <div className="nmi-rule" />
          {n > 1 && (
            <div className="nmi-cnt">
              <div className="cur"><div style={{ transform: `translateY(${-idx}em)` }}>{slides.map((_, i) => <span key={i}>{pad(i + 1)}</span>)}</div></div>
              <div className="tot">/ {pad(n)}</div>
            </div>
          )}
        </div>
        <div className="nmi-w">
          {slides.map((s, i) => <div key={i} className={"nmi-s" + pos(i)} style={{ backgroundImage: `url(${s})` }} />)}
          <div className="nmi-fl" key={flash} />
        </div>
        {n > 1 && (
          <div className="nmi-pg">
            {slides.map((_, i) => <span key={i + "-" + (i === idx ? flash : "x")} className={i < idx ? "done" : i === idx ? "on" : ""}><i /></span>)}
          </div>
        )}
      </div>
      <ModernChrome />
    </div>
  );
}

const CSS = `
.nmi-t{position:absolute;left:96px;top:170px;width:640px;height:700px;display:flex;flex-direction:column;gap:26px}
.nmi-tt{flex:none;font-size:74px}
.nmi-tt .nm-ttl{font-size:inherit;line-height:1}
.nmi-rule{flex:none;width:100%;height:1px;background:var(--line);opacity:0}
.nmi-cnt{display:flex;align-items:baseline;gap:14px;margin-top:auto;font-family:var(--display);font-variant-numeric:tabular-nums;opacity:0}
.nmi-cnt .cur{position:relative;height:1em;overflow:hidden;font-weight:900;font-stretch:72%;font-size:190px;line-height:1;color:var(--paper)}
.nmi-cnt .cur div{transition:transform .9s cubic-bezier(.65,0,.25,1)}
.nmi-cnt .cur span{display:block;height:1em}
.nmi-cnt .tot{font-weight:600;font-size:44px;color:var(--mist)}
.in .nmi-cnt{animation:nm-up .8s cubic-bezier(.2,.8,.2,1) 1.2s both}
.in .nmi-rule{animation:nm-fade .6s ease 1.4s forwards}
.nmi-w{position:absolute;inset:0;perspective:1400px;perspective-origin:1140px 500px;opacity:0}
.in .nmi-w{animation:nmi-fromR 1s cubic-bezier(.16,.9,.2,1) .35s both}
@keyframes nmi-fromR{from{opacity:0;transform:translateX(500px)}to{opacity:1;transform:none}}
.nmi-s{position:absolute;left:860px;top:156px;width:560px;height:700px;border-radius:14px;overflow:hidden;background:#fff center/cover no-repeat;
  box-shadow:0 50px 90px -30px rgba(0,0,0,.85);transition:transform 1s cubic-bezier(.65,0,.25,1),opacity 1s ease,filter 1s ease;opacity:0;transform:translateX(700px) translateZ(-520px)}
.nmi-s.cur{transform:none;opacity:1;filter:none;z-index:3}
.nmi-s.nx{transform:translateX(430px) translateZ(-280px);opacity:1;filter:brightness(.42);z-index:2}
.nmi-s.nx2{transform:translateX(700px) translateZ(-560px);opacity:0;filter:brightness(.3);z-index:1}
.nmi-s.pv{transform:translateX(-360px) translateZ(-240px);opacity:0;z-index:2}
.nmi-fl{position:absolute;left:860px;top:156px;width:560px;height:700px;border-radius:14px;background:#fff;mix-blend-mode:screen;opacity:0;pointer-events:none;z-index:4;animation:nmi-flash .55s ease-out both}
@keyframes nmi-flash{0%{opacity:.85}100%{opacity:0}}
.nmi-pg{position:absolute;left:860px;top:880px;width:560px;display:flex;gap:8px;z-index:5;opacity:0}
.in .nmi-pg{animation:nm-fade .5s ease 1s forwards}
.nmi-pg span{flex:1;height:4px;border-radius:2px;background:rgba(255,255,255,.2);overflow:hidden}
.nmi-pg span i{display:block;height:100%;width:0;background:#fff}
.nmi-pg span.done i{width:100%}
.nmi-pg span.on i{animation:nmi-fill var(--sec) linear forwards}
@keyframes nmi-fill{to{width:100%}}
.out .nmi-sc{animation:nmi-down .9s cubic-bezier(.6,0,.8,.4) forwards}
@keyframes nmi-down{to{transform:translateY(260px);opacity:0}}
`;

const CSS_V = `
.nmi-t{left:60px;top:190px;width:960px;height:1480px}
.nmi-tt{font-size:70px}
.nmi-w{perspective-origin:540px 870px}
.nmi-s,.nmi-fl{left:180px;top:470px;width:720px;height:900px}
.nmi-s.nx{transform:translateX(300px) translateZ(-300px)}
.nmi-s.nx2{transform:translateX(480px) translateZ(-600px)}
.nmi-pg{left:180px;top:1396px;width:720px}
`;
