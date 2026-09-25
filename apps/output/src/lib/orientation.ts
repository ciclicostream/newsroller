// Orientación del output: horizontal (1920x1080, la de siempre) o vertical (1080x1920, ?orientation=vertical).
// Es un dato de la URL: el output de OBS/vMix y los monitores del panel (iframes) eligen con el parámetro.
export const IS_VERTICAL = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("orientation") === "vertical";
export const STAGE_W = IS_VERTICAL ? 1080 : 1920;
export const STAGE_H = IS_VERTICAL ? 1920 : 1080;
export const ORIENTATION: "horizontal" | "vertical" = IS_VERTICAL ? "vertical" : "horizontal";

// Qué contenidos tienen versión vertical. Se va ampliando a medida que se aprueba el diseño de cada placa.
// Lo que no la tiene se saltea en la rotación del output vertical (cámaras: nunca; Video Full y Publicidad Full: sólo con versión vertical).
const VERTICAL_READY = new Set(["placas", "ultima_hora", "shorts", "promos", "declaraciones", "dolar", "cifras", "clima", "efemerides", "informe", "cartelera", "lista", "retro"]);
export function supportsVertical(type: string, data: Record<string, any> | null | undefined): boolean {
  if (type === "publicidad") return (data?.format ?? "vertical") === "vertical" || !!data?.vertical_url || !!data?.vertical_yt;
  if (type === "video_full") return !!data?.vertical_url || !!data?.vertical_yt;
  if (type === "shorts" && data?.count === 2 && data?.video2) return false; // 2 shorts: sin versión vertical
  return VERTICAL_READY.has(type);
}

// Estilo del lienzo escalado al viewport.
export const stageStyle = (scale: number) => ({ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` });
export const fitScale = () => Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
