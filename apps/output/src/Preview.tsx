import { Component, useEffect, useState, type ReactNode } from "react";
import { API_BASE, fetchScene, type Scene } from "./lib/scene";
import { ItemView } from "./templates/items";
import { fitScale, stageStyle } from "./lib/orientation";

// El panel pide sonido con ?audio=1 (botón del parlante); sin eso la vista previa va muda.
const WANT_SOUND = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("audio");

// Preview de un contenido tipado (MONITOR del panel). Renderiza una placa, con su animación,
// y la reproduce en loop para que el operador la vea antes de mandarla al aire.
export function Preview({ id }: { id: string }) {
  const [item, setItem] = useState<{ type: string; data: Record<string, any>; duration_sec?: number } | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);
  const [scale, setScale] = useState(1);
  const [loop, setLoop] = useState(0);

  useEffect(() => {
    let on = true;
    fetch(`${API_BASE}/api/output/item/${id}`)
      .then((r) => r.json())
      .then((d) => on && setItem(d))
      .catch(() => {});
    return () => { on = false; };
  }, [id]);

  // Datos en vivo (clima, dólar) y cámaras: sin esto las placas que dependen
  // de la escena se ven vacías en el monitor.
  useEffect(() => {
    let on = true;
    fetchScene().then((s) => on && setScene(s)).catch(() => {});
    return () => { on = false; };
  }, [id]);

  const dur = Math.max(4, item?.duration_sec ?? 8);

  useEffect(() => {
    const fit = () => setScale(fitScale());
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // Replay de la animación cada ciclo (duración + margen para ver entrada y salida).
  useEffect(() => {
    const t = setInterval(() => setLoop((n) => n + 1), (dur + 1) * 1000);
    return () => clearInterval(t);
  }, [dur]);

  return (
    <div className="viewport">
      <div className="stage" style={stageStyle(scale)}>
        {item ? <ItemView key={loop} type={item.type} data={item.data} durationSec={dur} liveData={scene?.data} cameras={scene?.cameras ?? []} /> : null}
      </div>
    </div>
  );
}

// Si una plantilla revienta con datos a medio cargar, el monitor muestra un aviso
// en vez de quedar en blanco.
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? (
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#9aa3b8", font: "600 40px Inter,system-ui,sans-serif" }}>
        Faltan datos para la vista previa
      </div>
    ) : this.props.children;
  }
}

// Vista previa EN VIVO de lo que se está cargando en un formulario del panel.
// El panel (iframe padre) manda por postMessage {type, data, durationSec}; acá se
// renderiza la placa con esos datos y se repite la animación en loop. Va muda:
// sin audio_url y con los <video> silenciados (es un monitor de edición).
export function DraftPreview() {
  const [draft, setDraft] = useState<{ type: string; data: Record<string, any>; dur: number; v: number } | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);
  const [scale, setScale] = useState(1);
  const [loop, setLoop] = useState(0);

  useEffect(() => {
    fetchScene().then(setScene).catch(() => {});
    function onMsg(e: MessageEvent) {
      if (e.source !== window.parent || e.data?.source !== "ciclico-panel-draft") return;
      const { type, data, durationSec, replay } = e.data;
      if (replay) { setLoop((n) => n + 1); return; }
      setDraft((d) => ({ type, data: { ...(data ?? {}), ...(WANT_SOUND ? {} : { audio_url: null }) }, dur: Math.max(4, durationSec ?? 8), v: (d?.v ?? 0) + 1 }));
    }
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ source: "ciclico-draft-ready" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    const fit = () => setScale(fitScale());
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const dur = draft?.dur ?? 8;
  useEffect(() => {
    const t = setInterval(() => setLoop((n) => n + 1), (dur + 1) * 1000);
    return () => clearInterval(t);
  }, [dur]);

  useEffect(() => {
    if (WANT_SOUND) return; // el panel pidió escuchar (?audio=1): no se fuerza el silencio
    const t = setInterval(() => document.querySelectorAll("video").forEach((v) => { v.muted = true; }), 400);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="viewport">
      <div className="stage" style={stageStyle(scale)}>
        {draft ? (
          <Boundary key={draft.v + ":" + loop}>
            <ItemView type={draft.type} data={draft.data} durationSec={dur} liveData={scene?.data} cameras={scene?.cameras ?? []} />
          </Boundary>
        ) : null}
      </div>
    </div>
  );
}
