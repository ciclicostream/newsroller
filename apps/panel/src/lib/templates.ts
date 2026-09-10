import type { Template } from "@newsroller/shared";
import { api } from "./api";

export const templatesApi = {
  list: () => api.get<Template[]>("/api/templates"),
  get: (id: string) => api.get<Template>(`/api/templates/${id}`),
  create: (t: Partial<Template>) => api.post<Template>("/api/templates", t),
  update: (id: string, t: Partial<Template>) => api.put<Template>(`/api/templates/${id}`, t),
  remove: (id: string) => api.del(`/api/templates/${id}`),
};
