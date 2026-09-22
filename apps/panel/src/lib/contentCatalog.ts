import { AlertTriangle, TrendingUp, Newspaper, Megaphone, Video, ListMusic } from "lucide-react";
import type { ContentItem, Camera } from "@newsroller/shared";
import { DOLAR_CASAS } from "@newsroller/shared";
import { TIPO_BY_KEY } from "./tipos";

// Catálogo de tipos de contenido: usado por Programación (Emisión) y por el editor de Sesiones,
// para que "Contenidos disponibles" y la lista ordenada se vean y funcionen exactamente igual en las dos.
export const TYPE_CAT: Record<string, string> = {
  ultima_hora: "ultima", dolar: "datos", cifras: "datos", clima: "datos",
  efemerides: "editorial", cartelera: "editorial", declaraciones: "editorial", informe: "editorial",
  publicidad: "media", promos: "media", video_full: "media", shorts: "media", camaras: "camaras",
};
export const TYPE_LABEL: Record<string, string> = {
  ultima_hora: "Última Hora", dolar: "Dólar", cifras: "Cifras", clima: "Clima",
  efemerides: "Efemérides", cartelera: "Cartelera", declaraciones: "Declaraciones", informe: "Informe",
  publicidad: "Publicidad", promos: "Promo", video_full: "Video", shorts: "Shorts", camaras: "Cámara",
};
export const CAT: Record<string, { label: string; color: string; Icon: any }> = {
  ultima: { label: "Última Hora", color: "#EE220C", Icon: AlertTriangle },
  datos: { label: "Datos", color: "#0ea5a3", Icon: TrendingUp },
  editorial: { label: "Editorial", color: "#2f6bff", Icon: Newspaper },
  media: { label: "Media", color: "#8b5cf6", Icon: Megaphone },
  camaras: { label: "Cámaras", color: "#e08a1e", Icon: Video },
  sesion: { label: "Sesiones", color: "#0891b2", Icon: ListMusic },
};
export const CAT_ORDER = ["ultima", "datos", "editorial", "media", "camaras", "sesion"];
// Ícono y color de una Sesión embebida como contenido (no es un tipo del banco: no tiene fila en CAT_ICON).
export const SESSION_ICON = ListMusic;
export const SESSION_COLOR = CAT.sesion!.color;
export const catOf = (t: string) => TYPE_CAT[t] || "media";
// Ícono de cada tipo: el mismo que tiene su botón en Contenido (si no, el de su categoría).
export const iconOf = (t: string): any => TIPO_BY_KEY[t]?.Icon ?? CAT[catOf(t)]!.Icon;
// Ícono de cada categoría del filtro: el de su tipo principal en Contenido.
export const CAT_ICON: Record<string, any> = {
  ultima: TIPO_BY_KEY.ultima_hora!.Icon, datos: TIPO_BY_KEY.dolar!.Icon, editorial: TIPO_BY_KEY.placas!.Icon,
  media: TIPO_BY_KEY.video_full!.Icon, camaras: TIPO_BY_KEY.camaras!.Icon, sesion: ListMusic,
};

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
    case "publicidad": return d.title ? String(d.title) : d.media_url ? fileName(d.media_url) : fallback;
    case "cifras": return (d.subtitle || d.value || fallback).toString();
    case "declaraciones": return (d.name ? `${d.name}${d.headline ? " · " + d.headline : ""}` : fallback).toString();
    case "dolar": return Array.isArray(d.casas) ? `Dólar · ${d.casas.map((c: string) => DOLAR_CASAS[c] ?? c).join(", ")}` : fallback;
  }
  return (d.text || d.title || d.subt || d.name || fallback).toString();
}
