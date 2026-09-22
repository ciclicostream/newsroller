import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { io } from "socket.io-client";
import { contentHasAudio, MUSIC_DEFAULT, type MusicSettings } from "@newsroller/shared";
import { API_BASE, fetchScene, dataView, tickerText, type Block, type Scene } from "./lib/scene";
import { TemplateView, templateHasVideo } from "./templates/render";
import { ItemView } from "./templates/items";
import offAir from "./assets/off-air.jpg";
import { reportAiring, reportIncident, isLiveOutput } from "./lib/telemetry";
import { IS_VERTICAL, ORIENTATION, fitScale, stageStyle, supportsVertical } from "./lib/orientation";
import { useForcePlay } from "./lib/autoplay";

// Sonido de la música de fondo: como todo lo demás, muteada salvo ?audio=1 (lo controla vMix/OBS).
const WANT_AUDIO = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("audio");

// Sesión: si la URL trae ?session=<id>, este output pasa a reproducir esa playlist en vez del aire
// principal. El resto (rotación, sonido, telemetría, recarga por antigüedad) funciona igual.
const SESSION_ID = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("session") : null;

// Borrador: ?borrador=1 hace que el Monitor de Emisión (PREVIEW) rote la parrilla BORRADOR
// (parrilla_draft, lo que todavía no se publicó) en vez del aire real — misma rotación, música y
// todo, para probar antes de publicar. Nunca cuenta para reportes (ver isLiveOutput) ni respeta el
// corte de emisión real (no tiene sentido: es sólo una previsualización).
const DRAFT_AIR = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("borrador");

// Contenidos reproducibles de una Sesión embebida: sólo los del banco (content_item; es lo único que se
// puede cargar en una Sesión hoy) y, en vertical, sólo los que tengan versión 9:16.
function sessionPlayable(blocks: Block[], vertical: boolean): Block[] {
  return blocks.filter((b) => b.item && (!vertical || supportsVertical(b.item.type, b.item.data)));
}

// Heurística de si el bloque actual trae audio propio (para el fadeout de la música de fondo).
// No es una medición real, es la misma idea que ya usa la telemetría del Monitor.
function blockHasAudio(b: Block | null): boolean {
  if (!b) return false;
  if (b.content_type === "short" || b.content_type === "promos") return true; // siempre video de YouTube
  if (b.content_type === "ad") return !!b.media?.mime?.startsWith("video/");
  if (b.tpl) return templateHasVideo(b.tpl as any);
  if (b.item) return contentHasAudio(b.item.type, b.item.data);
  return false;
}

// Horas de encendido tras las cuales el output se recarga solo al cerrar una vuelta de la parrilla.
const MAX_UPTIME_H = 12;

export function Output() {
  const [scene, setScene] = useState<Scene | null>(null);
  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [now, setNow] = useState(() => new Date());
  const [onAir, setOnAir] = useState(true);
  const [music, setMusic] = useState<MusicSettings>(MUSIC_DEFAULT);
  const [sessionAudio, setSessionAudio] = useState(false); // lo reporta el SessionRunner activo, si hay uno
  const bgVideoRef = useForcePlay<HTMLVideoElement>();

  const load = useCallback(async () => {
    try {
      setScene(await fetchScene(SESSION_ID, DRAFT_AIR));
    } catch {
      /* reintenta en el próximo ciclo */
    }
  }, []);

  // Escena inicial + refresco periódico (cambios de contenido/playlist).
  useEffect(() => {
    void load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  // Data en vivo por Socket.IO (actualiza valores sin recargar la escena) +
  // corte manual de emisión (onAir), que aplica al instante sin esperar el poll.
  useEffect(() => {
    const socket = io(API_BASE || undefined, { transports: ["websocket", "polling"] });
    socket.on("data:update", (d: { source: string; payload: unknown }) => {
      setScene((prev) => (prev ? { ...prev, data: { ...prev.data, [d.source]: d.payload } } : prev));
    });
    if (SESSION_ID) {
      // Corte de emergencia de la sesión: instantáneo por socket, filtrando por id.
      socket.on("session:update", (s: { id: string; active: boolean }) => { if (s.id === SESSION_ID) setOnAir(s.active); });
    } else {
      socket.on("settings:update", (s: Record<string, unknown>) => {
        if (!DRAFT_AIR) setOnAir(s?.onAir !== false);
        setMusic((s?.music as MusicSettings) ?? MUSIC_DEFAULT);
      });
    }
    return () => {
      socket.disconnect();
    };
  }, []);

  // Poll de respaldo (además del socket): en OBS el websocket no siempre se
  // sostiene de forma confiable (mismo motivo por el que el timer de avance
  // tuvo que blindarse antes), así que el corte de emisión no puede depender
  // SÓLO del socket — si se pierde el mensaje, esto lo aplica igual en pocos segundos.
  useEffect(() => {
    // Sesión: el estado activo/detenido viaja dentro de su propia escena (ya se está pollando arriba);
    // sólo el aire principal necesita este chequeo aparte de /api/settings.
    if (SESSION_ID) return;
    const check = () =>
      fetch(`${API_BASE}/api/settings`)
        .then((r) => r.json())
        .then((s) => { if (!DRAFT_AIR) setOnAir(s?.onAir !== false); setMusic(s?.music ?? MUSIC_DEFAULT); })
        .catch(() => {});
    void check();
    const t = setInterval(check, 5_000);
    return () => clearInterval(t);
  }, []);

  // Escalar el lienzo 1920x1080 al viewport.
  useEffect(() => {
    const fit = () => setScale(fitScale());
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // Reloj.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Output vertical: sólo salen los contenidos con versión 9:16 (las cámaras nunca); el resto se saltea en la rotación.
  // Un bloque "Sesión" pasa si, para esta orientación, le queda al menos un contenido propio reproducible.
  const allItems = scene?.items ?? [];
  const items = IS_VERTICAL
    ? allItems.filter((b) => (b.item && supportsVertical(b.item.type, b.item.data)) || (b.session && sessionPlayable(b.session.items, true).length > 0))
    : allItems;
  const current = items.length ? items[index % items.length] : null;
  const isTemplate = !!current?.tpl;
  const isItem = !!current?.item;
  const isSession = !!current?.session;

  // Música de fondo continua (Ajustes → Música + interruptor del Monitor de Emisión): sólo en el aire
  // principal (no en el output de una Sesión), y sólo si hay un tema elegido. Hace fadeout cuando el
  // bloque actual trae audio propio (mp3, short, video con sonido) y fadein cuando vuelve a estar mudo.
  const musicTrack = !SESSION_ID ? music.tracks.find((t) => t.id === music.activeId) ?? null : null;
  const wantMusic = music.enabled && !!musicTrack && onAir;
  const currentHasAudio = isSession ? sessionAudio : blockHasAudio(current);

  // Ref (no state/dep) para que `advance` tenga una identidad ESTABLE entre
  // refrescos de escena — así no reinicia el timer de reproducción (ver abajo).
  const itemsLenRef = useRef(items.length);
  itemsLenRef.current = items.length;

  // Higiene para emisión 24/7: con el output encendido hace más de MAX_UPTIME_H horas, al completar una
  // vuelta de la parrilla se recarga la página (libera la memoria que el navegador acumula con los días).
  // El corte cae justo entre el último y el primer bloque. Sólo en el output real (no en el monitor).
  const bootAt = useRef(Date.now());
  const indexRef = useRef(index);
  indexRef.current = index;

  const advanced = useRef(false);
  const advance = useCallback(() => {
    if (advanced.current) return;
    advanced.current = true;
    const len = itemsLenRef.current || 1;
    if ((indexRef.current + 1) % len === 0 && isLiveOutput() && Date.now() - bootAt.current > MAX_UPTIME_H * 3_600_000) {
      window.location.reload();
      return;
    }
    setIndex((i) => {
      const len = itemsLenRef.current || 1;
      const next = (i + 1) % len;
      if (next === 0) void load();
      return next;
    });
  }, [load]);

  // Reproductor: avanza por la duración del bloque; un video que TERMINA antes avanza antes.
  // (Nunca queda congelado: la duración es el tope.)
  // OJO: las dependencias son primitivas (id/duración del bloque actual), NO el array
  // `items` completo — ese array llega con una referencia NUEVA en cada refresco de
  // escena (poll cada 60s, o el load() al completar una vuelta), aunque el contenido
  // sea idéntico. Depender de `items` reiniciaba este timer desde cero cada vez que
  // eso pasaba, duplicando (o más) la duración real en pantalla, y si la escena
  // llegaba momentáneamente vacía, cortaba el timer sin reprogramar el próximo avance.
  useEffect(() => {
    advanced.current = false;
    if (!current) return;
    // Sesión: no tiene una duración propia — se calcula sumando lo que realmente va a reproducir (según
    // orientación). Es sólo la red de seguridad: quien manda el avance en la práctica es SessionRunner
    // al completar su vuelta; este timer existe por si algo se traba adentro.
    const dur = current.session
      ? Math.max(2, sessionPlayable(current.session.items, IS_VERTICAL).reduce((s, b) => s + Math.max(2, b.duration_sec ?? 8), 0))
      : Math.max(2, current.duration_sec ?? 8);
    const t = setTimeout(advance, dur * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, current?.duration_sec, advance]);

  // Reportes: cada vez que un contenido tipado ARRANCA al aire se registra la salida (todos los tipos).
  // Con el canal cortado no cuenta, y el monitor del panel (iframe) tampoco.
  const airKey = current?.item ? `${current.id}:${index}` : null;
  const airedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!airKey || !onAir || !current?.item || airedRef.current === airKey) return;
    airedRef.current = airKey;
    reportAiring(current.item.id, current.item.type, current.duration_sec, ORIENTATION, SESSION_ID);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [airKey, onAir]);

  // Reportes: foto/video/audio que no carga en lo que está al aire (los errores de recursos no burbujean:
  // se escuchan en captura). Las cámaras avisan por su cuenta (data-nr-skip).
  const currentRef = useRef(current);
  currentRef.current = current;
  useEffect(() => {
    if (!isLiveOutput()) return;
    const onErr = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (!el || !["IMG", "VIDEO", "AUDIO", "SOURCE"].includes(el.tagName) || el.hasAttribute("data-nr-skip")) return;
      const src = (el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src;
      if (!src || src.startsWith("data:")) return;
      const cur = currentRef.current;
      reportIncident({ kind: "media", key: src.replace(/^https?:\/\/[^/]+/, ""), label: cur?.item?.type ?? cur?.content_type, detail: `No cargó ${el.tagName.toLowerCase()}`, item_id: cur?.item?.id });
    };
    window.addEventListener("error", onErr, true);
    return () => window.removeEventListener("error", onErr, true);
  }, []);

  // FPS real de rendering (frames de pantalla por segundo) — diagnóstico técnico
  // para el Monitor del panel; no hay forma de leer el bitrate de OBS desde acá,
  // eso lo fija el encoder de OBS, no la página.
  const frameCountRef = useRef(0);
  const fpsRef = useRef(0);
  useEffect(() => {
    let raf: number;
    const tick = () => { frameCountRef.current++; raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Telemetría para el Monitor de Programación (postMessage al padre, cuando el
  // output está embebido en un iframe). Se reenvía cada vez que cambia el reloj
  // (1x/seg) o el bloque actual, y de paso trae el fps medido en esa ventana.
  useEffect(() => {
    fpsRef.current = frameCountRef.current;
    frameCountRef.current = 0;
    if (window.parent === window) return;
    const next = items.length ? items[(index + 1) % items.length] : null;
    window.parent.postMessage(
      {
        source: "ciclico-output",
        updatedAt: new Date().toISOString(),
        fps: fpsRef.current,
        onAir,
        current: current
          ? {
              id: current.id,
              itemType: current.item?.type ?? null,
              // Suena algo si el propio bloque trae audio, o si no lo trae pero la música de fondo está audible.
              hasAudio: blockHasAudio(current) || (wantMusic && !currentHasAudio),
              durationSec: current.duration_sec,
            }
          : null,
        next: next
          ? { id: next.id, itemType: next.item?.type ?? null, durationSec: next.duration_sec }
          : null,
      },
      "*",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, current?.id, items.length, index, onAir, wantMusic, currentHasAudio]);

  const clock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const logo = scene?.logos?.[0];
  const bg = scene?.background;
  // Bloques con diseño propio (plantilla, contenido tipado 2026 o una Sesión embebida): traen su propio fondo/chrome.
  const isCustom = isTemplate || isItem || isSession;

  useEffect(() => { if (!isSession) setSessionAudio(false); }, [isSession]);
  const musicRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = musicRef.current;
    if (!el || !musicTrack) return;
    const target = wantMusic && !currentHasAudio ? 1 : 0;
    if (wantMusic && el.paused) void el.play().catch(() => {});
    if (!wantMusic && !el.paused) el.pause();
    let raf: number;
    const step = () => {
      const a = musicRef.current;
      if (!a) return;
      const next = a.volume + (target - a.volume) * 0.08;
      a.volume = Math.abs(next - target) < 0.01 ? target : next;
      if (a.volume !== target) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [wantMusic, currentHasAudio, musicTrack?.url]);

  // Corte manual de emisión: muestra la placa de "fuera del aire" a pantalla
  // completa, sin ticker ni rotación, hasta que se reanuda desde el Monitor.
  if (!onAir) {
    return (
      <div className="viewport">
        <div className="stage" style={stageStyle(scale)}>
          <img src={offAir} alt="Fuera del aire" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="viewport">
      <div className="stage" style={stageStyle(scale)}>
        {/* Música de fondo continua: sin capa visual, se controla toda por volumen (fadeout/fadein). */}
        {musicTrack && <audio key={musicTrack.url} ref={musicRef} src={musicTrack.url} loop muted={!WANT_AUDIO} data-nr-skip />}
        {/* Fondo (para bloques con chrome estándar; plantillas y contenidos tipados traen su propio fondo) */}
        {!isCustom && (
          <div className="layer">
            {bg?.mime?.startsWith("video/") ? (
              <video key={bg.url} ref={bgVideoRef} className="bg-media" src={bg.url} autoPlay muted loop playsInline />
            ) : bg?.url ? (
              <img className="bg-media" src={bg.url} alt="" />
            ) : (
              <div className="layer bg-white" />
            )}
          </div>
        )}

        {/* Contenido rotativo */}
        <AnimatePresence mode="wait">
          {current && isTemplate && (
            <motion.div
              key={current.id + ":" + index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              style={{ position: "absolute", inset: 0, zIndex: 5 }}
            >
              <TemplateView template={current.tpl!} data={scene!.data} logos={scene!.logos} cameras={scene!.cameras ?? []} onEnded={advance} />
            </motion.div>
          )}
          {current && isSession && (
            <motion.div
              key={current.id + ":" + index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              style={{ position: "absolute", inset: 0, zIndex: 5 }}
            >
              <SessionRunner scene={scene!} blocks={current.session!.items} sessionId={current.session!.id} onDone={advance} onAudioChange={setSessionAudio} />
            </motion.div>
          )}
          {current && isItem && (
            <motion.div
              key={current.id + ":" + index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              style={{ position: "absolute", inset: 0, zIndex: 5 }}
            >
              <ItemView id={current.item!.id} type={current.item!.type} data={current.item!.data} durationSec={current.duration_sec} liveData={scene?.data} cameras={scene?.cameras ?? []} />
            </motion.div>
          )}
          {current && !isCustom && (
            <motion.div
              key={current.id + ":" + index}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
              className="content"
              style={{ zIndex: 5 }}
            >
              <BlockView block={current} data={scene!.data} />
            </motion.div>
          )}
        </AnimatePresence>
        {/* Sin nada para mostrar (sesión recién creada, parrilla vacía): sólo el fondo de color, nada
            más -- sin logo, sin reloj ni ticker dando vueltas sobre la nada. */}
        {items.length > 0 && (
          <>
            {logo && !isCustom && (
              <div className="chrome-logo">
                <img src={logo.url} alt={logo.name ?? ""} />
              </div>
            )}
            {!isCustom && <div className="chrome-clock">{clock}</div>}

            {!isItem && <div className="ticker">
              <div className="ticker-tag">CÍCLICO</div>
              <div className="ticker-track">
                {(() => {
                  const txt = scene ? tickerText(scene.data) : "Cíclico";
                  const durS = Math.max(60, Math.round(txt.length * 0.45));
                  return <span style={{ animationDuration: `${durS}s` }}>{txt + "        "}</span>;
                })()}
              </div>
            </div>}
          </>
        )}
      </div>
    </div>
  );
}

// Reproduce, dentro de un bloque de la Emisión (o de otra Sesión anfitriona), los contenidos propios de una
// Sesión embebida: gira sólo entre ellos con sus propias duraciones y, al completar una vuelta entera,
// avisa (`onDone`, con guarda propia arriba en `advance`) para que la Emisión siga con su próximo bloque.
function SessionRunner({ scene, blocks, sessionId, onDone, onAudioChange }: { scene: Scene; blocks: Block[]; sessionId: string; onDone: () => void; onAudioChange?: (has: boolean) => void }) {
  const playable = sessionPlayable(blocks, IS_VERTICAL);
  const [idx, setIdx] = useState(0);
  const cur = playable.length ? playable[idx % playable.length] : null;

  // Avisa al padre si el sub-contenido actual trae audio propio (fadeout de la música de fondo).
  useEffect(() => { onAudioChange?.(blockHasAudio(cur)); }, [cur?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const lenRef = useRef(playable.length);
  lenRef.current = playable.length;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const advanceSub = useCallback(() => {
    setIdx((i) => {
      const len = lenRef.current || 1;
      const next = (i + 1) % len;
      if (next === 0) onDoneRef.current();
      return next;
    });
  }, []);

  useEffect(() => {
    if (!cur) { onDoneRef.current(); return; }
    const t = setTimeout(advanceSub, Math.max(2, cur.duration_sec ?? 8) * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.id, cur?.duration_sec]);

  // Reportes: las salidas de los contenidos de una Sesión embebida cuentan para ESA Sesión, no para el aire.
  const airedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!cur?.item) return;
    const key = `${cur.id}:${idx}`;
    if (airedRef.current === key) return;
    airedRef.current = key;
    reportAiring(cur.item.id, cur.item.type, cur.duration_sec, ORIENTATION, sessionId);
  }, [cur?.id, idx, sessionId]);

  if (!cur?.item) return null;
  return <ItemView id={cur.item.id} type={cur.item.type} data={cur.item.data} durationSec={cur.duration_sec} liveData={scene.data} cameras={scene.cameras ?? []} />;
}

function AnimatedWords({ text, size }: { text: string; size: number }) {
  return (
    <div className="title" style={{ fontSize: size }}>
      {text.split(" ").map((w, i) => (
        <motion.span
          key={i}
          className="word"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 + i * 0.08, duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {w}&nbsp;
        </motion.span>
      ))}
    </div>
  );
}

function ytEmbed(videoId: string): string {
  const p = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    controls: "0",
    loop: "1",
    playlist: videoId,
    playsinline: "1",
    modestbranding: "1",
    rel: "0",
  });
  return `https://www.youtube.com/embed/${videoId}?${p.toString()}`;
}

function BlockView({ block, data }: { block: Block; data: Record<string, any> }) {
  const t = block.template;

  if (block.short && t === "short-916") {
    return (
      <div className="short916">
        <div className="short-frame">
          <iframe src={ytEmbed(block.short.videoId)} allow="autoplay; encrypted-media" title="short" />
        </div>
        <div className="short-side">
          <div className="kicker">Short del canal</div>
          <AnimatedWords text={block.short.title} size={60} />
        </div>
      </div>
    );
  }

  if (block.short && (t === "full-media" || t === "tres-cuartos")) {
    if (t === "tres-cuartos") return <TresCuartos mediaNode={<YtBox id={block.short.videoId} />} data={data} title={block.short.title} />;
    return (
      <div className="media-full">
        <div style={{ height: "90%", aspectRatio: "9/16" }}>
          <iframe
            src={ytEmbed(block.short.videoId)}
            style={{ width: "100%", height: "100%", border: 0 }}
            allow="autoplay; encrypted-media"
            title="short"
          />
        </div>
      </div>
    );
  }

  if (block.media) {
    if (t === "tres-cuartos") return <TresCuartos mediaNode={<MediaNode url={block.media.url} mime={block.media.mime} />} data={data} />;
    return (
      <div className="media-full">
        <MediaNode url={block.media.url} mime={block.media.mime} />
      </div>
    );
  }

  if (block.placa) {
    const accent = block.placa.accent ?? "#e8542f";
    if (t === "placa-medio") {
      return (
        <div className="card-center">
          <div className="panel" style={{ borderTopColor: accent, display: "flex", gap: 40, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <AnimatedWords text={block.placa.title} size={64} />
              {block.placa.body && <div className="placa-body">{block.placa.body}</div>}
            </div>
            {block.placa.image_url && (
              <img src={block.placa.image_url} style={{ width: 380, height: 460, objectFit: (block.placa.image_fit as any) ?? "contain" }} />
            )}
          </div>
        </div>
      );
    }
    return (
      <div className="full-pad" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 60 }}>
        <div style={{ flex: 1 }}>
          <div className="kicker" style={{ color: accent }}>Informe</div>
          <AnimatedWords text={block.placa.title} size={76} />
          {block.placa.body && <div className="placa-body">{block.placa.body}</div>}
        </div>
        {block.placa.image_url && (
          <img src={block.placa.image_url} style={{ width: 620, height: 760, objectFit: (block.placa.image_fit as any) ?? "contain" }} />
        )}
      </div>
    );
  }

  if (block.data) {
    const dv = dataView(block.data.source, data);
    if (!dv) return null;
    if (t === "tres-cuartos") return <TresCuartos mediaNode={<DataBig dv={dv} />} data={data} />;
    if (t === "data-medio") {
      return (
        <div className="card-center">
          <div className="panel">
            <div className="kicker">{dv.title}</div>
            <div className="rows">
              {dv.rows.map((row) => (
                <div key={row.label}>
                  <div className="label">{row.label}</div>
                  <div className="value">{row.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="full-pad">
        <div className="kicker">{dv.title}</div>
        <div className="rows">
          {dv.rows.map((row) => (
            <div key={row.label}>
              <div className="label">{row.label}</div>
              <div className="value">{row.value}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

function MediaNode({ url, mime }: { url: string; mime: string | null }) {
  const ref = useForcePlay<HTMLVideoElement>();
  return mime?.startsWith("video/") ? (
    <video key={url} ref={ref} src={url} autoPlay muted loop playsInline />
  ) : (
    <img src={url} alt="" />
  );
}

function YtBox({ id }: { id: string }) {
  return (
    <div className="short-frame" style={{ height: "100%" }}>
      <iframe src={ytEmbed(id)} allow="autoplay; encrypted-media" title="short" />
    </div>
  );
}

function DataBig({ dv }: { dv: { title: string; rows: { label: string; value: string }[] } }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
      <div className="kicker">{dv.title}</div>
      <div className="rows" style={{ flexWrap: "wrap" }}>
        {dv.rows.map((r) => (
          <div key={r.label}>
            <div className="label">{r.label}</div>
            <div className="value">{r.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TresCuartos({ mediaNode, data, title }: { mediaNode: React.ReactNode; data: Record<string, any>; title?: string }) {
  const dolar = dataView("dolar", data);
  const cammesa = dataView("cammesa", data);
  return (
    <div className="tres">
      <div style={{ flex: 3, height: "80%", display: "flex", alignItems: "center", justifyContent: "center" }}>{mediaNode}</div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 40 }}>
        {title && <AnimatedWords text={title} size={40} />}
        {[dolar, cammesa].filter(Boolean).map((dv) => (
          <div key={dv!.title}>
            <div className="kicker" style={{ fontSize: 20, marginBottom: 8 }}>{dv!.title}</div>
            {dv!.rows.slice(0, 2).map((r) => (
              <div key={r.label} style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 22, color: "#6b7688", marginRight: 10 }}>{r.label}</span>
                <span style={{ fontSize: 34, fontWeight: 600 }}>{r.value}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
