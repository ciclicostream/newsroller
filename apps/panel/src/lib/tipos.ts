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
  type LucideIcon,
} from "lucide-react";

export interface TipoDef {
  type: ContentItemType;
  label: string;
  desc: string;
  Icon: LucideIcon;
  ready?: boolean; // formulario implementado
}

// Placas que el editor carga a mano (banco → parrilla → aire).
// Shorts, Cámaras y Programas tienen su propia sección (se alimentan de APIs).
export const TIPOS: TipoDef[] = [
  { type: "ultima_hora", label: "Última Hora", desc: "Placa roja de alerta con foto o video opcional", Icon: Siren, ready: true },
  { type: "placas", label: "Placas", desc: "Noticia: escrita a mano o traída de Cíclico", Icon: Newspaper, ready: true },
  { type: "dolar", label: "Dólar", desc: "Cotizaciones (API o manual)", Icon: DollarSign, ready: true },
  { type: "cifras", label: "Cifras", desc: "Dato destacado con fuente", Icon: BarChart3, ready: true },
  { type: "efemerides", label: "Efemérides", desc: "Fecha + cuerpo + imagen", Icon: CalendarDays },
  { type: "cartelera", label: "Cartelera", desc: "Estreno / obra con ficha", Icon: Clapperboard },
  { type: "declaraciones", label: "Declaraciones", desc: "Cita textual + foto", Icon: Quote },
  { type: "informe", label: "Informe Cíclico", desc: "Hasta 10 tarjetas en secuencia", Icon: ListOrdered },
  { type: "publicidad", label: "Publicidad", desc: "Full o vertical (genera reporte)", Icon: Megaphone },
  { type: "video_full", label: "Video Full", desc: "Video a pantalla completa", Icon: MonitorPlay },
  { type: "promos", label: "Promos / Avances", desc: "Pill + card + video 9:16 o 4:3", Icon: Sparkles },
  { type: "clima", label: "Clima", desc: "Pronóstico con íconos y BIG", Icon: CloudSun },
];

export const TIPO_BY_KEY: Record<string, TipoDef> = Object.fromEntries(
  TIPOS.map((t) => [t.type, t]),
);
