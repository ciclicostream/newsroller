import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

// Cierre de sesión por inactividad. La "actividad" son gestos de la persona (mouse, teclado, toque, scroll);
// mientras hay actividad se avisa al servidor cada ~60 s (así el servidor también sabe que sigue ahí). Un minuto
// antes de cortar aparece un cartel con cuenta regresiva y "Seguir conectado".
export function IdleGuard({ minutes, onIdle }: { minutes: number; onIdle: () => void }) {
  const limitMs = Math.max(1, minutes) * 60_000;
  const warnMs = Math.min(60_000, limitMs / 2);
  const lastActivity = useRef(Date.now());
  const lastPing = useRef(0);
  const [left, setLeft] = useState<number | null>(null); // segundos que faltan (sólo con el cartel)
  const warning = useRef(false);

  const ping = () => {
    lastPing.current = Date.now();
    void api.post("/api/session/ping", {}).catch(() => {});
  };

  useEffect(() => {
    lastActivity.current = Date.now();
    ping();
    const onGesture = () => {
      if (warning.current) return; // con el cartel abierto sólo cuenta apretar el botón
      lastActivity.current = Date.now();
      if (Date.now() - lastPing.current > 60_000) ping();
    };
    const evs = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"] as const;
    evs.forEach((e) => window.addEventListener(e, onGesture, { passive: true }));

    const tick = setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= limitMs) { clearInterval(tick); onIdle(); return; }
      if (idle >= limitMs - warnMs) {
        warning.current = true;
        setLeft(Math.max(0, Math.ceil((limitMs - idle) / 1000)));
      }
    }, 1000);
    return () => { evs.forEach((e) => window.removeEventListener(e, onGesture)); clearInterval(tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limitMs]);

  function stay() {
    warning.current = false;
    lastActivity.current = Date.now();
    setLeft(null);
    ping();
  }

  if (left == null) return null;
  return (
    <div className="modal-back" style={{ zIndex: 300 }}>
      <div className="modal" style={{ maxWidth: 420, padding: 24, gap: 10 }}>
        <b style={{ fontSize: 17 }}>¿Seguís ahí?</b>
        <div className="muted-note" style={{ fontSize: 14 }}>
          Por inactividad, tu sesión se cierra en <b>{left} s</b>. El aire no se ve afectado.
        </div>
        <button className="btn primary" autoFocus onClick={stay} style={{ justifyContent: "center", marginTop: 6 }}>Seguir conectado</button>
      </div>
    </div>
  );
}
