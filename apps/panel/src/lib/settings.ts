import { api } from "./api";
import type { Plataforma, MusicSettings, Suite } from "@newsroller/shared";

export interface AppSettings {
  tickerSpeed: number; // segundos por vuelta del newsticker (mayor = más lento)
  onAir: boolean; // false = corte manual, el output muestra la placa "fuera del aire"
  airSince: string; // ISO timestamp de la última publicación de la parrilla (reloj "al aire")
  idleMinutes?: Record<string, number>; // minutos de inactividad por rol (sólo lo cambia el Master)
  plataformas?: Plataforma[]; // plataformas de streaming para series (Ajustes → Plataformas)
  climaIcons?: Record<string, string>; // íconos grandes del clima cargados en Ajustes ({casillero: url})
  climaDayIcons?: Record<string, string>; // íconos chicos de los días del pronóstico ({estado: url})
  airPausedAt: string; // ISO del corte de emisión ("" = al aire); congela el reloj
  airChangedAt?: string; // ISO del último envío a vivo o corte/reanudación (lo estampa el servidor)
  music?: MusicSettings; // música de fondo continua (Ajustes → Música + toggle en el Monitor de Emisión)
  collections?: string[]; // colecciones de templates habilitadas por el Master
  suites?: Suite[]; // suites (nombre + colección)
  activeSuite?: string; // id de la suite activa: la salida del canal emite con su colección
  legacyLinks?: boolean; // false = los links viejos con variables ya no emiten
}

export const settingsApi = {
  get: () => api.get<AppSettings>("/api/settings"),
  update: (patch: Partial<AppSettings>) => api.put<AppSettings>("/api/settings", patch),
};
