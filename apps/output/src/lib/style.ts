import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { DEFAULT_COLLECTION, activeSuiteOf, collectionById } from "@newsroller/shared";
import { API_BASE } from "./scene";
import { P } from "./params";
import { boot } from "./boot";

// Colección de templates de este output:
//  - Por defecto, la de la SUITE ACTIVA (Ajustes → Suites). Si el Admin activa otra suite o le cambia la colección,
//    el cambio entra en el próximo contenido (ver collections/index.tsx), sin recargar.
//  - Vista previa de un formulario con `style` en la URL: esa colección, fija.
// Además, si es un link del canal y en el panel le cambian el audio, el nombre o lo regeneran, el output se recarga
// (con el nombre viejo muestra el aviso de link inexistente).
const valid = (s: unknown): s is string => typeof s === "string" && !!collectionById(s)?.ready;
const LINK = boot.link;
// Las vistas previas pueden pedir una colección todavía en preparación (para revisarla antes de habilitarla).
const PARAM = collectionById(P.get("style")) ? P.get("style")! : null;

let current: string = PARAM ?? (valid(boot.defaultCollection) ? boot.defaultCollection : DEFAULT_COLLECTION);
const subs = new Set<(s: string) => void>();
let started = false;

function set(s: unknown): void {
  if (!valid(s) || s === current) return;
  current = s;
  subs.forEach((f) => f(current));
}
const fromSettings = (d: Record<string, unknown> | null | undefined) => (d ? activeSuiteOf(d).style : undefined);

async function refetchLink(): Promise<void> {
  if (!LINK) return;
  const cfg = await fetch(`${API_BASE}/api/output/link/${encodeURIComponent(LINK.slug)}`).then((r) => (r.ok ? r.json() : null)).catch(() => undefined);
  if (cfg === undefined) return; // sin red: se reintenta en el próximo ciclo
  if (!cfg || cfg.orientation !== LINK.orientation || !!cfg.audio !== !!LINK.audio) window.location.reload();
}

function start(): void {
  if (started || PARAM) return;
  started = true;
  const socket = io(API_BASE || undefined, { transports: ["websocket", "polling"] });
  socket.on("settings:update", (d: Record<string, unknown>) => set(fromSettings(d)));
  if (LINK) socket.on("link:update", (l: { slug?: string }) => { if (l?.slug === LINK.slug) void refetchLink(); });
  // Respaldo por si se pierde algún aviso del socket (en OBS el websocket no siempre se sostiene).
  setInterval(() => {
    fetch(`${API_BASE}/api/settings`).then((r) => r.json()).then((d) => set(fromSettings(d))).catch(() => {});
    void refetchLink();
  }, 60_000);
}

export const currentStyle = (): string => current;

export function useStyle(): string {
  const [s, setS] = useState(current);
  useEffect(() => {
    if (PARAM) return;
    start();
    subs.add(setS);
    setS(current);
    return () => { subs.delete(setS); };
  }, []);
  return s;
}
