import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { io } from "socket.io-client";
import { contentHasAudio } from "@newsroller/shared";
import { API_BASE, fetchScene, dataView, tickerText, type Block, type Scene } from "./lib/scene";
import { TemplateView } from "./templates/render";
import { ItemView } from "./templates/items";
import offAir from "./assets/off-air.jpg";
import { reportAiring, reportIncident, isLiveOutput } from "./lib/telemetry";

export function Output() {
  const [scene, setScene] = useState<Scene | null>(null);
  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [now, setNow] = useState(() => new Date());
  const [onAir, setOnAir] = useState(true);

  const load = useCallback(async () => {
    try {
      setScene(await fetchScene());
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
    socket.on("settings:update", (s: Record<string, unknown>) => setOnAir(s?.onAir !== false));
    return () => {
      socket.disconnect();
    };
  }, []);

  // Poll de respaldo (además del socket): en OBS el websocket no siempre se
  // sostiene de forma confiable (mismo motivo por el que el timer de avance
  // tuvo que blindarse antes), así que el corte de emisión no puede depender
  // SÓLO del socket — si se pierde el mensaje, esto lo aplica igual en pocos segundos.
  useEffect(() => {
    const check = () =>
      fetch(`${API_BASE}/api/settings`)
        .then((r) => r.json())
        .then((s) => setOnAir(s?.onAir !== false))
        .catch(() => {});
    void check();
    const t = setInterval(check, 5_000);
    return () => clearInterval(t);
  }, []);

  // Escalar el lienzo 1920x1080 al viewport.
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // Reloj.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const items = scene?.items ?? [];
  const current = items.length ? items[index % items.length] : null;

  // Ref (no state/dep) para que `advance` tenga una identidad ESTABLE entre
  // refrescos de escena — así no reinicia el timer de reproducción (ver abajo).
  const itemsLenRef = useRef(items.length);
  itemsLenRef.current = items.length;

  const advanced = useRef(false);
  const advance = useCallback(() => {
    if (advanced.current) return;
    advanced.current = true;
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
    const dur = Math.max(2, current.duration_sec ?? 8);
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
    reportAiring(current.item.id, current.item.type, current.duration_sec);
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
              hasAudio: current.item ? contentHasAudio(current.item.type, current.item.data) : false,
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
  }, [now, current?.id, items.length, index, onAir]);

  const clock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const logo = scene?.logos?.[0];
  const bg = scene?.background;
  const isTemplate = !!current?.tpl;
  const isItem = !!current?.item;
  // Bloques con diseño propio (plantilla o contenido tipado 2026): traen su propio fondo/chrome.
  const isCustom = isTemplate || isItem;

  // Corte manual de emisión: muestra la placa de "fuera del aire" a pantalla
  // completa, sin ticker ni rotación, hasta que se reanuda desde el Monitor.
  if (!onAir) {
    return (
      <div className="viewport">
        <div className="stage" style={{ transform: `scale(${scale})` }}>
          <img src={offAir} alt="Fuera del aire" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="viewport">
      <div className="stage" style={{ transform: `scale(${scale})` }}>
        {/* Fondo (para bloques con chrome estándar; plantillas y contenidos tipados traen su propio fondo) */}
        {!isCustom && (
          <div className="layer">
            {bg?.mime?.startsWith("video/") ? (
              <video className="bg-media" src={bg.url} autoPlay muted loop playsInline />
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
        {items.length === 0 && <div className="content"><Standby /></div>}

        {/* Chrome (se oculta el logo/reloj sobre plantillas, que traen su propio diseño) */}
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
              // Velocidad legible: ~0.45s por caracter, mínimo 60s.
              const durS = Math.max(60, Math.round(txt.length * 0.45));
              return <span style={{ animationDuration: `${durS}s` }}>{txt + "        "}</span>;
            })()}
          </div>
        </div>}
      </div>
    </div>
  );
}

function Standby() {
  return (
    <div className="standby">
      <div className="mark">C</div>
      <div style={{ fontSize: 40, fontWeight: 600 }}>Cíclico</div>
      <div style={{ fontSize: 24, color: "#6b7688" }}>Programación vacía — cargá bloques en el panel</div>
    </div>
  );
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
  return mime?.startsWith("video/") ? (
    <video src={url} autoPlay muted loop playsInline />
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
