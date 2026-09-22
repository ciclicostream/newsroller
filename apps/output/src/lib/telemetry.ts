import { API_BASE } from "./scene";

// Registros para los reportes. Sólo cuentan cuando el output corre "de verdad" (OBS/vMix): dentro de un
// iframe (monitor del panel), en vistas previas o en el Monitor con la parrilla BORRADOR (?borrador=1,
// que todavía no salió al aire) no se registra nada, para no inflar los números.
export const isLiveOutput = (): boolean =>
  typeof window !== "undefined" &&
  window.parent === window &&
  !new URLSearchParams(window.location.search).has("borrador");

const post = (path: string, body: unknown) =>
  fetch(`${API_BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true }).catch(() => {});

export function reportAiring(contentItemId: string, contentType: string, durationSec: number, orientation: "horizontal" | "vertical" = "horizontal", sessionId?: string | null) {
  if (!isLiveOutput()) return;
  void post("/api/output/airing", { content_item_id: contentItemId, content_type: contentType, duration_sec: durationSec, orientation, ...(sessionId ? { session_id: sessionId } : {}) });
}

// Un mismo problema se avisa como mucho una vez cada 5 minutos desde este output (el server además lo agrupa).
const sent = new Map<string, number>();
export function reportIncident(i: { kind: "camara" | "media"; key: string; label?: string; detail?: string; item_id?: string }) {
  if (!isLiveOutput()) return;
  const k = `${i.kind}:${i.key}`;
  const now = Date.now();
  if (now - (sent.get(k) ?? 0) < 5 * 60_000) return;
  sent.set(k, now);
  void post("/api/output/incident", i);
}
