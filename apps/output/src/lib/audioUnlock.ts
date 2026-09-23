import { useEffect, useState } from "react";

const WANT_AUDIO = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("audio");

// Con ?audio=1 en un navegador común (PC/celular) el autoplay con sonido está bloqueado hasta que la
// persona toca la página. En vMix/OBS el autoplay ya está permitido, así que ahí nunca queda "locked"
// y no se muestra nada al aire. `unlocked` cambia al primer toque, para que quien dependa de él reintente el play().
export function useAudioUnlock() {
  const [locked, setLocked] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (!WANT_AUDIO || window.parent !== window) return; // embebido en el panel: el iframe ya tiene permiso
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    if (ctx.state === "suspended") setLocked(true);
    ctx.close().catch(() => {});
  }, []);

  const unlock = () => {
    document.querySelectorAll<HTMLMediaElement>("audio, video").forEach((el) => {
      if (el.autoplay && el.paused) el.play().catch(() => {});
    });
    setLocked(false);
    setUnlocked(true);
  };

  return { locked, unlocked, unlock };
}
