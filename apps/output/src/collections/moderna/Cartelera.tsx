import { useEffect, useRef, useState } from "react";
import type { CarteleraData, Plataforma } from "@newsroller/shared";
import { PLATAFORMAS_DEFAULT } from "@newsroller/shared";
import { IS_VERTICAL } from "../../lib/orientation";
import { P } from "../../lib/params";
import { API_BASE } from "../../lib/scene";
import { useForcePlay } from "../../lib/autoplay";
import { YouTubePlayer } from "../../templates/render";
import { Grain, NM_CSS, useFit, useLife } from "./base";
import { ModernChrome } from "./Chrome";

const WANT_AUDIO = P.has("audio");

// Cartelera, colección Modernas, con los campos reales del formulario:
//  - pieza horizontal: el tráiler (cine/serie) o la foto (teatro/evento), que se enciende como un proyector;
//  - pieza lateral vertical (opcional): póster o short en cine, video 9:16 en teatro/evento. Es el único módulo
//    girado; con ella, en 16:9 el marco oculta hora y temperatura (como la clásica);
//  - bloque de título que pisa el borde inferior de la pieza horizontal: newsticker chico (ESTRENO / RECOMENDADA /
//    CLÁSICO), título en franjas azules (a lo sumo 2 renglones) y debajo sinopsis (cine), descripción (evento) o
//    "De" + "Con" (teatro);
//  - ficha "EN CARTELERA": en cine título, director, actores, duración, género (+ temporadas/capítulos y
//    plataforma en series); en teatro/evento lugar, dirección, ciudad, días y horario.
// Con short: suena el short mientras el tráiler se repite mudo; al terminar queda su tapa y el tráiler toma el
// sonido. Una luz de proyector difusa acompaña la entrada; sale cerrándose en iris.
// 9:16: la pieza horizontal arriba, el título debajo y la ficha abajo con el póster o short adentro, a la derecha.
// Teatro/evento con video: sólo el video, casi a pantalla completa, y la ficha encima.
export function Cartelera({ data, durationSec }: { data: CarteleraData; durationSec?: number }) {
  const { cls } = useLife(durationSec, 1.2);
  const kind = data.kind ?? "teatro";
  const cine = kind === "cine";
  const lat: "poster" | "short" | "video" | null = cine
    ? (data.short_id ? "short" : data.poster_url ? "poster" : null)
    : data.video_url ? "video" : null;
  const videoMode = IS_VERTICAL && lat === "video";
  const [shortDone, setShortDone] = useState(false);
  const [plataformas, setPlataformas] = useState<Plataforma[]>(PLATAFORMAS_DEFAULT);
  const videoRef = useForcePlay<HTMLVideoElement>();
  const titleRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!(cine && data.is_series)) return;
    let on = true;
    fetch(`${API_BASE}/api/settings`).then((r) => r.json()).then((s) => { if (on && Array.isArray(s?.plataformas)) setPlataformas(s.plataformas); }).catch(() => {});
    return () => { on = false; };
  }, [cine, data.is_series]);

  // Título: arranca grande (más chico si es largo) y se achica hasta quedar en 2 renglones como mucho.
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    let s = (data.title ?? "").length > 18 ? (IS_VERTICAL ? 72 : 80) : (IS_VERTICAL ? 100 : 112);
    el.style.fontSize = s + "px";
    while (el.scrollHeight > s * 1.06 * 2 + s * 0.2 && s > 44) { s -= 2; el.style.fontSize = s + "px"; }
  }, [data.title]);
  useFit(rowsRef, IS_VERTICAL ? 26 : 22, 14, [data.title, data.author, data.cast, data.genre, data.venue, data.address]);

  const tickerWord = data.ticker === "estreno" ? "ESTRENO" : data.ticker === "recomendada" ? "RECOMENDADA" : data.ticker === "clasico" ? "CLÁSICO" : data.ticker === "produccion_argentina" ? "PRODUCCIÓN ARGENTINA" : "";
  const plat = data.is_series ? plataformas.find((p) => p.id === data.platform) : undefined;
  const platName = plat?.name ?? data.platform_name ?? "";
  const serieInfo = [
    data.seasons ? `${data.seasons} ${data.seasons === 1 ? "temporada" : "temporadas"}` : "",
    data.episodes ? `${data.episodes} ${data.episodes === 1 ? "capítulo" : "capítulos"}` : "",
  ].filter(Boolean).join(" · ");
  const row = (label: string, value?: string | null) => (value?.trim() ? <div className="nmk-row" key={label}><b>{label}</b>{value}</div> : null);

  const lateral = lat && (
    <div className={"nmk-v" + (lat === "poster" ? "" : " tall")}>
      <div className="nm-pe" />
      <div className="nm-pf">
        {lat === "poster" && <img src={data.poster_url} alt="" />}
        {lat === "short" && (
          <>
            <div className="nmk-yt"><YouTubePlayer videoId={data.short_id!} onEnded={() => setShortDone(true)} /></div>
            {shortDone && data.short_thumb && <img className="nmk-tapa" src={data.short_thumb} alt="" />}
          </>
        )}
        {lat === "video" && <video key={data.video_url!} ref={videoRef} src={data.video_url!} autoPlay muted={!WANT_AUDIO} loop playsInline />}
      </div>
    </div>
  );

  const ficha = (
    <div className="nm-panel nmk-d">
      <div className="nm-inner">
        <span className="nmk-pill">EN CARTELERA</span>
        <div className="nmk-ft">{cine || videoMode ? data.title : data.venue}</div>
        <div className="nmk-rows" ref={rowsRef}>
          {cine ? (
            <>
              {row("Director", data.author)}
              {row("Actores", data.cast)}
              {row("Duración", data.duration_text)}
              {row("Género", data.genre)}
              {data.is_series && row("Temporadas", serieInfo)}
              {data.is_series && (plat?.logo || platName) && (
                <div className="nmk-row"><b>Plataforma</b>{plat?.logo ? <img className="nmk-logo" src={plat.logo} alt={platName} /> : <span className="nmk-plat">{platName}</span>}</div>
              )}
            </>
          ) : videoMode ? (
            <>
              {row("Lugar", data.venue)}
              {row("Dirección", [data.address, data.city].filter((x) => x?.trim()).join(" · "))}
              {row("Días", [data.days, data.time].filter((x) => x?.trim()).join(" · "))}
            </>
          ) : (
            <>
              {row("Dirección", data.address)}
              {row("Ciudad", data.city)}
              {row("Días", data.days)}
              {row("Horario", data.time)}
            </>
          )}
        </div>
      </div>
      {IS_VERTICAL && !videoMode && lateral && <div className="nmk-incard">{lateral}</div>}
    </div>
  );

  if (videoMode) {
    return (
      <div className={"nm nmk video" + cls + " v"}>
        <style>{NM_CSS + CSS + CSS_V}</style>
        <div className="nm-bg" /><Grain />
        <div className="nm-sc nmk-sc">
          <div className="nmk-sv">{lateral}</div>
          {ficha}
        </div>
        <ModernChrome />
      </div>
    );
  }

  return (
    <div className={"nm nmk" + cls + (lat ? " lat" : " nolat") + (IS_VERTICAL ? " v" : "")}>
      <style>{NM_CSS + CSS + (IS_VERTICAL ? CSS_V : "")}</style>
      <div className="nm-bg" /><Grain />
      <div className="nm-sc nmk-sc">
        <div className="nmk-proj" />
        <div className="nmk-h">
          <div className="nm-pe" />
          <div className="nm-pf">
            {cine
              ? data.trailer_id && <div className="nmk-trl"><YouTubePlayer videoId={data.trailer_id} onEnded={() => {}} loop holdAudio={lat === "short"} unmuted={shortDone} /></div>
              : <img src={data.photo_url} alt="" />}
          </div>
        </div>
        {!IS_VERTICAL && lateral}
        <div className="nmk-t">
          {tickerWord && (
            <div className={"nmk-tk " + data.ticker}><div className="nmk-trk">{Array.from({ length: 20 }, (_, i) => <span key={i}>{tickerWord}</span>)}</div></div>
          )}
          <div className="nmk-title" ref={titleRef}><span>{data.title}</span></div>
          {cine || kind === "evento"
            ? (cine ? data.synopsis : data.description)?.trim() && <div className="nmk-sin">{cine ? data.synopsis : data.description}</div>
            : (
              <>
                {data.author?.trim() && <div className="nmk-by">De {data.author}</div>}
                {data.cast?.trim() && <div className="nmk-cast"><b>Con:</b> {data.cast}</div>}
              </>
            )}
        </div>
        {ficha}
      </div>
      <ModernChrome hideClock={!IS_VERTICAL && !!lat} hideTemp={!IS_VERTICAL && !!lat} />
    </div>
  );
}

const CSS = `
.nmk-sc{transform-style:preserve-3d;clip-path:circle(150% at 40% 45%)}
.out .nmk-sc{animation:nmk-iris 1.05s cubic-bezier(.7,0,.25,1) forwards}
@keyframes nmk-iris{from{clip-path:circle(150% at 40% 45%)}to{clip-path:circle(0% at 40% 45%)}}

/* Luz de proyector difusa */
.nmk-proj{position:absolute;left:-240px;top:-300px;width:1900px;height:1500px;pointer-events:none;mix-blend-mode:screen;opacity:0;filter:blur(46px)}
.nmk-proj::before{content:"";position:absolute;inset:0;clip-path:polygon(8% 12%,100% 40%,62% 100%);
  background:linear-gradient(126deg,rgba(255,236,200,0) 0%,rgba(255,236,200,.42) 8%,rgba(170,200,255,.12) 40%,transparent 70%)}
.nmk-proj::after{content:"";position:absolute;left:18%;top:26%;width:62%;height:56%;border-radius:50%;background:radial-gradient(closest-side,rgba(255,236,200,.28),transparent)}
.in .nmk-proj{animation:nmk-projOn 1.3s steps(1) forwards,nmk-flick 4s ease-in-out 1.4s infinite alternate}
@keyframes nmk-projOn{0%{opacity:0}8%{opacity:.9}13%{opacity:.08}20%{opacity:.75}27%{opacity:.2}38%{opacity:.7}100%{opacity:.55}}
@keyframes nmk-flick{from{opacity:.55}to{opacity:.42}}

/* Piezas con canto (horizontal y lateral) */
.nmk-h,.nmk-v{position:absolute;transform-style:preserve-3d}
.nmk-h .nm-pf,.nmk-v .nm-pf{background:#000}
.nmk-h .nm-pf img,.nmk-v .nm-pf img,.nmk-v video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.nmk-h{left:96px;top:140px;width:1000px;height:562px}
.nmk-h>*{opacity:0}
.in .nmk-h>*{animation:nmk-kaIn 1.4s ease-out .2s both}
@keyframes nmk-kaIn{0%{opacity:0;filter:brightness(4) saturate(0)}10%{opacity:1}16%{opacity:.25}24%{opacity:1;filter:brightness(2.4) saturate(.3)}100%{opacity:1;filter:brightness(1) saturate(1)}}
.nmk-trl{position:absolute;left:0;top:-36px;width:100%;height:634px}
.nmk-trl iframe,.nmk-yt iframe{width:100%;height:100%;border:0;display:block}
.nmk-v{left:1000px;top:176px;width:400px;height:600px;transform-origin:100% 50%;transform:rotateY(-10deg) translateZ(70px);opacity:0}
.nmk-v.tall{left:1010px;top:150px;width:380px;height:676px}
.in .nmk-v{animation:nmk-swing 1s cubic-bezier(.2,.8,.2,1) .65s both}
@keyframes nmk-swing{from{opacity:0;transform:translateX(180px) rotateY(-80deg)}to{opacity:1;transform:rotateY(-10deg) translateZ(70px)}}
.nmk-yt{position:absolute;left:0;top:-40px;width:100%;height:calc(100% + 80px)}
.nmk-tapa{z-index:3}

/* Título que pisa la pieza horizontal */
.nmk-t{position:absolute;left:150px;top:600px;width:900px;display:flex;flex-direction:column;align-items:flex-start;gap:12px;transform:translateZ(90px)}
.nmk-tk{position:relative;width:348px;height:42px;flex:none;overflow:hidden;border-radius:8px;background:#EE220C;
  -webkit-mask-image:linear-gradient(90deg,#000 68%,transparent);mask-image:linear-gradient(90deg,#000 68%,transparent)}
.nmk-tk.recomendada{background:#2f6bff}.nmk-tk.clasico{background:#a9741c}.nmk-tk.produccion_argentina{background:#3FB6E8}
.nmk-tk::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,transparent 45%,rgba(0,0,0,.8) 100%)}
.nmk-trk{position:absolute;left:0;top:0;height:100%;display:flex;align-items:center;white-space:nowrap;animation:nm-tick 24s linear infinite}
.nmk-trk span{font-family:var(--display);font-weight:800;font-size:20px;letter-spacing:.14em;color:#fff;padding:0 22px}
.in .nmk-tk{animation:nm-growX .6s cubic-bezier(.7,0,.2,1) 1s both;transform-origin:0 50%}
.nmk-title{font-family:var(--display);font-weight:900;font-stretch:80%;font-size:112px;line-height:1.06;letter-spacing:-.01em;color:#fff;max-width:100%}
.nmk-title span{background:var(--blue);box-decoration-break:clone;-webkit-box-decoration-break:clone;padding:0 .14em .02em;border-radius:6px;box-shadow:0 30px 50px -20px rgba(0,0,0,.7)}
.in .nmk-title{animation:nmk-bar .7s cubic-bezier(.7,0,.2,1) 1.1s both}
@keyframes nmk-bar{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 -2% -10% 0)}}
.nmk-sin{max-width:860px;font-size:25px;line-height:1.4;color:var(--mist);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.nmk-by{font-family:var(--display);font-weight:700;font-stretch:112%;font-size:18px;letter-spacing:.28em;text-transform:uppercase;color:#fff;background:#0A1433;padding:9px 14px 8px;border-radius:5px}
.nmk-cast{max-width:860px;font-size:24px;line-height:1.35;color:var(--mist);margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.nmk-cast b{color:var(--paper);font-weight:600}
.nmk-sin,.nmk-by,.nmk-cast{opacity:0}
.in .nmk-sin,.in .nmk-by,.in .nmk-cast{animation:nm-up .6s cubic-bezier(.2,.8,.2,1) 1.55s both}

/* Ficha */
.nmk-d{left:1450px;top:170px;width:374px;height:700px;opacity:0;overflow:visible}
.nmk.nolat .nmk-d{left:1136px;width:688px}
.in .nmk-d{animation:nmk-fromR .9s cubic-bezier(.16,.9,.2,1) .95s both}
@keyframes nmk-fromR{from{opacity:0;transform:translateX(500px)}to{opacity:1;transform:none}}
.nmk-d::after{content:"";position:absolute;left:0;top:0;width:60px;height:3px;border-radius:3px;
  background:linear-gradient(90deg,transparent,rgba(160,190,255,.7) 35%,#fff 50%,rgba(160,190,255,.7) 65%,transparent);
  filter:blur(2.5px);transform:translate(-50%,-50%);opacity:0;pointer-events:none}
.in .nmk-d::after{animation:nmk-edge 26s linear 1.8s infinite}
@keyframes nmk-edge{
  0%{left:0%;top:0%;transform:translate(-50%,-50%) rotate(0deg);opacity:0}
  2.5%{opacity:1}
  23.75%{opacity:1}
  25%{left:100%;top:0%;transform:translate(-50%,-50%) rotate(0deg);opacity:0}
  25.1%{left:100%;top:0%;transform:translate(-50%,-50%) rotate(90deg);opacity:0}
  27.5%{opacity:1}
  48.75%{opacity:1}
  50%{left:100%;top:100%;transform:translate(-50%,-50%) rotate(90deg);opacity:0}
  50.1%{left:100%;top:100%;transform:translate(-50%,-50%) rotate(0deg);opacity:0}
  52.5%{opacity:1}
  73.75%{opacity:1}
  75%{left:0%;top:100%;transform:translate(-50%,-50%) rotate(0deg);opacity:0}
  75.1%{left:0%;top:100%;transform:translate(-50%,-50%) rotate(90deg);opacity:0}
  77.5%{opacity:1}
  98.75%{opacity:1}
  100%{left:0%;top:0%;transform:translate(-50%,-50%) rotate(90deg);opacity:0}
}
.nmk-d .nm-inner{padding:38px 34px;gap:0}
.nmk-pill{align-self:flex-start;margin-bottom:18px;font-family:var(--display);font-weight:800;font-stretch:112%;font-size:15px;letter-spacing:.3em;color:#fff;background:var(--red);padding:9px 16px 8px;border-radius:6px}
.nmk-ft{flex:none;font-family:var(--display);font-weight:800;font-stretch:88%;font-size:42px;line-height:1.02;color:var(--paper);padding-bottom:18px;border-bottom:1px solid var(--line);margin-bottom:6px;
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.nmk-rows{flex:1;min-height:0;overflow:hidden;font-size:22px}
.nmk-row{display:flex;flex-direction:column;gap:4px;padding:.64em 0;border-bottom:1px solid var(--line);line-height:1.3;color:var(--paper)}
.nmk-row:last-child{border-bottom:0}
.nmk-row b{font-family:var(--display);font-weight:700;font-stretch:115%;font-size:13px;letter-spacing:.26em;text-transform:uppercase;color:var(--blue-soft)}
.nmk-logo{height:1.4em;max-width:160px;object-fit:contain;align-self:flex-start}
.nmk-plat{align-self:flex-start;font-family:var(--display);font-weight:900;font-size:.9em;letter-spacing:.08em;color:#fff;background:#0B1330;border:1px solid rgba(255,255,255,.3);padding:4px 10px;border-radius:5px}
`;

const CSS_V = `
.nmk-h{left:60px;top:190px;width:960px;height:540px}
.nmk-trl{top:-34px;height:608px}
.nmk-t{left:90px;top:640px;width:900px}
.nmk-d,.nmk.nolat .nmk-d{left:60px;top:1060px;width:960px;height:660px}
.nmk-d .nm-inner{padding:44px 50px}
.nmk.lat .nmk-d .nm-inner{padding-right:390px}
.nmk-ft{font-size:52px}
.nmk-incard{position:absolute;right:40px;top:50px;z-index:3}
.nmk-incard .nmk-v{position:relative;left:auto;top:auto;width:326px;height:489px;transform:none;opacity:1;animation:none;border-radius:14px;overflow:hidden;box-shadow:0 30px 60px -20px rgba(0,0,0,.8)}
.nmk-incard .nmk-v.tall{width:290px;height:516px;margin-top:-10px}
.nmk-incard .nm-pe{display:none}
/* Teatro/evento con video: el video casi a pantalla completa y la ficha encima */
.nmk-sv{position:absolute;left:60px;top:170px;width:960px;height:1590px}
.nmk-sv .nmk-v,.nmk-sv .nmk-v.tall{left:0;top:0;width:100%;height:100%;transform:none}
.in .nmk-sv .nmk-v{animation:nmk-kaIn 1.4s ease-out .2s both}
.nmk.video .nmk-d{left:90px;top:1180px;width:900px;height:540px}
.nmk.video .nmk-d .nm-inner{padding:44px 50px}
`;
