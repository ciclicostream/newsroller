import { useEffect, useRef, useState } from "react";
import * as Icons from "lucide-react";
import type { CifrasData } from "@newsroller/shared";
import { IS_VERTICAL } from "../../lib/orientation";
import { Grain, NM_CSS, Words, fmtNum, useLife } from "./base";
import { ModernChrome } from "./Chrome";

// Cifras, colección Modernas: todo de frente y sólo con los campos del formulario. La cifra (con prefijo, sufijo
// corto pegado o unidad larga chica al lado) usa todo el ancho y se achica sola; cae desde arriba y cuenta mientras
// un láser la recorre sobre un piso de grilla. Debajo: qué representa, la fuente (con AUTO si vino de la API) y la
// explicación en la tarjeta azul con su ícono (o sin ícono). Sale como un televisor que se apaga.
export function Cifras({ data, durationSec }: { data: CifrasData; durationSec?: number }) {
  const { cls } = useLife(durationSec, 0.9);
  const numRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(fmtNum(0, data.value));
  const suffix = (data.suffix ?? "").trim();
  const shortSuffix = suffix.length > 0 && suffix.length <= 3;
  const Ic = data.icon ? (Icons as unknown as Record<string, Icons.LucideIcon>)[data.icon] : null;

  // Tamaño: se mide con el valor final y se achica hasta que entra en el ancho; después cuenta de 0 al valor.
  useEffect(() => {
    const box = numRef.current;
    const span = box?.querySelector<HTMLSpanElement>(".cnt");
    if (!box || !span) return;
    span.textContent = data.value;
    let s = IS_VERTICAL ? 300 : 330;
    box.style.fontSize = s + "px";
    while (box.scrollWidth > box.clientWidth + 2 && s > 80) { s -= 4; box.style.fontSize = s + "px"; }
    span.textContent = fmtNum(0, data.value);
    let raf = 0;
    const t0 = performance.now() + 450;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0) / 1300));
      setShown(p >= 1 ? data.value : fmtNum(data.valueNum * (1 - Math.pow(1 - p, 3)), data.value));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [data.value, data.valueNum, data.prefix, data.suffix]);

  return (
    <div className={"nm nmf" + cls + (IS_VERTICAL ? " v" : "")}>
      <style>{NM_CSS + CSS + (IS_VERTICAL ? CSS_V : "")}</style>
      <div className="nm-bg" /><Grain />
      <div className="nm-sc nmf-tv">
        <div className="nmf-floor" />
        <div className="nmf-pill">LA CIFRA</div>
        <div className="nmf-num" ref={numRef}>
          {data.prefix?.trim() && <span className="p">{data.prefix.trim()}</span>}
          <span className="cnt">{shown}</span>
          {shortSuffix && <span className="u">{suffix}</span>}
          {suffix && !shortSuffix && <span className="ul">{suffix}</span>}
        </div>
        <div className="nmf-laser" />
        <div className="nm-panel nmf-sub"><div className="nm-inner"><Words text={data.subtitle} t0={1.35} /></div></div>
        <div className="nm-panel nmf-src"><div className="nm-inner"><span className="nm-lab">Fuente</span><b>{data.source}</b>{data.sourceAuto && <i>AUTO</i>}</div></div>
        <div className={"nm-panel solid nmf-exp" + (Ic ? "" : " noico")}>
          <div className="nm-inner">{Ic && <div className="ico"><Ic size={52} strokeWidth={2} color="#fff" /></div>}<p>{data.explanation}</p></div>
        </div>
      </div>
      <ModernChrome />
    </div>
  );
}

const CSS = `
.nmf-tv{transform-origin:50% 48%}
.out .nmf-tv{animation:nmf-off .75s cubic-bezier(.7,0,.3,1) forwards}
@keyframes nmf-off{0%{transform:none;filter:brightness(1)}55%{transform:scaleY(.005);filter:brightness(5)}100%{transform:scaleY(.005) scaleX(0);filter:brightness(8)}}
.nmf-floor{position:absolute;left:-600px;right:-600px;top:600px;height:1000px;transform-origin:50% 0;transform:rotateX(78deg);opacity:0;
  background-image:linear-gradient(rgba(127,162,255,.5) 2px,transparent 2px),linear-gradient(90deg,rgba(127,162,255,.5) 2px,transparent 2px);background-size:120px 120px;
  -webkit-mask:linear-gradient(180deg,#000 0%,transparent 60%);mask:linear-gradient(180deg,#000 0%,transparent 60%)}
.in .nmf-floor{animation:nmf-floorIn 1.2s ease .1s forwards,nmf-floorMove 5s linear infinite}
@keyframes nmf-floorIn{to{opacity:.5}}
@keyframes nmf-floorMove{to{background-position:0 120px,0 120px}}
.nmf-pill{position:absolute;left:96px;top:150px;background:#2F6BFF;color:#fff;font-family:var(--display);font-weight:800;font-stretch:112%;font-size:18px;letter-spacing:.3em;padding:11px 18px 10px;border-radius:7px;box-shadow:0 14px 30px -10px rgba(47,107,255,.9);opacity:0}
.in .nmf-pill{animation:nm-fade .4s ease .15s forwards}
.nmf-num{position:absolute;left:96px;top:196px;width:1728px;height:330px;display:flex;align-items:center;white-space:nowrap;
  font-family:var(--display);font-weight:900;font-stretch:72%;font-size:330px;line-height:1;letter-spacing:-.03em;color:#F4F6FB;font-variant-numeric:tabular-nums;
  text-shadow:1px 1px 0 #4F6FD0,2px 2px 0 #4566C8,3px 3px 0 #3C5DBF,4px 4px 0 #3454B5,5px 5px 0 #2D4CAB,6px 6px 0 #2744A1,7px 7px 0 #213C96,8px 8px 0 #1C358B,10px 12px 26px rgba(0,0,0,.55),0 0 90px rgba(47,107,255,.4)}
.nmf-num .p{font-size:.5em;color:#7FA2FF;margin-right:.06em;align-self:flex-start;margin-top:.35em}
.nmf-num .u{font-size:.5em;color:#7FA2FF;margin-left:.05em;align-self:flex-start;margin-top:.35em}
.nmf-num .ul{font-family:var(--text);font-weight:600;font-size:.13em;line-height:1.1;letter-spacing:0;color:#A9B6D6;white-space:normal;max-width:5.2em;margin-left:.25em;text-shadow:none;align-self:center}
.in .nmf-num{animation:nmf-drop .9s cubic-bezier(.2,.8,.2,1) .2s both}
@keyframes nmf-drop{from{opacity:0;transform:translateY(-220px)}to{opacity:1;transform:none}}
.nmf-laser{position:absolute;left:0;right:0;top:196px;height:2px;opacity:0;background:linear-gradient(90deg,transparent,#fff 15%,#fff 85%,transparent);box-shadow:0 0 22px 6px rgba(47,107,255,.85),0 0 80px 20px rgba(47,107,255,.35)}
.in .nmf-laser{animation:nmf-scan 1.4s cubic-bezier(.5,0,.5,1) .35s both}
@keyframes nmf-scan{0%{opacity:0;top:196px}10%{opacity:1}85%{opacity:1}100%{opacity:0;top:530px}}
.nmf-sub{left:96px;top:560px;width:1000px;height:190px}
.nmf-sub .nm-inner{justify-content:center;padding:30px 48px}
.nmf-sub .nm-ttl{font-size:54px;line-height:1.04}
.in .nmf-sub{animation:nmf-l .9s cubic-bezier(.16,.9,.2,1) 1.05s both}
.nmf-src{left:96px;top:770px;width:1000px;height:96px}
.nmf-src .nm-inner{flex-direction:row;align-items:center;gap:22px;padding:0 48px}
.nmf-src .nm-lab{color:#7FA2FF}
.nmf-src b{font-family:var(--display);font-weight:700;font-size:28px;color:#F4F6FB;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nmf-src i{margin-left:auto;font-style:normal;background:#2F6BFF;color:#fff;font-family:var(--display);font-weight:800;font-stretch:112%;font-size:13px;letter-spacing:.24em;padding:6px 10px 5px;border-radius:5px}
.in .nmf-src{animation:nmf-l .8s cubic-bezier(.16,.9,.2,1) 1.35s both}
.nmf-exp{left:1136px;top:560px;width:688px;height:306px}
.nmf-exp .nm-inner{padding:40px 46px;gap:22px}
.nmf-exp.noico .nm-inner{justify-content:center}
.nmf-exp .ico{width:88px;height:88px;border-radius:50%;background:rgba(255,255,255,.16);box-shadow:inset 0 0 0 2px rgba(255,255,255,.35);display:flex;align-items:center;justify-content:center}
.nmf-exp p{margin:0;font-size:28px;line-height:1.38;color:#fff;overflow:hidden}
.in .nmf-exp{animation:nmf-r .9s cubic-bezier(.16,.9,.2,1) 1.2s both}
@keyframes nmf-l{from{opacity:0;transform:translateX(-300px)}to{opacity:1;transform:none}}
@keyframes nmf-r{from{opacity:0;transform:translateX(500px)}to{opacity:1;transform:none}}
.nmf-sub,.nmf-src,.nmf-exp{opacity:0}
`;

const CSS_V = `
.nmf-pill{left:60px;top:200px}
.nmf-num{left:60px;top:250px;width:960px;height:300px}
.nmf-laser{top:250px}
.in .nmf-laser{animation-name:nmf-scanv}
@keyframes nmf-scanv{0%{opacity:0;top:250px}10%{opacity:1}85%{opacity:1}100%{opacity:0;top:560px}}
.nmf-floor{top:1300px}
.nmf-sub{left:60px;top:600px;width:960px;height:280px}
.nmf-src{left:60px;top:910px;width:960px}
.nmf-exp{left:60px;top:1040px;width:960px;height:380px}
`;
