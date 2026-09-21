import { api } from "./api";

export interface AppSettings {
  tickerSpeed: number; // segundos por vuelta del newsticker (mayor = más lento)
  onAir: boolean; // false = corte manual, el output muestra la placa "fuera del aire"
  airSince: string; // ISO timestamp de la última publicación de la parrilla (reloj "al aire")
  climaIcons?: Record<string, string>; // íconos BIG del clima cargados en Ajustes ({slot: url})
  airPausedAt: string; // ISO del corte de emisión ("" = al aire); congela el reloj
}

export const settingsApi = {
  get: () => api.get<AppSettings>("/api/settings"),
  update: (patch: Partial<AppSettings>) => api.put<AppSettings>("/api/settings", patch),
};
