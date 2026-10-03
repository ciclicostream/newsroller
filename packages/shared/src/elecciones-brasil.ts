// Precarga de los candidatos presidenciales de Brasil 2026: nombre, partido, color y foto ya cargados.
// Las fotos viven en apps/output/public/elecciones/br (se sirven con la app, bajo /output/).
// `aliases` sirve para reconocer a cada uno en los datos del TSE (nombre de urna, sin tildes ni mayúsculas).
export interface BrCandidatePreset {
  slug: string;
  name: string;
  party: string; // "Partido de los Trabajadores · PT"
  color: string; // color propio del candidato en barras, mapa y burbujas
  photo_url: string;
  aliases: string[];
}
const photo = (s: string) => `/output/elecciones/br/${s}.jpg`;
export const BR_CANDIDATES: BrCandidatePreset[] = [
  { slug: "lula", name: "Luiz Inácio Lula da Silva", party: "Partido de los Trabajadores · PT", color: "#E5303A", photo_url: photo("lula"), aliases: ["lula"] },
  { slug: "flavio", name: "Flávio Bolsonaro", party: "Partido Liberal · PL", color: "#2F6BFF", photo_url: photo("flavio"), aliases: ["flavio bolsonaro"] },
  { slug: "caiado", name: "Ronaldo Caiado", party: "PSD", color: "#F2B134", photo_url: photo("caiado"), aliases: ["caiado"] },
  { slug: "zema", name: "Romeu Zema", party: "Partido Novo", color: "#FF8A3D", photo_url: photo("zema"), aliases: ["zema"] },
  { slug: "cury", name: "Augusto Cury", party: "Avante", color: "#2BB673", photo_url: photo("cury"), aliases: ["cury"] },
  { slug: "renan", name: "Renan Santos", party: "Movimiento Missão", color: "#A66BFF", photo_url: photo("renan"), aliases: ["renan santos"] },
  { slug: "samara", name: "Samara Martins", party: "UP", color: "#E64A9B", photo_url: photo("samara"), aliases: ["samara"] },
  { slug: "hertz", name: "Hertz Dias", party: "PSTU", color: "#12B5CB", photo_url: photo("hertz"), aliases: ["hertz"] },
  { slug: "edmilson", name: "Edmilson Costa", party: "PCB", color: "#8A93A6", photo_url: photo("edmilson"), aliases: ["edmilson"] },
  { slug: "rui", name: "Rui Costa Pimenta", party: "Partido de la Causa Obrera · PCO", color: "#7ED321", photo_url: photo("rui"), aliases: ["rui costa pimenta", "pimenta"] },
  { slug: "clariana", name: "Clariana Barão", party: "Democracia Cristiana · DC", color: "#4CC9F0", photo_url: photo("clariana"), aliases: ["clariana"] },
  { slug: "wilson", name: "Wilson Grassi", party: "Democrata", color: "#B5179E", photo_url: photo("wilson"), aliases: ["grassi"] },
];
export const normName = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
/** Reconoce a un candidato del TSE (nombre de urna / nombre completo) en la precarga; null si no está. */
export function matchBrCandidate(...names: string[]): BrCandidatePreset | null {
  const hay = names.map(normName).filter(Boolean).join(" | ");
  return BR_CANDIDATES.find((c) => c.aliases.some((a) => hay.includes(a))) ?? null;
}
