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
  // Última cotización DISTINTA a la actual (no la del poll anterior, que casi siempre es igual): sirve para
  // ▲/▼/= según la última variación real. Igual a `venta` = nunca varió en el historial; null = sin dato.
  ventaPrev?: number | null;
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

export interface ClimaDia {
  date: string; // YYYY-MM-DD
  code: number | null;
  max: number | null;
  min: number | null;
  desc: string;
}
export interface ClimaCiudad {
  city: string;
  province: string;
  lat: number;
  lon: number;
  tempC: number | null;
  code: number | null;
  desc: string;
  feelsLike: number | null;
  humidity: number | null; // %
  windKmh: number | null;
  isDay?: boolean | null; // true de día, false de noche (Open-Meteo `is_day`); elige el ícono BIG
  days: ClimaDia[]; // hoy + próximos 2 días
}
export interface ClimaPayload {
  city: string;
  tempC: number | null;
  code: number | null;
  desc: string;
  cities: ClimaCiudad[];
  updatedAt: string;
}

// Íconos disponibles (BIG y de card) por condición. weatherIconKey mapea el
// weather_code de Open-Meteo (WMO) a una de estas claves.
export type ClimaIconKey = "soleado" | "nublado" | "llovizna" | "lluvia" | "nieve" | "tormenta";
export function weatherIconKey(code: number | null): ClimaIconKey {
  if (code == null) return "nublado";
  if (code <= 1) return "soleado";
  if (code === 2 || code === 3 || code === 45 || code === 48) return "nublado";
  if ([51, 53, 55, 56, 57].includes(code)) return "llovizna";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "lluvia";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "nieve";
  if ([95, 96, 99].includes(code)) return "tormenta";
  return "nublado";
}

// ---- Íconos BIG del clima (configurables en Ajustes) ----
// Cada "slot" es una situación del cielo que el sistema distingue a partir de lo que manda la API
// (weather_code WMO + is_day). El editor carga la imagen de cada slot en Ajustes; si un slot no
// tiene imagen propia se usa la predeterminada (o la del slot de reserva).
export type ClimaSlotKey =
  | "soleado" | "despejado_noche" | "parcial" | "parcial_noche"
  | "nublado" | "nublado_noche" | "niebla" | "llovizna" | "lluvia" | "nieve" | "tormenta";

export const CLIMA_SLOTS: { key: ClimaSlotKey; label: string; when: string; fallback: ClimaSlotKey | null; hasDefault: boolean }[] = [
  { key: "soleado", label: "Soleado", when: "Cielo despejado de día (códigos 0-1)", fallback: null, hasDefault: true },
  { key: "despejado_noche", label: "Despejado de noche", when: "Cielo despejado de noche (códigos 0-1)", fallback: "soleado", hasDefault: true },
  { key: "parcial", label: "Parcialmente nublado", when: "Algo de nubes de día (código 2)", fallback: "nublado", hasDefault: true },
  { key: "parcial_noche", label: "Parcialmente nublado de noche", when: "Algo de nubes de noche (código 2)", fallback: "nublado_noche", hasDefault: true },
  { key: "nublado", label: "Nublado", when: "Cubierto de día (código 3)", fallback: null, hasDefault: true },
  { key: "nublado_noche", label: "Nublado de noche", when: "Cubierto de noche (código 3)", fallback: "nublado", hasDefault: true },
  { key: "niebla", label: "Niebla", when: "Niebla o niebla escarchada (códigos 45, 48)", fallback: "nublado", hasDefault: false },
  { key: "llovizna", label: "Llovizna", when: "Llovizna y llovizna helada (códigos 51-57)", fallback: null, hasDefault: true },
  { key: "lluvia", label: "Lluvia", when: "Lluvia, lluvia helada y chaparrones (códigos 61-67, 80-82)", fallback: null, hasDefault: true },
  { key: "nieve", label: "Nieve", when: "Nevadas y chaparrones de nieve (códigos 71-77, 85-86)", fallback: null, hasDefault: true },
  { key: "tormenta", label: "Tormenta", when: "Tormenta eléctrica, con o sin granizo (códigos 95-99)", fallback: null, hasDefault: true },
];
export const CLIMA_SLOT_KEYS = CLIMA_SLOTS.map((s) => s.key);

// weather_code (WMO) + día/noche → slot del ícono BIG.
export function climaSlotKey(code: number | null, isDay: boolean | null | undefined): ClimaSlotKey {
  const day = isDay !== false; // sin dato = de día
  if (code == null) return "nublado";
  if (code <= 1) return day ? "soleado" : "despejado_noche";
  if (code === 2) return day ? "parcial" : "parcial_noche";
  if (code === 3) return day ? "nublado" : "nublado_noche";
  if (code === 45 || code === 48) return "niebla";
  if ([51, 53, 55, 56, 57].includes(code)) return "llovizna";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "lluvia";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "nieve";
  if ([95, 96, 99].includes(code)) return "tormenta";
  return "nublado";
}

// Imágenes elegidas en Ajustes: slot → URL (los slots sin entrada usan la predeterminada).
export type ClimaIconsConfig = Partial<Record<ClimaSlotKey, string>>;

// Datos del tipo "clima": qué ciudad (de las capitales de la fuente `clima`)
// muestra la placa. El resto (temperatura, pronóstico) sale en vivo de la API.
export interface ClimaData {
  city: string;
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
  audio_url?: string | null;          // audio opcional (se reproduce mientras está al aire)
}

// Datos del tipo "placas" (noticia genérica: escrita a mano o traída de Cíclico).
export interface PlacasData {
  title: string;                      // titular (card izquierda, admite **negrita**)
  body?: string;                      // cuerpo largo (card derecha)
  label?: string;                     // volanta / fecha (pill sobre la card de título)
  media_url?: string | null;          // foto opcional (card izquierda, debajo del título)
  media_kind?: "image" | "video" | null;
  source?: string;                    // fuente (opcional, no se muestra)
  audio_url?: string | null;          // audio opcional (se reproduce mientras está al aire)
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
  audio_url?: string | null;  // audio opcional (se reproduce mientras está al aire)
}

// Datos del tipo "shorts": 1 o 2 shorts verticales del canal (YouTube). El
// título viene de la API y es editable; con 2 shorts es un título único
// compartido (no por video).
export interface ShortsData {
  count: 1 | 2;
  video1: string; // id de video de YouTube
  video2?: string; // sólo si count=2
  title: string; // editable
}

// Datos del tipo "camaras": una cámara en vivo (de la base ya construida) +
// ubicación editable + uno o más avisos (imágenes) que rotan en fade.
export interface CamarasData {
  camera_id: string; // FK a cameras.id
  location: string; // "Buenos Aires · Obelisco"
  ads: string[]; // URLs de imagen (1 o más); si hay 1 sola no rota
}

// Datos del tipo "video_full": video, imagen o video de YouTube a pantalla
// completa, sin overlay. A diferencia de Publicidad, NO genera reporte.
export interface VideoFullData {
  media_url: string; // URL de archivo (image/video) o id de video de YouTube (kind="youtube")
  media_kind: "image" | "video" | "youtube";
  title?: string; // título del video de YouTube (oEmbed al guardar), para referencia en el panel
}

// Datos del tipo "informe": carrusel de hasta 10 slides (imágenes 4:5) con un
// título fijo a la izquierda mientras rotan. Sin overlay de reporte.
export interface InformeData {
  title: string; // fijo, se muestra en la card azul mientras rotan las slides
  slides: string[]; // hasta 10 URLs de imagen 4:5 (1080x1350)
  sec_per_slide?: number; // default 5
}

// Datos del tipo "publicidad": Full (16:9 sin overlay) o Vertical (9:16 +
// marco estándar + logo/QR de marca opcionales). Única familia que genera reporte.
export interface PublicidadData {
  format: "full" | "vertical";
  media_url: string;
  media_kind: "image" | "video";
  logo_url?: string; // sólo vertical, opcional
  brand_qr_url?: string; // sólo vertical, opcional (≠ QR de Cíclico del zócalo)
}

// Datos del tipo "promos": pill+card de texto libre + video 9:16 o 4:3 del
// canal de YouTube (elegido a mano o autoseleccionado por hashtag). No genera reporte.
export interface PromosData {
  title: string; // pill, máx ~24
  body: string; // card, máx ~160, auto-fit
  format: "916" | "43";
  video_id: string; // id de YouTube
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
  "settings:update": (settings: Record<string, unknown>) => void;
}
export interface ClientToServerEvents {
  // reservado para futuras acciones del panel (ej: forzar refetch)
  "data:request": (source: SourceId) => void;
}

// Determina si un contenido tipado trae audio propio (para el VU del Monitor de
// Programación). No es una medición real de audio, es heurística por tipo/data.
export function contentHasAudio(type: string, data: Record<string, any> = {}): boolean {
  if (data?.audio_url) return true;
  if (type === "camaras") return false; // las cámaras nunca llevan audio
  if (type === "shorts" || type === "promos") return true; // siempre video de YouTube
  const kind = data?.media_kind;
  return kind === "video" || kind === "youtube";
}
