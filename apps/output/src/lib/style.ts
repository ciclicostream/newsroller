import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { DEFAULT_COLLECTION, collectionById } from "@newsroller/shared";
import { API_BASE } from "./scene";
import { P } from "./params";
import { boot } from "./boot";

// Colección de templates activa. Si el link la fija (link con nombre o `style` en la URL de un monitor), queda fija;
// si no, sigue Ajustes → Estilos y cambia en vivo (el próximo contenido ya sale con la nueva).
const FIXED = collectionById(P.get("style")) ? P.get("style")! : null;
const valid = (s: unknown): s is string => typeof s === "string" && !!collectionById(s)?.ready;

let current: string = FIXED ?? (valid(boot.style) ? boot.style : DEFAULT_COLLECTION);
const subs = new Set<(s: string) => void>();
let started = false;

function set(s: unknown): void {
  if (!valid(s) || s === current) return;
  current = s;
  subs.forEach((f) => f(current));
}

function start(): void {
  if (started || FIXED) return;
  started = true;
  const load = () => fetch(`${API_BASE}/api/settings`).then((r) => r.json()).then((d) => set(d?.style)).catch(() => {});
  setInterval(load, 60_000); // respaldo por si se pierde el aviso del socket
  const socket = io(API_BASE || undefined, { transports: ["websocket", "polling"] });
  socket.on("settings:update", (d: Record<string, unknown>) => set(d?.style));
}

export const currentStyle = (): string => current;

export function useStyle(): string {
  const [s, setS] = useState(current);
  useEffect(() => {
    if (FIXED) return;
    start();
    subs.add(setS);
    setS(current);
    return () => { subs.delete(setS); };
  }, []);
  return s;
}
