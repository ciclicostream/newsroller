import { useRef } from "react";
import type { DeclaracionesData } from "@newsroller/shared";
import { IS_VERTICAL } from "../../lib/orientation";
import { P } from "../../lib/params";
import { Grain, NM_CSS, useFit, useLife, useTypewriter } from "./base";
import { ModernChrome } from "./Chrome";

const WANT_AUDIO = P.has("audio");

// Declaraciones (Citas), colección Modernas: un seguidor de luz se enciende sobre la foto, que es el único módulo
// girado. La comilla gigante entra de frente; nombre, cargo y lugar en fichas escalonadas que pisan la foto; la cita
// se escribe a máquina (la caja se mide con el texto completo, así nada salta mientras se escribe). Abajo, el titular
// y "Entrevista completa en…", los dos opcionales. Sin temperatura en el marco. Sale pieza por pieza.
export function Declaraciones({ data, durationSec }: { data: DeclaracionesData; durationSec?: number }) {
  const { cls } = useLife(durationSec, 1.3);
  const qRef = useRef<HTMLDivElement>(null);
  const quote = (data.quote ?? "").trim();
  useFit(qRef, IS_VERTICAL ? 62 : 58, 30, [quote]);
  const typed = useTypewriter(quote, 1700, 5200);
  const headline = data.headline?.trim();
  const program = data.interview_program?.trim();

  return (
    <div className={"nm nmq" + cls + (IS_VERTICAL ? " v" : "") + (headline ? "" : " nohl") + (program ? "" : " noepa")}>
      <style>{NM_CSS + CSS + (IS_VERTICAL ? CSS_V : "")}</style>
      <div className="nm-bg" /><Grain />
      <div className="nmq-spot" />
      <div className="nm-sc">
        <div className="nmq-p">
          <div className="nm-pe" />
          <div className="nm-pf"><img src={data.photo_url} alt="" /></div>
        </div>
        <div className="nmq-g">&ldquo;</div>
        <div className="nmq-tags">
          <div className="nmq-tg n" style={{ ["--x" as string]: "0px", ["--dl" as string]: "1s" }}>{data.name}</div>
          {data.role?.trim() && <div className="nmq-tg c" style={{ ["--x" as string]: "44px", ["--dl" as string]: "1.15s" }}>{data.role}</div>}
          {data.place?.trim() && <div className="nmq-tg l" style={{ ["--x" as string]: "88px", ["--dl" as string]: "1.3s" }}>{data.place}</div>}
        </div>
        <div className="nmq-q" ref={qRef}>
          <span>{typed}</span><span className="nm-caret" style={{ background: "var(--blue-soft)" }} /><span className="rest">{quote.slice(typed.length)}</span>
        </div>
        {headline && <div className="nm-panel nmq-hl"><div className="nm-inner"><div>{headline}</div></div></div>}
        {program && <div className="nm-panel solid nmq-epa"><div className="nm-inner"><small>Entrevista completa en</small><b>{program}</b></div></div>}
      </div>
      {data.audio_url && <audio src={data.audio_url} autoPlay muted={!WANT_AUDIO} />}
      <ModernChrome hideTemp />
    </div>
  );
}

const CSS = `
.nmq-spot{position:absolute;left:-220px;top:-160px;width:1250px;height:1300px;z-index:21;pointer-events:none;mix-blend-mode:screen;opacity:0;transform:scale(.15);
  background:radial-gradient(closest-side,rgba(210,222,255,.34),rgba(47,107,255,.13) 55%,transparent)}
.in .nmq-spot{animation:nmq-spotOn .9s cubic-bezier(.2,.8,.2,1) .05s forwards,nmq-drift 8s ease-in-out 1s infinite alternate}
@keyframes nmq-spotOn{0%{opacity:0;transform:scale(.15)}55%{opacity:1}100%{opacity:1;transform:none}}
@keyframes nmq-drift{from{opacity:1;transform:none}to{opacity:1;transform:translate(50px,26px)}}

/* Foto: el único módulo girado. */
.nmq-p{position:absolute;left:120px;top:150px;width:520px;height:680px;transform-style:preserve-3d;transform-origin:0 50%;transform:rotateY(21deg)}
.nmq-p .nm-pf img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.nmq-p>*{opacity:0}
.in .nmq-p>*{animation:nmq-lit 1.3s ease-out .35s both}
@keyframes nmq-lit{0%{opacity:0;filter:brightness(0)}50%{opacity:1;filter:brightness(1.6)}100%{opacity:1;filter:brightness(1)}}

/* Comilla de frente */
.nmq-g{position:absolute;left:560px;top:40px;font-family:var(--display);font-weight:900;font-size:560px;line-height:1;color:var(--blue);opacity:0;pointer-events:none;
  text-shadow:2px 2px 0 #2458E0,4px 4px 0 #1F4DCB,6px 6px 0 #1A42B5,8px 8px 0 #15389F,10px 10px 0 #112F8A,16px 22px 40px rgba(0,0,0,.6),0 0 60px rgba(47,107,255,.5)}
.in .nmq-g{animation:nmq-gIn .8s cubic-bezier(.2,.8,.2,1) .55s both}
@keyframes nmq-gIn{from{opacity:0;transform:scale(1.5)}to{opacity:1;transform:none}}

/* Fichas: nombre, cargo y lugar, escalonadas por delante de la foto */
.nmq-tags{position:absolute;left:430px;top:600px;display:flex;flex-direction:column;align-items:flex-start;gap:10px;max-width:760px}
.nmq-tg{padding:12px 24px 11px;border-radius:8px;opacity:0;transform:translateX(var(--x));box-shadow:0 20px 40px -14px rgba(0,0,0,.7);max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nmq-tg.n{background:#F4F6FB;color:#0A1433;font-family:var(--display);font-weight:800;font-stretch:92%;font-size:48px;line-height:1}
.nmq-tg.c{background:var(--blue);color:#fff;font-family:var(--display);font-weight:700;font-size:28px}
.nmq-tg.l{background:rgba(10,22,54,.92);color:var(--mist);font-family:var(--display);font-weight:600;font-stretch:112%;font-size:17px;letter-spacing:.24em;text-transform:uppercase;box-shadow:inset 0 0 0 1px rgba(127,162,255,.3),0 20px 40px -14px rgba(0,0,0,.7)}
.in .nmq-tg{animation:nmq-tagIn .7s cubic-bezier(.2,.8,.2,1) var(--dl) both}
@keyframes nmq-tagIn{from{opacity:0;transform:translateX(calc(var(--x) - 60px))}to{opacity:1;transform:translateX(var(--x))}}

/* Cita */
.nmq-q{position:absolute;left:820px;top:176px;width:1000px;height:560px;overflow:hidden;font-family:var(--display);font-weight:700;font-stretch:94%;font-size:58px;line-height:1.14;letter-spacing:-.005em;color:var(--paper);text-wrap:pretty;white-space:pre-line}
.nmq-q .rest{color:transparent}
.nmq.nohl.noepa .nmq-q{height:700px}

/* Titular y "Entrevista completa en…" (opcionales) */
.nmq-hl{left:820px;top:790px;width:724px;height:100px;opacity:0}
.nmq.noepa .nmq-hl{width:1004px}
.nmq-hl .nm-inner{padding:0 34px;justify-content:center}
.nmq-hl .nm-inner div{font-family:var(--display);font-weight:700;font-size:26px;color:var(--paper);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nmq-epa{left:1564px;top:790px;width:260px;height:100px;opacity:0}
.nmq.nohl .nmq-epa{left:820px;width:320px}
.nmq-epa .nm-inner{padding:0 26px;justify-content:center;gap:2px}
.nmq-epa small{white-space:nowrap;font-size:16px;color:rgba(255,255,255,.85)}
.nmq-epa b{font-family:var(--display);font-weight:900;font-size:40px;line-height:1;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.in .nmq-hl{animation:nm-fade .8s ease 1.2s forwards}
.in .nmq-epa{animation:nm-fade .8s ease 1.35s forwards}

/* Salida pieza por pieza */
.out .nmq-q{animation:nm-fadeOut .5s ease both}
.out .nmq-g{animation:nm-fadeOut .5s ease .15s both}
.out .nmq-tg{animation:nm-fadeOut .5s ease .3s both}
.out .nmq-hl,.out .nmq-epa{animation:nm-fadeOut .5s ease .45s both}
.out .nmq-p>*{animation:nm-fadeOut .6s ease .6s both}
.out .nmq-spot{animation:nmq-spotOff .7s ease-in .55s both}
@keyframes nmq-spotOff{from{opacity:1}to{opacity:0;transform:scale(.1)}}
`;

const CSS_V = `
.nmq-spot{left:-300px;top:-200px}
.nmq-p{left:60px;top:190px;width:540px;height:700px}
.nmq-g{left:650px;top:150px;font-size:440px}
.nmq-tags{left:380px;top:720px;max-width:640px}
.nmq-q{left:60px;top:990px;width:960px;height:520px}
.nmq.nohl.noepa .nmq-q{height:680px}
.nmq-hl{left:60px;top:1570px;width:700px}
.nmq.noepa .nmq-hl{width:960px}
.nmq-epa{left:780px;top:1570px;width:240px}
.nmq.nohl .nmq-epa{left:60px;width:360px}
`;
