// Parámetros del output. Pueden venir de la URL (monitores del panel, demos) o de un link con nombre
// (/output/<slug>): en ese caso la configuración la trae el server y se mezcla acá ANTES de cargar la app,
// porque varias templates leen estos valores al importarse (orientación, audio).
export const P = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");

// Nombre del link en la ruta: /output/ciclico2026 → "ciclico2026". Vacío en /output/ o /output/?…
export function slugFromPath(): string {
  if (typeof window === "undefined") return "";
  const base = (import.meta.env.BASE_URL as string) || "/";
  const rest = window.location.pathname.startsWith(base) ? window.location.pathname.slice(base.length) : "";
  const slug = decodeURIComponent(rest.replace(/\/+$/, "")).toLowerCase();
  return slug && slug !== "index.html" && !slug.includes("/") ? slug : "";
}

export interface LinkConfig {
  target: "emision" | "sesion" | "stream";
  session?: string | null;
  key?: string | null;
  orientation: "horizontal" | "vertical";
  audio: boolean;
  style?: string | null;
}

// Vuelca la configuración de un link con nombre sobre P, con los mismos nombres que usan los links viejos.
export function applyLinkConfig(c: LinkConfig): void {
  if (c.orientation === "vertical") P.set("orientation", "vertical");
  if (c.audio) P.set("audio", "1");
  if (c.style) P.set("style", c.style);
  if (c.target === "sesion" && c.session) P.set("session", c.session);
  if (c.target === "stream" && c.key) { P.set("radio", "1"); P.set("key", c.key); }
  P.set("link", "1"); // abierto por link con nombre (no es un link viejo)
}
