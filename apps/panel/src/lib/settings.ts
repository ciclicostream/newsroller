import { api } from "./api";

export interface AppSettings {
  tickerSpeed: number; // segundos por vuelta del newsticker (mayor = más lento)
}

export const settingsApi = {
  get: () => api.get<AppSettings>("/api/settings"),
  update: (patch: Partial<AppSettings>) => api.put<AppSettings>("/api/settings", patch),
};
