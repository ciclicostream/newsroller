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
  ventaPrev?: number | null; // venta del día hábil anterior (para variación ▲/▼); null si no hay dato aún
}
export interface DolarPayload {
  casas: DolarCasa[];
  updatedAt: string; // ISO, la fecha más reciente entre casas
}

// Casas de cambio elegibles para la placa Dólar (id de dolarapi.com → etiqueta).
export const DOLAR_CASAS: Record<string, string> = {
  oficial: "Oficial",
  blue: "Blue",
  bolsa: "MEP",
  contadoconliqui: "CCL",
  tarjeta: "Tarjeta",
  mayorista: "Mayorista",
  cripto: "Cripto",
};

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

export type ContentType = "short" | "placa" | "ad" | "background" | "data" | "template" | "content_item";

// ---- Banco de contenidos tipados 2026 ----
export type ContentItemType =
  | "ultima_hora"
  | "dolar"
  | "cifras"
  | "efemerides"
  | "cartelera"
  | "declaraciones"
  | "shorts"
  | "informe"
  | "publicidad"
  | "video_full"
  | "promos"
  | "camaras"
  | "clima"
  | "placas"
  | (string & {});

export interface ContentItem {
  id: string;
  type: ContentItemType;
  data: Record<string, any>; // campos propios del tipo
  duration_sec: number;
  active: boolean;
  in_parrilla: boolean; // disponible en la lista de la parrilla
  sort: number;
  created_at: string;
}

// Datos del tipo "ultima_hora".
export interface UltimaHoraData {
  text: string;                       // bajada (soporta **markdown** para negrita)
  media_url?: string | null;          // foto o video opcional
  media_kind?: "image" | "video" | null;
}

// Datos del tipo "placas" (noticia genérica: escrita a mano o traída de Cíclico).
export interface PlacasData {
  title: string;                      // titular (card izquierda, admite **negrita**)
  body?: string;                      // cuerpo largo (card derecha)
  label?: string;                     // volanta / fecha (pill sobre la card de título)
  media_url?: string | null;          // foto opcional (card izquierda, debajo del título)
  media_kind?: "image" | "video" | null;
  source?: string;                    // fuente (opcional, no se muestra)
}

// Datos del tipo "dolar": 3 cotizaciones elegidas, la del medio (índice 1) es la ancla.
// El valor en vivo sale de la fuente `dolar` (dolarapi.com); `overrides` permite
// forzar un valor manual por casa (ignora la API para esa cotización).
export interface DolarData {
  casas: [string, string, string]; // ids de DOLAR_CASAS; casas[1] = ancla (pill "EL DÓLAR")
  overrides?: Partial<Record<string, number>>; // casa -> valor manual (pisa el venta de la API)
}

// Íconos elegibles para la placa Cifras (nombre de componente lucide-react).
// "Sin ícono" = valor null (la explicación ocupa todo el ancho de la tarjeta azul).
export const CIFRAS_ICONS = [
  "TrendingUp", "TrendingDown", "Minus", "TriangleAlert", "Banknote",
  "Clock", "Trophy", "Users", "Thermometer", "Flame", "Zap", "Percent",
] as const;
export type CifrasIcon = (typeof CIFRAS_ICONS)[number];

// Métricas con dato de API disponible (cifra + fuente se autoescriben al elegirla).
// key = id estable guardado en CifrasData.metric.
export const CIFRAS_METRICS: Record<string, { label: string }> = {
  ipc: { label: "IPC nacional (INDEC)" },
  salarios: { label: "Índice de salarios (INDEC)" },
  energia: { label: "Ventas de energía eléctrica" },
  petroleo: { label: "Producción de petróleo (YPF)" },
  demanda_electrica: { label: "Demanda eléctrica (CAMMESA)" },
  dolar_oficial: { label: "Dólar oficial (venta)" },
  dolar_blue: { label: "Dólar blue (venta)" },
};

// Datos del tipo "cifras". El dato (valueNum/value/source) se resuelve y CONGELA
// al guardar (igual que Placas al importar de Cíclico): el output sólo renderiza
// lo guardado, no vuelve a pedir la API.
export interface CifrasData {
  mode: "api" | "manual";
  metric?: string;          // key de CIFRAS_METRICS si mode="api"
  value: string;             // cifra formateada para mostrar (ej. "5,2%", "1.245 GWh")
  valueNum: number;          // valor numérico puro, para el conteo 0→valor
  suffix?: string;           // sufijo pegado al número animado (ej. "%")
  subtitle: string;          // qué representa (obligatorio)
  source: string;            // fuente técnica (obligatorio; auto si mode="api")
  sourceAuto?: boolean;      // true = se autoescribió de una API (pill "AUTO")
  explanation: string;       // texto de la tarjeta azul (obligatorio)
  icon: CifrasIcon | null;   // null = "Sin ícono"
}

const MESES_LARGO = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// Datos del tipo "efemerides". Precisión de fecha variable: día exacto, sólo
// mes o sólo año (hay efemérides sin fecha exacta conocida).
export interface EfemeridesData {
  dateKind: "full" | "month" | "year";
  day?: number;    // 1-31, sólo si dateKind="full"
  month?: number;  // 0-11, si dateKind="full" o "month"
  year: number;
  title: string;   // máx 60
  body: string;    // máx 400
  media_url: string;              // obligatoria
  media_kind: "image" | "video";
}

// "11 DE SEPTIEMBRE DE 2001" / "SEPTIEMBRE DE 2025" / "2025".
export function formatEfemeridesDate(d: Pick<EfemeridesData, "dateKind" | "day" | "month" | "year">): string {
  if (d.dateKind === "year") return String(d.year);
  const mes = MESES_LARGO[d.month ?? 0] ?? "";
  if (d.dateKind === "month") return `${mes.toUpperCase()} DE ${d.year}`;
  return `${d.day ?? 1} DE ${mes.toUpperCase()} DE ${d.year}`;
}

// Datos del tipo "cartelera" ("En cartelera"). Todo obligatorio salvo el video.
export interface CarteleraData {
  photo_url: string;   // foto horizontal, obligatoria
  title: string;        // título de la obra, máx 90
  author: string;       // "De …"
  cast: string;          // "Con: …"
  venue: string;         // lugar
  address: string;       // dirección
  city: string;           // ciudad/barrio
  days: string;           // día(s)
  time: string;           // horario
  video_url?: string | null; // opcional, 9:16
}

// Programas sugeridos para "Entrevista completa en …" (el editor puede escribir otro).
export const DECLARACIONES_PROGRAMAS = ["EPA!", "REC!", "Cíclico Noticias", "Modo Cíclico"];

// Datos del tipo "declaraciones". Foto + ficha + cita son obligatorios; titular
// y programa de entrevista son opcionales (si están vacíos, no se muestran).
export interface DeclaracionesData {
  photo_url: string; // cuadrada, obligatoria
  name: string;
  role: string;   // cargo
  place: string;  // lugar
  quote: string;  // cita, máx 450
  headline?: string;          // titular de la nota (opcional)
  interview_program?: string; // "Entrevista completa en …" (opcional)
}

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
