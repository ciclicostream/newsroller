import type { Asset, AssetKind, Placa, Short } from "@newsroller/shared";
import { api } from "./api";
import { supabase } from "./supabase";

interface SignResponse {
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
}

// Sube un archivo directo a Storage (URL firmada) y registra la metadata.
export async function uploadAsset(kind: AssetKind, file: File): Promise<Asset> {
  const sign = await api.post<SignResponse>("/api/content/uploads/sign", {
    kind,
    filename: file.name,
  });
  const { error } = await supabase.storage.from(sign.bucket).uploadToSignedUrl(sign.path, sign.token, file);
  if (error) throw new Error(`subida a Storage: ${error.message}`);
  return api.post<Asset>("/api/content/assets", {
    kind,
    bucket: sign.bucket,
    path: sign.path,
    name: file.name,
    mime: file.type,
    size: file.size,
  });
}

export const content = {
  listAssets: (kind: AssetKind) => api.get<Asset[]>(`/api/content/assets?kind=${kind}`),
  patchAsset: (id: string, patch: Partial<Pick<Asset, "active" | "name" | "sort">>) =>
    api.patch<Asset>(`/api/content/assets/${id}`, patch),
  deleteAsset: (id: string) => api.del(`/api/content/assets/${id}`),

  listPlacas: () => api.get<Placa[]>("/api/content/placas"),
  createPlaca: (p: { title: string; body?: string; accent?: string }) => api.post<Placa>("/api/content/placas", p),
  patchPlaca: (id: string, patch: Partial<Pick<Placa, "title" | "body" | "accent" | "active" | "sort">>) =>
    api.patch<Placa>(`/api/content/placas/${id}`, patch),
  deletePlaca: (id: string) => api.del(`/api/content/placas/${id}`),

  listShorts: () => api.get<Short[]>("/api/content/shorts"),
  syncShorts: () => api.post<{ synced: number; shorts: Short[] }>("/api/content/shorts/sync", {}),
  patchShort: (id: string, patch: Partial<Pick<Short, "custom_title" | "active" | "sort">>) =>
    api.patch<Short>(`/api/content/shorts/${id}`, patch),
  deleteShort: (id: string) => api.del(`/api/content/shorts/${id}`),
};
