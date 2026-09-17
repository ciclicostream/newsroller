import { useEffect, useRef, useState } from "react";
import type { ShortsData } from "@newsroller/shared";
import fondo from "../assets/fondo2.jpg";
import { Chrome } from "./Chrome";
import { YouTubePlayer } from "./render";
import { useAutoFit } from "../lib/autofit";

// Placa Shorts: 1 o 2 videos verticales del canal (YouTube) + card de título
// (viene de la API, editable). Sin logo de programa. Entrada en fade por
// elemento; salida estándar (baja detrás del ticker, según nota del artifact).
export function Shorts({ data, durationSec }: { data: ShortsData; durationSec?: number }) {
  const [play, setPlay] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [s1Ended, setS1Ended] = useState(false);
  const titleRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setPlay(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (!durationSec) return;
    const t = setTimeout(() => setExiting(true), Math.max(1000, durationSec * 1000 - 900));
    return () => clearTimeout(t);
  }, [durationSec]);

  useAutoFit(titleRef, 64, 30, [data.title]);

  const two = data.count === 2 && !!data.video2;

  return (
    <div className={"sh" + (play ? " play" : "") + (exiting ? " exit" : "") + (two ? " two" : " one")} style={{ position: "absolute", inset: 0 }}>
      <style>{CSS}</style>
      <img className="sh-bg" src={fondo} alt="" />
      <Chrome />

      <div className="sh-video sh-s1 sh-el">
        <YouTubePlayer videoId={data.video1} onEnded={() => setS1Ended(true)} />
      </div>
      {two && (
        <div className="sh-video sh-s2 sh-el">
          {s1Ended ? (
            <YouTubePlayer videoId={data.video2!} onEnded={() => {}} />
          ) : (
            <img
              className="sh-thumb"
              src={`https://img.youtube.com/vi/${data.video2}/hqdefault.jpg`}
              alt=""
            />
          )}
        </div>
      )}

      <div className="sh-titlecard sh-el">
        {!two && <span className="sh-kicker">SHORT</span>}
        <span ref={titleRef}>{data.title}</span>
      </div>
    </div>
  );
}

const CSS = `
.sh{font-family:Inter,system-ui,sans-serif}
.sh-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.sh-el{opacity:0}
.sh.play .sh-el{transition:opacity .5s ease;opacity:1}

.sh-video{position:absolute;border-radius:22px;overflow:hidden;background:#0b1330;box-shadow:0 14px 34px rgba(0,0,0,.4)}
.sh-thumb{width:100%;height:100%;object-fit:cover;display:block}
.sh.one .sh-s1{left:470px;top:110px;width:462px;height:820px}
.sh.two .sh-s1{left:150px;top:150px;width:404px;height:718px}
.sh.two .sh-s2{left:576px;top:150px;width:404px;height:718px}

.sh-titlecard{position:absolute;width:720px;background:#fff;border-radius:30px;box-sizing:border-box;
  padding:52px 56px;color:#0b2b6b;font-weight:800;font-size:64px;line-height:1.15;max-height:520px;overflow:hidden}
.sh.one .sh-titlecard{left:972px;bottom:150px}
.sh.two .sh-titlecard{left:1040px;top:360px}
.sh-kicker{display:block;font-size:32px;font-weight:800;letter-spacing:.03em;color:#2f80ed;text-transform:uppercase;margin-bottom:14px}

.sh.exit .sh-el{transition:transform .8s cubic-bezier(.4,0,.8,.2), opacity .8s ease;transform:translateY(260px);opacity:0}
`;
