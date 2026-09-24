import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { MUSIC_DEFAULT, RADIO_STATE_DEFAULT, type MusicSettings, type RadioState } from "@newsroller/shared";
import { API_BASE } from "./lib/scene";
import { IS_VERTICAL, fitScale, stageStyle } from "./lib/orientation";
import { useAudioUnlock } from "./lib/audioUnlock";
import offAir from "./assets/off-air.jpg";

// Output de Stream (radio manual): `/output/?radio=1&key=<clave>[&orientation=vertical][&audio=1]`.
// Corre en el OBS/vMix del estudio. Emite lo que el Host toca en el panel (contenido en loop, o la placa de espera),
// y recibe por WebRTC su micrófono y su cámara (pantalla completa o recuadro). No captura nada: sólo reproduce.
const params = new URLSearchParams(window.location.search);
const KEY = params.get("key") ?? "";

type Ice = { urls: string | string[]; username?: string; credential?: string }[];

export function RadioOutput() {
  const [state, setState] = useState<RadioState>(RADIO_STATE_DEFAULT);
  const [scale, setScale] = useState(1);
  const [rtc, setRtc] = useState<"idle" | "connecting" | "connected">("idle");
  const [camLive, setCamLive] = useState(false);
  const [denied, setDenied] = useState(false);
  const [music, setMusic] = useState<MusicSettings>(MUSIC_DEFAULT); // Ajustes → Música (tema activo)
  const musicRef = useRef<HTMLAudioElement>(null);
  const clipAudioRef = useRef(false); // el contenido al aire trae audio propio: la música se apaga
  const camRef = useRef<HTMLVideoElement>(null);
  const micRef = useRef<HTMLAudioElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const { locked, unlocked, unlock } = useAudioUnlock();

  useEffect(() => {
    const fit = () => setScale(fitScale());
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // Estado (socket + poll de respaldo: en OBS el websocket no siempre se sostiene) y conexión WebRTC con el Host.
  useEffect(() => {
    let closed = false;
    let ice: Ice = [{ urls: "stun:stun.l.google.com:19302" }];
    const remote = new MediaStream(); // audio y video recibidos, armados a mano (el Host los manda sin stream)
    let pc: RTCPeerConnection | null = null;
    let hostId = "";
    const socket: Socket = io(API_BASE || undefined, { transports: ["websocket", "polling"] });

    const poll = () =>
      fetch(`${API_BASE}/api/radio/state?key=${encodeURIComponent(KEY)}`).then((r) => (r.ok ? r.json() : null)).then((s) => { if (s && !closed) setState(s); }).catch(() => {});
    void poll();
    const pollT = setInterval(poll, 3000);

    const attach = () => {
      if (camRef.current) camRef.current.srcObject = remote;
      if (micRef.current) { micRef.current.srcObject = remote; void micRef.current.play().catch(() => {}); }
    };

    const closePc = () => { pc?.close(); pc = null; setRtc("idle"); setCamLive(false); };
    const open = () => {
      closePc();
      pc = new RTCPeerConnection({ iceServers: ice });
      setRtc("connecting");
      pc.ontrack = (e) => {
        remote.addTrack(e.track);
        attach();
        if (e.track.kind === "video") {
          const sync = () => setCamLive(!e.track.muted);
          e.track.onmute = sync; e.track.onunmute = sync; sync();
        }
      };
      pc.onicecandidate = (e) => { if (e.candidate && hostId) socket.emit("radio:signal", { to: hostId, data: { candidate: e.candidate.toJSON() } }); };
      pc.onconnectionstatechange = () => {
        if (!pc) return;
        if (pc.connectionState === "connected") setRtc("connected");
        else if (pc.connectionState === "failed" || pc.connectionState === "closed") setRtc("idle");
      };
    };

    socket.on("connect", () => {
      socket.emit("radio:viewer-join", KEY, (ok: boolean) => { if (!ok && !closed) setDenied(true); });
      fetch(`${API_BASE}/api/radio/ice?key=${encodeURIComponent(KEY)}`).then((r) => r.json()).then((d) => { if (d?.iceServers) ice = d.iceServers; }).catch(() => {});
    });
    socket.on("radio:state", (s: RadioState) => setState(s));
    // Música de fondo: el tema activo se elige en Ajustes → Música (mismo dato que usa el aire principal).
    const loadMusic = () => fetch(`${API_BASE}/api/settings`).then((r) => r.json()).then((s) => { if (!closed) setMusic((s?.music as MusicSettings) ?? MUSIC_DEFAULT); }).catch(() => {});
    void loadMusic();
    const musicT = setInterval(loadMusic, 30_000);
    socket.on("settings:update", (s: Record<string, unknown>) => setMusic((s?.music as MusicSettings) ?? MUSIC_DEFAULT));
    socket.on("radio:signal", async ({ from, data }: { from: string; data: any }) => {
      try {
        if (data?.sdp) {
          if (from !== hostId || data.sdp.type === "offer") { hostId = from; open(); }
          await pc!.setRemoteDescription(data.sdp);
          if (data.sdp.type === "offer") {
            const answer = await pc!.createAnswer();
            await pc!.setLocalDescription(answer);
            socket.emit("radio:signal", { to: hostId, data: { sdp: pc!.localDescription } });
          }
        } else if (data?.candidate && pc) {
          await pc.addIceCandidate(data.candidate).catch(() => {});
        }
      } catch { /* el Host reintenta al reconectarse */ }
    });

    return () => { closed = true; clearInterval(pollT); clearInterval(musicT); closePc(); socket.disconnect(); };
  }, []);

  // Contenido al aire: el mismo output de los monitores del panel (?preview=<id> o ?session=<id>), en un iframe del mismo origen.
  const frameSrc = useMemo(() => {
    if (!state.tx || !state.pad) return null;
    const p = new URLSearchParams();
    p.set(state.pad.kind === "session" ? "session" : "preview", state.pad.id);
    p.set("audio", "1");
    if (IS_VERTICAL) p.set("orientation", "vertical");
    return `${window.location.pathname}?${p.toString()}`;
  }, [state.tx, state.pad?.kind, state.pad?.id]);

  // Micrófono abierto: baja el volumen del clip (videos, audios y reproductores de YouTube del iframe).
  useEffect(() => {
    const t = setInterval(() => {
      const s = stateRef.current;
      const v = s.mic ? s.duck / 100 : 1;
      try {
        const doc = frameRef.current?.contentDocument;
        if (!doc) return;
        let audible = false;
        doc.querySelectorAll<HTMLMediaElement>("video, audio").forEach((m) => {
          if (Math.abs(m.volume - v) > 0.01) m.volume = v;
          if (!m.paused && !m.muted && !m.hasAttribute("data-nr-skip")) audible = true;
        });
        if (doc.querySelector("iframe")) audible = true; // reproductor de YouTube (shorts, promos, video)
        clipAudioRef.current = audible;
        doc.querySelectorAll<HTMLIFrameElement>("iframe").forEach((f) => f.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "setVolume", args: [Math.round(v * 100)] }), "*"));
      } catch { /* iframe todavía sin cargar */ }
    }, 400);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { if (unlocked) void micRef.current?.play().catch(() => {}); }, [unlocked]);

  // Música de fondo: suena con la transmisión abierta y el botón encendido; se apaga (fade) si el contenido trae audio
  // propio y baja con el micrófono abierto, igual que el clip.
  const track = music.tracks.find((t) => t.id === music.activeId) ?? null;
  const wantMusic = state.tx && state.music && !!track;
  useEffect(() => {
    const el = musicRef.current;
    if (!el || !track) return;
    if (wantMusic && el.paused) void el.play().catch(() => {});
    if (!wantMusic && !el.paused && el.volume < 0.02) el.pause();
    let raf = 0;
    const step = () => {
      const a = musicRef.current;
      if (!a) return;
      const s = stateRef.current;
      const target = wantMusic && !clipAudioRef.current ? (s.mic ? s.duck / 100 : 1) : 0;
      const next = a.volume + (target - a.volume) * 0.08;
      a.volume = Math.max(0, Math.min(1, Math.abs(next - target) < 0.01 ? target : next));
      if (!wantMusic && a.volume === 0 && !a.paused) a.pause();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [wantMusic, track?.url, unlocked]);

  const showCam = state.tx && state.cam !== "off" && camLive;
  return (
    <div className="viewport">
      <div className="stage" style={stageStyle(scale)}>
        {frameSrc
          ? <iframe ref={frameRef} key={frameSrc} src={frameSrc} title="stream" allow="autoplay; encrypted-media" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
          : <img src={offAir} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}

        {/* Cámara del Host: siempre montada (así el video sigue fluyendo); sólo cambia dónde se muestra. */}
        <video ref={camRef} autoPlay muted playsInline
          style={showCam
            ? state.cam === "full"
              ? { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", background: "#000" }
              : { position: "absolute", right: 48, bottom: 48, width: IS_VERTICAL ? "44%" : "26%", aspectRatio: "16 / 9", objectFit: "cover", borderRadius: 18, border: "6px solid #fff", boxShadow: "0 12px 40px rgba(0,0,0,.5)", background: "#000" }
            : { display: "none" }} />
        {/* El micrófono del Host sólo suena con la transmisión abierta. */}
        <audio ref={micRef} autoPlay muted={!state.tx} data-nr-skip />
        {track && <audio key={track.url} ref={musicRef} src={track.url} loop data-nr-skip />}

        {locked && (
          <button onClick={unlock} style={{ position: "absolute", left: 40, bottom: 40, zIndex: 50, font: "700 34px Inter,system-ui,sans-serif", padding: "18px 30px", borderRadius: 14, border: 0, background: "#EE220C", color: "#fff" }}>
            Activar sonido
          </button>
        )}
        {denied && (
          <div style={{ position: "absolute", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(5,10,30,.92)", color: "#fff", font: "700 44px Inter,system-ui,sans-serif", textAlign: "center", padding: 80 }}>
            Clave del link inválida. Copiá el enlace de Stream desde el panel.
          </div>
        )}
        <span data-nr-skip style={{ position: "absolute", left: 0, top: 0, width: 1, height: 1, opacity: 0 }} data-rtc={rtc} />
      </div>
    </div>
  );
}
