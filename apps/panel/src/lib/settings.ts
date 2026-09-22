import { api } from "./api";
import type { Plataforma, MusicSettings } from "@newsroller/shared";

export interface AppSettings {
  tickerSpeed: number; // segundos por vuelta del newsticker (mayor = más lento)
  onAir: boolean; // false = corte manual, el output muestra la placa "fuera del aire"
  airSince: string; // ISO timestamp de la última publicación de la parrilla (reloj "al aire")
  idleMinutes?: Record<string, number>; // minutos de inactividad por rol (sólo lo cambia el Master)
  plataformas?: Plataforma[]; // plataformas de streaming para series (Ajustes → Plataformas)
  climaIcons?: Record<string, string>; // íconos BIG del clima cargados en Ajustes ({slot: url})
  airPausedAt: string; // ISO del corte de emisión ("" = al aire); congela el reloj
  music?: MusicSettings; // música de fondo continua (Ajustes → Música + toggle en el Monitor de Emisión)
}

export const settingsApi = {
  get: () => api.get<AppSettings>("/api/settings"),
  update: (patch: Partial<AppSettings>) => api.put<AppSettings>("/api/settings", patch),
};
