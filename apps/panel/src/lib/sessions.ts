import type { ContentType, PlaylistItem } from "@newsroller/shared";
import { api } from "./api";
import { OUTPUT_BASE, OUTPUT_FRAME_BASE } from "./parrilla";

export interface SessionRow {
  id: string;
  name: string;
  active: boolean;
  paused_at: string | null;
  in_parrilla: boolean; // aparece o no en "Contenidos disponibles" de Emisión (independiente de "active")
  created_at: string;
  created_by: string | null;
  item_count: number;
  total_duration_sec: number;
  manager_ids: string[];
}

// Sesiones: playlists independientes del aire, cada una con su propia URL de salida.
export const sessions = {
  list: () => api.get<SessionRow[]>("/api/sessions"),
  create: (name: string) => api.post<SessionRow>("/api/sessions", { name }),
  rename: (id: string, name: string) => api.patch<SessionRow>(`/api/sessions/${id}`, { name }),
  remove: (id: string) => api.del(`/api/sessions/${id}`),
  toggle: (id: string, active: boolean) => api.post<SessionRow>(`/api/sessions/${id}/toggle`, { active }),
  setAvailable: (id: string, available: boolean) => api.post<SessionRow>(`/api/sessions/${id}/availability`, { available }),
  managers: (id: string) => api.get<string[]>(`/api/sessions/${id}/managers`),
  setManagers: (id: string, userIds: string[]) => api.put<{ ok: boolean }>(`/api/sessions/${id}/managers`, { user_ids: userIds }),

  items: (id: string) => api.get<PlaylistItem[]>(`/api/sessions/${id}/items`),
  addItem: (id: string, b: { content_type: ContentType; content_id: string | null; template: string; duration_sec: number }) =>
    api.post<PlaylistItem>(`/api/sessions/${id}/items`, b),
  patchItem: (id: string, itemId: string, patch: Partial<Pick<PlaylistItem, "template" | "duration_sec" | "enabled" | "sort">>) =>
    api.patch<PlaylistItem>(`/api/sessions/${id}/items/${itemId}`, patch),
  removeItem: (id: string, itemId: string) => api.del(`/api/sessions/${id}/items/${itemId}`),
  reorderItems: (id: string, ids: string[]) => api.post<PlaylistItem[]>(`/api/sessions/${id}/items/reorder`, { ids }),
};

// URLs de salida de una sesión, para copiar (mismo patrón que el output principal).
export function sessionUrls(id: string) {
  const base = `${OUTPUT_BASE}/output/?session=${id}`;
  const baseFrame = `${OUTPUT_FRAME_BASE}/output/?session=${id}`;
  return { base, baseFrame };
}
