import { useCallback, useEffect, useState } from "react";
import type { OutputLink, OutputLinkTarget } from "@newsroller/shared";
import { outputLinksApi } from "./outputLinks";

// Aviso entre componentes: el Generador de links creó, editó o borró una suite.
export const SUITES_EVT = "nr:suites-changed";
export const notifySuitesChanged = () => window.dispatchEvent(new Event(SUITES_EVT));

// Suites de un destino y la que el monitor está mostrando (se recuerda en este navegador).
export function useOperatingSuite(target: OutputLinkTarget): { suites: OutputLink[]; suite: OutputLink | null; pick: (slug: string) => void } {
  const key = `nr.suite.${target}`;
  const [suites, setSuites] = useState<OutputLink[]>([]);
  const [slug, setSlug] = useState<string>(() => { try { return localStorage.getItem(key) || ""; } catch { return ""; } });
  useEffect(() => {
    const load = () => outputLinksApi.list().then((all) => setSuites(all.filter((l) => l.target === target))).catch(() => setSuites([]));
    void load();
    window.addEventListener(SUITES_EVT, load);
    return () => window.removeEventListener(SUITES_EVT, load);
  }, [target]);
  const pick = useCallback((s: string) => { try { localStorage.setItem(key, s); } catch { /* sólo esta vista */ } setSlug(s); }, [key]);
  const suite = suites.find((l) => l.slug === slug) ?? suites[0] ?? null;
  return { suites, suite, pick };
}
