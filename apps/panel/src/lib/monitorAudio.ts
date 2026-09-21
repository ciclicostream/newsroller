import { useCallback, useEffect, useState } from "react";

// Sonido de los monitores de vista previa (Programación en PREVIEW/CLIP y formularios de Contenido).
// Arranca APAGADO (para evitar eco con el aire) y se recuerda en este navegador.
const KEY = "nr.monitorAudio";
const EVT = "nr:monitor-audio";

const read = (): boolean => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };

export function useMonitorAudio(): [boolean, () => void] {
  const [on, setOn] = useState(read);
  useEffect(() => {
    const sync = () => setOn(read());
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", sync); };
  }, []);
  const toggle = useCallback(() => {
    const next = !read();
    try { localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* sin storage: sólo esta vista */ }
    setOn(next);
    window.dispatchEvent(new Event(EVT));
  }, []);
  return [on, toggle];
}
