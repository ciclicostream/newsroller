import { useCallback, useEffect, useState } from "react";

// Interruptor recordado en este navegador y sincronizado entre los componentes que lo usan.
const read = (key: string): boolean => { try { return localStorage.getItem(key) === "1"; } catch { return false; } };

export function useStoredFlag(key: string): [boolean, () => void] {
  const evt = `nr:flag:${key}`;
  const [on, setOn] = useState(() => read(key));
  useEffect(() => {
    const sync = () => setOn(read(key));
    window.addEventListener(evt, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(evt, sync); window.removeEventListener("storage", sync); };
  }, [key, evt]);
  const toggle = useCallback(() => {
    const next = !read(key);
    try { localStorage.setItem(key, next ? "1" : "0"); } catch { /* sin storage: sólo esta vista */ }
    setOn(next);
    window.dispatchEvent(new Event(evt));
  }, [key, evt]);
  return [on, toggle];
}
