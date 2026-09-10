import type { Camera, CameraType } from "@newsroller/shared";
import { api } from "./api";

export interface WindyHit {
  webcamId: number;
  title: string;
  city: string;
  preview: string;
}

export const camerasApi = {
  list: () => api.get<Camera[]>("/api/content/cameras"),
  create: (c: { name: string; city?: string; type: CameraType; url: string }) =>
    api.post<Camera>("/api/content/cameras", c),
  patch: (id: string, patch: Partial<Pick<Camera, "name" | "city" | "type" | "url" | "active" | "sort">>) =>
    api.patch<Camera>(`/api/content/cameras/${id}`, patch),
  remove: (id: string) => api.del(`/api/content/cameras/${id}`),
  windy: (city: string) => api.get<{ city: string; cameras: WindyHit[] }>(`/api/content/windy?city=${encodeURIComponent(city)}`),
};

// Extrae el ID de video de una URL de YouTube (live, watch, youtu.be) o lo devuelve tal cual.
export function youtubeId(input: string): string {
  const s = input.trim();
  const m =
    s.match(/[?&]v=([\w-]{11})/) ||
    s.match(/youtu\.be\/([\w-]{11})/) ||
    s.match(/youtube\.com\/live\/([\w-]{11})/) ||
    s.match(/youtube\.com\/embed\/([\w-]{11})/) ||
    s.match(/shorts\/([\w-]{11})/);
  return m ? m[1] : s;
}
