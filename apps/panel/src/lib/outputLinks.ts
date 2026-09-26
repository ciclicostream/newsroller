import type { OutputLink } from "@newsroller/shared";
import { api } from "./api";
import { OUTPUT_BASE } from "./parrilla";

// Links de la salida del canal (uno horizontal y uno vertical). Usan la suite activa; se administran en Ajustes → Suites.
export const outputLinksApi = {
  list: () => api.get<OutputLink[]>("/api/output-links"),
  update: (slug: string, patch: { audio?: boolean; slug?: string }) => api.patch<OutputLink>(`/api/output-links/${slug}`, patch),
  regenerate: (slug: string) => api.post<OutputLink>(`/api/output-links/${slug}/regenerate`, {}),
};

const ORIGIN = OUTPUT_BASE || (typeof window !== "undefined" ? window.location.origin : "");
export const outputLinkUrl = (slug: string) => `${ORIGIN}/output/${slug}`;
