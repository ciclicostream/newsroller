import { useRef } from "react";
import type { ObituarioData } from "@newsroller/shared";
import { IS_VERTICAL } from "../../lib/orientation";
import { Grain, NM_CSS, useFit, useLife } from "./base";

// Obituario, colección Modernas: pantalla limpia (sin marco ni ticker, sin hora ni fecha), fondo casi negro,
// retrato en blanco y negro, nombre en serif, años y oficio. Una luz cálida que respira detrás y fundidos lentos.
export function Obituario({ data, durationSec }: { data: ObituarioData; durationSec?: number }) {
  const { cls } = useLife(durationSec, 1.3);
  const nameRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  useFit(nameRef, IS_VERTICAL ? 98 : 108, 50, [data.name]);
  useFit(textRef, 27, 20, [data.text]);
  return (
    <div className={"nm nmo" + cls + (IS_VERTICAL ? " v" : "")}>
      <style>{NM_CSS + CSS + (IS_VERTICAL ? CSS_V : "")}</style>
      <div className="nmo-bg" />
      {data.photo_url && <div className="nmo-wm"><img src={data.photo_url} alt="" /><Grain /></div>}
      <div className="nmo-glow" />
      <div className="nmo-t">
        <div className="nmo-n" ref={nameRef} style={{ ["--dl" as any]: "1.5s" }}>{data.name}</div>
        {data.years && <div className="nmo-d" style={{ ["--dl" as any]: "1.9s" }}>{data.years}</div>}
        {data.role && <div className="nmo-r" style={{ ["--dl" as any]: "2.2s" }}>{data.role}</div>}
        {data.text && <div className="nmo-b" ref={textRef} style={{ ["--dl" as any]: "2.6s" }}>{data.text}</div>}
      </div>
    </div>
  );
}

const CSS = `
.nmo-bg{position:absolute;inset:0;background:#05070C}
.nmo-wm{position:absolute;inset:0;overflow:hidden;opacity:0}
.nmo-wm img{width:100%;height:100%;object-fit:cover;display:block;filter:grayscale(1) contrast(1.05) brightness(.85);transform:scale(1.02);will-change:transform;backface-visibility:hidden;-webkit-backface-visibility:hidden}
.nmo-wm::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,7,12,.35) 0%,rgba(5,7,12,.6) 45%,rgba(5,7,12,.97) 100%)}
.in .nmo-wm{animation:nm-fade 2.4s ease .2s forwards}
.in .nmo-wm img{animation:nmo-zoom 20s linear .2s infinite alternate}
@keyframes nmo-zoom{from{transform:scale(1.02)}to{transform:scale(1.14)}}
.nmo-glow{position:absolute;left:50%;top:-40px;width:1300px;height:900px;transform:translateX(-50%);background:radial-gradient(closest-side,rgba(255,228,190,.13),transparent);opacity:0}
.in .nmo-glow{animation:nm-fade 2s ease .4s forwards,nmo-breathe 5s ease-in-out 2.4s infinite alternate}
@keyframes nmo-breathe{from{opacity:1}to{opacity:.65}}
.nmo-t{position:absolute;left:50%;top:calc(50% + 150px);width:1000px;height:620px;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;text-align:center;justify-content:center;gap:22px}
.nmo-t>*{opacity:0}
.in .nmo-t>*{animation:nmo-up 1.3s ease var(--dl) both}
@keyframes nmo-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.nmo-n{font-family:"Newsreader",Georgia,serif;font-weight:400;font-size:108px;line-height:1.05;letter-spacing:-.015em;color:#F2F2F0;max-height:240px;overflow:hidden;padding-bottom:4px}
.nmo-d{font-family:var(--display);font-weight:300;font-size:40px;letter-spacing:.08em;color:#C9CCD3;font-variant-numeric:tabular-nums}
.nmo-r{font-family:"Newsreader",Georgia,serif;font-style:italic;font-size:36px;color:#C9CCD3}
.nmo-b{max-width:56ch;max-height:180px;overflow:hidden;padding-top:24px;border-top:1px solid rgba(255,255,255,.1);font-size:27px;line-height:1.5;color:#9AA3B5;margin:0 auto}
.out .nmo-t>*{animation:nm-fadeOut 1s ease both}
.out .nmo-glow{animation:nm-fadeOut 1.2s ease both}
.out .nmo-wm{animation:nm-fadeOut 1.2s ease both}
`;

const CSS_V = `
.nmo-glow{width:1000px;height:1000px;top:-60px}
.nmo-t{top:auto;bottom:15%;transform:translateX(-50%);width:940px;height:auto;justify-content:flex-end}
.nmo-n{font-size:98px}
.nmo-b{max-width:none}
`;
