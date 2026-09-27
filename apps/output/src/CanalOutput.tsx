import { useEffect, useState } from "react";
import { Output } from "./Output";
import { RadioOutput } from "./RadioOutput";
import { API_BASE } from "./lib/scene";
import { P } from "./lib/params";

// Salida del canal (links /output/<nombre>): UNA sola señal. Emite la parrilla del Copiloto y, mientras el Host
// tiene la transmisión de Stream abierta, pasa a Stream; al cerrarla, vuelve sola al Copiloto.
// El estado de Stream se consulta con la clave que trajo el link (nunca aparece en la URL).
const KEY = P.get("key") ?? "";

// Si el server cambió la clave (reinicio sin RADIO_KEY fija, o clave rotada), la que trajo el link quedó vieja: el
// server responde 403 y la señal se quedaba para siempre en la parrilla aunque el Host esté transmitiendo. Recargar
// la página vuelve a pedir la clave vigente; se limita a una vez cada 20 s para no entrar en bucle.
const RELOAD_KEY = "nr.canal.reload";
function reloadForFreshKey(): void {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 20_000) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch { /* sin storage: recarga igual */ }
  window.location.reload();
}

export function CanalOutput() {
  const [tx, setTx] = useState(false);
  useEffect(() => {
    if (!KEY) return;
    let on = true;
    const poll = () =>
      fetch(`${API_BASE}/api/radio/state?key=${encodeURIComponent(KEY)}`)
        .then((r) => { if (r.status === 403) { reloadForFreshKey(); return null; } return r.ok ? r.json() : null; })
        .then((s) => { if (on && s) setTx(!!s.tx); })
        .catch(() => {});
    void poll();
    const t = setInterval(poll, 2000);
    return () => { on = false; clearInterval(t); };
  }, []);
  return tx ? <RadioOutput /> : <Output />;
}
