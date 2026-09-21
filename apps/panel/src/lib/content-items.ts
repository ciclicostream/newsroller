import type { ContentItem, ContentItemType } from "@newsroller/shared";
import { api } from "./api";
import { toast } from "./toast";

export interface TrashedItem extends ContentItem {
  deleted_at: string;
  deleted_by_name: string | null;
  created_by_name: string | null;
  days_left: number;
}

export const contentItems = {
  list: (type?: ContentItemType) =>
    api.get<ContentItem[]>(`/api/content-items${type ? `?type=${type}` : ""}`),
  create: (c: { type: ContentItemType; data: Record<string, any>; duration_sec: number }) =>
    api.post<ContentItem>("/api/content-items", c),
  patch: (id: string, patch: Partial<Pick<ContentItem, "data" | "duration_sec" | "active" | "in_parrilla" | "sort">>) =>
    api.patch<ContentItem>(`/api/content-items/${id}`, patch),
  // Borrar = a la papelera (30 días). Un contenido al aire no se puede borrar: el servidor lo rechaza y se avisa.
  remove: async (id: string): Promise<boolean> => {
    try {
      await api.del(`/api/content-items/${id}`);
      toast("Enviado a la papelera. Se conserva 30 días.", "ok");
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : "no se pudo borrar", "error");
      return false;
    }
  },
  trash: () => api.get<TrashedItem[]>("/api/content-items/trash"),
  restore: (id: string) => api.post<ContentItem>(`/api/content-items/${id}/restore`, {}),
  purge: (id: string) => api.del(`/api/content-items/${id}/purge`),
};
