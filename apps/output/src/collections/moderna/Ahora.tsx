import { useRef } from "react";
import type { UltimaHoraData } from "@newsroller/shared";
import { IS_VERTICAL } from "../../lib/orientation";
import { P } from "../../lib/params";
import { useForcePlay } from "../../lib/autoplay";
import { Grain, NM_CSS, horaCorta, richHTML, useFit, useLife } from "./base";
import { ModernChrome } from "./Chrome";

const WANT_AUDIO = P.has("audio");

// Ahora (tipo ultima_hora), colección Modernas. Entra como sale: un cuadrado rojo barre la pantalla y al retirarse
// deja la noticia; un flash rojo, el rótulo AHORA que cae y una baliza que gira de fondo. Con "Noticia en desarrollo"
// suma una tira azul que corre al lado del rótulo. El ticker del marco se pone rojo y repite AHORA.
// La hora de "Actualizado" es la de la última edición del contenido. Todo de frente.
export function Ahora({ data, durationSec, updatedAt }: { data: UltimaHoraData; durationSec?: number; updatedAt?: string }) {
  const media = !!data.media_url;
  const dev = !!data.developing;
  const { cls } = useLife(durationSec, 1.0);
  const tRef = useRef<HTMLDivElement>(null);
  const videoRef = useForcePlay<HTMLVideoElement>();
  useFit(tRef, IS_VERTICAL ? (media ? 96 : 130) : media ? 86 : 116, 50, [data.text, media]);
  const devTrack = Array.from({ length: 8 }, (_, i) => <span key={i}>NOTICIA EN DESARROLLO</span>);

  return (
    <div className={"nm nma" + cls + (media ? " media" : "") + (IS_VERTICAL ? " v" : "")}>
      <style>{NM_CSS + CSS + (IS_VERTICAL ? CSS_V : "")}</style>
      <div className="nm-bg" /><Grain />
      <div className="nm-sc">
        <div className="nma-bg" />
        <div className="nma-beacon" />
        <div className="nma-c">
          <div className="nma-head">
            <div className="nma-k"><i />AHORA</div>
            {dev && <div className="nma-dev"><div className="trk">{devTrack}{devTrack}</div></div>}
          </div>
          <div className="nma-time">Actualizado {horaCorta(updatedAt)}</div>
          {media && (
            <div className="nma-m">
              {data.media_kind === "video"
                ? <video key={data.media_url} ref={videoRef} src={data.media_url!} autoPlay muted={!WANT_AUDIO} loop playsInline />
                : <img src={data.media_url!} alt="" />}
            </div>
          )}
          <div className="nma-t" ref={tRef} dangerouslySetInnerHTML={{ __html: richHTML(data.text) }} />
        </div>
        <div className="nma-wipe" />
        <div className="nma-flash" />
      </div>
      <ModernChrome alert />
      {data.audio_url && <audio src={data.audio_url} autoPlay muted={!WANT_AUDIO} />}
    </div>
  );
}

const CSS = `
.nma-bg{position:absolute;inset:0;background:radial-gradient(1000px 640px at 0% 0%,rgba(238,34,12,.38),transparent 70%),radial-gradient(1100px 700px at 100% 100%,rgba(238,34,12,.24),transparent 70%),rgba(20,4,8,.35)}
.nma-beacon{position:absolute;left:50%;top:40%;width:2800px;height:2800px;margin:-1400px;mix-blend-mode:screen;opacity:0;
  background:conic-gradient(from 0deg,transparent 0 30deg,rgba(255,70,50,.2) 48deg,transparent 66deg,transparent 210deg,rgba(255,70,50,.16) 228deg,transparent 246deg)}
.in .nma-beacon{animation:nma-spin 5s linear infinite,nm-fade .8s ease .6s forwards}
@keyframes nma-spin{to{transform:rotate(360deg)}}
.nma-flash{position:absolute;inset:0;background:#FF2A12;mix-blend-mode:screen;opacity:0;pointer-events:none}
.in .nma-flash{animation:nma-flash .8s ease-out .45s both}
@keyframes nma-flash{0%{opacity:.9}14%{opacity:.08}24%{opacity:.6}100%{opacity:0}}
.nma-c{opacity:0}
.in .nma-c{animation:nm-fade .01s linear .47s both}
.out .nma-c{animation:nm-fadeOut .01s linear .47s both}
.nma-head{position:absolute;left:96px;right:96px;top:176px;display:flex;align-items:center;gap:28px}
.nma-k{flex:none;display:flex;align-items:center;gap:18px;background:#EE220C;color:#fff;padding:14px 28px 12px;border-radius:6px;font-family:var(--display);font-weight:900;font-stretch:112%;font-size:48px;letter-spacing:.05em;box-shadow:0 0 70px rgba(238,34,12,.65)}
.nma-k i{width:16px;height:16px;border-radius:50%;background:#fff;animation:nm-blink 1s steps(1) infinite}
.in .nma-k{animation:nma-slam .55s cubic-bezier(.2,1.4,.4,1) .5s both}
@keyframes nma-slam{from{opacity:0;transform:scale(1.7);filter:blur(12px)}to{opacity:1;transform:none;filter:none}}
.nma-dev{flex:1;align-self:stretch;min-width:0;position:relative;overflow:hidden;border-radius:6px;background:linear-gradient(90deg,#2F6BFF,#1C48C9);box-shadow:0 0 50px rgba(47,107,255,.45);transform-origin:0 50%}
.nma-dev .trk{position:absolute;left:0;top:0;height:100%;display:flex;align-items:center;white-space:nowrap;animation:nm-tick 14s linear infinite}
.nma-dev span{font-family:var(--display);font-weight:800;font-stretch:112%;font-size:28px;letter-spacing:.22em;color:#fff;padding:0 30px;display:flex;align-items:center;gap:30px}
.nma-dev span::after{content:"";width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.6)}
.nma-dev::before,.nma-dev::after{content:"";position:absolute;top:0;bottom:0;width:90px;z-index:2;pointer-events:none}
.nma-dev::before{left:0;background:linear-gradient(90deg,#2F6BFF,rgba(47,107,255,0))}
.nma-dev::after{right:0;background:linear-gradient(270deg,#1C48C9,rgba(28,72,201,0))}
.in .nma-dev{animation:nm-growX .6s cubic-bezier(.7,0,.2,1) .95s both}
.nma-time{position:absolute;left:96px;top:268px;font-family:var(--display);font-weight:600;font-stretch:112%;font-size:18px;letter-spacing:.26em;color:#FFB4A8;text-transform:uppercase;opacity:0}
.in .nma-time{animation:nm-fade .5s ease 1s forwards}
.nma-t{position:absolute;left:96px;top:318px;width:1728px;height:540px;overflow:hidden;font-family:var(--display);font-weight:800;font-stretch:84%;font-size:116px;line-height:1.02;letter-spacing:-.015em;color:#fff;text-wrap:balance}
.nma-t b{background:#EE220C;box-decoration-break:clone;-webkit-box-decoration-break:clone;padding:0 .12em;border-radius:6px;font-weight:900}
.in .nma-t{animation:nma-clip .75s cubic-bezier(.2,.8,.2,1) .7s both}
@keyframes nma-clip{from{clip-path:inset(0 0 100% 0);transform:translateY(40px)}to{clip-path:inset(0 0 -10% 0);transform:none}}
.nma.media .nma-t{left:740px;width:1084px;font-size:86px}
.nma-m{position:absolute;left:96px;top:318px;width:580px;height:540px;border-radius:14px;overflow:hidden;box-shadow:0 0 0 3px #EE220C,0 0 90px rgba(238,34,12,.5)}
.nma-m img,.nma-m video{width:100%;height:100%;object-fit:cover;display:block}
.in .nma-m{animation:nma-flick .6s steps(1) .55s both}
@keyframes nma-flick{0%{opacity:0}20%{opacity:1}35%{opacity:.2}50%{opacity:1}100%{opacity:1}}
.nma-wipe{position:absolute;left:0;right:0;top:140px;bottom:120px;background:#EE220C;transform:scaleX(0);transform-origin:0 50%;z-index:6}
.in .nma-wipe{animation:nma-wipe .95s cubic-bezier(.7,0,.3,1) both}
.out .nma-wipe{animation:nma-wipeOut .95s cubic-bezier(.7,0,.3,1) both}
@keyframes nma-wipe{0%{transform:scaleX(0);transform-origin:0 50%}50%{transform:scaleX(1);transform-origin:0 50%}50.01%{transform:scaleX(1);transform-origin:100% 50%}100%{transform:scaleX(0);transform-origin:100% 50%}}
@keyframes nma-wipeOut{0%{transform:scaleX(0);transform-origin:0 50%}50%{transform:scaleX(1);transform-origin:0 50%}50.01%{transform:scaleX(1);transform-origin:100% 50%}100%{transform:scaleX(0);transform-origin:100% 50%}}
.out .nma-beacon,.out .nma-bg{animation:nm-fadeOut .4s ease .5s both}
`;

const CSS_V = `
.nma-head{left:60px;right:60px;top:190px}
.nma-k{font-size:44px}
.nma-time{left:60px;top:290px}
.nma-t{left:60px;top:350px;width:960px;height:1360px}
.nma.media .nma-t{left:60px;top:970px;width:960px;height:740px}
.nma-m{left:60px;top:350px;width:960px;height:580px}
.nma-wipe{top:170px;bottom:150px}
`;
