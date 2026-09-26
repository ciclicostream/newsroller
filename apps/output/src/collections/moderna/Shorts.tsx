import { useRef, useState } from "react";
import type { ShortsData } from "@newsroller/shared";
import { IS_VERTICAL } from "../../lib/orientation";
import { YouTubePlayer } from "../../templates/render";
import { Card, Grain, Lights, NM_CSS, Words, useFit, useLife } from "./base";
import { ModernChrome } from "./Chrome";

// Shorts, colección Modernas: 1 o 2 shorts del canal en paneles 3D + card con el título (sin la palabra "Shorts").
// Con 2: el segundo espera atrás, oscurecido y con su tapa; cuando termina el primero intercambian profundidad y
// arranca el segundo. En 9:16 va un solo short casi a pantalla completa y el título encima.
export function Shorts({ data, durationSec }: { data: ShortsData; durationSec?: number }) {
  const { cls } = useLife(durationSec, 1.2);
  const [s1Ended, setS1Ended] = useState(false);
  const tRef = useRef<HTMLDivElement>(null);
  const two = !IS_VERTICAL && data.count === 2 && !!data.video2;
  useFit(tRef, IS_VERTICAL ? 70 : 74, 36, [data.title, two]);

  const title = <div className="nms-t" ref={tRef}><Words text={data.title} /></div>;
  const v1 = <div className="nms-v"><YouTubePlayer videoId={data.video1} onEnded={() => setS1Ended(true)} /></div>;
  const v2 = two && (
    <div className="nms-v">
      {s1Ended
        ? <YouTubePlayer videoId={data.video2!} onEnded={() => {}} />
        : <><img className="nms-thumb" src={`https://img.youtube.com/vi/${data.video2}/hqdefault.jpg`} alt="" /><div className="nms-next"><span /></div></>}
    </div>
  );

  return (
    <div className={"nm nms" + cls + (s1Ended ? " swap" : "") + (IS_VERTICAL ? " v" : "")}>
      <style>{NM_CSS + CSS}</style>
      <div className="nm-bg" /><Grain />
      <div className="nm-sc">
        {IS_VERTICAL ? (
          <>
            <Card cls="s1" x={90} y={170} w={900} h={1600} d={0.12} od={0.3}>{v1}</Card>
            <Card x={60} y={1330} w={960} h={370} rx={4} d={0.4} od={0.05}>{title}</Card>
          </>
        ) : two ? (
          <>
            <Card cls="s1" x={96} y={150} w={416} h={740} ry={10} d={0.12} od={0.35}>{v1}<div className="nms-dim" /></Card>
            <Card cls="s2" x={552} y={150} w={416} h={740} ry={10} d={0.24} od={0.2}>{v2}<div className="nms-dim" /></Card>
            <Card x={1008} y={150} w={816} h={740} ry={-5} d={0.4} od={0.05}>{title}</Card>
          </>
        ) : (
          <>
            <Card cls="s1" x={420} y={120} w={450} h={800} ry={9} d={0.12} od={0.3}>{v1}</Card>
            <Card x={910} y={460} w={914} h={460} ry={-5} d={0.38} od={0.05}>{title}</Card>
          </>
        )}
      </div>
      <Lights />
      <ModernChrome />
    </div>
  );
}

const CSS = `
.nms-v{position:absolute;inset:0;background:#000}
.nms-v iframe{width:100%;height:100%;border:0;display:block}
.nms-thumb{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.nms-next{position:absolute;left:0;right:0;top:50%;margin-top:-34px;z-index:6;display:flex;justify-content:center}
.nms-next span{width:68px;height:68px;border-radius:50%;border:2px solid rgba(255,255,255,.7);display:flex;align-items:center;justify-content:center}
.nms-next span::before{content:"";margin-left:6px;border-left:20px solid #fff;border-top:12px solid transparent;border-bottom:12px solid transparent}
.nms-t{position:absolute;inset:0;padding:56px 60px 44px;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;font-size:74px}
.nms-t .nm-ttl{font-size:inherit;line-height:1.02}
/* Dos shorts: el que no suena queda atrás y oscurecido; al terminar el primero cambian de lugar. */
.nms-dim{position:absolute;inset:0;z-index:5;background:rgba(3,7,20,.62);opacity:0;transition:opacity 1s ease;pointer-events:none}
.nms .nm-card.s1,.nms .nm-card.s2{transition:translate 1s cubic-bezier(.65,0,.35,1)}
.nms .nm-card.s2{translate:0 0 -180px}
.nms .s2 .nms-dim{opacity:1}
.nms.swap .nm-card.s2{translate:0 0 0}
.nms.swap .s2 .nms-dim{opacity:0}
.nms.swap .nm-card.s1{translate:0 0 -180px}
.nms.swap .s1 .nms-dim{opacity:1}
`;
