import { useEffect, useRef } from "react";

// El atributo HTML `autoPlay` solo no alcanza en el browser de vMix: a diferencia de OBS,
// a veces deja el video congelado en el primer fotograma. Forzamos play() por JS al montar
// y reintentamos unas veces si el navegador lo frena (buffer, foco, lo que sea) — no cambia
// nada en OBS, donde el autoplay ya andaba, y arregla el freeze en vMix.
export function useForcePlay<T extends HTMLMediaElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tryPlay = () => {
      if (!el.isConnected || !el.paused) return;
      el.play().catch(() => { if (tries++ < 8) timer = setTimeout(tryPlay, 250); });
    };
    tryPlay();
    el.addEventListener("loadeddata", tryPlay);
    el.addEventListener("canplay", tryPlay);
    return () => {
      clearTimeout(timer);
      el.removeEventListener("loadeddata", tryPlay);
      el.removeEventListener("canplay", tryPlay);
    };
  }, []);
  return ref;
}
