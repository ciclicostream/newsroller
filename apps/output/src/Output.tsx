import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { io } from "socket.io-client";
import { API_BASE, fetchScene, dataView, tickerText, type Block, type Scene } from "./lib/scene";
import { TemplateView, templateHasVideo } from "./templates/render";

export function Output() {
  const [scene, setScene] = useState<Scene | null>(null);
  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [now, setNow] = useState(() => new Date());

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

  // Data en vivo por Socket.IO (actualiza valores sin recargar la escena).
  useEffect(() => {
    const socket = io(API_BASE || undefined, { transports: ["websocket", "polling"] });
    socket.on("data:update", (d: { source: string; payload: unknown }) => {
      setScene((prev) => (prev ? { ...prev, data: { ...prev.data, [d.source]: d.payload } } : prev));
    });
    return () => {
      socket.disconnect();
    };
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
  // Un bloque con video se avanza cuando el video TERMINA (no por tiempo).
  const hasVideo = !!(current?.tpl && templateHasVideo(current.tpl));

  const advanced = useRef(false);
  const advance = useCallback(() => {
    if (advanced.current) return;
    advanced.current = true;
    setIndex((i) => {
      const len = items.length || 1;
      const next = (i + 1) % len;
      if (next === 0) void load();
      return next;
    });
  }, [items.length, load]);

  // Reproductor: por duración, salvo bloques con video (avanzan al terminar, con tope de seguridad).
  useEffect(() => {
    advanced.current = false;
    if (items.length === 0) return;
    const dur = Math.max(2, items[index % items.length]?.duration_sec ?? 8);
    const ms = (hasVideo ? Math.max(dur, 1200) : dur) * 1000;
    const t = setTimeout(advance, ms);
    return () => clearTimeout(t);
  }, [index, items, hasVideo, advance]);

  const clock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const logo = scene?.logos?.[0];
  const bg = scene?.background;
  const isTemplate = !!current?.tpl;

  return (
    <div className="viewport">
      <div className="stage" style={{ transform: `scale(${scale})` }}>
        {/* Fondo (para bloques que no son plantilla; la plantilla trae su propio fondo) */}
        {!isTemplate && (
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
              <TemplateView template={current.tpl!} data={scene!.data} logos={scene!.logos} onEnded={advance} />
            </motion.div>
          )}
          {current && !isTemplate && (
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
        {logo && !isTemplate && (
          <div className="chrome-logo">
            <img src={logo.url} alt={logo.name ?? ""} />
          </div>
        )}
        {!isTemplate && <div className="chrome-clock">{clock}</div>}

        <div className="ticker">
          <div className="ticker-tag">CÍCLICO</div>
          <div className="ticker-track">
            <span>{scene ? tickerText(scene.data) + "        " : "Cíclico"}</span>
          </div>
        </div>
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
          <div className="panel" style={{ borderTopColor: accent }}>
            <AnimatedWords text={block.placa.title} size={64} />
            {block.placa.body && <div className="placa-body">{block.placa.body}</div>}
          </div>
        </div>
      );
    }
    return (
      <div className="full-pad">
        <div className="kicker" style={{ color: accent }}>Informe</div>
        <AnimatedWords text={block.placa.title} size={76} />
        {block.placa.body && <div className="placa-body">{block.placa.body}</div>}
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
