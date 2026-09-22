import type { VideoFullData } from "@newsroller/shared";
import { YouTubePlayer } from "./render";
import { IS_VERTICAL } from "../lib/orientation";
import { useForcePlay } from "../lib/autoplay";

const WANT_AUDIO = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("audio");

// Placa Video Full: video, imagen o video de YouTube a pantalla completa, SIN
// overlay (idéntico a Publicidad Full). A diferencia de Publicidad, NO genera
// reporte. Entrada y salida por CORTE (sin efectos) — no hay animación.
export function VideoFull({ data }: { data: VideoFullData }) {
  const videoRef = useForcePlay<HTMLVideoElement>();
  // Output vertical: sólo la versión 9:16 (archivo o short de YouTube), a pantalla completa y sin overlay.
  if (IS_VERTICAL) {
    return (
      <div style={{ position: "absolute", inset: 0, background: "#000" }}>
        {data.vertical_yt ? (
          <YouTubePlayer videoId={data.vertical_yt} onEnded={() => {}} />
        ) : data.vertical_url && data.vertical_kind === "video" ? (
          <video key={data.vertical_url} ref={videoRef} src={data.vertical_url} autoPlay muted={!WANT_AUDIO} playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : data.vertical_url ? (
          <img src={data.vertical_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : null}
      </div>
    );
  }
  return (
    <div style={{ position: "absolute", inset: 0, background: "#000" }}>
      {data.media_kind === "youtube" ? (
        <YouTubePlayer videoId={data.media_url} onEnded={() => {}} />
      ) : data.media_kind === "video" ? (
        <video
          key={data.media_url}
          ref={videoRef}
          src={data.media_url}
          autoPlay
          muted={!WANT_AUDIO}
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <img src={data.media_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      )}
    </div>
  );
}
