export interface Logo {
  url: string;
  name: string | null;
}
export interface Background {
  url: string;
  mime: string | null;
}
export interface Block {
  id: string;
  template: string;
  duration_sec: number;
  content_type: string;
  short?: { videoId: string; title: string; thumb: string | null };
  placa?: { title: string; body: string | null; accent: string | null; image_url?: string | null; image_fit?: string | null };
  media?: { url: string; mime: string | null };
  data?: { source: string };
  tpl?: {
    id: string;
    name: string;
    background: { type: "image" | "gradient" | "color"; value: string };
    elements: TemplateElement[];
  };
}

export interface TemplateElement {
  id: string;
  type: "text" | "image" | "video" | "weather" | "data" | "logo" | "shape";
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  props: Record<string, any>;
}
export interface Scene {
  background: Background | null;
  logos: Logo[];
  items: Block[];
  data: Record<string, any>;
  updatedAt: string;
}

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export async function fetchScene(): Promise<Scene> {
  const res = await fetch(`${API_BASE}/api/output/scene`);
  if (!res.ok) throw new Error(`scene HTTP ${res.status}`);
  return res.json();
}

// Traduce un bloque de datos a algo mostrable.
export interface DataView {
  title: string;
  rows: { label: string; value: string }[];
}
export function dataView(source: string, data: Record<string, any>): DataView | null {
  const n = (v: any) => (typeof v === "number" ? v.toLocaleString("es-AR") : v);
  if (source === "dolar") {
    const casas: any[] = data.dolar?.casas ?? [];
    const get = (c: string) => casas.find((x) => x.casa === c)?.venta;
    return {
      title: "Dólar",
      rows: [
        { label: "Oficial", value: `$${n(get("oficial")) ?? "-"}` },
        { label: "Blue", value: `$${n(get("blue")) ?? "-"}` },
        { label: "MEP", value: `$${n(get("bolsa")) ?? "-"}` },
      ],
    };
  }
  if (source === "cammesa") {
    const c = data.cammesa ?? {};
    return {
      title: "Demanda eléctrica · SADI",
      rows: [
        { label: "Ahora", value: c.demActual != null ? `${n(c.demActual)} MW` : "-" },
        { label: "Previsto", value: c.demPrevista != null ? `${n(c.demPrevista)} MW` : "-" },
        { label: "Temp.", value: c.temp != null ? `${c.temp}°` : "-" },
      ],
    };
  }
  // Series de datos.gob.ar (ipc, salarios, energia, petroleo)
  const series: any[] = data.datosgob?.series ?? [];
  const s = series.find((x) => x.key === source);
  if (s) {
    return {
      title: s.label ?? source,
      rows: [
        { label: "Mensual", value: s.momPct != null ? `${s.momPct > 0 ? "+" : ""}${s.momPct}%` : "-" },
        { label: "Interanual", value: s.yoyPct != null ? `${s.yoyPct > 0 ? "+" : ""}${s.yoyPct}%` : "-" },
      ],
    };
  }
  return null;
}

export function tickerText(data: Record<string, any>): string {
  // Prioridad: titulares de somosciclico.com.
  const headlines: string[] = data.ticker?.headlines ?? [];
  if (headlines.length) return headlines.join("        ·        ");
  // Respaldo: datos en vivo.
  const parts: string[] = [];
  const casas: any[] = data.dolar?.casas ?? [];
  const blue = casas.find((c) => c.casa === "blue")?.venta;
  const ofi = casas.find((c) => c.casa === "oficial")?.venta;
  if (ofi) parts.push(`Dólar oficial $${ofi}`);
  if (blue) parts.push(`Dólar blue $${blue}`);
  if (data.cammesa?.demActual) parts.push(`Demanda eléctrica ${data.cammesa.demActual.toLocaleString("es-AR")} MW`);
  const ipc = (data.datosgob?.series ?? []).find((s: any) => s.key === "ipc");
  if (ipc?.momPct != null) parts.push(`IPC ${ipc.momPct}% mensual`);
  return parts.join("   ·   ") || "Cíclico";
}
