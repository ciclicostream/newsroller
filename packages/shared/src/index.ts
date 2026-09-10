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

// Eventos de Socket.IO server -> clientes.
export interface ServerToClientEvents {
  "data:update": (data: CachedData) => void;
  "sources:status": (statuses: SourceStatus[]) => void;
}
export interface ClientToServerEvents {
  // reservado para futuras acciones del panel (ej: forzar refetch)
  "data:request": (source: SourceId) => void;
}
