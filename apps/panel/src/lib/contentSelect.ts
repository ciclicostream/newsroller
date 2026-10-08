import { useEffect, useRef, useSyncExternalStore, type MouseEvent } from "react";
import { parrilla } from "./parrilla";
import { playlist } from "./playlist";

// Selección múltiple de contenidos (Contenido → cada plantilla) y marca de los que están en la parrilla.
//  - La página llama a useContentSelect(items, load) y le pone {...sel.row(it.id)} a cada card de la lista.
//  - La barra (<ContentToolbar/>, dentro del monitor) lee este mismo estado: Seleccionar, Borrar, etc.
//  - "En parrilla" = el contenido está en la parrilla en borrador (Copiloto) o en la que está al aire.
interface State {
  selecting: boolean;
  selected: ReadonlySet<string>;
  ids: readonly string[]; // contenidos que muestra la página ahora (lo que "Todos" selecciona)
  reload: (() => unknown) | null;
  grid: ReadonlySet<string>;
}

let state: State = { selecting: false, selected: new Set(), ids: [], reload: null, grid: new Set() };
const subs = new Set<() => void>();
const set = (patch: Partial<State>) => { state = { ...state, ...patch }; subs.forEach((f) => f()); };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export const useSelectState = (): State => useSyncExternalStore(subscribe, () => state);
export const selectingNow = (): boolean => state.selecting;

export const selectActions = {
  start: () => set({ selecting: true }),
  cancel: () => set({ selecting: false, selected: new Set() }),
  all: () => set({ selected: new Set(state.ids) }),
  none: () => set({ selected: new Set() }),
  toggle: (id: string) => {
    const next = new Set(state.selected);
    if (!next.delete(id)) next.add(id);
    set({ selected: next });
  },
};

// ---- Contenidos en parrilla: se consulta mientras haya alguna página de contenido abierta ----
let gridUsers = 0;
let gridTimer: ReturnType<typeof setInterval> | undefined;
const loadGrid = () =>
  Promise.all([parrilla.list(), playlist.list()])
    .then(([draft, live]) => {
      const g = new Set<string>();
      for (const r of draft) if (r.content_type === "content_item" && r.content_id) g.add(r.content_id);
      for (const r of live) if (r.enabled && r.content_type === "content_item" && r.content_id) g.add(r.content_id);
      set({ grid: g });
    })
    .catch(() => {});
const onFocus = () => { void loadGrid(); };

function startGrid(): void {
  if (gridUsers++ > 0) return;
  void loadGrid();
  gridTimer = setInterval(loadGrid, 10_000);
  window.addEventListener("focus", onFocus);
}
function stopGrid(): void {
  if (--gridUsers > 0) return;
  clearInterval(gridTimer);
  window.removeEventListener("focus", onFocus);
}

export interface RowProps {
  "data-ingrid"?: string;
  "data-sel"?: string;
  onClickCapture?: (e: MouseEvent<HTMLDivElement>) => void;
}

export function useContentSelect(items: readonly { id: string }[], reload: () => unknown) {
  const s = useSelectState();
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  const idsKey = items.map((i) => i.id).join(",");
  useEffect(() => {
    const ids = idsKey ? idsKey.split(",") : [];
    const still = new Set(ids);
    set({ ids, reload: () => reloadRef.current(), selected: new Set([...state.selected].filter((id) => still.has(id))) });
  }, [idsKey]);

  useEffect(() => {
    startGrid();
    return () => {
      stopGrid();
      set({ ids: [], reload: null, selecting: false, selected: new Set() });
    };
  }, []);

  return {
    // Atributos de cada card de la lista: borde rojo si está en parrilla; en modo selección, tocarla la marca.
    row: (id: string): RowProps => ({
      "data-ingrid": s.grid.has(id) ? "1" : undefined,
      "data-sel": s.selecting ? (s.selected.has(id) ? "1" : "0") : undefined,
      onClickCapture: s.selecting ? (e) => { e.preventDefault(); e.stopPropagation(); selectActions.toggle(id); } : undefined,
    }),
  };
}
