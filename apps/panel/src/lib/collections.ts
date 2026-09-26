import { useCallback, useEffect, useState } from "react";
import { DEFAULT_COLLECTION, TEMPLATE_COLLECTIONS, activeSuiteOf, collectionById, type Suite, type TemplateCollection } from "@newsroller/shared";
import { settingsApi } from "./settings";

// Colecciones habilitadas por el Master (Ajustes → Suites).
let cache: string[] | null = null;
export function useEnabledCollections(): TemplateCollection[] {
  const [ids, setIds] = useState<string[]>(cache ?? [DEFAULT_COLLECTION]);
  useEffect(() => {
    settingsApi.get().then((s) => { const v = (s.collections ?? [DEFAULT_COLLECTION]).filter((id) => collectionById(id)?.ready); cache = v.length ? v : [DEFAULT_COLLECTION]; setIds(cache); }).catch(() => {});
  }, []);
  return ids.map((id) => collectionById(id)!).filter(Boolean);
}
export const collectionLabel = (id: string | null | undefined) => collectionById(id)?.label ?? id ?? "";
export const allCollections = TEMPLATE_COLLECTIONS;

// Colección con la que se ven los monitores de los formularios de Contenidos (se recuerda en este navegador).
const KEY = "nr.monitorCollection";
const EVT = "nr:monitor-collection";
const read = (): string => { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } };
export function useMonitorCollection(): [string, (id: string) => void] {
  const [v, setV] = useState(read);
  useEffect(() => {
    const sync = () => setV(read());
    window.addEventListener(EVT, sync);
    return () => window.removeEventListener(EVT, sync);
  }, []);
  const set = useCallback((id: string) => {
    try { localStorage.setItem(KEY, id); } catch { /* sin storage: sólo esta vista */ }
    setV(id);
    window.dispatchEvent(new Event(EVT));
  }, []);
  return [v, set];
}

// Suite activa (la que usa la salida del canal). El Programador y el Host ven sólo su nombre.
export function useActiveSuite(): Suite | null {
  const [suite, setSuite] = useState<Suite | null>(null);
  useEffect(() => {
    let on = true;
    const load = () => settingsApi.get().then((s) => { if (on) setSuite(activeSuiteOf(s)); }).catch(() => {});
    void load();
    const t = setInterval(load, 30_000);
    return () => { on = false; clearInterval(t); };
  }, []);
  return suite;
}
