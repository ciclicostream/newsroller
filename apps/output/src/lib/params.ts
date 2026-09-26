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

// Link del canal (/output/<slug>): orientación, audio y la clave de Stream (para pasar a Stream cuando el Host
// transmite). La colección no viene acá: es la de la suite activa.
export interface LinkConfig {
  orientation: "horizontal" | "vertical";
  audio: boolean;
  key?: string | null;
}

// Vuelca la configuración del link sobre P, con los mismos nombres que usan los links viejos.
// `?mute` (monitores del panel) gana sobre el audio del link: el monitor AIRE no debe sonar en el panel.
export function applyLinkConfig(c: LinkConfig): void {
  if (c.orientation === "vertical") P.set("orientation", "vertical");
  if (c.audio && !P.has("mute")) P.set("audio", "1");
  if (c.key) P.set("key", c.key);
  P.set("canal", "1"); // salida del canal: Copiloto, o Stream mientras el Host transmite
}
