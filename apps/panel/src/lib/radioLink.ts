import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, RadioState, ServerToClientEvents } from "@newsroller/shared";
import { api } from "./api";
import { supabase } from "./supabase";
import { OUTPUT_BASE } from "./parrilla";

// Stream (radio manual): enlace del panel del Host con el output `?radio=1` del estudio.
// El micrófono y la cámara viajan por WebRTC directo de esta compu al output (el server sólo intercambia los
// mensajes de conexión); el estado (qué contenido está al aire, cámara, micrófono) va por una ruta del server.
export interface RadioConfig { key: string; iceServers: RTCIceServer[]; turn: boolean }
export const radioApi = {
  config: () => api.get<RadioConfig>("/api/radio/config"),
  setState: (s: Omit<RadioState, "at">) => api.put<RadioState>("/api/radio/state", s),
};

// Link del output de Stream para OBS/vMix.
export function radioUrl(key: string, vertical: boolean): string {
  const origin = OUTPUT_BASE || (typeof window !== "undefined" ? window.location.origin : "");
  const p = new URLSearchParams({ radio: "1", key, audio: "1", ...(vertical ? { orientation: "vertical" } : {}) });
  return `${origin}/output/?${p.toString()}`;
}

export interface RadioLink {
  setAudio: (t: MediaStreamTrack | null) => void;
  setVideo: (t: MediaStreamTrack | null) => void;
  close: () => void;
}

interface Peer { pc: RTCPeerConnection; audio: RTCRtpSender; video: RTCRtpSender }

export function createRadioLink(cfg: RadioConfig, onViewers: (n: number) => void): RadioLink {
  const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(import.meta.env.VITE_API_URL || undefined, { transports: ["websocket", "polling"] });
  const peers = new Map<string, Peer>();
  let audio: MediaStreamTrack | null = null;
  let video: MediaStreamTrack | null = null;
  let closed = false;

  const report = () => onViewers(peers.size);
  const drop = (id: string) => { peers.get(id)?.pc.close(); peers.delete(id); report(); };

  async function connectViewer(id: string) {
    drop(id);
    const pc = new RTCPeerConnection({ iceServers: cfg.iceServers });
    // Los dos transceivers existen siempre; prender/apagar mic o cámara es cambiar la pista (replaceTrack), sin renegociar.
    const a = pc.addTransceiver("audio", { direction: "sendonly" });
    const v = pc.addTransceiver("video", { direction: "sendonly" });
    const peer: Peer = { pc, audio: a.sender, video: v.sender };
    peers.set(id, peer);
    report();
    void a.sender.replaceTrack(audio);
    void v.sender.replaceTrack(video);
    // Sin tope el video puede saturar la subida de una casa: 2.5 Mbps alcanzan para 720p.
    const params = v.sender.getParameters();
    if (params.encodings?.length) { params.encodings[0]!.maxBitrate = 2_500_000; void v.sender.setParameters(params).catch(() => {}); }

    pc.onicecandidate = (e) => { if (e.candidate) socket.emit("radio:signal", { to: id, data: { candidate: e.candidate.toJSON() } }); };
    pc.onconnectionstatechange = () => { if (pc.connectionState === "failed" || pc.connectionState === "closed") drop(id); };
    await pc.setLocalDescription(await pc.createOffer());
    socket.emit("radio:signal", { to: id, data: { sdp: pc.localDescription } });
  }

  socket.on("radio:viewer", (id) => { void connectViewer(id); });
  socket.on("radio:viewer-left", drop);
  socket.on("radio:signal", async ({ from, data }) => {
    const peer = peers.get(from);
    const d = data as { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
    if (!peer) return;
    try {
      if (d.sdp) await peer.pc.setRemoteDescription(d.sdp);
      else if (d.candidate) await peer.pc.addIceCandidate(d.candidate);
    } catch { /* negociación fallida: el output se reconecta */ }
  });
  // Al (re)conectar el socket se vuelve a anunciar el Host; el server responde con los outputs ya conectados.
  socket.on("connect", async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token && !closed) socket.emit("radio:host-join", token);
  });
  socket.on("disconnect", () => { for (const id of [...peers.keys()]) drop(id); });

  return {
    setAudio: (t) => { audio = t; peers.forEach((p) => void p.audio.replaceTrack(t)); },
    setVideo: (t) => { video = t; peers.forEach((p) => void p.video.replaceTrack(t)); },
    close: () => { closed = true; for (const id of [...peers.keys()]) drop(id); socket.disconnect(); },
  };
}
