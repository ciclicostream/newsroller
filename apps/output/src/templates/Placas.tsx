import { useEffect, useState } from "react";
import type { PlacasData } from "@newsroller/shared";
import ciclicoWhite from "../assets/ciclico-white.png";

const WANT_AUDIO = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("audio");
const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

function renderText(t: string): string {
  const esc = (t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}

// Placa de noticia genérica: se escribe a mano o se trae del sitio de Cíclico.
export function Placas({ data }: { data: PlacasData }) {
  const hasMedia = !!data.media_url;
  const [now, setNow] = useState(() => new Date());
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const id = requestAnimationFrame(() => setPlay(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const clock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const fecha = `${now.getDate()} ${MESES[now.getMonth()]}`;
  const kicker = (data.kicker || "NOTICIAS").toUpperCase();

  return (
    <div className={"pl" + (play ? " play" : "") + (hasMedia ? " has-media" : "")} style={{ position: "absolute", inset: 0 }}>
      <style>{CSS}</style>
      <div className="pl-bg" />

      {hasMedia && (
        <div className="pl-media">
          {data.media_kind === "video" ? (
            <video src={data.media_url!} autoPlay muted={!WANT_AUDIO} loop playsInline />
          ) : (
            <img src={data.media_url!} alt="" />
          )}
          <div className="pl-media-grad" />
        </div>
      )}

      <div className="pl-clock">{clock} | {fecha}</div>
      <div className="pl-logo"><img src={ciclicoWhite} alt="Cíclico" /></div>

      <div className="pl-content">
        <div className="pl-kicker">{kicker}</div>
        <div className="pl-title" dangerouslySetInnerHTML={{ __html: renderText(data.title) }} />
        {data.body && <div className="pl-body">{data.body}</div>}
        {data.source && <div className="pl-source">{data.source}</div>}
      </div>

      <div className="pl-ticker">
        <div className="pl-track">
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i}>{kicker}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

const CSS = `
.pl{font-family:Inter,system-ui,sans-serif}
.pl-bg{position:absolute;inset:0;background:radial-gradient(120% 90% at 30% 20%,#16308f 0%,#0d2168 32%,#050d33 78%,#03081f 100%)}
.pl-clock{position:absolute;top:44px;right:52px;z-index:20;background:#fff;color:#12203a;border-radius:16px;padding:16px 26px;font-weight:800;font-size:40px;letter-spacing:.02em;box-shadow:0 6px 18px rgba(0,0,0,.18);opacity:0}
.pl-logo{position:absolute;top:56px;left:96px;z-index:20;width:150px;opacity:0}
.pl-logo img{display:block;width:100%;height:auto;filter:brightness(0) invert(1)}

.pl-media{position:absolute;right:60px;top:150px;width:860px;height:600px;border-radius:28px;overflow:hidden;background:#c9ccd2;opacity:0;transform:translateX(40px);clip-path:inset(0 0 0 100%)}
.pl-media img,.pl-media video{width:100%;height:100%;object-fit:cover;display:block}
.pl-media-grad{position:absolute;inset:0;background:linear-gradient(180deg,transparent 60%,rgba(3,8,31,.35) 100%)}

.pl-content{position:absolute;left:96px;right:120px;bottom:184px;z-index:15;display:flex;flex-direction:column;align-items:flex-start;gap:20px;opacity:0;transform:translateY(28px)}
.pl.has-media .pl-content{right:960px;bottom:210px}
.pl-kicker{background:#EE220C;color:#fff;font-weight:800;font-size:32px;letter-spacing:.06em;padding:8px 22px;border-radius:10px}
.pl-title{font-family:"Zilla Slab",Georgia,serif;font-weight:700;color:#fff;line-height:.98;font-size:118px}
.pl.has-media .pl-title{font-size:74px}
.pl-title b{font-weight:900}
.pl-body{color:#dfe6ff;font-weight:500;line-height:1.14;font-size:50px;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.pl.has-media .pl-body{font-size:38px;-webkit-line-clamp:3}
.pl-source{color:#8ea3e6;font-weight:700;font-size:28px;letter-spacing:.04em;text-transform:uppercase}

.pl-ticker{position:absolute;left:30px;right:30px;bottom:56px;height:56px;z-index:30;background:#fff;overflow:hidden;display:flex;align-items:center;box-shadow:inset 0 0 24px rgba(0,0,0,.28), inset 0 2px 6px rgba(0,0,0,.20);opacity:0}
.pl-ticker::before,.pl-ticker::after{content:"";position:absolute;top:0;bottom:0;width:140px;z-index:2;pointer-events:none}
.pl-ticker::before{left:0;background:linear-gradient(90deg,rgba(0,0,0,.50) 0%,rgba(0,0,0,.18) 45%,rgba(0,0,0,0) 100%)}
.pl-ticker::after{right:0;background:linear-gradient(270deg,rgba(0,0,0,.50) 0%,rgba(0,0,0,.18) 45%,rgba(0,0,0,0) 100%)}
.pl-track{display:flex;white-space:nowrap;will-change:transform;animation:pl-scroll 30s linear infinite}
.pl-track span{font-family:"Zilla Slab",Georgia,serif;font-weight:700;color:#0E0E0E;font-size:32px;letter-spacing:.02em;padding:0 26px}
@keyframes pl-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}

.pl.play .pl-clock{animation:pl-fadeIn .5s ease .5s forwards}
.pl.play .pl-logo{animation:pl-fadeIn .5s ease .5s forwards}
.pl.play .pl-content{animation:pl-rise .6s cubic-bezier(.2,.8,.2,1) .35s forwards}
.pl.play .pl-media{animation:pl-mediaIn .7s cubic-bezier(.2,.8,.2,1) .3s forwards}
.pl.play .pl-ticker{animation:pl-fadeIn .5s ease .7s forwards}
@keyframes pl-fadeIn{to{opacity:1}}
@keyframes pl-rise{to{opacity:1;transform:translateY(0)}}
@keyframes pl-mediaIn{to{opacity:1;transform:translateX(0);clip-path:inset(0 0 0 0)}}
`;
