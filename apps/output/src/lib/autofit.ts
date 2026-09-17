import { useLayoutEffect, type RefObject } from "react";

// Achica la fuente de un elemento hasta que entre en su alto disponible.
// Compartido por las placas con texto de largo variable (Placas, Efemérides, ...).
export function useAutoFit(ref: RefObject<HTMLElement>, base: number, min: number, deps: unknown[]): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let px = base;
    el.style.fontSize = px + "px";
    let guard = 0;
    while (el.scrollHeight > el.clientHeight && px > min && guard++ < 50) {
      px -= 2;
      el.style.fontSize = px + "px";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
