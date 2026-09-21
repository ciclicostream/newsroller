import { useEffect, useRef, useState } from "react";
import type { CarteleraData, Plataforma } from "@newsroller/shared";
import { PLATAFORMAS_DEFAULT } from "@newsroller/shared";
import fondo from "../assets/fondo-cartelera.jpg";
import { Chrome } from "./Chrome";
import { YouTubePlayer } from "./render";
import { useAutoFit } from "../lib/autofit";
import { API_BASE } from "../lib/scene";

// Placa Cartelera · CINE (película o serie). Card izquierda: trailer de YouTube (se repite) + título (a
// lo sumo hasta la mitad de la pantalla, casi siempre en 2 líneas) + sinopsis, y un newsticker chico
// (RECOMENDADA / ESTRENO / CLÁSICO) encima del título. Card derecha (siempre alineada con el borde inferior de la
// izquierda): póster O short de Cíclico arriba —alineado con el borde superior del trailer— y la ficha:
// nombre, director, actores, duración, género (+ plataforma, temporadas y capítulos si es serie).
// Con short: suena el columnista (?audio=1) mientras el trailer se repite mudo; al terminar el short
// queda su tapa y el trailer activa el sonido. Salida estándar: todo baja detrás del ticker.
export function CarteleraCine({ data, durationSec }: { data: CarteleraData; durationSec?: number }) {
  const hasShort = !!data.short_id;
  const hasSide = hasShort || !!data.poster_url;
  const [play, setPlay] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [shortDone, setShortDone] = useState(false);
  const [plataformas, setPlataformas] = useState<Plataforma[]>(PLATAFORMAS_DEFAULT);
  const titleRef = useRef<HTMLDivElement>(null);
  const sinRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setPlay(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (!durationSec) return;
    const t = setTimeout(() => setExiting(true), Math.max(1000, durationSec * 1000 - 900));
    return () => clearTimeout(t);
  }, [durationSec]);
  // Plataformas (con logo) administradas en Ajustes.
  useEffect(() => {
    let on = true;
    fetch(`${API_BASE}/api/settings`).then((r) => r.json()).then((s) => { if (on && Array.isArray(s?.plataformas)) setPlataformas(s.plataformas); }).catch(() => {});
    return () => { on = false; };
  }, []);

  useAutoFit(titleRef, 64, 34, [data.title]);
  useAutoFit(sinRef, 28, 18, [data.synopsis]);
  useAutoFit(dataRef, 25, 15, [data.author, data.cast, data.genre, data.duration_text, data.is_series, data.platform, data.seasons, data.episodes, data.title]);

  const plat = data.is_series ? plataformas.find((p) => p.id === data.platform) : undefined;
  const platName = plat?.name ?? data.platform_name ?? "";
  const serieInfo = [
    data.seasons ? `${data.seasons} ${data.seasons === 1 ? "temporada" : "temporadas"}` : "",
    data.episodes ? `${data.episodes} ${data.episodes === 1 ? "capítulo" : "capítulos"}` : "",
  ].filter(Boolean).join(" · ");
  const tickerWord = data.ticker === "estreno" ? "ESTRENO" : data.ticker === "recomendada" ? "RECOMENDADA" : data.ticker === "clasico" ? "CLÁSICO" : "";

  return (
    <div className={"cc" + (play ? " play" : "") + (exiting ? " exit" : "") + (hasSide ? " has-side" : "")} style={{ position: "absolute", inset: 0 }}>
      <style>{CSS}</style>
      <img className="cc-bg" src={fondo} alt="" />
      <Chrome hideClock={hasSide} hideTemp={hasSide} />

      <div className="cc-left cc-el">
        <div className="cc-trailer">
          {data.trailer_id && (
            <div className="cc-trailer-in">
              {/* Se repite; con short espera (mudo) a que termine el columnista para activar el sonido. */}
              <YouTubePlayer videoId={data.trailer_id} onEnded={() => {}} loop holdAudio={hasShort} unmuted={shortDone} />
            </div>
          )}
        </div>
        {/* Título + sinopsis en una columna: la sinopsis va pegada al título, sea de 1 o 2 líneas. */}
        <div className="cc-text">
          <div className="cc-obra" ref={titleRef}><span>{data.title}</span></div>
          <div className="cc-sinopsis" ref={sinRef}>{data.synopsis}</div>
        </div>
        {tickerWord && (
          <div className={"cc-ticker " + data.ticker}>
            <div className="cc-track">{Array.from({ length: 10 }).map((_, i) => <span key={i}>{tickerWord}</span>)}</div>
          </div>
        )}
      </div>

      {hasSide && (
        <div className="cc-media cc-el">
          {hasShort ? (
            <>
              <div className="cc-media-in"><YouTubePlayer videoId={data.short_id!} onEnded={() => setShortDone(true)} /></div>
              {shortDone && data.short_thumb && <img className="cc-tapa" src={data.short_thumb} alt="" />}
            </>
          ) : (
            <img src={data.poster_url} alt="" />
          )}
        </div>
      )}

      <div className="cc-side cc-el">
        <div className="cc-pill">EN CARTELERA</div>
        <div className="cc-data" ref={dataRef}>
          <div className="cc-ftitle">{data.title}</div>
          {data.author && <div className="cc-row"><b>Director:</b> {data.author}</div>}
          {data.cast && <div className="cc-row"><b>Actores:</b> {data.cast}</div>}
          {data.duration_text && <div className="cc-row"><b>Duración:</b> {data.duration_text}</div>}
          {data.genre && <div className="cc-row"><b>Género:</b> {data.genre}</div>}
          {data.is_series && (
            <div className="cc-row cc-serie">
              <b>Plataforma:</b>
              {plat?.logo ? <img className="cc-logo" src={plat.logo} alt={platName} /> : platName ? <span className="cc-platname">{platName}</span> : null}
              {serieInfo && <span className="cc-eps">{serieInfo}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const CSS = `
.cc{font-family:Inter,system-ui,sans-serif}
.cc-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.cc-el{opacity:0}

/* Card izquierda: trailer + título + sinopsis */
.cc-left{position:absolute;left:100px;top:88px;width:1160px;height:820px;z-index:13;background:#fff;border-radius:40px;
  box-shadow:inset 0 0 70px 4px rgba(11,43,107,.20), inset 0 0 0 2px rgba(11,43,107,.10), 0 16px 34px rgba(0,0,0,.25);
  transform:translateX(-70px)}
.cc-trailer{position:absolute;left:48px;top:40px;width:1064px;height:520px;border-radius:16px;overflow:hidden;background:#000}
.cc-trailer-in{position:absolute;left:0;top:-39px;width:1064px;height:598px}
.cc-trailer-in iframe{width:100%;height:100%;border:0;display:block}
/* Título: como máximo hasta la mitad de la pantalla (x=960) → casi siempre 2 líneas. */
.cc-text{position:absolute;left:48px;right:48px;top:452px;bottom:26px;z-index:2;display:flex;flex-direction:column;gap:22px;min-height:0}
.cc-obra{flex:0 0 auto;width:812px;max-height:200px;overflow:hidden;font-size:64px}
.cc-obra span{background:#4ea0f5;color:#fff;box-decoration-break:clone;-webkit-box-decoration-break:clone;
  padding:8px 18px;font-weight:800;line-height:1.5;text-transform:uppercase;letter-spacing:.01em}
.cc-sinopsis{flex:1 1 auto;min-height:0;overflow:hidden;margin-left:4px;color:#0b2b6b;font-weight:600;font-size:28px;line-height:1.28}

/* Newsticker chico: 30% del ancho de la card, justo encima del título, alineado al borde izquierdo del trailer; sólo se desvanece por la derecha */
.cc-ticker{position:absolute;left:48px;width:30%;top:406px;height:42px;z-index:3;overflow:hidden;display:flex;align-items:center;border-radius:8px;
  -webkit-mask-image:linear-gradient(90deg,#000 78%,transparent);mask-image:linear-gradient(90deg,#000 78%,transparent)}
.cc-ticker.estreno{background:#EE220C}
.cc-ticker.recomendada{background:#2f6bff}
.cc-ticker.clasico{background:#a9741c}
.cc-track{display:flex;white-space:nowrap;animation:cc-scroll 14s linear infinite}
.cc-track span{color:#fff;font-weight:800;font-size:24px;letter-spacing:.14em;padding:0 22px}
@keyframes cc-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}

/* Card derecha: siempre alineada con el borde inferior de la izquierda (y=908) */
.cc-side{position:absolute;left:1300px;width:470px;bottom:172px;z-index:14;background:#fff;border-radius:30px;box-sizing:border-box;
  padding:26px 32px 30px;display:flex;flex-direction:column;gap:14px;color:#0b2b6b;
  box-shadow:inset 0 0 60px 4px rgba(11,43,107,.20), inset 0 0 0 2px rgba(11,43,107,.10), 0 16px 34px rgba(0,0,0,.25);
  transform:translateX(70px)}
.cc.has-side .cc-side{top:88px;padding-top:472px}
.cc-pill{align-self:center;background:#3b82f6;color:#fff;font-weight:800;font-size:26px;letter-spacing:.02em;padding:9px 22px;border-radius:14px;flex:none}
.cc-data{flex:1 1 auto;min-height:0;overflow:hidden;font-size:25px;display:flex;flex-direction:column;gap:5px}
.cc.has-side .cc-data{max-height:264px}
.cc:not(.has-side) .cc-data{max-height:420px}
.cc-ftitle{font-weight:800;font-size:1.2em;line-height:1.05;text-transform:uppercase;margin-bottom:4px}
.cc-row{font-weight:500;line-height:1.2}
.cc-row b{font-weight:800}
.cc-serie{display:flex;align-items:center;flex-wrap:wrap;gap:4px 12px}
.cc-logo{height:1.3em;max-width:130px;object-fit:contain}
.cc-platname{font-weight:800;color:#2f6bff}
.cc-eps{font-weight:600;width:100%}

/* Póster o short: alineado con el borde superior del trailer (y=128) */
.cc-media{position:absolute;left:1395px;top:128px;width:281px;height:420px;z-index:15;border-radius:20px;overflow:hidden;background:#c9ccd2;
  box-shadow:0 12px 30px rgba(0,0,0,.35);transform:translateX(70px)}
.cc-media>img{width:100%;height:100%;object-fit:cover;display:block}
.cc-media-in{position:absolute;left:0;top:-40px;width:281px;height:500px}
.cc-media-in iframe{width:100%;height:100%;border:0;display:block}
.cc-tapa{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:3}

.cc.play .cc-el{transition:opacity .5s ease, transform .5s cubic-bezier(.2,.8,.2,1);opacity:1;transform:translateX(0)}
.cc.exit .cc-el{transition:transform .8s cubic-bezier(.4,0,.8,.2), opacity .8s ease;transform:translateY(260px)!important;opacity:0}
`;
