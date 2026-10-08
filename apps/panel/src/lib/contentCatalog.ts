import type React from "react";
import { AlertTriangle, TrendingUp, Newspaper, Megaphone, Video, ListMusic, Theater, LayoutGrid } from "lucide-react";
import type { ContentItem, Camera } from "@newsroller/shared";
import { DOLAR_CASAS } from "@newsroller/shared";
import { TIPO_BY_KEY } from "./tipos";

// Catálogo de tipos de contenido: usado por Programación (Emisión) y por el editor de Sesiones,
// para que "Contenidos disponibles" y la lista ordenada se vean y funcionen exactamente igual en las dos.
// Categorías por la FUNCIÓN del contenido en el aire (no por cómo se carga). Cada una tiene un color: el mismo se usa en "Contenidos
// disponibles", en la parrilla, en Stream y en el submenú de Contenido, para reconocer de un vistazo qué es cada cosa.
export const TYPE_CAT: Record<string, string> = {
  ultima_hora: "urgente", obituario: "urgente",
  placas: "noticias", declaraciones: "noticias", informe: "noticias", lista: "noticias",
  dolar: "datos", clima: "datos", cifras: "datos", elecciones: "datos",
  efemerides: "cultura", retro: "cultura", cartelera: "cultura", musica: "cultura",
  video_full: "video", shorts: "video", camaras: "video",
  publicidad: "publicidad", promos: "publicidad",
};
export const TYPE_LABEL: Record<string, string> = {
  ultima_hora: "Última Hora", obituario: "Obituario", placas: "Placa", dolar: "Dólar", cifras: "Cifras", clima: "Clima", elecciones: "Elecciones",
  efemerides: "Efemérides", cartelera: "Cartelera", declaraciones: "Declaraciones", informe: "Informe", lista: "Lista", retro: "Retro",
  publicidad: "Publicidad", promos: "Promo", video_full: "Video", musica: "Música", shorts: "Shorts", camaras: "Cámara",
};
export const CAT: Record<string, { label: string; color: string; Icon: any }> = {
  urgente: { label: "Urgente", color: "#EE220C", Icon: AlertTriangle },
  noticias: { label: "Noticias", color: "#2f6bff", Icon: Newspaper },
  datos: { label: "Datos", color: "#0ea5a3", Icon: TrendingUp },
  cultura: { label: "Cultura", color: "#d6409f", Icon: Theater },
  video: { label: "Video", color: "#8b5cf6", Icon: Video },
  publicidad: { label: "Publicidad", color: "#e08a1e", Icon: Megaphone },
  sesion: { label: "Sesiones", color: "#5b6678", Icon: ListMusic },
  otros: { label: "Otros", color: "#5b6678", Icon: LayoutGrid },
};
export const CAT_ORDER = ["urgente", "noticias", "datos", "cultura", "video", "publicidad", "sesion"];
// Ícono y color de una Sesión embebida como contenido (no es un tipo del banco: no tiene fila en CAT_ICON).
export const SESSION_ICON = ListMusic;
export const SESSION_COLOR = CAT.sesion!.color;
// Un tipo que falta en TYPE_CAT cae en "Otros" (visible), no escondido dentro de otra categoría.
export const catOf = (t: string) => TYPE_CAT[t] || "otros";
// Ícono de cada tipo: el mismo que tiene su botón en Contenido (si no, el de su categoría).
export const iconOf = (t: string): any => TIPO_BY_KEY[t]?.Icon ?? CAT[catOf(t)]!.Icon;
// Ícono de cada categoría del filtro: el de su tipo principal en Contenido.
export const CAT_ICON: Record<string, any> = {
  urgente: TIPO_BY_KEY.ultima_hora!.Icon, noticias: TIPO_BY_KEY.placas!.Icon, datos: TIPO_BY_KEY.dolar!.Icon,
  cultura: TIPO_BY_KEY.efemerides!.Icon, video: TIPO_BY_KEY.video_full!.Icon, publicidad: TIPO_BY_KEY.publicidad!.Icon,
  sesion: ListMusic, otros: LayoutGrid,
};
// Variable CSS con el color de la categoría: los fondos suaves (`.pv-tint`, `.tpl-grp`) se calculan a partir de ella.
export const catVar = (k: string) => ({ ["--cc" as string]: (CAT[k] ?? CAT.otros!).color }) as React.CSSProperties;

export interface TextCtx { cams: Map<string, Camera>; yt: Record<string, string> }
export const fileName = (u: string) => { try { return decodeURIComponent(u.split("?")[0]!.split("/").pop() || ""); } catch { return u; } };

// Referencia corta de un contenido (lo que se ve en chips y filas de la lista ordenada).
export function itemText(ci: ContentItem, ctx: TextCtx): string {
  const d: any = ci.data || {};
  const fallback = TYPE_LABEL[ci.type] || ci.type || "";
  switch (ci.type) {
    case "clima": return d.city ? String(d.city) : fallback;
    case "camaras": {
      const cam = ctx.cams.get(d.camera_id);
      const name = cam?.name ?? "(cámara eliminada)";
      return d.location ? `${name} · ${d.location}` : name;
    }
    case "video_full": {
      if (d.title) return String(d.title);
      if (d.media_kind === "youtube") return d.title || ctx.yt[d.media_url] || `YouTube · ${d.media_url}`;
      return d.media_url ? fileName(d.media_url) : fallback;
    }
    case "elecciones": return d.title ? String(d.title) : `${d.country ?? ""} ${d.year ?? ""}`.trim() || fallback;
    case "lista": case "retro": return d.title ? String(d.title) : fallback;
    case "musica": return (d.title ? `${d.title}${d.album ? " · " + d.album : ""}` : fallback).toString();
    case "obituario": return d.name ? String(d.name) : fallback;
    case "publicidad": return d.title ? String(d.title) : d.media_url ? fileName(d.media_url) : fallback;
    case "cifras": return (d.subtitle || d.value || fallback).toString();
    case "declaraciones": return (d.name ? `${d.name}${d.headline ? " · " + d.headline : ""}` : fallback).toString();
    case "dolar": return Array.isArray(d.casas) ? `Dólar · ${d.casas.map((c: string) => DOLAR_CASAS[c] ?? c).join(", ")}` : fallback;
  }
  return (d.text || d.title || d.subt || d.name || fallback).toString();
}
