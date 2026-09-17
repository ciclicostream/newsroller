import { api } from "./api";

export interface AppSettings {
  tickerSpeed: number; // segundos por vuelta del newsticker (mayor = más lento)
  onAir: boolean; // false = corte manual, el output muestra la placa "fuera del aire"
}

export const settingsApi = {
  get: () => api.get<AppSettings>("/api/settings"),
  update: (patch: Partial<AppSettings>) => api.put<AppSettings>("/api/settings", patch),
};
