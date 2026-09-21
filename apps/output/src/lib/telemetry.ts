import { API_BASE } from "./scene";

// Registros para los reportes. Sólo cuentan cuando el output corre "de verdad" (OBS/vMix): dentro de un
// iframe (monitor del panel) o en vistas previas no se registra nada, para no inflar los números.
export const isLiveOutput = (): boolean => typeof window !== "undefined" && window.parent === window;

const post = (path: string, body: unknown) =>
  fetch(`${API_BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true }).catch(() => {});

export function reportAiring(contentItemId: string, contentType: string, durationSec: number, orientation: "horizontal" | "vertical" = "horizontal") {
  if (!isLiveOutput()) return;
  void post("/api/output/airing", { content_item_id: contentItemId, content_type: contentType, duration_sec: durationSec, orientation });
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
