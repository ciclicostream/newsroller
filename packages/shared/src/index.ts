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

export type ContentType = "short" | "placa" | "ad" | "background" | "data" | "template" | "content_item" | "session";

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
  prefix?: string;           // prefijo delante del número (ej. "US$", "$")
  suffix?: string;           // sufijo: corto (%, MW) va pegado al número; una unidad larga ("millones de dólares") va chica al lado
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
// Una efeméride (fecha + título + cuerpo + media). La placa puede llevar 1, 2 o 3 en el mismo pase.
export interface EfemeridesEntry {
  // "anniversary" = sólo día y mes, sin año (fechas que se repiten: Día Mundial del Alzheimer, 21 de septiembre).
  // "year" ya no se ofrece en el formulario; queda para las efemérides viejas.
  dateKind: "full" | "month" | "anniversary" | "year";
  day?: number;    // 1-31, si dateKind="full" o "anniversary"
  month?: number;  // 0-11, si dateKind="full", "month" o "anniversary"
  year?: number;   // no aplica a "anniversary"
  title: string;   // máx 60
  body: string;    // máx 400
  media_url: string;              // obligatoria
  media_kind: "image" | "video";
}

// Datos del tipo "efemerides": la primera efeméride va en los campos de arriba (así siguen valiendo las
// ya guardadas) y `more` suma la 2ª y la 3ª. Con varias, pasan entre sí girando como un cubo y la
// duración del bloque se reparte en partes iguales.
export interface EfemeridesData extends EfemeridesEntry {
  more?: EfemeridesEntry[]; // hasta 2 más
}

// "11 DE SEPTIEMBRE DE 2001" / "SEPTIEMBRE DE 2025" / "21 DE SEPTIEMBRE" (aniversario) / "2025".
export function formatEfemeridesDate(d: Pick<EfemeridesEntry, "dateKind" | "day" | "month" | "year">): string {
  if (d.dateKind === "year") return String(d.year ?? "");
  const mes = MESES_LARGO[d.month ?? 0] ?? "";
  if (d.dateKind === "anniversary") return `${d.day ?? 1} DE ${mes.toUpperCase()}`;
  if (d.dateKind === "month") return `${mes.toUpperCase()} DE ${d.year}`;
  return `${d.day ?? 1} DE ${mes.toUpperCase()} DE ${d.year}`;
}

// Datos del tipo "cartelera" ("En cartelera"), en tres variantes:
//  - teatro (la de siempre): foto horizontal + título + "De …" + "Con: …" (+ video 9:16 opcional)
//  - cine: en lugar de la foto, el trailer de YouTube; título + sinopsis y una ficha lateral (director, actores, duración, género)
//  - evento: como teatro pero SIN director ni elenco
// Las ya guardadas no traen `kind` y se tratan como teatro.
export type CarteleraKind = "teatro" | "cine" | "evento";
export interface CarteleraData {
  kind?: CarteleraKind;
  photo_url: string;   // foto horizontal (teatro y evento, obligatoria); en cine va vacía
  title: string;        // título de la obra/película/evento, máx 90
  author: string;       // "De …" (teatro: autor, cine: director; en evento va vacío)
  cast: string;          // "Con: …" (en evento va vacío)
  venue: string;         // lugar
  address: string;       // dirección
  city: string;           // ciudad/barrio
  days: string;           // día(s)
  time: string;           // horario
  description?: string;      // evento: descripción (va bajo el título)
  video_url?: string | null; // teatro/evento: opcional, 9:16
  // ---- Cine (película o serie) ----
  trailer_id?: string;       // id de YouTube del trailer (obligatorio)
  synopsis?: string;         // sinopsis (va bajo el título); `author` = director y `cast` = actores (van en la ficha lateral)
  duration_text?: string;    // "148 min"
  genre?: string;
  is_series?: boolean;       // serie: se muestra la plataforma (+ temporadas/capítulos, opcionales)
  platform?: string;         // id de plataforma (Ajustes → Plataformas)
  platform_name?: string;    // nombre guardado por si la plataforma se quita después
  seasons?: number;
  episodes?: number;
  ticker?: "recomendada" | "estreno" | "clasico" | null; // newsticker chico encima del título
  poster_url?: string;       // póster (opcional) en el lugar lateral…
  short_id?: string;         // …o un short de Cíclico (id de YouTube, de la ingesta de Shorts)
  short_thumb?: string;      // tapa del short: queda a la vista cuando termina
}

// Plataformas de streaming elegibles para una serie. La lista se administra en Ajustes → Plataformas
// (se pueden agregar/quitar y cargar su logo); éstas son las de arranque.
export interface Plataforma { id: string; name: string; logo?: string }
export const PLATAFORMAS_DEFAULT: Plataforma[] = [
  { id: "netflix", name: "Netflix" },
  { id: "appletv", name: "AppleTV+" },
  { id: "mubi", name: "Mubi" },
  { id: "prime", name: "Prime" },
  { id: "disney", name: "Disney+" },
  { id: "hbo", name: "HBO+" },
  { id: "flow", name: "Flow" },
];

// Música de fondo continua (Ajustes → Música): suena mientras el aire no tiene
// contenido con audio propio, y hace fadeout/fadein al cruzarse con uno que sí
// (mp3, short, video con sonido). Sólo puede sonar un tema a la vez; el volumen
// real lo controla el mezclador de vMix/OBS, acá sólo se maneja el fundido.
export interface MusicTrack { id: string; name: string; url: string }
export interface MusicSettings { tracks: MusicTrack[]; activeId: string | null; enabled: boolean }
export const MUSIC_DEFAULT: MusicSettings = { tracks: [], activeId: null, enabled: false };

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
  title?: string; // nombre para identificarlo en la parrilla y el banco (en YouTube, por defecto el título del video)
  // Versión para el output vertical (9:16): archivo o short de YouTube. Sin ella no sale en el vertical.
  vertical_url?: string; vertical_kind?: "image" | "video"; vertical_yt?: string;
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
  title?: string; // nombre del aviso/anunciante, para identificarlo en la parrilla y los reportes
  // Formato Full: versión para el output vertical (9:16). Sin ella el aviso Full no sale en el vertical.
  vertical_url?: string; vertical_kind?: "image" | "video";
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
  "session:update": (s: { id: string; active: boolean; paused_at: string | null }) => void;
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

// ---- Roles y permisos ----
// Cuatro perfiles con jerarquía. Los permisos se aplican en el SERVIDOR (requirePerm) y el panel sólo
// los usa para mostrar/ocultar secciones.
export type Role = "master" | "administrador" | "programador" | "generador";
export const ROLES: Role[] = ["master", "administrador", "programador", "generador"];
export const ROLE_LABEL: Record<Role, string> = {
  master: "Master",
  administrador: "Administrador",
  programador: "Programador",
  generador: "Generador de contenidos",
};
export const ROLE_RANK: Record<Role, number> = { master: 4, administrador: 3, programador: 2, generador: 1 };

export type Perm =
  | "programar" // Programación: armar la parrilla, enviar a vivo, cortar el aire
  | "contenidos" // crear y ver contenidos (todos los roles)
  | "plantillas_ver" // ver las plantillas (solo lectura)
  | "plantillas_editar" // modificar plantillas
  | "camaras" // agregar/editar cámaras
  | "fuentes" // ver el estado de las fuentes de datos / APIs
  | "reportes"
  | "ajustes"
  | "perfiles" // invitar/editar/desactivar personas (salvo Master)
  | "eliminar_personas" // borrar personas
  | "vaciar_papelera" // borrar definitivamente (de la papelera)
  | "config_sistema" // configuración sensible del sistema (ej. tiempos de inactividad)
  | "sesiones" // ver/editar las sesiones (playlists propias) que le fueron asignadas
  | "sesiones_admin"; // crear/borrar sesiones y asignar quién las gestiona

export const ROLE_PERMS: Record<Role, Perm[]> = {
  master: ["programar", "contenidos", "plantillas_ver", "plantillas_editar", "camaras", "fuentes", "reportes", "ajustes", "perfiles", "eliminar_personas", "vaciar_papelera", "config_sistema", "sesiones", "sesiones_admin"],
  administrador: ["programar", "contenidos", "plantillas_ver", "camaras", "reportes", "ajustes", "perfiles", "vaciar_papelera", "sesiones", "sesiones_admin"],
  programador: ["programar", "contenidos", "camaras", "fuentes", "ajustes", "sesiones"],
  generador: ["contenidos", "sesiones"],
};
export const can = (role: Role | null | undefined, perm: Perm): boolean => !!role && ROLE_PERMS[role].includes(perm);

// Los roles viejos (admin/editor) se leen como administrador/programador hasta que se corra la migración;
// cualquier otro valor cae en el rol de menor privilegio.
export function normalizeRole(raw: unknown): Role {
  if (typeof raw === "string" && (ROLES as string[]).includes(raw)) return raw as Role;
  if (raw === "admin") return "administrador";
  if (raw === "editor") return "programador";
  return "generador";
}

// A quién puede invitar/asignar cada rol: el Master a cualquiera; el Administrador a administradores,
// programadores y generadores (nunca a un Master).
export function assignableRoles(actor: Role): Role[] {
  if (actor === "master") return ROLES;
  if (actor === "administrador") return ["administrador", "programador", "generador"];
  return [];
}

// Minutos de inactividad tras los cuales se cierra la sesión (configurable por el Master en Ajustes).
export const IDLE_MINUTES_DEFAULT: Record<Role, number> = { generador: 20, programador: 15, administrador: 10, master: 10 };

// Adónde mandar a cada rol al entrar (primera sección a la que tiene acceso).
export function homeFor(role: Role): string {
  if (can(role, "programar")) return "/";
  return "/contenido";
}
