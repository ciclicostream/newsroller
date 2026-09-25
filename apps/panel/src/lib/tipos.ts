import type { ContentItemType } from "@newsroller/shared";
import {
  Siren,
  DollarSign,
  BarChart3,
  CalendarDays,
  Clapperboard,
  Quote,
  ListOrdered,
  Megaphone,
  MonitorPlay,
  Sparkles,
  CloudSun,
  Newspaper,
  Youtube,
  Video,
  ListChecks,
  Tv,
  type LucideIcon,
} from "lucide-react";

export interface TipoDef {
  type: ContentItemType;
  label: string;
  desc: string;
  Icon: LucideIcon;
  ready?: boolean; // formulario implementado
  hidden?: boolean; // no tiene card propia en el submenú (vive dentro de otra, ej. Lista dentro de Informes)
}

// Placas que el editor carga a mano (banco → parrilla → aire).
// Programas tiene su propia sección (se alimenta de la API de YouTube por hashtag).
export const TIPOS: TipoDef[] = [
  { type: "ultima_hora", label: "Última Hora", desc: "Placa roja de alerta con foto o video opcional", Icon: Siren, ready: true },
  { type: "placas", label: "Placas", desc: "Noticia: escrita a mano o traída de Cíclico", Icon: Newspaper, ready: true },
  { type: "dolar", label: "Dólar", desc: "Cotizaciones (API o manual)", Icon: DollarSign, ready: true },
  { type: "cifras", label: "Cifras", desc: "Dato destacado con fuente", Icon: BarChart3, ready: true },
  { type: "efemerides", label: "Efemérides", desc: "Un día como hoy, o Retro", Icon: CalendarDays, ready: true },
  { type: "cartelera", label: "Cartelera", desc: "Estreno / obra con ficha", Icon: Clapperboard, ready: true },
  { type: "declaraciones", label: "Declaraciones", desc: "Cita textual + foto", Icon: Quote, ready: true },
  { type: "shorts", label: "Shorts", desc: "1 o 2 shorts verticales del canal", Icon: Youtube, ready: true },
  { type: "informe", label: "Informes", desc: "Carrusel de slides o lista con foco", Icon: ListOrdered, ready: true },
  { type: "lista", label: "Lista", desc: "Lista con foco (dentro de Informes)", Icon: ListChecks, ready: true, hidden: true },
  { type: "retro", label: "Retro", desc: "Programa viejo con imagen o video (dentro de Efemérides)", Icon: Tv, ready: true, hidden: true },
  { type: "publicidad", label: "Publicidad", desc: "Full o vertical (genera reporte)", Icon: Megaphone, ready: true },
  { type: "video_full", label: "Video Full", desc: "Video a pantalla completa", Icon: MonitorPlay, ready: true },
  { type: "promos", label: "Promos / Avances", desc: "Pill + card + video 9:16 o 4:3", Icon: Sparkles, ready: true },
  { type: "camaras", label: "Cámaras", desc: "Cámara en vivo + avisos rotativos", Icon: Video, ready: true },
  { type: "clima", label: "Clima", desc: "Pronóstico con íconos y BIG", Icon: CloudSun, ready: true },
];

// Tipos que viven dentro de la card de otro en el submenú de Contenido (hijo → card).
export const CARD_OF: Record<string, string> = { lista: "informe", retro: "efemerides" };

export const TIPO_BY_KEY: Record<string, TipoDef> = Object.fromEntries(
  TIPOS.map((t) => [t.type, t]),
);
