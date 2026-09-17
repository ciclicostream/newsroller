import type { VideoFullData } from "@newsroller/shared";
import { YouTubePlayer } from "./render";

const WANT_AUDIO = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("audio");

// Placa Video Full: video, imagen o video de YouTube a pantalla completa, SIN
// overlay (idéntico a Publicidad Full). A diferencia de Publicidad, NO genera
// reporte. Entrada y salida por CORTE (sin efectos) — no hay animación.
export function VideoFull({ data }: { data: VideoFullData }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "#000" }}>
      {data.media_kind === "youtube" ? (
        <YouTubePlayer videoId={data.media_url} onEnded={() => {}} />
      ) : data.media_kind === "video" ? (
        <video
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
