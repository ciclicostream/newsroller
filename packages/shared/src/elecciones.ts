// Datos del tipo "elecciones" (vive en Informes): resultados electorales de un país. Presidencial (1ª o 2ª vuelta)
// o parlamentaria (partidos). Tres pantallas que rotan: ganador, principales y votación por estado.
// Etapas, en orden. Cada una agrega algo a lo anterior; nunca se muestra una pantalla sin datos.
export type ElectionPhase = "apertura" | "cierre" | "resultados" | "preliminar" | "definitivo";
export const ELECTION_PHASES: { id: ElectionPhase; label: string; short: string; hint: string }[] = [
  { id: "apertura", label: "Comicios abiertos", short: "Apertura", hint: "Sólo la placa de arranque." },
  { id: "cierre", label: "Se cierran las urnas", short: "Cierre", hint: "Sólo la placa de arranque, con el cierre y el inicio del escrutinio." },
  { id: "resultados", label: "Primeros resultados", short: "Resultados", hint: "Más votados y votación por estado, a medida que se cargan. Sin ganador." },
  { id: "preliminar", label: "Conteo preliminar", short: "Conteo prelim.", hint: "Suma la pantalla del ganador, marcada como conteo preliminar." },
  { id: "definitivo", label: "Ganador definitivo", short: "Ganador final", hint: "El ganador, ya sin 'preliminar'." },
];
export type ElectionIntroMode = "solo" | "con" | "sin";
export type ElectionScreen = "intro" | "winner" | "runoff" | "top" | "states" | "cities" | "abroad";
export type ElectionKind = "presidencial" | "parlamentaria";
export interface ElectionCandidate {
  name: string; // candidato (o partido, en parlamentaria)
  party?: string; // partido o frente (en parlamentaria no se usa)
  color: string; // color del partido, #RRGGBB; pinta barras, mapa y burbujas
  photo_url?: string | null; // sin foto: iniciales sobre el color
  pct: number; // 0–100
  votes?: number;
}
export interface ElectionState {
  id: string; // id de la precarga del país (ver ELECTION_COUNTRIES)
  winner: number; // índice en candidates; -1 = sin datos todavía
  pct?: number; // % del ganador en ese estado
  votes?: number; // votos totales del ganador en ese estado
}
// Resultado de una ciudad (capital seguida): los 4 más votados con índice en `candidates`.
export interface ElectionCity {
  id: string; // código TSE del municipio
  name: string; // "São Paulo"
  uf: string; // "SP"
  counted_pct: number; // % de secciones totalizadas de la ciudad
  top: { i: number; pct: number; votes: number }[];
}
// Voto de brasileños en el exterior, en un país (hoy Argentina): lo agrega el colector desde las ciudades del TSE.
export interface ElectionAbroad {
  country_name: string; // "Argentina"
  electorate: number | null; // electores habilitados
  cities: { name: string; electorate: number | null; top: { i: number; votes: number; pct: number }[] }[]; // Buenos Aires, Córdoba, Otras ciudades: quién ganó (top[0]) y los siguientes
  bulletins_expected: number | null;
  bulletins_received: number | null; // boletines (BU) recibidos
  bulletins_totalized: number | null;
  totalized_pct: number | null;
  updated_at: string | null; // última totalización, hora de Brasilia (ISO con -03:00)
  candidates: { i: number; votes: number; pct: number }[]; // en todo el país, por votos; i = índice en `candidates`. La placa muestra los 3 primeros
}
export interface ElectionData {
  country: string; // id del país con precarga (ar, br, us, fr, sv)
  kind: ElectionKind;
  round?: 1 | 2; // sólo presidencial
  title?: string; // por defecto "Elecciones presidenciales" etc.
  year?: string;
  candidates: ElectionCandidate[]; // 2 a 10
  states: ElectionState[];
  source: string;
  counted_pct: number; // % de votos o mesas escrutadas, 0–100
  phase: ElectionPhase; // etapa de la noche; define qué pantallas pueden emitirse (ver electionScreens)
  intro?: ElectionIntroMode; // placa de arranque: sola, antes de los resultados o sin ella. Por defecto "con"
  voting_hours?: string; // "08:00 a 17:00 hs", sólo en la placa de arranque
  electorate?: string; // "156 millones de electores", sólo en la placa de arranque
  winner_override?: string; // nombre del candidato que el editor confirma como ganador (por si las noticias lo dan y el TSE no lo marca): fuerza etapa "definitivo" y la tarjeta de ganador
  outcome?: "open" | "winner" | "runoff"; // lo informa el TSE en modo auto: "runoff" = nadie ganó en 1ª vuelta
  auto?: "tse-br"; // datos en vivo del TSE (sólo Brasil): reemplazan candidatos, estados y % escrutado; el resto sigue manual
  abroad?: ElectionAbroad; // en modo auto: paso "Brasileños en Argentina"
  cities?: ElectionCity[]; // en modo auto: las ciudades que informa el TSE; sin ellas no hay pantalla de ciudades
  screens?: { winner?: boolean; top?: boolean; states?: boolean; cities?: boolean; abroad?: boolean }; // por defecto todas las que tengan datos
  sec_per_screen?: number; // segundos con la placa ya armada (mínimo y por defecto 20)
}
export const ELECTION_MAX_CANDIDATES = 12;
export const ELECTION_TOP_N = 5;

export const electionPhase = (d: Pick<ElectionData, "phase">): ElectionPhase => d.phase ?? "apertura";

// Fuente única de la lógica de emisión (la usan el panel y el aire): qué pantallas salen, en orden, con los datos que
// hay hoy. Una pantalla sólo entra si tiene con qué llenarse; sin resultados siempre queda, al menos, el arranque.
export function electionScreens(d: Pick<ElectionData, "auto" | "phase" | "intro" | "screens" | "candidates" | "states" | "counted_pct" | "country" | "outcome" | "cities" | "abroad" | "winner_override">): ElectionScreen[] {
  const rank = d.winner_override ? ELECTION_PHASES.length - 1 : ELECTION_PHASES.findIndex((p) => p.id === electionPhase(d));
  const mode = d.intro ?? "con";
  const withPct = (d.candidates ?? []).filter((c) => c.name?.trim() && c.pct > 0);
  const hasResults = rank >= 2 && withPct.length >= 2 && (d.counted_pct ?? 0) > 0;
  if (mode === "solo" || !hasResults) return ["intro"];
  const on = d.screens ?? {};
  const l: ElectionScreen[] = [];
  // En modo auto (TSE), con resultados en pantalla la placa de arranque ya cumplió: se va directo a los resultados.
  if (mode === "con" && !d.auto) l.push("intro");
  if (rank >= 3 && on.winner !== false) l.push(d.outcome === "runoff" && !d.winner_override ? "runoff" : "winner");
  if (on.top !== false) l.push("top");
  const hasStates = (d.states ?? []).some((s) => s.winner >= 0) && ELECTION_COUNTRIES_IDS.includes(d.country);
  if (on.states !== false && hasStates) l.push("states");
  if (on.cities !== false && (d.cities?.length ?? 0) > 0) l.push("cities");
  if (on.abroad !== false && (d.abroad?.candidates.length ?? 0) > 0) l.push("abroad");
  return l.length ? l : ["intro"];
}
const ELECTION_COUNTRIES_IDS = ["ar", "br", "us", "fr", "sv"];

// Respuesta de GET /api/tse/live/br-presidente: lo que el modo "auto" de la placa pisa sobre los datos manuales.
export interface ElectionLive {
  available: boolean; // false mientras el TSE no publicó resultados
  updated_at: string | null; // última totalización (hora de Brasilia, ISO con -03:00)
  fetched_at: string | null;
  round: 1 | 2;
  counted_pct: number;
  candidates: ElectionCandidate[]; // ordenados por votos; los índices de `states[].winner` apuntan acá
  states: ElectionState[];
  cities: ElectionCity[];
  abroad: ElectionAbroad | null;
  outcome: "open" | "winner" | "runoff";
  totalized_final: boolean; // 100 % de las secciones totalizadas
  source: string;
}

// Tiempos de la placa: cada pantalla necesita ENTER segundos para terminar de armarse y después queda al menos HOLD_MIN
// segundos completa antes de pasar a la siguiente. La duración del bloque debe cubrir todo eso o la salida lo corta.
export const ELECTION_HOLD_MIN_SEC = 20;
export const ELECTION_ENTER_SEC = 7;
export const ELECTION_EXIT_SEC = 2;
export const electionHold = (sec: number | undefined): number => Math.max(ELECTION_HOLD_MIN_SEC, sec ?? ELECTION_HOLD_MIN_SEC);
export const electionDuration = (screens: number, sec?: number): number => Math.max(1, screens) * (ELECTION_ENTER_SEC + electionHold(sec)) + ELECTION_EXIT_SEC;
