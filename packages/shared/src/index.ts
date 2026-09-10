// Tipos compartidos entre server, panel y output.
// El objetivo: que el "contrato" de datos viva en un solo lugar.

export type SourceId = "dolar" | "datosgob" | "cammesa" | (string & {});

// Envoltorio con el que se cachea y se emite cualquier payload de una fuente.
export interface CachedData<T = unknown> {
  source: SourceId;
  payload: T;
  fetchedAt: string; // ISO
}

// Estado de cada poller, para /api/sources y el panel.
export interface SourceStatus {
  id: SourceId;
  label: string;
  intervalMs: number;
  ok: boolean;
  lastRunAt: string | null;
  lastOkAt: string | null;
  lastError: string | null;
}

// ---- Payloads normalizados por fuente ----

export interface DolarCasa {
  casa: string; // oficial, blue, bolsa (MEP), contadoconliqui (CCL), tarjeta, mayorista, cripto
  nombre: string;
  compra: number | null;
  venta: number | null;
  fecha: string; // ISO
}
export interface DolarPayload {
  casas: DolarCasa[];
  updatedAt: string; // ISO, la fecha más reciente entre casas
}

export interface SerieValor {
  key: string; // ipc, salarios, energia, petroleo...
  id: string; // id de la serie en datos.gob.ar
  label: string;
  unit: string;
  latest: { date: string; value: number } | null;
  momPct: number | null; // variación mensual %
  yoyPct: number | null; // variación interanual %
}
export interface DatosGobPayload {
  series: SerieValor[];
}

export interface CammesaPayload {
  region: string;
  fecha: string; // ISO del último sample con dato
  demActual: number | null; // MW ahora
  demPrevista: number | null; // MW previsto
  demAyer: number | null; // MW mismo horario ayer
  demSemanaAnt: number | null; // MW misma hora semana anterior
  maxHoy: number | null; // pico del día hasta ahora
  temp: number | null; // °C
}

// ---- Contenido ----

export type AssetKind = "background" | "logo" | "ad";

export interface Asset {
  id: string;
  kind: AssetKind;
  bucket: string;
  path: string;
  name: string | null;
  mime: string | null;
  size: number | null;
  active: boolean;
  sort: number;
  meta: Record<string, unknown>;
  created_at: string;
  url: string; // URL pública calculada por el server
}

export interface Placa {
  id: string;
  title: string;
  body: string | null;
  accent: string | null;
  image_url: string | null;
  image_fit: string | null; // 'cover' | 'contain'
  active: boolean;
  sort: number;
  created_at: string;
}

export interface Short {
  id: string; // id del video de YouTube
  title: string;
  custom_title: string | null;
  thumbnail_url: string | null;
  duration_sec: number | null;
  published_at: string | null;
  active: boolean;
  sort: number;
  synced_at: string;
}

// ---- Programación (playlist) + plantillas ----

export type ContentType = "short" | "placa" | "ad" | "background" | "data" | "template";

// ---- Plantillas propias (editor visual) ----
export type ElementType = "text" | "image" | "video" | "weather" | "data" | "logo" | "shape" | "camera";

export type CameraType = "youtube" | "hls" | "image" | "iframe";
export interface Camera {
  id: string;
  name: string;
  city: string | null;
  type: CameraType;
  url: string;
  active: boolean;
  sort: number;
  created_at: string;
}

export interface TemplateElement {
  id: string;
  type: ElementType;
  x: number; // px sobre lienzo 1920x1080
  y: number;
  w: number;
  h: number;
  z: number;
  props: Record<string, any>;
}

export interface TemplateBackground {
  type: "image" | "gradient" | "color";
  value: string; // url | css de gradiente | color hex
}

export interface Template {
  id: string;
  name: string;
  background: TemplateBackground;
  elements: TemplateElement[];
  created_at: string;
  updated_at: string;
}

export const CANVAS_W = 1920;
export const CANVAS_H = 1080;

// Fuentes de datos que se pueden poner como bloque de la playlist.
export const DATA_BLOCKS: { id: string; label: string }[] = [
  { id: "dolar", label: "Dólar" },
  { id: "cammesa", label: "Demanda eléctrica (CAMMESA)" },
  { id: "ipc", label: "IPC" },
  { id: "salarios", label: "Salarios" },
  { id: "energia", label: "Energía" },
  { id: "petroleo", label: "Petróleo" },
  { id: "clima", label: "Clima" },
];

// Catálogo fijo de layouts para bloques simples de la playlist (no las plantillas propias).
export interface Layout {
  id: string;
  label: string;
  description: string;
  appliesTo: ContentType[];
}
export const LAYOUTS: Layout[] = [
  { id: "full-media", label: "Pantalla completa", description: "Media ocupando toda la pantalla", appliesTo: ["short", "ad", "background"] },
  { id: "short-916", label: "Short 9:16 + título", description: "Video vertical con el título animado al lado", appliesTo: ["short"] },
  { id: "placa-full", label: "Placa pantalla completa", description: "Título y cuerpo a pantalla completa", appliesTo: ["placa"] },
  { id: "placa-medio", label: "Placa centrada", description: "Tarjeta centrada sobre el fondo", appliesTo: ["placa"] },
  { id: "data-full", label: "Dato pantalla completa", description: "Dato grande a pantalla completa", appliesTo: ["data"] },
  { id: "data-medio", label: "Dato centrado", description: "Dato en tarjeta centrada", appliesTo: ["data"] },
  { id: "tres-cuartos", label: "Tres cuartos + datos", description: "Contenido 3/4 con columna de datos", appliesTo: ["short", "ad", "data"] },
];

export interface PlaylistItem {
  id: string;
  content_type: ContentType;
  content_id: string | null; // id del short/placa/asset, o clave de dato (dolar, ipc, ...)
  template: string;
  duration_sec: number;
  enabled: boolean;
  sort: number;
  created_at: string;
}

// Eventos de Socket.IO server -> clientes.
export interface ServerToClientEvents {
  "data:update": (data: CachedData) => void;
  "sources:status": (statuses: SourceStatus[]) => void;
}
export interface ClientToServerEvents {
  // reservado para futuras acciones del panel (ej: forzar refetch)
  "data:request": (source: SourceId) => void;
}
