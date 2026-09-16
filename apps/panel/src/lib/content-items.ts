import type { ContentItem, ContentItemType } from "@newsroller/shared";
import { api } from "./api";

export const contentItems = {
  list: (type?: ContentItemType) =>
    api.get<ContentItem[]>(`/api/content-items${type ? `?type=${type}` : ""}`),
  create: (c: { type: ContentItemType; data: Record<string, any>; duration_sec: number }) =>
    api.post<ContentItem>("/api/content-items", c),
  patch: (id: string, patch: Partial<Pick<ContentItem, "data" | "duration_sec" | "active" | "in_parrilla" | "sort">>) =>
    api.patch<ContentItem>(`/api/content-items/${id}`, patch),
  remove: (id: string) => api.del(`/api/content-items/${id}`),
};
