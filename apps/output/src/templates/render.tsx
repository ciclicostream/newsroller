import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Hls from "hls.js";
import { dataView, type Camera, type Logo, type TemplateElement } from "../lib/scene";

// Sonido: por defecto MUTEADO (así el autoplay nunca se bloquea en el navegador).
// Para OBS/vMix, abrir el output con ?audio=1 → intenta activar el audio.
const WANT_AUDIO = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("audio");

interface TemplateData {
  id: string;
  name: string;
  background: { type: "image" | "gradient" | "color"; value: string };
  elements: TemplateElement[];
}

function bgCss(bg: TemplateData["background"]): string {
  if (bg.type === "image") return `#000 url(${bg.value}) center/cover no-repeat`;
  if (bg.type === "gradient") return bg.value;
  return bg.value || "#ffffff";
}

export function templateHasVideo(t: TemplateData): boolean {
  return t.elements.some((e) => e.type === "video");
}

export function TemplateView({ template, data, logos, cameras, onEnded }: { template: TemplateData; data: Record<string, any>; logos: Logo[]; cameras: Camera[]; onEnded: () => void }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: bgCss(template.background) }}>
      {[...template.elements].sort((a, b) => a.z - b.z).map((el, i) => (
        <motion.div
          key={el.id}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + i * 0.08, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
          style={{ position: "absolute", left: el.x, top: el.y, width: el.w, height: el.h, zIndex: el.z }}
        >
          <ElementView el={el} data={data} logos={logos} cameras={cameras} onEnded={onEnded} />
        </motion.div>
      ))}
    </div>
  );
}

function ElementView({ el, data, logos, cameras, onEnded }: { el: TemplateElement; data: Record<string, any>; logos: Logo[]; cameras: Camera[]; onEnded: () => void }) {
  const p = el.props;

  if (el.type === "text") {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", textAlign: p.align ?? "left", color: p.color ?? "#10151f", textTransform: p.uppercase ? "uppercase" : "none" }}>
        {p.kicker && <div style={{ fontSize: 30, letterSpacing: ".14em", color: "#e8542f", marginBottom: 14, textTransform: "uppercase" }}>{p.kicker}</div>}
        <div style={{ fontSize: p.size ?? 64, fontWeight: p.weight ?? 600, lineHeight: 1.05 }}>{p.text}</div>
      </div>
    );
  }
  if (el.type === "image") {
    return p.src ? <img src={p.src} style={{ width: "100%", height: "100%", objectFit: p.fit ?? "cover", borderRadius: p.radius ?? 0 }} /> : null;
  }
  if (el.type === "video") {
    if (p.sourceKind === "asset") {
      return <VideoAsset src={p.src} fit={p.fit ?? "contain"} radius={p.radius ?? 0} onEnded={onEnded} />;
    }
    return <YouTubePlayer videoId={p.src} onEnded={onEnded} />;
  }
  if (el.type === "weather") {
    return <WeatherEl lat={p.lat} lon={p.lon} city={p.city} data={data} />;
  }
  if (el.type === "data") {
    const dv = dataView(p.source, data);
    if (!dv) return null;
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontSize: 26, letterSpacing: ".14em", color: "#e8542f", textTransform: "uppercase", marginBottom: 12 }}>{dv.title}</div>
        <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
          {dv.rows.map((r) => (
            <div key={r.label}>
              <div style={{ fontSize: 22, color: "#6b7688" }}>{r.label}</div>
              <div style={{ fontSize: 64, fontWeight: 600 }}>{r.value}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (el.type === "logo") {
    const url = logos[0]?.url;
    return url ? (
      <img src={url} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
    ) : (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, letterSpacing: ".06em", fontSize: 40 }}>CÍCLICO</div>
    );
  }
  if (el.type === "shape") {
    return <div style={{ width: "100%", height: "100%", background: p.color ?? "#e8542f", borderRadius: p.shape === "line" ? 0 : p.radius ?? 0 }} />;
  }
  if (el.type === "camera") {
    const cam = p.mode === "fixed" ? cameras.find((c) => c.id === p.cameraId) : cameras.find((c) => c.active);
    if (!cam) return <div style={{ width: "100%", height: "100%", background: "#0b0e15", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7688", fontSize: 22 }}>Sin cámara</div>;
    return <CameraView cam={cam} />;
  }
  return null;
}

function CameraView({ cam }: { cam: Camera }) {
  if (cam.type === "youtube") return <YouTubePlayer videoId={cam.url} onEnded={() => {}} />;
  if (cam.type === "hls") return <HlsVideo url={cam.url} />;
  if (cam.type === "iframe") return <iframe src={cam.url} style={{ width: "100%", height: "100%", border: 0 }} allow="autoplay; encrypted-media" title={cam.name} />;
  return <RefreshingImage url={cam.url} />;
}

function HlsVideo({ url }: { url: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (v.canPlayType("application/vnd.apple.mpegurl")) {
      v.src = url;
    } else if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(v);
      return () => hls.destroy();
    }
  }, [url]);
  return <video ref={ref} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
}

// Imagen de cámara que se actualiza sola (cámaras de tránsito / Windy).
function RefreshingImage({ url }: { url: string }) {
  const [src, setSrc] = useState(url);
  useEffect(() => {
    const iv = setInterval(() => setSrc(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`), 5000);
    return () => clearInterval(iv);
  }, [url]);
  return <img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
}

function VideoAsset({ src, fit, radius, onEnded }: { src: string; fit: string; radius: number; onEnded: () => void }) {
  return (
    <video
      src={src}
      autoPlay
      muted={!WANT_AUDIO}
      playsInline
      onEnded={onEnded}
      style={{ width: "100%", height: "100%", objectFit: fit as any, borderRadius: radius }}
    />
  );
}

// Reproductor de YouTube con IFrame API: audio activado + aviso al terminar.
function YouTubePlayer({ videoId, onEnded }: { videoId: string; onEnded: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;

  useEffect(() => {
    let player: any;
    let cancelled = false;
    function create() {
      if (cancelled || !ref.current) return;
      player = new window.YT.Player(ref.current, {
        videoId,
        width: "100%",
        height: "100%",
        // autoplay muteado = arranca SIEMPRE (política del navegador). En vMix el unMute toma sonido.
        playerVars: { autoplay: 1, mute: 1, controls: 0, rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3, fs: 0, disablekb: 1 },
        events: {
          onReady: (e: any) => {
            try { e.target.playVideo(); } catch { /* noop */ }
            // Solo intentar sonido si se pidió (OBS/vMix con ?audio=1). En el navegador normal
            // NO se toca: así el autoplay muteado nunca se bloquea.
            if (WANT_AUDIO) setTimeout(() => { try { e.target.unMute(); e.target.setVolume(100); } catch { /* noop */ } }, 500);
          },
          onStateChange: (e: any) => {
            const S = window.YT?.PlayerState;
            if (e.data === S?.ENDED) { endedRef.current(); return; }
            // Si el navegador lo pausó (por el intento de sonido sin gesto), seguí reproduciendo muteado.
            if (e.data === S?.PAUSED) {
              try { e.target.mute(); e.target.playVideo(); } catch { /* noop */ }
            }
          },
        },
      });
    }
    if (window.YT && window.YT.Player) create();
    else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); create(); };
      if (!document.getElementById("yt-api")) {
        const s = document.createElement("script");
        s.id = "yt-api";
        s.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(s);
      }
    }
    return () => { cancelled = true; try { player?.destroy(); } catch { /* noop */ } };
  }, [videoId]);

  return <div style={{ width: "100%", height: "100%", overflow: "hidden" }}><div ref={ref} style={{ width: "100%", height: "100%" }} /></div>;
}

function WeatherEl({ lat, lon, city, data }: { lat?: number; lon?: number; city: string; data: Record<string, any> }) {
  const [temp, setTemp] = useState<number | null>(null);
  useEffect(() => {
    if (lat == null || lon == null) {
      // Sin coordenadas: usa la fuente clima del server (Buenos Aires).
      const t = data.clima?.tempC;
      if (typeof t === "number") setTemp(t);
      return;
    }
    let on = true;
    const load = () =>
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`)
        .then((r) => r.json())
        .then((d) => { if (on && d.current?.temperature_2m != null) setTemp(Math.round(d.current.temperature_2m)); })
        .catch(() => {});
    load();
    const iv = setInterval(load, 10 * 60_000);
    return () => { on = false; clearInterval(iv); };
  }, [lat, lon, data]);

  return (
    <div style={{ width: "100%", height: "100%", background: "linear-gradient(180deg,#7ec8f0,#efe6c8)", borderRadius: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#0b3a63" }}>
      <div style={{ fontSize: 120, fontWeight: 700, lineHeight: 1 }}>{temp != null ? `${temp}°` : "--"}</div>
      <div style={{ fontSize: 40, fontWeight: 600, marginTop: 10 }}>{city}</div>
    </div>
  );
}
