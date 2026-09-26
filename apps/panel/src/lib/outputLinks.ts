import type { OutputLink, OutputLinkTarget } from "@newsroller/shared";
import { api } from "./api";
import { OUTPUT_BASE } from "./parrilla";

// Suites = links de salida con nombre (/output/<slug>). La configuración vive en el server.
export const outputLinksApi = {
  list: () => api.get<OutputLink[]>("/api/output-links"),
  create: (b: { slug?: string; label?: string | null; target: OutputLinkTarget; session_id?: string | null; orientation: "horizontal" | "vertical"; audio: boolean; style?: string }) =>
    api.post<OutputLink>("/api/output-links", b),
  update: (slug: string, patch: Partial<Pick<OutputLink, "label" | "orientation" | "audio" | "style">>) => api.patch<OutputLink>(`/api/output-links/${slug}`, patch),
  remove: (slug: string) => api.del<void>(`/api/output-links/${slug}`),
};

const ORIGIN = OUTPUT_BASE || (typeof window !== "undefined" ? window.location.origin : "");
export const outputLinkUrl = (slug: string) => `${ORIGIN}/output/${slug}`;
