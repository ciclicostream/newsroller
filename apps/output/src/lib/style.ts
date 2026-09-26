import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { DEFAULT_COLLECTION, collectionById } from "@newsroller/shared";
import { API_BASE } from "./scene";
import { P } from "./params";
import { boot } from "./boot";

// Colección de templates de este output:
//  - Suite (link con nombre): la de la suite. Si en el panel le cambian la colección, se aplica sola en el
//    próximo contenido; si le cambian qué emite, la orientación o el audio, el output se recarga.
//  - Monitor o preview del panel con `style` en la URL: esa colección, fija.
//  - Sin suite ni `style` (links viejos, monitores sin selector): la primera colección habilitada por el Master.
const valid = (s: unknown): s is string => typeof s === "string" && !!collectionById(s)?.ready;
const LINK = boot.link;
const PARAM = !LINK && valid(P.get("style")) ? P.get("style")! : null;

let current: string = LINK && valid(LINK.style) ? LINK.style! : PARAM ?? (valid(boot.defaultCollection) ? boot.defaultCollection : DEFAULT_COLLECTION);
const subs = new Set<(s: string) => void>();
let started = false;

function set(s: unknown): void {
  if (!valid(s) || s === current) return;
  current = s;
  subs.forEach((f) => f(current));
}

async function refetchLink(): Promise<void> {
  if (!LINK) return;
  const cfg = await fetch(`${API_BASE}/api/output/link/${encodeURIComponent(LINK.slug)}`).then((r) => (r.ok ? r.json() : null)).catch(() => undefined);
  if (cfg === undefined) return; // sin red: se reintenta en el próximo ciclo
  // Borraron la suite o le cambiaron algo que se aplica al arrancar: recargar (el arranque muestra el aviso si ya no existe).
  if (!cfg || cfg.target !== LINK.target || (cfg.session ?? null) !== (LINK.session ?? null) || cfg.orientation !== LINK.orientation || !!cfg.audio !== !!LINK.audio || (cfg.key ?? null) !== (LINK.key ?? null)) {
    window.location.reload();
    return;
  }
  set(cfg.style);
}

function start(): void {
  if (started || PARAM) return;
  started = true;
  const socket = io(API_BASE || undefined, { transports: ["websocket", "polling"] });
  if (LINK) {
    socket.on("link:update", (l: { slug?: string }) => { if (l?.slug === LINK.slug) void refetchLink(); });
    setInterval(() => void refetchLink(), 60_000); // respaldo por si se pierde el aviso del socket
  } else {
    const first = (d: Record<string, unknown> | null) => (Array.isArray(d?.collections) ? d!.collections[0] : undefined);
    socket.on("settings:update", (d: Record<string, unknown>) => set(first(d)));
    setInterval(() => { fetch(`${API_BASE}/api/settings`).then((r) => r.json()).then((d) => set(first(d))).catch(() => {}); }, 60_000);
  }
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
