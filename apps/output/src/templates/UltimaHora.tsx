import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { UltimaHoraData } from "@newsroller/shared";
import ciclicoWhite from "../assets/ciclico-white.png";

const WANT_AUDIO = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("audio");
const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

// Escapa HTML y aplica **negrita** (markdown mínimo).
function renderText(t: string): string {
  const esc = (t ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}

export function UltimaHora({ data }: { data: UltimaHoraData }) {
  const hasMedia = !!data.media_url;
  const [now, setNow] = useState(() => new Date());
  const [play, setPlay] = useState(false);
  const bajadaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => setPlay(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Auto-fit de la bajada: achica la fuente hasta que entre antes del ticker.
  useLayoutEffect(() => {
    const el = bajadaRef.current;
    if (!el) return;
    const base = hasMedia ? 52 : 78;
    const top = hasMedia ? 452 : 560;
    const tickerTop = 1080 - 56 - 56; // bottom + alto del ticker
    const maxH = tickerTop - 28 - top;
    let px = base;
    el.style.fontSize = px + "px";
    let guard = 0;
    while (el.scrollHeight > maxH && px > 30 && guard++ < 40) {
      px -= 2;
      el.style.fontSize = px + "px";
    }
  }, [data.text, hasMedia]);

  const clock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const fecha = `${now.getDate()} ${MESES[now.getMonth()]}`;

  return (
    <div className={"uh" + (play ? " play" : "") + (hasMedia ? " has-media" : "")} style={{ position: "absolute", inset: 0 }}>
      <style>{CSS}</style>
      <div className="uh-bg" />
      <div className="uh-placa" />
      <div className="uh-flash" />

      {hasMedia && (
        <div className="uh-media">
          {data.media_kind === "video" ? (
            <video src={data.media_url!} autoPlay muted={!WANT_AUDIO} loop playsInline />
          ) : (
            <img src={data.media_url!} alt="" />
          )}
        </div>
      )}

      <div className="uh-clock">{clock} | {fecha}</div>
      <div className="uh-logo"><img src={ciclicoWhite} alt="Cíclico" /></div>
      <div className="uh-titulo">ÚLTIMA HORA</div>
      <div className="uh-bajada" ref={bajadaRef} dangerouslySetInnerHTML={{ __html: renderText(data.text) }} />

      <div className="uh-ticker">
        <div className="uh-track">
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i}>ÚLTIMA HORA</span>
          ))}
        </div>
      </div>

      {data.audio_url && <audio src={data.audio_url} autoPlay muted={!WANT_AUDIO} />}
    </div>
  );
}

const CSS = `
.uh{font-family:Inter,system-ui,sans-serif}
.uh-bg{position:absolute;inset:0;background:radial-gradient(120% 90% at 30% 20%,#16308f 0%,#0d2168 32%,#050d33 78%,#03081f 100%)}
.uh-bg::after{content:"";position:absolute;inset:0;background:radial-gradient(130% 100% at 50% 45%,transparent 55%,rgba(0,0,0,.55) 100%)}
.uh-placa{position:absolute;inset:30px;background:#EE220C;border-radius:44px;opacity:0;transform:scale(.965)}
.uh-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;border-radius:44px;z-index:40}
.uh-clock{position:absolute;top:44px;right:52px;z-index:20;background:#fff;color:#12203a;border-radius:16px;padding:16px 26px;font-weight:800;font-size:40px;letter-spacing:.02em;box-shadow:0 6px 18px rgba(0,0,0,.18);opacity:0}
.uh-logo{position:absolute;z-index:20;opacity:0}
.uh-logo img{display:block;width:100%;height:auto;filter:brightness(0) invert(1)}
.uh-titulo{position:absolute;z-index:15;font-family:"Zilla Slab",Georgia,serif;font-weight:700;color:#0E0E0E;line-height:.92;letter-spacing:.005em;white-space:nowrap;clip-path:inset(0 100% 0 0)}
.uh-bajada{position:absolute;z-index:15;color:#fff;font-weight:600;line-height:1.06;opacity:0;transform:translateY(26px)}
.uh-bajada b{font-weight:900}
.uh-media{position:absolute;border-radius:28px;overflow:hidden;background:#c9ccd2;opacity:0;transform:translateX(-40px);clip-path:inset(0 100% 0 0);left:110px;top:120px;width:640px;height:640px}
.uh-media img,.uh-media video{width:100%;height:100%;object-fit:cover;display:block}

/* FULL (sin media): todo centrado */
.uh-logo{top:140px;left:50%;margin-left:-75px;width:150px}
.uh-titulo{top:335px;left:0;right:0;text-align:center;font-size:170px}
.uh-bajada{top:560px;left:120px;right:120px;text-align:center;font-size:78px}

/* Video/Foto (con media): columna de texto a la derecha (logo -20%, bloque 100px más arriba, logo separado del título) */
.uh.has-media .uh-logo{top:214px;left:832px;margin-left:0;width:80px}
.uh.has-media .uh-titulo{top:326px;left:830px;right:auto;text-align:left;font-size:104px}
.uh.has-media .uh-bajada{top:452px;left:832px;right:110px;text-align:left;font-size:52px}

/* ticker */
.uh-ticker{position:absolute;left:30px;right:30px;bottom:56px;height:56px;z-index:30;background:#fff;overflow:hidden;display:flex;align-items:center;box-shadow:inset 0 0 24px rgba(0,0,0,.28), inset 0 2px 6px rgba(0,0,0,.20);opacity:0}
.uh-ticker::before,.uh-ticker::after{content:"";position:absolute;top:0;bottom:0;width:140px;z-index:2;pointer-events:none}
.uh-ticker::before{left:0;background:linear-gradient(90deg,rgba(0,0,0,.50) 0%,rgba(0,0,0,.18) 45%,rgba(0,0,0,0) 100%)}
.uh-ticker::after{right:0;background:linear-gradient(270deg,rgba(0,0,0,.50) 0%,rgba(0,0,0,.18) 45%,rgba(0,0,0,0) 100%)}
.uh-track{display:flex;white-space:nowrap;will-change:transform;animation:uh-scroll 30s linear infinite}
.uh-track span{font-family:"Zilla Slab",Georgia,serif;font-weight:700;color:#0E0E0E;font-size:32px;letter-spacing:.02em;padding:0 26px}
@keyframes uh-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}

/* animaciones (al montar → play) */
.uh.play .uh-placa{animation:uh-placaIn .55s cubic-bezier(.2,.8,.2,1) forwards}
.uh.play .uh-flash{animation:uh-flashA .6s ease-out forwards}
.uh.play .uh-clock{animation:uh-fadeIn .5s ease .5s forwards}
.uh.play .uh-logo{animation:uh-fadeIn .5s ease .55s forwards}
.uh.play .uh-titulo{animation:uh-wipe .7s cubic-bezier(.2,.8,.2,1) .35s forwards}
.uh.play .uh-bajada{animation:uh-rise .6s cubic-bezier(.2,.8,.2,1) .62s forwards}
.uh.play .uh-media{animation:uh-mediaIn .7s cubic-bezier(.2,.8,.2,1) .4s forwards}
.uh.play .uh-ticker{animation:uh-fadeIn .5s ease .8s forwards}
@keyframes uh-placaIn{to{opacity:1;transform:scale(1)}}
@keyframes uh-flashA{0%{opacity:.85}100%{opacity:0}}
@keyframes uh-fadeIn{to{opacity:1}}
@keyframes uh-wipe{to{clip-path:inset(0 0 0 0)}}
@keyframes uh-rise{to{opacity:1;transform:translateY(0)}}
@keyframes uh-mediaIn{to{opacity:1;transform:translateX(0);clip-path:inset(0 0 0 0)}}
`;
