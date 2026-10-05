import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TseEnv } from "./types.js";

// Configuración del colector. Todo se puede cambiar por variables de entorno (ver README del colector).
const num = (n: string, d: number) => { const v = Number(process.env[n]); return Number.isFinite(v) && process.env[n] ? v : d; };
const str = (n: string, d: string) => process.env[n]?.trim() || d;

export const ARGENTINA_CITIES = ["BUENOS AIRES", "CÓRDOBA", "MENDOZA", "PASO LOS LIBRES", "PUERTO IGUAZÚ"] as const;
export interface MunicipalSelection { uf: string; all?: boolean; names?: string[] }

// Resultados finales sellados (1ª vuelta 2026): si existe `server/tse-final/seal.json` el colector NO consulta al TSE y todo sale
// de ese archivo de sólo lectura. Sólo se levanta con TSE_DESCONGELAR=1 (acceso al servidor), nunca desde el panel ni la API.
const FINAL_DIR = path.resolve(fileURLToPath(import.meta.url), "../../../tse-final");

export function tseConfig() {
  const env = (str("TSE_ENV", "oficial") === "simulado" ? "simulado" : "oficial") as TseEnv;
  return {
    // Activo por defecto (apuntando al TSE oficial): hay que apagarlo a propósito con TSE_ENABLED=0. Antes de la publicación sólo pide el catálogo y EA14 con espera creciente.
    finalDir: FINAL_DIR,
    frozen: existsSync(path.join(FINAL_DIR, "seal.json")) && str("TSE_DESCONGELAR", "0") !== "1",
    enabled: !["0", "false", "no"].includes(str("TSE_ENABLED", "1").toLowerCase()),
    env,
    cycle: str("TSE_CICLO", "ele2026"),
    pleito: str("TSE_PLEITO", env === "oficial" ? "3220" : ""), // en el simulado el pleito lo resuelve el catálogo
    round: (str("TSE_VUELTA", "1") === "2" ? 2 : 1) as 1 | 2,
    cargo: "1", // Presidente
    // Intervalo entre ciclos: el TSE recomienda ≥ 60 s. Se puede bajar sólo explícitamente (mínimo duro 20 s).
    pollMs: Math.max(20_000, num("TSE_POLL_MS", 60_000)),
    minGapMs: Math.max(100, num("TSE_MIN_GAP_MS", 250)), // separación entre requests
    maxFilesPerCycle: num("TSE_MAX_FILES_CICLO", 80), // tope de EA20 municipales por ciclo (el resto queda en cola)
    catalogEveryMs: 5 * 60_000,
    municipalitiesEveryMs: 6 * 60 * 60_000,
    includeAbroad: str("TSE_INCLUIR_EXTERIOR", "0") === "1", // "ZZ"
    // Municipios seguidos: sólo las 5 capitales pedidas. Los códigos se resuelven por nombre desde EA12 (no se hardcodean).
    // Se puede ampliar con { uf: "SP", all: true } para una UF completa (eso activa el EA15 de esa UF para detectar cambios).
    municipalities: [
      { uf: "SP", names: ["SÃO PAULO"] }, { uf: "RJ", names: ["RIO DE JANEIRO"] }, { uf: "BA", names: ["SALVADOR"] },
      { uf: "MG", names: ["BELO HORIZONTE"] }, { uf: "DF", names: ["BRASÍLIA"] },
      // Brasileños votando en Argentina: las ciudades del exterior (UF "ZZ") donde el TSE tiene sección consular.
      { uf: "ZZ", names: [...ARGENTINA_CITIES] },
    ] as MunicipalSelection[],
    dataDir: str("TSE_DATA_DIR", path.resolve(fileURLToPath(import.meta.url), "../../../.tse-data")),
    userAgent: str("TSE_USER_AGENT", "NewsRoller-Ciclico/1.0 (resultados electorales; somosciclico.com)"),
  };
}
export type TseConfig = ReturnType<typeof tseConfig>;

export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;
