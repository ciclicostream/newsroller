import { useRef } from "react";
import type { PromosData } from "@newsroller/shared";
import { IS_VERTICAL } from "../../lib/orientation";
import { YouTubePlayer } from "../../templates/render";
import { Grain, NM_CSS, useFit, useLife } from "./base";
import { ModernChrome } from "./Chrome";

// Promos/Avances, colección Modernas: a la izquierda la pill con el título y la card clara con el texto
// (alineadas a la derecha, contra el video); el video del canal (9:16 o 4:3) es el único módulo girado. Un
// destello anamórfico cruza al entrar y la salida es cruzada: el texto se va a la derecha y el video a la izquierda.
// 9:16: el video casi a pantalla completa (o el 4:3 arriba) y el texto encima, abajo.
export function Promos({ data, durationSec }: { data: PromosData; durationSec?: number }) {
  const { cls } = useLife(durationSec, 1);
  const bRef = useRef<HTMLDivElement>(null);
  const f43 = data.format === "43";
  useFit(bRef, 46, 26, [data.body]);
  return (
    <div className={"nm nmp" + cls + (f43 ? " f43" : " f916") + (IS_VERTICAL ? " v" : "")}>
      <style>{NM_CSS + CSS + (IS_VERTICAL ? CSS_V : "")}</style>
      <div className="nm-bg" /><Grain />
      <div className="nm-sc">
        <div className="nmp-v">
          <div className="nm-pe" />
          <div className="nm-pf"><div className="nmp-yt"><YouTubePlayer videoId={data.video_id} onEnded={() => {}} /></div></div>
        </div>
        <div className="nmp-t">
          {data.title?.trim() && <div className="nmp-pill">{data.title}</div>}
          <div className="nmp-card"><div className="nmp-b" ref={bRef}>{data.body}</div></div>
        </div>
      </div>
      <div className="nmp-flare" /><div className="nmp-gh"><i /><i /><i /></div>
      <ModernChrome />
    </div>
  );
}

const CSS = `
.nmp-t{position:absolute;left:120px;top:0;width:800px;height:100%;display:flex;flex-direction:column;justify-content:center;align-items:flex-end;gap:18px;text-align:right;opacity:0}
.in .nmp-t{animation:nm-fade .8s ease .35s forwards}
.nmp-pill{max-width:100%;background:var(--blue);color:#fff;font-family:var(--display);font-weight:800;font-stretch:108%;font-size:40px;padding:12px 26px 10px;border-radius:10px;box-shadow:0 18px 40px -14px rgba(47,107,255,.9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nmp-card{width:760px;padding:40px 46px;border-radius:18px;background:linear-gradient(160deg,#fff,#E6ECF8);box-shadow:0 40px 80px -30px rgba(0,0,0,.85)}
.nmp-b{max-height:340px;overflow:hidden;color:#0A1433;font-family:var(--display);font-weight:700;font-size:46px;line-height:1.12;text-wrap:balance;white-space:pre-line}
.nmp-v{position:absolute;left:960px;top:150px;width:405px;height:720px;transform-style:preserve-3d;transform-origin:0 50%;--ry:14deg;transform:rotateY(var(--ry));opacity:0}
.nmp.f43 .nmp-v{top:186px;width:864px;height:648px;--ry:9deg}
.nmp-v .nm-pf{background:#000}
.nmp-yt{position:absolute;inset:0}
.nmp-yt iframe{width:100%;height:100%;border:0;display:block}
.in .nmp-v{animation:nm-fade .8s ease .1s forwards}
.nmp-flare{position:absolute;left:0;right:0;top:506px;height:3px;z-index:24;opacity:0;mix-blend-mode:screen;transform:translateX(60%);pointer-events:none;
  background:linear-gradient(90deg,transparent,rgba(120,170,255,.8) 30%,#fff 50%,rgba(120,170,255,.8) 70%,transparent);box-shadow:0 0 40px 8px rgba(47,107,255,.55)}
.nmp-gh{position:absolute;top:506px;left:1160px;z-index:24;opacity:0;mix-blend-mode:screen;pointer-events:none}
.nmp-gh i{position:absolute;border-radius:50%;background:radial-gradient(circle,rgba(160,190,255,0) 40%,rgba(160,190,255,.35) 70%,transparent 72%)}
.nmp-gh i:nth-child(1){width:140px;height:140px;left:-70px;top:-70px}
.nmp-gh i:nth-child(2){width:60px;height:60px;left:-330px;top:-30px;background:radial-gradient(circle,rgba(255,200,150,.45),transparent 70%)}
.nmp-gh i:nth-child(3){width:220px;height:220px;left:-620px;top:-110px}
.in .nmp-flare{animation:nmp-flare 1.8s ease-out .5s both}
.in .nmp-gh{animation:nmp-gh 1.8s ease-out .5s both}
@keyframes nmp-flare{0%{opacity:0;transform:translateX(60%) scaleX(.3)}25%{opacity:1}100%{opacity:0;transform:translateX(-40%) scaleX(1)}}
@keyframes nmp-gh{0%{opacity:0;transform:translateX(200px)}30%{opacity:1}100%{opacity:0;transform:translateX(-300px)}}
.out .nmp-t{animation:nmp-outR .85s cubic-bezier(.6,0,.8,.4) both}
.out .nmp-v{animation:nmp-outL .85s cubic-bezier(.6,0,.8,.4) both}
@keyframes nmp-outR{from{opacity:1;transform:none}to{opacity:0;transform:translateX(1150px)}}
@keyframes nmp-outL{from{opacity:1;transform:rotateY(var(--ry))}to{opacity:0;transform:translateX(-1150px) rotateY(var(--ry))}}
`;

const CSS_V = `
.nmp-v,.nmp.f43 .nmp-v{--ry:0deg}
.nmp-v{left:90px;top:170px;width:900px;height:1600px}
.nmp.f43 .nmp-v{left:60px;top:300px;width:960px;height:720px}
.nmp-t{left:60px;top:auto;bottom:190px;width:960px;height:auto;align-items:flex-start;text-align:left;z-index:5}
.nmp.f43 .nmp-t{top:1080px;bottom:auto}
.nmp-card{width:960px;box-sizing:border-box}
.nmp-flare,.nmp-gh{top:960px}
`;
