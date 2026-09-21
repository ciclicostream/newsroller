import { api } from "./api";

export interface BancoUsage {
  on_air: boolean;
  count: number;
  refs: Array<{ id: string; type: string; title: string; on_air: boolean }>;
}
export interface BancoItem {
  id: string;
  name: string;
  url: string;
  bucket: string;
  path: string;
  mime: string | null;
  size: number | null;
  kind: "image" | "video" | "audio" | "other";
  source: "banco" | "placa" | "importado";
  created_at: string;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  usage: BancoUsage;
}
export interface BancoList {
  ready: boolean;
  unused_days: number;
  trash_days: number;
  trash_count: number;
  items: BancoItem[];
}
export interface BancoTrashed {
  id: string;
  name: string;
  url: string;
  mime: string | null;
  size: number | null;
  kind: BancoItem["kind"];
  created_at: string;
  deleted_at: string;
  uploaded_by_name: string | null;
  deleted_by_name: string | null;
  days_left: number;
}
export interface BriefFile { id: string; name: string; refs: BancoUsage["refs"] }
export interface DeleteResult { deleted: number; blocked: BriefFile[]; skipped: BriefFile[] }

export const banco = {
  list: (sync = false) => api.get<BancoList>(`/api/banco${sync ? "?sync=1" : ""}`),
  trash: () => api.get<BancoTrashed[]>("/api/banco/trash"),
  sync: () => api.post<{ added: number }>("/api/banco/sync", {}),
  remove: (ids: string[], includeInUse: boolean) => api.post<DeleteResult>("/api/banco/delete", { ids, include_in_use: includeInUse }),
  restore: (ids: string[]) => api.post<{ restored: number }>("/api/banco/restore", { ids }),
  purge: (ids: string[]) => api.post<{ purged: number }>("/api/banco/purge", { ids }),
};

export const fmtSize = (n: number | null | undefined): string => {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
};
