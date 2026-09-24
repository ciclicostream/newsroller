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

let state: RadioState = { ...RADIO_STATE_DEFAULT };

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
  return { tx: b.tx === true, pad: b.tx === true ? p : null, cam: b.tx === true ? cam : "off", mic: b.mic === true, duck, at: Date.now() };
};

// Sockets: el Host (panel, con su token de sesión) y los outputs receptores (con la clave del link).
export function attachRadio(io: IO): void {
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
    state = next;
    io.to(VIEWERS).emit("radio:state", state);
    res.json(state);
  });

  return r;
}
