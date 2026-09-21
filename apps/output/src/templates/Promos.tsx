import { useEffect, useRef, useState } from "react";
import type { PromosData } from "@newsroller/shared";
import fondo from "../assets/fondo2.jpg";
import { Chrome } from "./Chrome";
import { YouTubePlayer } from "./render";
import { useAutoFit } from "../lib/autofit";
import { IS_VERTICAL } from "../lib/orientation";

// Placa Promos/Avances: pill (título editable) + card (texto libre, auto-fit)
// a la izquierda, video 9:16 o 4:3 del canal de YouTube a la derecha (desde
// la mitad de la pantalla). Marco estándar completo (clock+temp+ticker+QR).
// Entrada en fade; salida CRUZADA: las cards salen a la derecha y el video a la izquierda.
export function Promos({ data, durationSec }: { data: PromosData; durationSec?: number }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  useAutoFit(bodyRef, 48, 26, [data.body]);

  const [play, setPlay] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setPlay(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (!durationSec) return;
    const t = setTimeout(() => setExiting(true), Math.max(1000, durationSec * 1000 - 700));
    return () => clearTimeout(t);
  }, [durationSec]);

  const is916 = data.format === "916";

  return (
    <div className={"pr" + (play ? " play" : "") + (exiting ? " exit" : "") + (IS_VERTICAL ? " v" : "")} style={{ position: "absolute", inset: 0 }}>
      <style>{CSS + (IS_VERTICAL ? CSS_V : "")}</style>
      <img className="pr-bg" src={fondo} alt="" />
      <Chrome />

      <div className="pr-pill pr-el">{data.title}</div>
      <div className="pr-card pr-el"><div ref={bodyRef} className="pr-body">{data.body}</div></div>

      <div className={"pr-vid pr-el" + (is916 ? " pr-916" : " pr-43")}>
        <div className="pr-m">
          <YouTubePlayer videoId={data.video_id} onEnded={() => {}} />
        </div>
      </div>
    </div>
  );
}

// Vertical: el video casi a pantalla completa (9:16) o el 4:3 arriba, y el pill + la card de texto encima, apenas sobre el ticker.
const CSS_V = `
.pr.v .pr-916{left:65px;top:120px;width:950px;height:1690px;border-radius:0;padding:0}
.pr.v .pr-916 .pr-m{border-radius:0}
.pr.v .pr-43{left:60px;top:200px;width:960px;height:720px}
.pr.v .pr-card{left:60px;right:auto;top:auto;bottom:142px;width:960px;height:250px;min-height:0;justify-content:center;z-index:5}
.pr.v .pr-body{text-align:center;max-height:190px}
.pr.v .pr-pill{left:60px;right:auto;top:auto;bottom:392px;z-index:5}
`;

const CSS = `
.pr{font-family:Inter,system-ui,sans-serif}
.pr-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.pr-el{opacity:0;transition:opacity .55s ease}
.pr.play .pr-el{opacity:1}

.pr-pill{position:absolute;right:1000px;top:420px;background:#3b82f6;color:#fff;font-weight:800;font-size:42px;
  letter-spacing:.02em;padding:16px 38px;border-radius:14px;box-shadow:0 8px 20px rgba(0,0,0,.2)}
.pr-card{position:absolute;right:1000px;top:496px;width:700px;min-height:300px;background:#fff;border-radius:24px;
  box-sizing:border-box;padding:44px 48px;display:flex;align-items:center;justify-content:flex-end;
  box-shadow:inset 0 0 30px rgba(11,43,107,.06)}
.pr-body{color:#0b2b6b;font-weight:800;text-align:right;line-height:1.15;max-height:212px;overflow:hidden}
.pr-vid{position:absolute;background:#fff;border-radius:22px;padding:12px;box-sizing:border-box;box-shadow:0 16px 40px rgba(0,0,0,.4)}
.pr-m{width:100%;height:100%;border-radius:12px;overflow:hidden;background:#0b1330}
.pr-916{left:960px;top:110px;width:461px;height:840px}
.pr-43{left:960px;top:260px;width:720px;height:540px}

/* salida cruzada: pill+card salen a la derecha, el video sale a la izquierda */
.pr.exit .pr-pill,.pr.exit .pr-card{transition:transform .6s cubic-bezier(.4,0,.7,1), opacity .6s ease;transform:translateX(1920px);opacity:0}
.pr.exit .pr-vid{transition:transform .6s cubic-bezier(.4,0,.7,1), opacity .6s ease;transform:translateX(-1920px);opacity:0}
`;
