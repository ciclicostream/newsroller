import { useEffect, useRef, useState } from "react";
import type { ObituarioData } from "@newsroller/shared";
import { useAutoFit } from "../lib/autofit";
import { IS_VERTICAL } from "../lib/orientation";

// Obituario (vive dentro de Última Hora): pantalla limpia, sin marco ni newsticker, sin hora ni fecha.
// Retrato en blanco y negro, nombre, años, oficio y una semblanza breve. Todo entra y sale con fundidos lentos.
export function Obituario({ data, durationSec }: { data: ObituarioData; durationSec?: number }) {
  const [play, setPlay] = useState(false);
  const [exiting, setExiting] = useState(false);
  const nameRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setPlay(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (!durationSec) return;
    const t = setTimeout(() => setExiting(true), Math.max(1000, durationSec * 1000 - 1400));
    return () => clearTimeout(t);
  }, [durationSec]);

  useAutoFit(nameRef, IS_VERTICAL ? 92 : 104, 48, [data.name]);
  useAutoFit(textRef, IS_VERTICAL ? 32 : 30, 20, [data.text]);

  return (
    <div className={"ob" + (play ? " play" : "") + (exiting ? " exit" : "") + (IS_VERTICAL ? " v" : "")} style={{ position: "absolute", inset: 0 }}>
      <style>{CSS + (IS_VERTICAL ? CSS_V : "")}</style>
      <div className="ob-bg" />
      <div className="ob-glow" />
      {data.photo_url && <div className="ob-photo ob-el" style={{ ["--d" as any]: ".5s" }}><img src={data.photo_url} alt="" /></div>}
      <div className="ob-col">
        <div className="ob-kick ob-el" style={{ ["--d" as any]: "1.1s" }}>OBITUARIO</div>
        <div className="ob-name ob-el" ref={nameRef} style={{ ["--d" as any]: "1.4s" }}>{data.name}</div>
        {data.years && <div className="ob-years ob-el" style={{ ["--d" as any]: "1.8s" }}>{data.years}</div>}
        {data.role && <div className="ob-role ob-el" style={{ ["--d" as any]: "2.1s" }}>{data.role}</div>}
        {data.text && <div className="ob-text ob-el" ref={textRef} style={{ ["--d" as any]: "2.5s" }}>{data.text}</div>}
      </div>
    </div>
  );
}

// Vertical (1080x1920): retrato centrado arriba, texto centrado debajo.
const CSS_V = `
.ob.v .ob-photo{left:240px;top:200px;width:600px;height:780px}
.ob.v .ob-glow{left:-10px;top:60px}
.ob.v .ob-col{left:80px;right:80px;top:1040px;width:auto;height:780px;align-items:center;text-align:center}
.ob.v .ob-kick::before{display:none}
.ob.v .ob-name{max-height:220px;text-align:center}
`;

const CSS = `
.ob{font-family:Inter,system-ui,sans-serif}
.ob-bg{position:absolute;inset:0;background:radial-gradient(90% 80% at 35% 40%,#15181f 0%,#0b0d12 55%,#050608 100%)}
.ob-glow{position:absolute;left:140px;top:-40px;width:1100px;height:1100px;background:radial-gradient(closest-side,rgba(255,228,190,.13),transparent);opacity:0}
.ob-photo{position:absolute;left:250px;top:170px;width:470px;height:620px;border-radius:22px;overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.14),0 40px 80px -30px #000}
.ob-photo img{width:100%;height:100%;object-fit:cover;display:block;filter:grayscale(1) contrast(1.05)}
.ob-col{position:absolute;left:800px;top:190px;width:900px;height:640px;display:flex;flex-direction:column;justify-content:center;gap:22px}
.ob-kick{display:flex;align-items:center;gap:18px;color:#9AA3B5;font-weight:600;font-size:18px;letter-spacing:.42em}
.ob-kick::before{content:"";width:44px;height:1px;background:#9AA3B5}
.ob-name{font-family:"Zilla Slab",Georgia,serif;font-weight:600;color:#F2F2F0;line-height:1.1;max-height:240px;overflow:hidden;padding-bottom:4px}
.ob-years{font-weight:300;font-size:40px;letter-spacing:.08em;color:#C9CCD3;font-variant-numeric:tabular-nums}
.ob-role{font-style:italic;font-size:34px;color:#C9CCD3}
.ob-text{max-height:230px;overflow:hidden;padding-top:24px;border-top:1px solid rgba(255,255,255,.1);line-height:1.5;color:#9AA3B5}

/* Entrada: fundidos lentos, uno por uno. Salida: todo se funde junto. */
.ob-el{opacity:0}
.ob.play .ob-glow{animation:ob-fade 2s ease .3s forwards}
.ob.play .ob-el{animation:ob-in 1.3s ease var(--d,0s) forwards}
.ob.exit .ob-el,.ob.exit .ob-glow{animation:ob-out 1.2s ease forwards}
@keyframes ob-fade{to{opacity:1}}
@keyframes ob-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes ob-out{from{opacity:1}to{opacity:0}}
`;
