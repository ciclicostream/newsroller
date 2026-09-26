import { useRef } from "react";
import type { ObituarioData } from "@newsroller/shared";
import { IS_VERTICAL } from "../../lib/orientation";
import { NM_CSS, useFit, useLife } from "./base";

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
      <div className="nmo-glow" />
      {data.photo_url && <div className="nmo-p"><img src={data.photo_url} alt="" /></div>}
      <div className="nmo-t">
        <div className="nmo-k" style={{ ["--dl" as any]: "1.2s" }}>Obituario</div>
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
.nmo-glow{position:absolute;left:180px;top:-40px;width:1100px;height:1100px;background:radial-gradient(closest-side,rgba(255,228,190,.15),transparent);opacity:0}
.in .nmo-glow{animation:nm-fade 2s ease .4s forwards,nmo-breathe 5s ease-in-out 2.4s infinite alternate}
@keyframes nmo-breathe{from{opacity:1}to{opacity:.65}}
.nmo-p{position:absolute;left:290px;top:180px;width:440px;height:580px;overflow:hidden;border-radius:4px;box-shadow:0 0 0 1px rgba(255,255,255,.14),0 40px 80px -30px #000;opacity:0}
.nmo-p img{width:100%;height:100%;object-fit:cover;display:block;filter:grayscale(1) contrast(1.05)}
.in .nmo-p{animation:nmo-in 2s ease .6s both}
@keyframes nmo-in{from{opacity:0;filter:brightness(0)}to{opacity:1;filter:brightness(1)}}
.nmo-t{position:absolute;left:820px;top:200px;width:900px;height:680px;display:flex;flex-direction:column;justify-content:center;gap:22px}
.nmo-t>*{opacity:0}
.in .nmo-t>*{animation:nmo-up 1.3s ease var(--dl) both}
@keyframes nmo-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.nmo-k{display:flex;align-items:center;gap:18px;font-family:var(--display);font-weight:600;font-stretch:118%;font-size:16px;letter-spacing:.42em;text-transform:uppercase;color:#9AA3B5}
.nmo-k::before{content:"";width:44px;height:1px;background:#9AA3B5}
.nmo-n{font-family:"Newsreader",Georgia,serif;font-weight:400;font-size:108px;line-height:1.05;letter-spacing:-.015em;color:#F2F2F0;max-height:240px;overflow:hidden;padding-bottom:4px}
.nmo-d{font-family:var(--display);font-weight:300;font-size:40px;letter-spacing:.08em;color:#C9CCD3;font-variant-numeric:tabular-nums}
.nmo-r{font-family:"Newsreader",Georgia,serif;font-style:italic;font-size:36px;color:#C9CCD3}
.nmo-b{max-width:52ch;max-height:220px;overflow:hidden;padding-top:24px;border-top:1px solid rgba(255,255,255,.1);font-size:27px;line-height:1.5;color:#9AA3B5}
.out .nmo-t>*{animation:nm-fadeOut 1s ease both}
.out .nmo-p{animation:nm-fadeOut 1.1s ease .1s both}
.out .nmo-glow{animation:nm-fadeOut 1.2s ease both}
`;

const CSS_V = `
.nmo-glow{left:-10px;top:40px}
.nmo-p{left:240px;top:200px;width:600px;height:760px}
.nmo-t{left:60px;top:1020px;width:960px;height:800px;justify-content:flex-start;align-items:center;text-align:center}
.nmo-n{font-size:98px}
.nmo-k::before{display:none}
.nmo-b{max-width:none}
`;
