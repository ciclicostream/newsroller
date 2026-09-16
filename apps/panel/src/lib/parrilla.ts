import type { ContentType, PlaylistItem } from "@newsroller/shared";
import { api } from "./api";

// Parrilla en BORRADOR. Se publica al aire (playlist_items) con publish().
export const parrilla = {
  list: () => api.get<PlaylistItem[]>("/api/parrilla"),
  add: (b: { content_type: ContentType; content_id: string | null; template: string; duration_sec: number }) =>
    api.post<PlaylistItem>("/api/parrilla", b),
  patch: (id: string, patch: Partial<Pick<PlaylistItem, "template" | "duration_sec" | "enabled" | "sort">>) =>
    api.patch<PlaylistItem>(`/api/parrilla/${id}`, patch),
  remove: (id: string) => api.del(`/api/parrilla/${id}`),
  reorder: (ids: string[]) => api.post<PlaylistItem[]>("/api/parrilla/reorder", { ids }),
  publish: () => api.post<{ ok: boolean; count: number }>("/api/parrilla/publish", {}),
};

export const OUTPUT_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
