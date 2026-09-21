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
   Cada contenido es una card (ícono + título + datos) que puede crecer de alto, y a la
   derecha, arriba, una píldora de controles (interruptor, editar, borrar) de tamaño fijo. */
.pm-col{display:flex;flex-direction:column;gap:12px;width:min(100%,460px);min-width:0}
.pm-col>.card{display:grid!important;grid-template-columns:auto minmax(0,1fr) 44px 34px 34px;column-gap:0!important;row-gap:0!important;align-items:start!important;padding:12px!important}
.pm-col>.card>*{grid-row:1}
.pm-col>.card>div:nth-child(1){grid-column:1;margin-right:12px}
.pm-col>.card>div:nth-child(2){grid-column:2;margin-right:12px;min-width:0}
.pm-col>.card>.toggle-pill{grid-column:3}
.pm-col>.card>.btn:nth-of-type(2){grid-column:4}
.pm-col>.card>.btn:nth-of-type(3){grid-column:5}
/* fondo de la píldora: mismo ancho y alto siempre, pegada arriba a la derecha */
.pm-col>.card::before{content:"";grid-row:1;grid-column:3/6;height:38px;border-radius:999px;background:#f1f3f8;border:1px solid #e3e7ef;box-sizing:border-box}
.pm-col>.card [style*="nowrap"]{white-space:normal!important;overflow:hidden!important;text-overflow:clip!important;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;word-break:break-word}
.pm-col>.card>.toggle-pill,.pm-col>.card>.btn{position:relative;z-index:1}
.pm-col>.card>.btn{width:30px;height:30px;padding:0;margin:4px auto 0;border:0;background:transparent;box-shadow:none;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#5b6577}
.pm-col>.card>.btn:hover{background:#e3e7ef;color:var(--text)}
/* "En parrilla" como interruptor. */
.pm-col .toggle-pill{width:38px;height:22px;padding:0;gap:0;border:0;border-radius:999px;background:#cfd4de;position:relative;font-size:0;flex:none;transition:background .15s;justify-self:center;margin-top:8px}
.pm-col .toggle-pill svg{display:none}
.pm-col .toggle-pill::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .15s}
.pm-col .toggle-pill.on{background:var(--accent)}
.pm-col .toggle-pill.on::after{transform:translateX(16px)}
.pm-col .toggle-pill:hover{background:#bcc2cf;color:inherit}.pm-col .toggle-pill.on:hover{background:#255ce0}
.pm{position:sticky;top:12px;z-index:5;width:100%;background:#fff;border:1px solid #e3e7ef;border-radius:14px;padding:10px 10px 12px;box-shadow:0 6px 20px rgba(20,30,60,.08),inset 0 2px 12px rgba(20,30,60,.05)}
.pm-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#7c869b}
.pm-re{border:1px solid #e3e7ef;background:#fff;color:#7c869b;border-radius:7px;padding:4px 6px;display:inline-flex;cursor:pointer}
.pm-re:hover:not(:disabled){color:#2f6bff;border-color:#2f6bff}.pm-re:disabled{opacity:.4;cursor:default}
.pm-screen{position:relative;aspect-ratio:16/9;background:#05081a;border-radius:9px;overflow:hidden}
.pm-screen iframe{width:100%;height:100%;border:0;display:block;pointer-events:none}
.pm-ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:18px;text-align:center;font-size:12px;color:#8a93a6;background:#05081a}
`;
