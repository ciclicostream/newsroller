import type { ContentType, PlaylistItem } from "@newsroller/shared";
import { api } from "./api";

export const playlist = {
  list: () => api.get<PlaylistItem[]>("/api/playlist"),
  add: (b: { content_type: ContentType; content_id: string | null; template: string; duration_sec: number }) =>
    api.post<PlaylistItem>("/api/playlist", b),
  patch: (id: string, patch: Partial<Pick<PlaylistItem, "template" | "duration_sec" | "enabled" | "sort">>) =>
    api.patch<PlaylistItem>(`/api/playlist/${id}`, patch),
  remove: (id: string) => api.del(`/api/playlist/${id}`),
  reorder: (ids: string[]) => api.post<PlaylistItem[]>("/api/playlist/reorder", { ids }),
};
