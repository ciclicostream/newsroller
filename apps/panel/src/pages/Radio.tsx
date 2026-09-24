import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Mic, MicOff, Square, Play, Power, Search, Tv, Volume2, VolumeX, RectangleHorizontal, RectangleVertical,
  LayoutGrid, RadioTower, X, Camera as CameraIcon, CameraOff, PictureInPicture2, Maximize, Link2, Copy, Check, ExternalLink, Music,
} from "lucide-react";
import type { Camera, ContentItem } from "@newsroller/shared";
import { useMonitorAudio } from "../lib/monitorAudio";
import { useMonitorVertical } from "../lib/monitorOrientation";
import { useStoredFlag } from "../lib/storedFlag";
import { settingsApi } from "../lib/settings";
import { OUTPUT_FRAME_BASE } from "../lib/parrilla";
import { sessions as sessionsApi, type SessionRow } from "../lib/sessions";
import { contentItems as contentItemsApi } from "../lib/content-items";
import { camerasApi } from "../lib/cameras";
import { createRadioLink, radioApi, radioUrl, type RadioConfig, type RadioLink } from "../lib/radioLink";
import offAir from "../assets/off-air.jpg";
import { CAT, CAT_ICON, CAT_ORDER, SESSION_COLOR, SESSION_ICON, TYPE_LABEL, catOf, iconOf, itemText } from "../lib/contentCatalog";

// Stream = radio manual (MAQUETA). Sin nada al aire se ve la placa de espera (off-air). Una "transmisión" es el programa completo del locutor: la abre a las 20:00,
// va poniendo contenidos (cada uno en loop hasta que toca otro), habla encima con el micrófono y la
// corta a las 22:00. El contador verde mide la transmisión entera (aunque los loops sumen menos); el
// rojo, lo que le queda al clip al aire. Por ahora el monitor previsualiza con el output real y el
// micrófono abre la entrada de esta computadora; el output `?radio=1` y el ducking llegan al aprobar.
type Pad = { key: string; kind: "item" | "session" | "cam"; id: string; cat: string; label: string; sub: string; dur: number; Icon: any; color: string };

const CAM_KEY = "cam:full"; // botón "Locutor en cámara" (pantalla completa)
const CAM_PAD: Pad = { key: CAM_KEY, kind: "cam", id: "cam", cat: "cam", label: "Locutor en cámara", sub: "Cámara del locutor", dur: 0, Icon: CameraIcon, color: "#0891b2" };
const TX_KEY = "nr.radio.tx"; // inicio de la transmisión en curso, para que un refresco no la pierda
const pad2 = (n: number) => String(n).padStart(2, "0");
const fmt = (s: number) => `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
const fmtMS = (s: number) => `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
const hhmm = (t: number) => new Date(t).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
const readTx = (): number | null => { try { const v = Number(localStorage.getItem(TX_KEY)); return v > 0 ? v : null; } catch { return null; } };
const writeTx = (v: number | null) => { try { if (v) localStorage.setItem(TX_KEY, String(v)); else localStorage.removeItem(TX_KEY); } catch { /* sin storage: sólo esta vista */ } };

// Micrófono de esta computadora: pide permiso a Chrome la primera vez y mide el nivel de entrada.
function useMic() {
  const [on, setOn] = useState(false);
  const [level, setLevel] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [track, setTrack] = useState<MediaStreamTrack | null>(null); // pista que se manda al output por WebRTC
  const rig = useRef<{ stream: MediaStream; ctx: AudioContext; raf: number } | null>(null);

  const stop = useCallback(() => {
    const r = rig.current; rig.current = null;
    if (r) { cancelAnimationFrame(r.raf); r.stream.getTracks().forEach((t) => t.stop()); void r.ctx.close().catch(() => {}); }
    setOn(false); setLevel(0); setTrack(null);
  }, []);

  const start = useCallback(async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const ctx = new AudioContext();
      const an = ctx.createAnalyser(); an.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.fftSize);
      const loop = () => {
        an.getByteTimeDomainData(buf);
        let peak = 0; for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]! - 128) / 128);
        setLevel((l) => Math.max(peak * 1.6, l * 0.82));
        if (rig.current) rig.current.raf = requestAnimationFrame(loop);
      };
      rig.current = { stream, ctx, raf: requestAnimationFrame(loop) };
      setOn(true); setTrack(stream.getAudioTracks()[0] ?? null);
    } catch (e) {
      const name = (e as DOMException)?.name;
      setErr(name === "NotAllowedError" ? "El navegador bloqueó el micrófono. Habilitalo en el candado de la barra de direcciones." : name === "NotFoundError" ? "No se encontró ningún micrófono conectado." : "No se pudo abrir el micrófono.");
    }
  }, []);

  useEffect(() => stop, [stop]);
  const toggle = useCallback(() => { if (rig.current) stop(); else void start(); }, [start, stop]);
  return { on, level: Math.min(1, level), err, toggle, track };
}

// Cámara web de esta computadora (la del locutor): pide permiso a Chrome y permite elegir entre varias.
function useCam() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<MediaStream | null>(null);

  const stop = useCallback(() => { ref.current?.getTracks().forEach((t) => t.stop()); ref.current = null; setStream(null); }, []);
  const start = useCallback(async (id?: string) => {
    setErr(null);
    try {
      ref.current?.getTracks().forEach((t) => t.stop());
      const st = await navigator.mediaDevices.getUserMedia({ video: id ? { deviceId: { exact: id }, width: { ideal: 1280 }, height: { ideal: 720 } } : { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      ref.current = st; setStream(st);
      setDeviceId(st.getVideoTracks()[0]?.getSettings().deviceId ?? id ?? "");
      // Con el permiso concedido ya se pueden listar las cámaras con su nombre.
      setDevices((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput"));
    } catch (e) {
      const name = (e as DOMException)?.name;
      setErr(name === "NotAllowedError" ? "El navegador bloqueó la cámara. Habilitala en el candado de la barra de direcciones." : name === "NotFoundError" ? "No se encontró ninguna cámara conectada." : "No se pudo abrir la cámara.");
    }
  }, []);
  useEffect(() => stop, [stop]);
  return { stream, on: !!stream, devices, deviceId, err, start, stop };
}

function CamVideo({ stream, className }: { stream: MediaStream; className?: string }) {
  const r = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (r.current) r.current.srcObject = stream; }, [stream]);
  return <video ref={r} className={className} autoPlay muted playsInline />;
}

// Enlace del output de Stream para OBS/vMix (lleva la clave que valida el server).
function LinkBox({ cfg }: { cfg: RadioConfig | null }) {
  const [vertical, setVertical] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = cfg ? radioUrl(cfg.key, vertical) : "";
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* el link queda visible igual */ }
  }
  return (
    <div className="rd-linkbox">
      <div className="rd-linkrow">
        <div className="lp-seg">
          <button className={!vertical ? "on" : ""} onClick={() => setVertical(false)}><RectangleHorizontal size={14} /> Horizontal</button>
          <button className={vertical ? "on" : ""} onClick={() => setVertical(true)}><RectangleVertical size={14} /> Vertical</button>
        </div>
        <div className="lp-url" title={url}>{cfg ? url : "Cargando…"}</div>
        {cfg && <a className="sess-icon" href={url} target="_blank" rel="noreferrer" title="Abrir"><ExternalLink size={14} /></a>}
        {cfg && <button className="sess-icon" onClick={() => void copy()} title={copied ? "Copiado" : "Copiar"}>{copied ? <Check size={14} /> : <Copy size={14} />}</button>}
      </div>
      <p className="rd-linknote">Pegalo como Browser Source en OBS o como Web Browser Input en vMix (1920×1080, o 1080×1920 en vertical). Lleva una clave: no lo compartas.{cfg && !cfg.turn ? " Sin servidor TURN configurado: funciona en la misma red o en redes abiertas; entre tu casa y el estudio puede fallar." : ""}</p>
    </div>
  );
}

function CardHead({ icon: I, title, children }: { icon: any; title: string; children?: React.ReactNode }) {
  return (
    <div className="rd-hd">
      <span className="rd-hdic"><I size={14} /></span>
      <span className="rd-hdt">{title}</span>
      {children && <div className="rd-hdr">{children}</div>}
    </div>
  );
}

export function Radio() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [sess, setSess] = useState<SessionRow[]>([]);
  const [cams, setCams] = useState<Camera[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [txStart, setTxStart] = useState<number | null>(readTx); // transmisión abierta (ms) o null
  const [lastRun, setLastRun] = useState<number | null>(null); // duración (s) de la última transmisión cortada
  const [confirmCut, setConfirmCut] = useState(false);
  const [active, setActive] = useState<string | null>(null); // key del botón al aire
  const [padSince, setPadSince] = useState<number | null>(null);
  const [clips, setClips] = useState<number[]>([]); // duración (s) de cada clip del botón al aire, en orden; una Sesión trae varios
  const [tick, setTick] = useState(0);
  const [duck, setDuck] = useState(25); // % de volumen del clip con el micrófono abierto
  const [monSound, toggleMonSound] = useMonitorAudio();
  const [monVertical, toggleMonVertical] = useMonitorVertical();
  const mic = useMic();
  const cam = useCam();
  const [camPip, setCamPip] = useState(false); // recuadro de la cámara sobre el contenido
  const live = txStart != null;
  const [cfg, setCfg] = useState<RadioConfig | null>(null);
  const [viewers, setViewers] = useState(0); // outputs del estudio conectados al enlace
  const [showLink, setShowLink] = useState(false);
  const [musicOn, toggleMusic] = useStoredFlag("nr.radio.music"); // música de fondo de Stream (el tema se elige en Ajustes → Música)
  const [hasTrack, setHasTrack] = useState(true);
  const [linkErr, setLinkErr] = useState<string | null>(null);
  const linkRef = useRef<RadioLink | null>(null);

  useEffect(() => {
    Promise.all([
      contentItemsApi.list().then(setItems).catch(() => {}),
      sessionsApi.list().then(setSess).catch(() => {}),
      camerasApi.list().then(setCams).catch(() => {}),
    ]).finally(() => setLoaded(true));
  }, []);
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 1000); return () => clearInterval(t); }, []);

  // Enlace WebRTC con el output del estudio: mic y cámara viajan directo; el estado va por el server.
  useEffect(() => {
    let dead = false; let l: RadioLink | null = null;
    settingsApi.get().then((s) => setHasTrack(!!s.music?.tracks.some((t) => t.id === s.music?.activeId))).catch(() => {});
    radioApi.config().then((c) => { if (dead) return; setCfg(c); l = createRadioLink(c, setViewers); linkRef.current = l; }).catch(() => { if (!dead) setLinkErr("Sin conexión con el servidor de Stream."); });
    return () => { dead = true; l?.close(); linkRef.current = null; };
  }, []);
  useEffect(() => { linkRef.current?.setAudio(mic.track); }, [mic.track, cfg]);
  const camTrack = cam.stream?.getVideoTracks()[0] ?? null;
  useEffect(() => { linkRef.current?.setVideo(camTrack); }, [camTrack, cfg]);
  useEffect(() => { if (!confirmCut) return; const t = setTimeout(() => setConfirmCut(false), 4000); return () => clearTimeout(t); }, [confirmCut]);

  const camById = useMemo(() => new Map(cams.map((c) => [c.id, c])), [cams]);
  const pads = useMemo<Pad[]>(() => {
    const ctx = { cams: camById, yt: {} as Record<string, string> };
    const sp: Pad[] = sess.filter((s) => s.in_parrilla !== false).map((s) => ({
      key: "s:" + s.id, kind: "session", id: s.id, cat: "sesion", label: s.name,
      sub: `Sesión · ${s.item_count} contenido${s.item_count === 1 ? "" : "s"}`, dur: s.total_duration_sec, Icon: SESSION_ICON, color: SESSION_COLOR,
    }));
    const ip: Pad[] = items.filter((c) => c.in_parrilla !== false).map((c) => ({
      key: "i:" + c.id, kind: "item", id: c.id, cat: catOf(c.type), label: itemText(c, ctx),
      sub: TYPE_LABEL[c.type] || c.type, dur: c.duration_sec, Icon: iconOf(c.type), color: CAT[catOf(c.type)]!.color,
    }));
    return [...sp, ...ip];
  }, [items, sess, camById]);

  const counts = useMemo(() => {
    const by: Record<string, number> = { all: pads.length };
    pads.forEach((p) => { by[p.cat] = (by[p.cat] || 0) + 1; });
    return by;
  }, [pads]);
  const term = q.trim().toLowerCase();
  const shown = pads.filter((p) => (filter === "all" || p.cat === filter) && (!term || p.label.toLowerCase().includes(term) || p.sub.toLowerCase().includes(term)));
  const cur = active === CAM_KEY ? CAM_PAD : pads.find((p) => p.key === active) ?? null;

  // Le cuenta al output del estudio qué está al aire (contenido en loop o placa de espera), la cámara y el micrófono.
  useEffect(() => {
    if (!cfg) return;
    const pad = live && cur && cur.kind !== "cam" ? { kind: cur.kind, id: cur.id } : null;
    const camMode = !live ? "off" : active === CAM_KEY ? "full" : camPip && cam.on ? "pip" : "off";
    const t = setTimeout(() => {
      radioApi.setState({ tx: live, pad, cam: camMode, mic: mic.on, duck, music: musicOn }).then(() => setLinkErr(null)).catch((e) => setLinkErr(e instanceof Error ? e.message : "No se pudo avisar al output."));
    }, 120);
    return () => clearTimeout(t);
  }, [cfg, live, cur?.key, active, camPip, cam.on, mic.on, duck, musicOn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Transmisión: la abre el locutor al sentarse y la corta al terminar el programa.
  function startTx() { const t = Date.now(); setTxStart(t); writeTx(t); setLastRun(null); }
  function cutTx() {
    if (!confirmCut) { setConfirmCut(true); return; }
    if (txStart) setLastRun(Math.floor((Date.now() - txStart) / 1000));
    setTxStart(null); writeTx(null); setConfirmCut(false); stopClip();
  }

  // MAQUETA: el contador del clip se simula recorriendo las duraciones en loop; cuando exista el output
  // `?radio=1` lo va a informar el propio output (telemetría), igual que en Emisión.
  function press(p: Pad) {
    if (!live) return;
    setActive(p.key); setPadSince(Date.now()); setClips([Math.max(1, p.dur || 8)]);
    if (p.kind === "session") {
      void sessionsApi.items(p.id).then((rows) => {
        const d = rows.filter((r) => r.enabled).map((r) => Math.max(1, r.duration_sec));
        setActive((k) => { if (k === p.key && d.length) setClips(d); return k; });
      }).catch(() => {});
    }
  }
  function stopClip() { setActive(null); setPadSince(null); setClips([]); }
  function pressCam() {
    if (!live || !cam.on) return;
    if (active === CAM_KEY) { stopClip(); return; }
    setActive(CAM_KEY); setPadSince(Date.now()); setClips([]);
  }
  function toggleCam() {
    if (cam.on) { cam.stop(); setCamPip(false); if (active === CAM_KEY) stopClip(); } else void cam.start();
  }

  // Atajos: M abre/cierra el micrófono, Esc deja la placa fija (no se activan escribiendo en un campo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "m" || e.key === "M") mic.toggle();
      if (e.key === "Escape") stopClip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mic.toggle]); // eslint-disable-line react-hooks/exhaustive-deps

  const orient = monVertical ? "&orientation=vertical" : "";
  const monUrl = cur && cur.kind !== "cam"
    ? cur.kind === "session"
      ? `${OUTPUT_FRAME_BASE}/output/?session=${cur.id}${monSound ? "&audio=1" : ""}${orient}`
      : `${OUTPUT_FRAME_BASE}/output/?preview=${cur.id}${monSound ? "&audio=1" : ""}${orient}`
    : null;

  void tick;
  const txSec = txStart ? Math.max(0, Math.floor((Date.now() - txStart) / 1000)) : 0;
  const padSec = padSince ? Math.max(0, Math.floor((Date.now() - padSince) / 1000)) : 0;
  // Clip actual y cuánto le queda (cuenta regresiva): recorre las duraciones en loop según el tiempo del botón al aire.
  const cycle = clips.reduce((a, b) => a + b, 0);
  let clipIdx = 0, clipLeft = 0;
  if (cur && cycle > 0) {
    let pos = padSec % cycle;
    while (pos >= clips[clipIdx]!) { pos -= clips[clipIdx]!; clipIdx++; }
    clipLeft = clips[clipIdx]! - pos;
  }
  const n = 22; const lit = Math.round(mic.level * n);
  const vuColor = (i: number) => { const q2 = i / n; return q2 > 0.8 ? "#f87171" : q2 > 0.55 ? "#fbbf24" : "#4ade80"; };
  const state: "off" | "plate" | "air" = !live ? "off" : cur ? "air" : "plate";

  return (
    <div className="pv rd">
      <div className="pv-head">
        <h1>Stream</h1>
        <div className="pv-hint">Abrí la transmisión, tocá un botón y queda al aire en loop hasta que toques otro.</div>
        <span />
      </div>

      <div className="rd-top">
        {/* Al aire */}
        <div className={"pv-card rd-card rd-now " + state}>
          <CardHead icon={RadioTower} title="Al aire">
            <span className={"rd-tally " + state}><i />{state === "air" ? "AL AIRE" : state === "plate" ? "PLACA FIJA" : "CORTADA"}</span>
          </CardHead>
          <div className="rd-nowname">{cur ? cur.label : live ? "Elegí un botón para poner al aire" : "Iniciá la transmisión"}</div>
          <div className="rd-clocks">
            <div className="rd-clk g">
              <span className="lb">transmisión</span>
              <span className="dg">{fmt(txSec)}</span>
              <span className="ft">{live ? `desde las ${hhmm(txStart!)} hs` : lastRun != null ? `última: ${fmt(lastRun)}` : "sin abrir"}</span>
            </div>
            <div className="rd-clk r">
              <span className="lb">{cur?.kind === "cam" ? "cámara" : clips.length > 1 ? `clip ${clipIdx + 1} de ${clips.length}` : "clip al aire"}</span>
              <span className="dg">{cur?.kind === "cam" ? "--:--" : fmtMS(clipLeft)}</span>
              <span className="ft">{cur?.kind === "cam" ? "en directo" : cur ? "le queda" : "—"}</span>
            </div>
          </div>
          {!live ? (
            <button type="button" className="rd-cta go" onClick={startTx}><Play size={16} /> Iniciar transmisión</button>
          ) : (
            <div className="rd-ctas">
              <button type="button" className="rd-cta plate" onClick={stopClip} disabled={!cur} title="Dejar la placa fija (Esc)"><Square size={13} /> Placa fija</button>
              <button type="button" className={"rd-cta cut" + (confirmCut ? " sure" : "")} onClick={cutTx}><Power size={14} /> {confirmCut ? "¿Cortar? Tocá de nuevo" : "Cortar transmisión"}</button>
            </div>
          )}
        </div>

        {/* Monitor */}
        <div className="pv-card rd-card rd-moncard">
          <CardHead icon={Tv} title="Monitor">
            <button type="button" className={"pv-snd" + (musicOn ? " on" : "")} onClick={toggleMusic} disabled={!hasTrack} aria-pressed={musicOn}
              aria-label={musicOn ? "Apagar la música de fondo" : "Encender la música de fondo"}
              title={!hasTrack ? "Elegí un tema en Ajustes → Música primero" : musicOn ? "Apagar la música de fondo" : "Encender la música de fondo (se apaga sola con contenido con audio y baja con el micrófono)"}>
              <Music size={14} />
            </button>
            <button type="button" className={"pv-snd" + (showLink ? " on" : "")} onClick={() => setShowLink((v) => !v)} aria-pressed={showLink}
              aria-label="Enlace para OBS o vMix" title="Enlace del output para OBS / vMix">
              <Link2 size={14} />
            </button>
            <button type="button" className={"pv-snd" + (monSound ? " on" : "")} onClick={toggleMonSound} aria-pressed={monSound}
              aria-label={monSound ? "Silenciar el monitor" : "Escuchar el monitor"} title={monSound ? "Silenciar el monitor" : "Escuchar el monitor"}>
              {monSound ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
            <button type="button" className={"pv-snd" + (monVertical ? " on" : "")} onClick={toggleMonVertical} aria-pressed={monVertical}
              aria-label={monVertical ? "Ver el monitor en horizontal" : "Ver el monitor en vertical"} title={monVertical ? "Ver en 16:9 (horizontal)" : "Ver en 9:16 (vertical)"}>
              {monVertical ? <RectangleVertical size={14} /> : <RectangleHorizontal size={14} />}
            </button>
          </CardHead>
          {showLink && <div className="pv-card rd-popover"><LinkBox cfg={cfg} /></div>}
          <div className={"pv-mon rd-mon" + (monVertical ? " v" : "")}>
            {cur?.kind === "cam" && cam.stream
              ? <CamVideo stream={cam.stream} className="rd-camfull" />
              : monUrl
                ? <iframe key={monUrl} src={monUrl} title="monitor radio" allow="autoplay; encrypted-media" />
                : <img className="rd-plate" src={offAir} alt="Placa de espera" />}
            {camPip && cam.stream && cur?.kind !== "cam" && <CamVideo stream={cam.stream} className="rd-pip" />}
          </div>
        </div>

        {/* Micrófono */}
        <div className={"pv-card rd-card rd-mic" + (mic.on ? " on" : "")}>
          <CardHead icon={Mic} title="Micrófono y cámara">
            <span className={"rd-rx" + (viewers > 0 ? " on" : "") + (linkErr ? " err" : "")} title={linkErr ?? (viewers > 0 ? "El output del estudio está conectado" : "Ningún output abierto con tu enlace: abrí el link en OBS o vMix")}>
              <i />{linkErr ? "Sin enlace" : viewers > 0 ? "Estudio conectado" : "Sin receptor"}
            </span>
          </CardHead>
          <button type="button" className="rd-micbtn" onClick={mic.toggle} aria-pressed={mic.on}
            title={mic.on ? "Cerrar el micrófono (M)" : "Abrir el micrófono (M)"}>
            <span className="rd-micic">{mic.on ? <Mic size={24} /> : <MicOff size={24} />}</span>
            <span className="rd-mictx">
              <b>{mic.on ? "MIC AL AIRE" : "MIC CERRADO"}</b>
              <small>{mic.on ? "Tocá para cerrar" : "Tocá para abrir"}</small>
            </span>
            <kbd>M</kbd>
          </button>
          <div className="rd-vuh">
            {Array.from({ length: n }).map((_, i) => <i key={i} style={{ background: i < lit ? vuColor(i) : "#e6e9f0" }} />)}
          </div>
          <label className="rd-duck">
            <span>Clip al hablar</span>
            <input type="range" min={0} max={100} step={5} value={duck} onChange={(e) => setDuck(Number(e.target.value))} />
            <b>{duck}%</b>
          </label>
          <div className="rd-camsep" />
          <div className="rd-cam">
            <div className={"rd-camprev" + (cam.on ? " on" : "")}>
              {cam.stream ? <CamVideo stream={cam.stream} /> : <CameraOff size={18} />}
            </div>
            <div className="rd-camctl">
              <button type="button" className={"rd-camb" + (cam.on ? " on" : "")} onClick={toggleCam} aria-pressed={cam.on}>
                {cam.on ? <CameraIcon size={14} /> : <CameraOff size={14} />}{cam.on ? "Cámara activa" : "Activar cámara"}
              </button>
              <div className="rd-camrow">
                <button type="button" className={"rd-camb" + (active === CAM_KEY ? " air" : "")} disabled={!cam.on || !live} onClick={pressCam} aria-pressed={active === CAM_KEY}
                  title={!cam.on ? "Activá la cámara primero" : !live ? "Iniciá la transmisión" : "Poner al locutor a pantalla completa"}>
                  <Maximize size={14} />Completa
                </button>
                <button type="button" className={"rd-camb" + (camPip ? " on" : "")} disabled={!cam.on || active === CAM_KEY} onClick={() => setCamPip((v) => !v)} aria-pressed={camPip}
                  title={!cam.on ? "Activá la cámara primero" : "Mostrar tu cámara en un recuadro sobre el contenido"}>
                  <PictureInPicture2 size={14} />Recuadro
                </button>
              </div>
            </div>
          </div>
          {cam.devices.length > 1 && (
            <select className="rd-camsel" value={cam.deviceId} onChange={(e) => void cam.start(e.target.value)} aria-label="Elegir cámara">
              {cam.devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Cámara ${i + 1}`}</option>)}
            </select>
          )}
          {cam.err && <div className="rd-miserr">{cam.err}</div>}
          {mic.err && <div className="rd-miserr">{mic.err}</div>}
        </div>
      </div>

      {/* Todos los botones en una sola tarjeta */}
      <div className={"pv-card rd-board" + (live ? "" : " off")}>
        <div className="rd-boardhd">
          <div className="rd-boardt"><b>Contenidos</b></div>
        <div className="rd-cats">
          {[["all", "Todos", LayoutGrid, "#5b6678"] as const, ...CAT_ORDER.map((k) => [k, CAT[k]!.label, CAT_ICON[k], CAT[k]!.color] as const)].map(([id, lb, I, col]) => (
            <button key={id} type="button" className={"rd-cat" + (filter === id ? " on" : "")} onClick={() => setFilter(id)}>
              <I size={14} color={col} />{lb}<span className="pv-cn">{counts[id] ?? 0}</span>
            </button>
          ))}
        </div>
        <label className="rd-search">
          <Search size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar contenido…" />
          {q && <button type="button" onClick={() => setQ("")} aria-label="Borrar búsqueda"><X size={14} /></button>}
        </label>
        </div>
        {!live && <div className="rd-lock"><Power size={14} /> Iniciá la transmisión para poner contenidos al aire.</div>}
        <div className="rd-pads">
          {loaded && shown.length === 0 && <div className="pv-empty" style={{ gridColumn: "1 / -1" }}>{pads.length ? "Ningún contenido coincide con la búsqueda." : 'Sin contenidos. Cargá desde "Contenido" o armá una Sesión.'}</div>}
          {shown.map((p) => {
            const on = p.key === active;
            return (
              <button key={p.key} type="button" disabled={!live} className={"rd-pad" + (on ? " on" : "")} style={{ ["--pc" as any]: p.color }} onClick={() => press(p)} aria-pressed={on}>
                <span className="rd-padic"><p.Icon size={16} /></span>
                <span className="rd-padtx">
                  <span className="rd-padk">{p.sub}</span>
                  <span className="rd-padl">{p.label}</span>
                </span>
                {on && <span className="rd-eq" aria-label="al aire"><i /><i /><i /><i /></span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
