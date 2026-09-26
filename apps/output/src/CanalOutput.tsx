import { useEffect, useState } from "react";
import { Output } from "./Output";
import { RadioOutput } from "./RadioOutput";
import { API_BASE } from "./lib/scene";
import { P } from "./lib/params";

// Salida del canal (links /output/<nombre>): UNA sola señal. Emite la parrilla del Copiloto y, mientras el Host
// tiene la transmisión de Stream abierta, pasa a Stream; al cerrarla, vuelve sola al Copiloto.
// El estado de Stream se consulta con la clave que trajo el link (nunca aparece en la URL).
const KEY = P.get("key") ?? "";

export function CanalOutput() {
  const [tx, setTx] = useState(false);
  useEffect(() => {
    if (!KEY) return;
    let on = true;
    const poll = () =>
      fetch(`${API_BASE}/api/radio/state?key=${encodeURIComponent(KEY)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((s) => { if (on && s) setTx(!!s.tx); })
        .catch(() => {});
    void poll();
    const t = setInterval(poll, 2000);
    return () => { on = false; clearInterval(t); };
  }, []);
  return tx ? <RadioOutput /> : <Output />;
}
