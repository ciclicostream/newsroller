import { useRef } from "react";
import type { PlacasData } from "@newsroller/shared";
import { IS_VERTICAL } from "../../lib/orientation";
import { P } from "../../lib/params";
import { useForcePlay } from "../../lib/autoplay";
import { Card, Grain, Kick, Lights, NM_CSS, Words, fechaLarga, richHTML, useFit, useLife } from "./base";
import { ModernChrome } from "./Chrome";

const WANT_AUDIO = P.has("audio");

// Placas (noticia), colección Modernas: dos paneles 3D. Con foto o video: el recurso a la izquierda (angosto) y
// volanta + título + cuerpo a la derecha. Sin recurso: volanta + título grande a la izquierda y el cuerpo a la derecha.
// La volanta va separada de la fecha, que es la de publicación del contenido. Entra con la columna de luz y sale
// con la luz de vuelta mientras los paneles se van al fondo.
export function Placas({ data, durationSec, createdAt }: { data: PlacasData; durationSec?: number; createdAt?: string }) {
  const media = !!data.media_url;
  const { cls } = useLife(durationSec, 1.4);
  const bodyRef = useRef<HTMLDivElement>(null);
  const videoRef = useForcePlay<HTMLVideoElement>();
  useFit(bodyRef, IS_VERTICAL ? 34 : media ? 29 : 30, 20, [data.body, media]);

  const date = fechaLarga(createdAt);
  const kick = data.label?.trim() ? <Kick text={data.label.trim()} date={date} /> : date ? <Kick text={date} /> : null;
  const body = data.body?.trim() ? <div className="nm-body" ref={bodyRef} dangerouslySetInnerHTML={{ __html: richHTML(data.body) }} /> : null;
  const recurso = media && (
    <div className="nmp-media">
      {data.media_kind === "video"
        ? <video key={data.media_url} ref={videoRef} src={data.media_url!} autoPlay muted={!WANT_AUDIO} loop playsInline />
        : <img src={data.media_url!} alt="" />}
      <div className="shade" />
    </div>
  );

  // Posiciones: [izquierda, derecha] en 16:9; [arriba, abajo] en 9:16.
  const L = IS_VERTICAL ? (media ? { x: 60, y: 190, w: 960, h: 560, rx: 4 } : { x: 60, y: 190, w: 960, h: 600, rx: 4 }) : { x: 96, y: 150, w: 680, h: 740, ry: 7 };
  const R = IS_VERTICAL ? (media ? { x: 60, y: 790, w: 960, h: 930 } : { x: 60, y: 830, w: 960, h: 890 }) : { x: 830, y: 150, w: 994, h: 740, ry: -4 };

  return (
    <div className={"nm nmp" + cls + (IS_VERTICAL ? " v" : "")}>
      <style>{NM_CSS + CSS}</style>
      <div className="nm-bg" /><Grain />
      <div className="nm-sc">
        <Card {...L} d={0.12} od={0.3}>
          {media ? recurso : <div className="nmp-lead">{kick}<Words text={data.title} className="nm-ttl nmp-big" /></div>}
        </Card>
        <Card {...R} d={0.38} od={0.05}>
          <div className="nm-col">{media && kick}{media && <Words text={data.title} />}{body}</div>
        </Card>
      </div>
      <Lights />
      <ModernChrome />
      {data.audio_url && <audio src={data.audio_url} autoPlay muted={!WANT_AUDIO} />}
    </div>
  );
}

const CSS = `
.nmp-media{position:absolute;inset:0}
.nmp-media img,.nmp-media video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;transform:scale(1.12)}
.in .nmp-media img,.in .nmp-media video{animation:nm-kb 12s cubic-bezier(.2,.6,.3,1) .3s both}
.nmp-media .shade{position:absolute;inset:0;background:linear-gradient(180deg,transparent 62%,rgba(5,11,31,.6))}
.nmp-lead{position:absolute;inset:0;padding:56px;display:flex;flex-direction:column;justify-content:flex-end;gap:30px;background:radial-gradient(700px 500px at 20% 0%,rgba(47,107,255,.35),transparent 65%)}
.nmp-big{font-size:78px;line-height:.98}
.v .nmp-big{font-size:92px}
`;
