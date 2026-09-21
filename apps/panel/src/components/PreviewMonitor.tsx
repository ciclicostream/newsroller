import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { OUTPUT_FRAME_BASE } from "../lib/parrilla";

// Monitor chico de edición: muestra en vivo cómo queda la placa con lo que se está
// cargando en el formulario. Embebe el output (?draft=1) y le manda los datos por
// postMessage (con debounce), así no hace falta guardar para previsualizar.
export function PreviewMonitor({ type, data, dur, ready = true }: {
  type: string;
  data: Record<string, unknown>;
  dur: number;
  ready?: boolean;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false); // el output avisó que está escuchando
  const payload = useRef({ type, data, dur });
  payload.current = { type, data, dur };

  const send = () => {
    const p = payload.current;
    frame.current?.contentWindow?.postMessage({ source: "ciclico-panel-draft", type: p.type, data: p.data, durationSec: p.dur }, "*");
  };

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source === frame.current?.contentWindow && e.data?.source === "ciclico-draft-ready") { setLoaded(true); send(); }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Reenvía al cambiar los datos (debounce para no reiniciar la animación en cada tecla).
  const key = JSON.stringify([type, data, dur]);
  useEffect(() => {
    if (!loaded || !ready) return;
    const t = setTimeout(send, 450);
    return () => clearTimeout(t);
  }, [key, loaded, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="pm">
      <style>{CSS}</style>
      <div className="pm-hd">
        <span>Vista previa</span>
        <button type="button" className="pm-re" title="Repetir animación" disabled={!ready}
          onClick={() => frame.current?.contentWindow?.postMessage({ source: "ciclico-panel-draft", replay: true }, "*")}>
          <RotateCcw size={13} />
        </button>
      </div>
      <div className="pm-screen">
        <iframe ref={frame} src={`${OUTPUT_FRAME_BASE}/output/?draft=1`} title="Vista previa" tabIndex={-1} />
        {!ready && <div className="pm-ph">Completá los datos para ver la vista previa.</div>}
      </div>
    </div>
  );
}

const CSS = `
/* Columna de la derecha: monitor + contenidos guardados, todo del ancho del monitor.
   Los textos largos bajan a 2-3 líneas y los botones pasan a otra fila. */
.pm-col{display:flex;flex-direction:column;gap:12px;width:min(100%,460px);min-width:0}
.pm-col>.card{flex-wrap:wrap;gap:10px 12px!important;padding:12px!important}
.pm-col>.card [style*="nowrap"]{white-space:normal!important;overflow:hidden!important;text-overflow:clip!important;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;word-break:break-word}
.pm-col>.card>div[style*="flex: 1"]{flex:1 1 250px!important}
.pm-col>.card>.toggle-pill{margin-left:auto}

.pm{position:sticky;top:12px;z-index:5;width:min(100%,460px);background:#fff;border:1px solid #e3e7ef;border-radius:14px;padding:10px 10px 12px;box-shadow:0 6px 20px rgba(20,30,60,.08),inset 0 2px 12px rgba(20,30,60,.05)}
.pm-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#7c869b}
.pm-re{border:1px solid #e3e7ef;background:#fff;color:#7c869b;border-radius:7px;padding:4px 6px;display:inline-flex;cursor:pointer}
.pm-re:hover:not(:disabled){color:#2f6bff;border-color:#2f6bff}.pm-re:disabled{opacity:.4;cursor:default}
.pm-screen{position:relative;aspect-ratio:16/9;background:#05081a;border-radius:9px;overflow:hidden}
.pm-screen iframe{width:100%;height:100%;border:0;display:block;pointer-events:none}
.pm-ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:18px;text-align:center;font-size:12px;color:#8a93a6;background:#05081a}
`;
