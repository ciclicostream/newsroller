import { useEffect, useRef, useState } from "react";
import type { ListaData, ListaItem } from "@newsroller/shared";
import { IS_VERTICAL } from "../../lib/orientation";
import { P } from "../../lib/params";
import { useForcePlay } from "../../lib/autoplay";
import { Card, Grain, Kick, NM_CSS, Words, useFitMax, useLife } from "./base";
import { ModernChrome } from "./Chrome";

const WANT_AUDIO = P.has("audio");
const INTRO_MS = 1000;

// Lista, colección Modernas: la lista ancha a la izquierda (volanta sólo si el editor la cargó, nunca "Lista";
// título; filas que caen de a una) y el foco a la derecha, en una card apenas girada: tapa, número (o el dato, sin
// números) debajo de la tapa, nombre, subtítulo, descripción y "Sonando" si el ítem tiene audio. En cada cambio una
// barra blanca barre el foco y deja la ficha nueva; la fila del foco se ilumina con su barra de progreso.
// 9:16: el foco arriba (tapa al lado del número) y la lista abajo.
const bg = (i: number) => `linear-gradient(160deg,hsl(${208 + (i % 10) * 7} 62% 52%),hsl(${222 + (i % 10) * 7} 66% 27%))`;
const initials = (t: string) => t.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function Art({ item, i, className }: { item: ListaItem; i: number; className: string }) {
  return item.image_url
    ? <div className={className} style={{ backgroundImage: `url(${item.image_url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
    : <div className={className} style={{ background: bg(i) }}>{initials(item.title)}</div>;
}
function ItemAudio({ src }: { src: string }) {
  const ref = useForcePlay<HTMLAudioElement>();
  return <audio ref={ref} src={src} autoPlay muted={!WANT_AUDIO} />;
}

function Focus({ it, i, numbered }: { it: ListaItem; i: number; numbered: boolean }) {
  const mark = numbered ? String(i + 1) : it.value ?? "";
  const sub = numbered ? [it.subtitle, it.value].filter((x) => x?.trim()).join(" · ") : it.subtitle ?? "";
  return (
    <>
      <div className="fx">
        <Art item={it} i={i} className="cover" />
        <div className="fmeta">
          {mark && <div className="mark">{mark}</div>}
          {IS_VERTICAL && <div className="ftitle">{it.title}</div>}
          {IS_VERTICAL && sub && <div className="fsub">{sub}</div>}
        </div>
      </div>
      {!IS_VERTICAL && <div className="ftitle">{it.title}</div>}
      {!IS_VERTICAL && sub && <div className="fsub">{sub}</div>}
      {it.text?.trim() && <div className="fdesc">{it.text}</div>}
      {it.audio_url && <div className="audio"><span className="eq"><i /><i /><i /><i /><i /></span>SONANDO</div>}
    </>
  );
}

export function Lista({ data, durationSec }: { data: ListaData; durationSec?: number }) {
  const { cls } = useLife(durationSec, 1);
  const items = (data.items ?? []).slice(0, 10);
  const n = items.length;
  const sec = data.sec_per_item ?? 5;
  const numbered = data.numbered !== false;
  const [idx, setIdx] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const tRef = useRef<HTMLDivElement>(null);
  useFitMax(tRef, 46, 30, 100, [data.title]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let k = 1; k < n; k++) {
      timers.push(setTimeout(() => { setPrev(k - 1); setIdx(k); }, INTRO_MS + k * sec * 1000));
      timers.push(setTimeout(() => setPrev(null), INTRO_MS + k * sec * 1000 + 750));
    }
    return () => timers.forEach(clearTimeout);
  }, [n, sec]);

  const cur = items[idx];
  const list = (
    <div className="nml-list">
      <div className="nml-hd">
        {data.kicker?.trim() && <Kick text={data.kicker.trim()} />}
        <div className="nml-tt" ref={tRef}><Words text={data.title} /></div>
      </div>
      {items.map((it, i) => (
        <div key={i} className={"nml-row" + (i === idx ? " on" : "")} style={{ ["--i" as string]: i }}>
          {numbered && <span className="rank">{i + 1}</span>}
          <Art item={it} i={i} className="thumb" />
          <span className="rt"><b>{it.title}</b>{it.subtitle && <small>{it.subtitle}</small>}</span>
          {it.value && <span className="val">{it.value}</span>}
          <span className="rprog"><i key={i === idx ? "on" : "off"} /></span>
        </div>
      ))}
    </div>
  );
  const focus = (
    <div className={"nml-foc" + (numbered ? "" : " nonum")}>
      {prev != null && items[prev] && <div className="fbox old" key={"o" + prev}><Focus it={items[prev]} i={prev} numbered={numbered} /></div>}
      {cur && <div className={"fbox" + (prev != null ? " new" : idx === 0 ? " first" : "")} key={"n" + idx}><Focus it={cur} i={idx} numbered={numbered} /></div>}
      {prev != null && <div className="nml-bar" key={"b" + idx} />}
    </div>
  );

  return (
    <div className={"nm nml" + cls + (IS_VERTICAL ? " v" : "")} style={{ ["--sec" as string]: `${sec}s` }}>
      <style>{NM_CSS + CSS + (IS_VERTICAL ? CSS_V : "")}</style>
      <div className="nm-bg" /><Grain />
      <div className="nm-sc">
        {IS_VERTICAL ? (
          <>
            <Card cls="nml-fc" x={60} y={190} w={960} h={560} rx={3} d={0.12} od={0.3}>{focus}</Card>
            <Card x={60} y={790} w={960} h={930} d={0.36} od={0.05}>{list}</Card>
          </>
        ) : (
          <>
            <Card x={96} y={150} w={1040} h={740} d={0.12} od={0.3}>{list}</Card>
            <Card cls="nml-fc" x={1176} y={150} w={648} h={740} ry={-6} d={0.36} od={0.05}>{focus}</Card>
          </>
        )}
      </div>
      {cur?.audio_url && <ItemAudio key={idx} src={cur.audio_url} />}
      <ModernChrome />
    </div>
  );
}

const CSS = `
.nml-list{position:absolute;inset:0;padding:40px 30px 26px;display:flex;flex-direction:column;gap:2px}
.nml-hd{display:flex;flex-direction:column;gap:14px;padding:0 20px 20px;flex:none}
.nml-tt{font-size:46px}
.nml-tt .nm-ttl{font-size:inherit;line-height:1.04}
.nml-row{position:relative;flex:1 1 0;min-height:0;max-height:112px;display:flex;align-items:center;gap:18px;padding:0 20px;border-radius:10px;opacity:0;transition:background .45s,box-shadow .45s}
.in .nml-row{animation:nml-drop .75s cubic-bezier(.3,1.35,.5,1) calc(1s + var(--i) * 220ms) both}
@keyframes nml-drop{0%{opacity:0;transform:translateY(-140px) rotateX(70deg)}60%{opacity:1}100%{opacity:1;transform:none}}
.nml-row+.nml-row::before{content:"";position:absolute;left:20px;right:20px;top:0;height:1px;background:var(--line)}
.nml-row.on::before,.nml-row.on+.nml-row::before{opacity:0}
.nml-row.on{background:linear-gradient(90deg,rgba(47,107,255,.42),rgba(47,107,255,.14));box-shadow:inset 0 0 0 1px rgba(127,162,255,.45),0 0 40px -6px rgba(47,107,255,.55)}
.nml-row .rank{width:40px;flex:none;text-align:center;font-family:var(--display);font-weight:700;font-size:26px;color:var(--mist);font-variant-numeric:tabular-nums;transition:color .4s}
.nml-row.on .rank{color:#fff}
.nml-row .thumb{width:46px;height:46px;flex:none;border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:var(--display);font-weight:800;font-size:17px;color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
.nml-row .rt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.nml-row .rt b{font-family:var(--display);font-weight:700;font-stretch:95%;font-size:25px;line-height:1.1;color:var(--paper);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nml-row .rt small{font-size:17px;color:var(--mist);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nml-row .val{flex:none;font-family:var(--display);font-weight:700;font-size:21px;color:var(--blue-soft);font-variant-numeric:tabular-nums}
.nml-row.on .val{color:#fff}
.nml-row .rprog{position:absolute;left:20px;right:20px;bottom:5px;height:3px;border-radius:2px;opacity:0}
.nml-row.on .rprog{opacity:1;background:rgba(255,255,255,.18)}
.nml-row .rprog i{display:block;height:100%;width:0;background:#fff;border-radius:2px;box-shadow:0 0 8px rgba(255,255,255,.8)}
.nml-row.on .rprog i{animation:nml-fill var(--sec) linear forwards}
@keyframes nml-fill{to{width:100%}}

/* Foco */
.nml-foc{position:absolute;inset:0;overflow:hidden}
.nml-foc .fbox{position:absolute;inset:0;padding:44px 46px;display:flex;flex-direction:column;gap:22px}
.nml-foc .fbox.first{opacity:0}
.in .nml-foc .fbox.first{animation:nm-fade .6s ease 1.2s forwards}
.nml-foc .fbox.new{clip-path:inset(0 100% 0 0);animation:nml-reveal .7s cubic-bezier(.65,0,.35,1) forwards}
.nml-foc .fbox.old{animation:nml-hide .7s cubic-bezier(.65,0,.35,1) forwards}
@keyframes nml-hide{from{clip-path:inset(0 0 0 0)}to{clip-path:inset(0 0 0 100%)}}
@keyframes nml-reveal{to{clip-path:inset(0 0 0 0)}}
.nml-bar{position:absolute;top:-4%;bottom:-4%;left:0;width:36px;background:#fff;z-index:8;opacity:0;box-shadow:0 0 40px 12px rgba(200,220,255,.8),0 0 120px 30px rgba(47,107,255,.5);animation:nml-bar .7s cubic-bezier(.65,0,.35,1) forwards}
@keyframes nml-bar{0%{opacity:1;left:-40px}100%{opacity:1;left:100%}}
.nml-foc .fx{display:flex;flex-direction:column;align-items:flex-start;gap:14px}
.nml-foc .cover{width:250px;height:250px;flex:none;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-family:var(--display);font-weight:800;font-size:84px;
  box-shadow:0 30px 50px -20px rgba(0,0,0,.8),inset 0 1px 0 rgba(255,255,255,.3)}
.nml-foc .fmeta{display:flex;flex-direction:column;gap:10px;min-width:0}
.nml-foc .mark{font-family:var(--display);font-weight:800;font-stretch:80%;font-size:120px;line-height:.85;letter-spacing:-.03em;color:var(--red-lit);font-variant-numeric:tabular-nums;text-shadow:0 0 40px rgba(238,34,12,.35)}
.nml-foc.nonum .mark{font-size:40px;line-height:1;color:var(--blue-soft);text-shadow:none;font-stretch:100%;letter-spacing:.02em}
.nml-foc .ftitle{font-family:var(--display);font-weight:800;font-stretch:90%;font-size:46px;line-height:1.02;color:var(--paper);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.nml-foc.nonum .ftitle{color:var(--red-lit);font-size:52px}
.nml-foc .fsub{font-weight:500;font-size:24px;color:var(--mist)}
.nml-foc .fdesc{font-size:26px;line-height:1.38;color:var(--mist);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.nml-foc .audio{align-self:flex-start;display:inline-flex;align-items:center;gap:14px;border:1px solid rgba(127,162,255,.35);border-radius:999px;padding:8px 20px 8px 16px;font-family:var(--display);font-weight:700;font-stretch:112%;font-size:14px;letter-spacing:.26em;color:var(--blue-soft)}
.nml-foc .eq{display:flex;align-items:flex-end;gap:4px;height:22px}
.nml-foc .eq i{width:4px;border-radius:2px;background:var(--blue-soft);height:30%;animation:nml-eq .9s ease-in-out infinite}
.nml-foc .eq i:nth-child(2){animation-delay:-.2s}.nml-foc .eq i:nth-child(3){animation-delay:-.45s}.nml-foc .eq i:nth-child(4){animation-delay:-.1s}.nml-foc .eq i:nth-child(5){animation-delay:-.6s}
@keyframes nml-eq{0%,100%{height:22%}50%{height:100%}}
`;

const CSS_V = `
.nml-foc .fx{flex-direction:row;align-items:flex-end;gap:34px}
.nml-foc .mark{font-size:150px}
.nml-row{max-height:78px}
`;
