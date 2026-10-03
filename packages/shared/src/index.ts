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

// ---- Estados del clima (Open-Meteo, weather_code WMO) ----
// Cada código se muestra con el nombre que le da Open-Meteo (traducido) y pertenece a un ESTADO: la familia de
// íconos (las intensidades leve / moderada / fuerte de un mismo fenómeno comparten ícono).
export type ClimaEstado =
  | "despejado" | "mayormente_despejado" | "parcial" | "cubierto" | "niebla" | "niebla_escarcha"
  | "llovizna" | "llovizna_helada" | "lluvia" | "lluvia_helada" | "nevada" | "granos_nieve"
  | "chaparrones" | "chaparrones_nieve" | "tormenta" | "tormenta_granizo";

// Tabla de Open-Meteo (https://open-meteo.com/en/docs, "WMO Weather interpretation codes"), código por código.
export const CLIMA_WMO: Record<number, { desc: string; estado: ClimaEstado }> = {
  0: { desc: "Despejado", estado: "despejado" },
  1: { desc: "Mayormente despejado", estado: "mayormente_despejado" },
  2: { desc: "Parcialmente nublado", estado: "parcial" },
  3: { desc: "Cubierto", estado: "cubierto" },
  45: { desc: "Niebla", estado: "niebla" },
  48: { desc: "Niebla con escarcha", estado: "niebla_escarcha" },
  51: { desc: "Llovizna leve", estado: "llovizna" },
  53: { desc: "Llovizna moderada", estado: "llovizna" },
  55: { desc: "Llovizna densa", estado: "llovizna" },
  56: { desc: "Llovizna helada leve", estado: "llovizna_helada" },
  57: { desc: "Llovizna helada densa", estado: "llovizna_helada" },
  61: { desc: "Lluvia leve", estado: "lluvia" },
  63: { desc: "Lluvia moderada", estado: "lluvia" },
  65: { desc: "Lluvia fuerte", estado: "lluvia" },
  66: { desc: "Lluvia helada leve", estado: "lluvia_helada" },
  67: { desc: "Lluvia helada fuerte", estado: "lluvia_helada" },
  71: { desc: "Nevada leve", estado: "nevada" },
  73: { desc: "Nevada moderada", estado: "nevada" },
  75: { desc: "Nevada fuerte", estado: "nevada" },
  77: { desc: "Granos de nieve", estado: "granos_nieve" },
  80: { desc: "Chaparrones leves", estado: "chaparrones" },
  81: { desc: "Chaparrones moderados", estado: "chaparrones" },
  82: { desc: "Chaparrones violentos", estado: "chaparrones" },
  85: { desc: "Chaparrones de nieve leves", estado: "chaparrones_nieve" },
  86: { desc: "Chaparrones de nieve fuertes", estado: "chaparrones_nieve" },
  95: { desc: "Tormenta leve o moderada", estado: "tormenta" },
  96: { desc: "Tormenta con granizo leve", estado: "tormenta_granizo" },
  99: { desc: "Tormenta con granizo fuerte", estado: "tormenta_granizo" },
};
// Un código representativo de cada estado (el primero de la tabla), para las vistas previas.
export const climaCodeOf = (estado: ClimaEstado): number => Number(Object.keys(CLIMA_WMO).find((c) => CLIMA_WMO[Number(c)]!.estado === estado) ?? 3);
export const climaDesc = (code: number | null | undefined): string => (code == null ? "" : CLIMA_WMO[code]?.desc ?? "");
// Código desconocido o sin dato: cubierto.
export const climaEstado = (code: number | null | undefined): ClimaEstado => (code == null ? "cubierto" : CLIMA_WMO[code]?.estado ?? "cubierto");

// Estados en el orden de Ajustes. `parent`: el estado más parecido, que se usa si éste no tiene imagen.
export const CLIMA_ESTADOS: { key: ClimaEstado; label: string; codes: string; parent: ClimaEstado | null }[] = [
  { key: "despejado", label: "Despejado", codes: "0", parent: null },
  { key: "mayormente_despejado", label: "Mayormente despejado", codes: "1", parent: "parcial" },
  { key: "parcial", label: "Parcialmente nublado", codes: "2", parent: null },
  { key: "cubierto", label: "Cubierto", codes: "3", parent: null },
  { key: "niebla", label: "Niebla", codes: "45", parent: "cubierto" },
  { key: "niebla_escarcha", label: "Niebla con escarcha", codes: "48", parent: "niebla" },
  { key: "llovizna", label: "Llovizna", codes: "51, 53, 55", parent: null },
  { key: "llovizna_helada", label: "Llovizna helada", codes: "56, 57", parent: "llovizna" },
  { key: "lluvia", label: "Lluvia", codes: "61, 63, 65", parent: null },
  { key: "lluvia_helada", label: "Lluvia helada", codes: "66, 67", parent: "lluvia" },
  { key: "nevada", label: "Nevada", codes: "71, 73, 75", parent: null },
  { key: "granos_nieve", label: "Granos de nieve", codes: "77", parent: "nevada" },
  { key: "chaparrones", label: "Chaparrones", codes: "80, 81, 82", parent: "lluvia" },
  { key: "chaparrones_nieve", label: "Chaparrones de nieve", codes: "85, 86", parent: "nevada" },
  { key: "tormenta", label: "Tormenta", codes: "95", parent: null },
  { key: "tormenta_granizo", label: "Tormenta con granizo", codes: "96, 99", parent: "tormenta" },
];
const ESTADO_PARENT = Object.fromEntries(CLIMA_ESTADOS.map((e) => [e.key, e.parent])) as Record<ClimaEstado, ClimaEstado | null>;
export const climaEstadoLabel = (e: ClimaEstado): string => CLIMA_ESTADOS.find((x) => x.key === e)?.label ?? e;

// Vista previa de Ajustes: la ciudad con el estado forzado (el actual y los tres días).
export function climaWithPreview(c: ClimaCiudad, p: ClimaData["preview"]): ClimaCiudad {
  if (!p) return c;
  const desc = climaDesc(p.code);
  return { ...c, code: p.code, isDay: p.isDay, desc, days: c.days.map((d) => ({ ...d, code: p.code, desc })) };
}

// ---- Íconos grandes (BIG): uno por estado de día y otro de noche, todos cargables en Ajustes ----
export type ClimaSlotKey = ClimaEstado | `${ClimaEstado}_noche`;
export const CLIMA_SLOT_KEYS: ClimaSlotKey[] = CLIMA_ESTADOS.flatMap((e) => [e.key, `${e.key}_noche` as ClimaSlotKey]);
// Imágenes que vienen con el sistema (apps/output/public/clima/). Los demás casilleros usan el más parecido.
export const CLIMA_BIG_DEFAULT: Partial<Record<ClimaSlotKey, string>> = {
  despejado: "big-soleado.png", despejado_noche: "big-despejado_noche.png",
  parcial: "big-parcial.png", parcial_noche: "big-parcial_noche.png",
  cubierto: "big-nublado.png", cubierto_noche: "big-nublado_noche.png",
  llovizna: "big-llovizna.png", lluvia: "big-lluvia.png", nevada: "big-nieve.png", tormenta: "big-tormenta.png",
};
// Orden en que se busca imagen para un estado: de noche, primero las versiones de noche (el estado y sus
// parecidos) y después las de día; al final, cubierto (que siempre tiene imagen).
export function climaSlotChain(estado: ClimaEstado, night: boolean): ClimaSlotKey[] {
  const fam: ClimaEstado[] = [];
  for (let e: ClimaEstado | null = estado; e && !fam.includes(e); e = ESTADO_PARENT[e]) fam.push(e);
  return [...(night ? fam.map((e) => `${e}_noche` as ClimaSlotKey) : []), ...fam, "cubierto"];
}
export const climaSlotKey = (code: number | null, isDay: boolean | null | undefined): ClimaSlotKey =>
  (isDay === false ? `${climaEstado(code)}_noche` : climaEstado(code)) as ClimaSlotKey;
export const climaSlotLabel = (k: ClimaSlotKey): string =>
  k.endsWith("_noche") ? `${climaEstadoLabel(k.slice(0, -6) as ClimaEstado)} (noche)` : climaEstadoLabel(k as ClimaEstado);

// Imágenes elegidas en Ajustes: casillero → URL (los que no tienen entrada usan la predeterminada o la más parecida).
export type ClimaIconsConfig = Partial<Record<ClimaSlotKey, string>>;
// Claves viejas (antes de separar todos los estados) → nuevas, para no perder lo que ya se cargó.
const CLIMA_LEGACY_KEYS: Record<string, ClimaSlotKey> = { soleado: "despejado", nublado: "cubierto", nublado_noche: "cubierto_noche", nieve: "nevada" };
export function normalizeClimaIcons(raw: unknown): ClimaIconsConfig {
  const out: ClimaIconsConfig = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = (CLIMA_LEGACY_KEYS[k] ?? k) as ClimaSlotKey;
    if (typeof v === "string" && v && CLIMA_SLOT_KEYS.includes(key) && !(key in out && k !== key)) out[key] = v;
  }
  return out;
}

// ---- Íconos chicos de los días del pronóstico (sin día/noche), también cargables en Ajustes ----
export type ClimaDayIconsConfig = Partial<Record<ClimaEstado, string>>;
export const CLIMA_DAY_DEFAULT: Record<ClimaEstado, string> = {
  despejado: "ic-soleado.png", mayormente_despejado: "ic-nublado.png", parcial: "ic-nublado.png", cubierto: "ic-nublado.png",
  niebla: "ic-nublado.png", niebla_escarcha: "ic-nublado.png", llovizna: "ic-llovizna.png", llovizna_helada: "ic-llovizna.png",
  lluvia: "ic-lluvia.png", lluvia_helada: "ic-lluvia.png", nevada: "ic-nieve.png", granos_nieve: "ic-nieve.png",
  chaparrones: "ic-lluvia.png", chaparrones_nieve: "ic-nieve.png", tormenta: "ic-tormenta.png", tormenta_granizo: "ic-tormenta.png",
};
export function normalizeClimaDayIcons(raw: unknown): ClimaDayIconsConfig {
  const out: ClimaDayIconsConfig = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === "string" && v && k in CLIMA_DAY_DEFAULT) out[k as ClimaEstado] = v;
  return out;
}
// URL de cada ícono, dada la carpeta base donde están los predeterminados (…/clima/).
export function resolveClimaBig(estado: ClimaEstado, night: boolean, custom: ClimaIconsConfig, base: string): { url: string; from: ClimaSlotKey } {
  for (const k of climaSlotChain(estado, night)) {
    if (custom[k]) return { url: custom[k]!, from: k };
    if (CLIMA_BIG_DEFAULT[k]) return { url: base + CLIMA_BIG_DEFAULT[k], from: k };
  }
  return { url: base + CLIMA_BIG_DEFAULT.cubierto, from: "cubierto" };
}
export function resolveClimaDay(estado: ClimaEstado, custom: ClimaDayIconsConfig, base: string): { url: string; from: ClimaEstado | null } {
  for (const k of climaSlotChain(estado, false) as ClimaEstado[]) if (custom[k]) return { url: custom[k]!, from: k };
  return { url: base + CLIMA_DAY_DEFAULT[estado], from: null };
}

// Datos del tipo "clima": qué ciudad (de las capitales de la fuente `clima`)
// muestra la placa. El resto (temperatura, pronóstico) sale en vivo de la API.
export interface ClimaData {
  city: string;
  // Sólo la vista previa de Ajustes → Íconos del clima: fuerza un estado (código WMO) y día/noche para ver cómo
  // queda cada ícono; `v` cambia al cargar un ícono para que la vista previa lo vuelva a leer. Nunca se guarda.
  preview?: { code: number; isDay: boolean; v?: number };
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
  | "lista"
  | "elecciones"
  | "retro"
  | "publicidad"
  | "video_full"
  | "promos"
  | "camaras"
  | "clima"
  | "placas"
  | "obituario"
  | "musica"
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
  developing?: boolean;               // "Noticia en desarrollo": suma una tira que corre con ese texto
}

// Datos del tipo "obituario" (vive dentro de la card de Última Hora). Placa sobria, sin marco ni ticker.
export interface ObituarioData {
  name: string;       // nombre (obligatorio)
  years: string;      // años de vida, texto libre: "1941 — 2026" (obligatorio)
  role: string;       // oficio (obligatorio)
  text?: string;      // semblanza breve, máx 300
  photo_url: string;  // retrato (obligatorio); se muestra en blanco y negro
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
  ticker?: "recomendada" | "estreno" | "clasico" | "produccion_argentina" | null; // newsticker chico encima del título
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

// Zócalo del newsticker (Ajustes → Newsticker → Zócalo): un PNG con una pastilla de texto que
// entra sobre el newsticker real (el del feed de somosciclico.com), programado por día/horario.
// No sale en placas sin ese newsticker (Última Hora, Video Full, Obituario, "Ahora" de Modernas).
export interface ZocaloItem {
  id: string;
  name: string;         // etiqueta interna, sólo para identificarlo en la lista (no se ve en pantalla)
  imageUrl: string;      // PNG (con transparencia)
  position: "derecha" | "centro";
  pillText: string;      // texto libre de la pastilla, ej. "Ya viene EPA! a las 12:00"
  days: number[];        // 0=domingo … 6=sábado; vacío = todos los días
  startTime: string;     // "HH:mm", hora de entrada
  endTime: string;       // "HH:mm", hora de salida
  active: boolean;
}
export const ZOCALOS_DEFAULT: ZocaloItem[] = [];

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

// Géneros musicales que el editor puede elegir en el formulario de Música (Ajustes → Géneros musicales).
export const GENEROS_MUSICALES_DEFAULT: string[] = [
  "Académica - Clásica", "Blues", "Canción de autor", "Chamamé", "Contemporánea - experimental", "Coro", "Country", "Cuarteto",
  "Cumbia", "Electrónica", "Era Contemporánea", "Étnica", "Flamenco", "Folclore latinoamericano", "Folclore nacional", "Folk",
  "Funk", "Fusión", "Góspel", "Hardcore", "Heavy metal", "Hip Hop", "Infantil", "Jazz", "Melódica", "Murga", "Otro", "Piano",
  "Pop", "Punk", "Rap", "Reggae", "Rioplatense", "Rock", "Salsa", "Ska", "Soul", "Tango", "Trap", "Tropical",
];
export const MUSICA_MAX_GENEROS = 3;
export const MUSICA_MAX_FOTOS = 5; // fotos extra que rotan con la portada

// Una línea de la letra. `t` = segundo en que empieza a cantarse (null = sin sincronizar).
export interface MusicaLine { t: number | null; text: string }

// Datos del tipo "musica": una canción con portada, ficha y letra sincronizada. Álbum, portada, géneros, tema, artista y pista
// de audio son obligatorios; fecha, créditos y letra son opcionales. La duración del bloque es la del audio.
export interface MusicaData {
  album: string;
  cover_url: string; // portada (cuadrada)
  photos?: string[]; // más fotos (hasta MUSICA_MAX_FOTOS): rotan con la portada
  description?: string; // descripción del álbum
  release_date?: string; // ISO "YYYY-MM-DD"
  genres: string[]; // 1 a MUSICA_MAX_GENEROS, de Ajustes → Géneros musicales
  title: string; // nombre del tema
  artist: string; // artista o banda que lo interpreta (va debajo del tema, "Intérprete: …")
  credits?: string; // texto libre, puede llevar saltos de línea
  instagram?: string; // usuario de Instagram de la banda, ej. "@losbandaloschinos"
  lyrics?: MusicaLine[]; // una línea por renglón, sin renglones vacíos
  audio_url: string; // pista de audio
}

// Índice de la línea que se canta en el segundo `sec`, o -1 si todavía no empezó la primera. Si ninguna línea tiene
// tiempo (letra sin sincronizar) se reparten parejo a lo largo de `total` segundos.
export function musicaLineIndex(lines: MusicaLine[], sec: number, total: number): number {
  if (!lines.length) return -1;
  if (lines.every((l) => l.t == null)) {
    const per = Math.max(1, total) / lines.length;
    return Math.min(lines.length - 1, Math.floor(sec / per));
  }
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]!.t;
    if (t != null && t <= sec) idx = i;
  }
  return idx;
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

// Datos del tipo "lista" (vive en Informes): lista completa con foco. El foco pasa de un ítem al siguiente
// cada `sec_per_item` segundos. Todos los campos del ítem son opcionales salvo el título.
export interface ListaItem {
  title: string;
  subtitle?: string; // artista, profesión, lugar (máx 60)
  value?: string; // dato destacado: reproducciones, año, puntaje (máx 16)
  text?: string; // descripción, se ve en el foco (máx 140)
  image_url?: string | null; // cuadrada; sin ella se muestra un color con las iniciales
  audio_url?: string | null; // preview copiado al bucket "media"; suena mientras el ítem tiene el foco
}
export interface ListaData {
  title: string; // máx 90
  kicker?: string; // texto de la pill, por defecto "LISTA"
  numbered?: boolean; // por defecto true: el número es el ranking (en rojo). Sin números el nombre va en rojo
  sec_per_item?: number; // por defecto 5
  items: ListaItem[]; // 3 a 10
}
export const LISTA_MAX_ITEMS = 10;

// Datos del tipo "retro": programa (o afiche/tapa) viejo. Imagen o video obligatorio + ficha.
export interface RetroData {
  media_url: string; // archivo, o el id del video si media_kind es "youtube"
  media_kind: "image" | "video" | "youtube";
  chip?: string; // etiqueta, por defecto "PROGRAMA" (vacía = sin etiqueta)
  year?: string; // texto libre: 1990, Años 90, 1978–83 (máx 14)
  title: string; // máx 70
  subtitle?: string; // máx 50
  text?: string; // descripción, máx 450
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

// ---- Colecciones de templates y Suites ----
// Colección: juego completo de templates, con versión 16:9 y 9:16 (en un output no se mezclan). Para sumar una por
// programación: agregarla acá y registrar su renderizador en apps/output/src/collections. `ready: false` = sin
// templates todavía (no se puede habilitar). El Master habilita cuáles se pueden usar (ajuste `collections`).
export interface TemplateCollection { id: string; label: string; desc: string; ready: boolean }
export const TEMPLATE_COLLECTIONS: TemplateCollection[] = [
  { id: "clasica", label: "Clásica", desc: "Las templates de siempre: cards blancas sobre los fondos de cada sección.", ready: true },
  { id: "moderna", label: "Moderna", desc: "Paneles oscuros con profundidad, luces y transiciones propias por contenido.", ready: true },
];
export const DEFAULT_COLLECTION = "clasica";
export const collectionById = (id: string | null | undefined): TemplateCollection | undefined => TEMPLATE_COLLECTIONS.find((c) => c.id === id);

// Suite = nombre + colección. El Administrador o el Master las crean y activan en Ajustes → Suites. Siempre hay UNA
// activa (ajuste `activeSuite`): la salida del canal emite con su colección, y el Programador y el Host ven su nombre.
// Cambiar la suite activa o su colección entra en el próximo contenido.
export interface Suite { id: string; name: string; style: string }
export const SUITE_DEFAULT: Suite = { id: "clasica", name: "clasica", style: DEFAULT_COLLECTION };
export const SUITE_NAME_RE = /^[a-z0-9][a-z0-9-]{1,39}$/; // 2 a 40: minúsculas, números y guiones
export function activeSuiteOf(s: { suites?: unknown; activeSuite?: unknown } | null | undefined): Suite {
  const list = Array.isArray(s?.suites) ? (s!.suites as Suite[]) : [];
  return list.find((x) => x.id === s?.activeSuite) ?? list[0] ?? SUITE_DEFAULT;
}

// ---- Links del canal ----
// La salida del canal es UNA sola señal (la parrilla del Copiloto; cuando el Host abre Stream, pasa a Stream) con dos
// links fijos: uno horizontal y uno vertical, /output/<nombre>. No llevan colección: siempre usan la suite activa.
// El Admin sólo puede prender o apagar el audio, cambiarles el nombre o regenerarlos si se filtran.
export interface OutputLink {
  slug: string;
  orientation: "horizontal" | "vertical";
  audio: boolean;
  updated_at?: string;
}
// 3 a 40 caracteres: minúsculas, números y guiones (sin guion al principio).
export const OUTPUT_LINK_SLUG_RE = /^[a-z0-9][a-z0-9-]{2,39}$/;
// Nombres que chocan con archivos o carpetas del output.
export const OUTPUT_LINK_RESERVED = ["assets", "clima", "output", "api", "index", "index.html", "favicon.ico", "socket.io"];

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
  "link:update": (l: { slug: string }) => void; // cambió un link del canal: los outputs que lo usan lo vuelven a leer
  // Stream (radio manual): estado que el Host manda al output y señalización WebRTC panel <-> output.
  "radio:state": (s: RadioState) => void;
  "radio:viewer": (id: string) => void; // (al Host) se conectó un output receptor
  "radio:viewer-left": (id: string) => void;
  "radio:signal": (msg: { from: string; data: unknown }) => void;
}
// Estado de Stream (radio manual). Lo escribe el Host desde el panel; lo lee el output `?radio=1`.
export interface RadioState {
  tx: boolean; // transmisión abierta
  pad: { kind: "item" | "session"; id: string } | null; // contenido al aire (en loop); null = placa de espera
  cam: "off" | "full" | "pip"; // cámara del Host: apagada, pantalla completa o recuadro
  mic: boolean; // micrófono abierto (el output baja el clip)
  duck: number; // % de volumen del clip mientras el micrófono está abierto
  music: boolean; // música de fondo (el tema activo de Ajustes → Música) encendida en Stream
  at: number; // ms, momento de la última actualización
}
export const RADIO_STATE_DEFAULT: RadioState = { tx: false, pad: null, cam: "off", mic: false, duck: 25, music: false, at: 0 };

export interface ClientToServerEvents {
  "radio:host-join": (token: string, ack?: (ok: boolean) => void) => void;
  "radio:viewer-join": (key: string, ack?: (ok: boolean) => void) => void;
  "radio:signal": (msg: { to: string; data: unknown }) => void;
  // reservado para futuras acciones del panel (ej: forzar refetch)
  "data:request": (source: SourceId) => void;
}

// Determina si un contenido tipado trae audio propio (para el VU del Monitor de
// Programación). No es una medición real de audio, es heurística por tipo/data.
export function contentHasAudio(type: string, data: Record<string, any> = {}): boolean {
  if (data?.audio_url) return true;
  if (type === "camaras") return false; // las cámaras nunca llevan audio
  if (type === "shorts" || type === "promos") return true; // siempre video de YouTube
  if (type === "cartelera") return !!(data?.trailer_id || data?.short_id || data?.video_url); // trailer/short de YouTube o video propio
  if (type === "lista") return Array.isArray(data?.items) && data.items.some((i: any) => i?.audio_url);
  if (type === "efemerides" && Array.isArray(data?.more) && data.more.some((m: any) => m?.media_kind === "video")) return true;
  const kind = data?.media_kind;
  return kind === "video" || kind === "youtube";
}

// ---- Roles y permisos ----
// Cuatro perfiles con jerarquía. Los permisos se aplican en el SERVIDOR (requirePerm) y el panel sólo
// los usa para mostrar/ocultar secciones.
export type Role = "master" | "administrador" | "programador" | "generador" | "host";
export const ROLES: Role[] = ["master", "administrador", "programador", "generador", "host"];
export const ROLE_LABEL: Record<Role, string> = {
  master: "Master",
  administrador: "Administrador",
  programador: "Programador",
  generador: "Generador de contenidos",
  host: "Host",
};
export const ROLE_RANK: Record<Role, number> = { master: 4, administrador: 3, programador: 2, host: 2, generador: 1 };

export type Perm =
  | "programar" // Programación: armar la parrilla, enviar a vivo, cortar el aire
  | "contenidos" // crear y ver contenidos (todos los roles)
  | "plantillas_ver" // ver las plantillas (solo lectura)
  | "plantillas_editar" // modificar plantillas
  | "camaras" // agregar/editar cámaras
  | "fuentes" // ver el estado de las fuentes de datos / APIs
  | "reportes"
  | "ajustes"
  | "ajustes_medios" // Ajustes: Shorts, Música y Programas (todos los que tienen "ajustes" + el Host)
  | "perfiles" // invitar/editar/desactivar personas (salvo Master)
  | "eliminar_personas" // borrar personas
  | "vaciar_papelera" // borrar definitivamente (de la papelera)
  | "config_sistema" // configuración sensible del sistema (ej. tiempos de inactividad)
  | "sesiones" // ver/editar las sesiones (playlists propias) que le fueron asignadas
  | "sesiones_admin" // crear/borrar sesiones y asignar quién las gestiona
  | "stream"; // operar Stream (la radio manual: transmisión, botonera, micrófono y cámara)

export const ROLE_PERMS: Record<Role, Perm[]> = {
  master: ["programar", "contenidos", "plantillas_ver", "plantillas_editar", "camaras", "fuentes", "reportes", "ajustes", "ajustes_medios", "perfiles", "eliminar_personas", "vaciar_papelera", "config_sistema", "sesiones", "sesiones_admin", "stream"],
  administrador: ["programar", "contenidos", "plantillas_ver", "camaras", "reportes", "ajustes", "ajustes_medios", "perfiles", "vaciar_papelera", "sesiones", "sesiones_admin", "stream"],
  programador: ["programar", "contenidos", "camaras", "fuentes", "ajustes", "ajustes_medios", "sesiones", "stream"],
  generador: ["contenidos", "sesiones"],
  // Host: como un Programador pero SIN programar (no usa Copiloto) y con Ajustes acotados a Shorts, Música y Programas
  // (sin Banco, íconos del clima, plataformas ni newsticker). Opera Stream y prepara contenidos.
  host: ["contenidos", "camaras", "fuentes", "ajustes_medios", "sesiones", "stream"],
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
  if (actor === "administrador") return ["administrador", "programador", "generador", "host"];
  return [];
}

// Minutos de inactividad tras los cuales se cierra la sesión (configurable por el Master en Ajustes).
export const IDLE_MINUTES_DEFAULT: Record<Role, number> = { generador: 20, host: 15, programador: 15, administrador: 10, master: 10 };

// Adónde mandar a cada rol al entrar (primera sección a la que tiene acceso).
export function homeFor(role: Role): string {
  if (can(role, "programar")) return "/";
  if (can(role, "stream")) return "/stream";
  return "/contenido";
}

export * from "./elecciones";
export * from "./elecciones-paises";
export * from "./elecciones-brasil";
