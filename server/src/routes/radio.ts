import { randomBytes, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import type { Socket } from "socket.io";
import { RADIO_STATE_DEFAULT, can, normalizeRole, type RadioState } from "@newsroller/shared";
import { env } from "../config/env.js";
import { requireAuth, requirePerm } from "../auth/middleware.js";
import { getSupabase } from "../db/supabase.js";
import type { IO } from "../realtime/socket.js";

// Stream (radio manual): estado en memoria, señalización WebRTC entre el panel del Host y el output
// `?radio=1` (que corre en el vMix/OBS del estudio) y un puñado de rutas. El audio y el video NO pasan por el
// server: viajan directo de la compu del Host al output (WebRTC); acá sólo se intercambian los mensajes de conexión.

const HOSTS = "radio-host";
const VIEWERS = "radio-viewers";

const KEY = env.radioKey || randomBytes(12).toString("hex");
if (!env.radioKey) console.warn(`[radio] RADIO_KEY sin definir: se generó una temporal (${KEY.slice(0, 4)}…). El link del output cambia en cada reinicio.`);

// Clave del output de Stream: la usan los links con nombre (output-links) para no mostrarla en la URL.
export const radioKey = (): string => KEY;

let state: RadioState = { ...RADIO_STATE_DEFAULT };
// Último aviso del Host. Su panel reenvía el estado cada 5 s; si deja de hacerlo (cerró la pestaña, se colgó la
// compu) el stream se corta solo y la salida del canal vuelve al Copiloto.
let lastSeen = 0;
const STALE_MS = 45_000;

// El estado se guarda también en la base: un reinicio del server (cada deploy) no corta un stream en curso.
const STORE_KEY = "radioState";
async function persist(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("app_settings").upsert({ key: STORE_KEY, value: state }, { onConflict: "key" });
  if (error) console.warn(`[radio] no se pudo guardar el estado: ${error.message}`);
}
async function restore(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { data } = await sb.from("app_settings").select("value").eq("key", STORE_KEY).maybeSingle();
  const saved = data?.value as RadioState | undefined;
  if (saved?.tx) { state = { ...RADIO_STATE_DEFAULT, ...saved }; lastSeen = Date.now(); } // el Host tiene STALE_MS para volver a avisar
}
const same = (a: RadioState, b: RadioState) => JSON.stringify({ ...a, at: 0 }) === JSON.stringify({ ...b, at: 0 });

const keyOk = (k: unknown): boolean => {
  if (typeof k !== "string" || k.length !== KEY.length) return false;
  return timingSafeEqual(Buffer.from(k), Buffer.from(KEY));
};

function iceServers(): { urls: string | string[]; username?: string; credential?: string }[] {
  const out: { urls: string | string[]; username?: string; credential?: string }[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  if (env.radioTurnUrls.length) out.push({ urls: env.radioTurnUrls, username: env.radioTurnUsername, credential: env.radioTurnCredential });
  return out;
}

const cleanState = (b: Record<string, unknown>): RadioState | null => {
  const pad = b.pad;
  let p: RadioState["pad"] = null;
  if (pad != null) {
    const o = pad as Record<string, unknown>;
    if ((o.kind !== "item" && o.kind !== "session") || typeof o.id !== "string" || !/^[0-9a-f-]{8,64}$/i.test(o.id)) return null;
    p = { kind: o.kind, id: o.id };
  }
  const cam = b.cam === "full" || b.cam === "pip" ? b.cam : "off";
  const duck = Math.max(0, Math.min(100, Math.round(Number(b.duck ?? 25)) || 0));
  return { tx: b.tx === true, pad: b.tx === true ? p : null, cam: b.tx === true ? cam : "off", mic: b.mic === true, duck, music: b.music === true, at: Date.now() };
};

// Sockets: el Host (panel, con su token de sesión) y los outputs receptores (con la clave del link).
export function attachRadio(io: IO): void {
  void restore().then(() => { if (state.tx) io.to(VIEWERS).emit("radio:state", state); }).catch(() => {});
  setInterval(() => {
    if (!state.tx || Date.now() - lastSeen < STALE_MS) return;
    console.warn("[radio] el Host dejó de avisar: se corta el stream");
    state = { ...RADIO_STATE_DEFAULT, at: Date.now() };
    io.to(VIEWERS).emit("radio:state", state);
    void persist();
  }, 5_000).unref();
  io.on("connection", (socket: Socket) => {
    socket.on("radio:host-join", async (token: unknown, ack?: (ok: boolean) => void) => {
      const sb = getSupabase();
      try {
        if (!sb || typeof token !== "string") throw new Error("sin auth");
        const { data, error } = await sb.auth.getUser(token);
        if (error || !data.user) throw new Error("token inválido");
        const { data: profile } = await sb.from("profiles").select("role, active").eq("id", data.user.id).maybeSingle();
        if (profile?.active === false || !can(normalizeRole(profile?.role), "stream")) throw new Error("sin permiso");
      } catch {
        ack?.(false);
        return;
      }
      socket.join(HOSTS);
      ack?.(true);
      // El Host que recién entra se entera de los outputs que ya estaban conectados.
      for (const id of io.sockets.adapter.rooms.get(VIEWERS) ?? []) socket.emit("radio:viewer", id);
    });

    socket.on("radio:viewer-join", (key: unknown, ack?: (ok: boolean) => void) => {
      if (!keyOk(key)) { ack?.(false); return; }
      socket.join(VIEWERS);
      ack?.(true);
      socket.emit("radio:state", state);
      io.to(HOSTS).emit("radio:viewer", socket.id);
    });

    // Mensajes de conexión WebRTC: sólo Host -> output y output -> Host.
    socket.on("radio:signal", (msg: { to?: unknown; data?: unknown }) => {
      if (typeof msg?.to !== "string") return;
      const fromHost = socket.rooms.has(HOSTS), fromViewer = socket.rooms.has(VIEWERS);
      const target = io.sockets.sockets.get(msg.to);
      if (!target) return;
      if ((fromHost && target.rooms.has(VIEWERS)) || (fromViewer && target.rooms.has(HOSTS))) target.emit("radio:signal", { from: socket.id, data: msg.data });
    });

    socket.on("disconnect", () => {
      if (socket.rooms.has(VIEWERS)) io.to(HOSTS).emit("radio:viewer-left", socket.id);
    });
  });
}

export function radioRouter(io: IO): Router {
  const r = Router();

  // Panel: clave del link y servidores ICE.
  r.get("/config", requireAuth, requirePerm("stream"), (_req, res) => {
    res.json({ key: KEY, iceServers: iceServers(), turn: env.radioTurnUrls.length > 0 });
  });

  // Output (público, con clave): servidores ICE y estado actual (respaldo por si el websocket se cae).
  r.get("/ice", (req, res) => {
    if (!keyOk(req.query.key)) return res.status(403).json({ error: "clave inválida" });
    res.json({ iceServers: iceServers() });
  });
  r.get("/state", (req, res) => {
    if (!keyOk(req.query.key)) return res.status(403).json({ error: "clave inválida" });
    res.json(state);
  });

  // Host: qué contenido está al aire, cámara, micrófono, etc.
  r.put("/state", requireAuth, requirePerm("stream"), (req, res) => {
    const next = cleanState((req.body ?? {}) as Record<string, unknown>);
    if (!next) return res.status(400).json({ error: "estado inválido" });
    lastSeen = Date.now();
    const changed = !same(state, next);
    state = next;
    if (changed) { io.to(VIEWERS).emit("radio:state", state); void persist(); }
    res.json(state);
  });

  return r;
}
