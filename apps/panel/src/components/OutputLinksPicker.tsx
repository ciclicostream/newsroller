import { useState } from "react";
import { Check, Copy, ExternalLink, Link2, RectangleHorizontal, RectangleVertical, Volume2, VolumeX } from "lucide-react";
import { OUTPUT_BASE } from "../lib/parrilla";

const ORIGIN = OUTPUT_BASE || (typeof window !== "undefined" ? window.location.origin : "");

// Selector de enlace de salida: el ícono de link, orientación y audio van todos en la misma franja;
// abajo, el link resultante. Lo usan Emisión y cada Sesión (con `extraParams` para meter ?session=<id>).
export function OutputLinksPicker({ title, extraParams = {} }: { title?: string; extraParams?: Record<string, string> }) {
  const [vertical, setVertical] = useState(false);
  const [audio, setAudio] = useState(false);
  const [copied, setCopied] = useState(false);

  const params = new URLSearchParams({ ...extraParams, ...(vertical ? { orientation: "vertical" } : {}), ...(audio ? { audio: "1" } : {}) });
  const url = `${ORIGIN}/output/?${params.toString()}`;

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* el navegador no dejó copiar: el link queda visible igual */ }
  }

  return (
    <div className="card lp">
      {title && <div className="lp-hd">{title}</div>}
      <div className="lp-picks">
        <Link2 size={15} className="lp-icon" />
        <div className="lp-seg">
          <button className={!vertical ? "on" : ""} onClick={() => setVertical(false)}><RectangleHorizontal size={14} /> Horizontal</button>
          <button className={vertical ? "on" : ""} onClick={() => setVertical(true)}><RectangleVertical size={14} /> Vertical</button>
        </div>
        <div className="lp-seg">
          <button className={!audio ? "on" : ""} onClick={() => setAudio(false)}><VolumeX size={14} /> Sin audio</button>
          <button className={audio ? "on" : ""} onClick={() => setAudio(true)}><Volume2 size={14} /> Con audio</button>
        </div>
        <div className="lp-url" title={url}>{url}</div>
        <a className="sess-icon" href={url} target="_blank" rel="noreferrer" title="Abrir"><ExternalLink size={14} /></a>
        <button className="sess-icon" onClick={copy} title={copied ? "Copiado" : "Copiar"}>{copied ? <Check size={14} /> : <Copy size={14} />}</button>
      </div>
    </div>
  );
}
