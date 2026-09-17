import { useRef } from "react";
import type { PromosData } from "@newsroller/shared";
import { Chrome } from "./Chrome";
import { YouTubePlayer } from "./render";
import { useAutoFit } from "../lib/autofit";

// Placa Promos/Avances: pill (título editable) + card (texto libre, auto-fit)
// a la izquierda, video 9:16 o 4:3 del canal de YouTube a la derecha (desde
// la mitad de la pantalla). Marco estándar completo (clock+temp+ticker+QR).
export function Promos({ data }: { data: PromosData }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  useAutoFit(bodyRef, 48, 26, [data.body]);

  const is916 = data.format === "916";

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <style>{CSS}</style>
      <Chrome />

      <div className="pr-pill">{data.title}</div>
      <div className="pr-card"><div ref={bodyRef} className="pr-body">{data.body}</div></div>

      <div className={"pr-vid" + (is916 ? " pr-916" : " pr-43")}>
        <div className="pr-m">
          <YouTubePlayer videoId={data.video_id} onEnded={() => {}} />
        </div>
      </div>
    </div>
  );
}

const CSS = `
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
`;
