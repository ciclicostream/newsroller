import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { matchBrCandidate, type ElectionAbroad, type ElectionCandidate, type ElectionCity, type ElectionLive, type ElectionState } from "@newsroller/shared";
import type { TseCollector } from "./collector.js";
import type { CandidateResult } from "./types.js";

// Adaptador TSE → placa de Elecciones. El TSE no publica colores de partido: se asignan de una paleta estable por
// número de candidato y se pueden fijar a mano en `candidate-colors.json` ({"13": "#E0242B", …}).
const PALETTE = ["#2F6BFF", "#E0553A", "#2BB673", "#F2B134", "#A66BFF", "#12B5CB", "#E64A9B", "#8A93A6", "#7ED321", "#FF8A3D", "#4CC9F0", "#B5179E", "#90BE6D"];
function overrides(): Record<string, string> {
  const f = path.resolve(fileURLToPath(import.meta.url), "../candidate-colors.json");
  try { return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as Record<string, string>) : {}; } catch { return {}; }
}
// Estable: el color sale del orden por número de candidato (no del ranking), así no cambia cuando cambian las posiciones.
const colorOf = (number: string, o: Record<string, string>, order: string[]) => o[number] ?? PALETTE[order.indexOf(number) % PALETTE.length]!;

const SMALL = new Set(["de", "da", "do", "das", "dos", "e"]);
/** "LUIZ INÁCIO LULA DA SILVA" → "Luiz Inácio Lula da Silva". */
export function titleCase(s: string): string {
  return s.toLocaleLowerCase("pt-BR").split(/\s+/).map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toLocaleUpperCase("pt-BR") + w.slice(1))).join(" ");
}
const isUpper = (s: string) => s === s.toLocaleUpperCase("pt-BR");

export function buildElectionLive(c: TseCollector): ElectionLive {
  const br = c.store.get("br")?.result;
  const source = "TSE · Tribunal Superior Eleitoral";
  const round = c.election?.round ?? 1;
  if (!br) return { available: false, updated_at: null, fetched_at: null, round, counted_pct: 0, candidates: [], states: [], cities: [], abroad: null, outcome: "open", totalized_final: false, source };
  const o = overrides();
  // Entran los candidatos con voto válido o sub judice; los "Anulado" (registro rechazado) no cuentan para nadie.
  const shown: CandidateResult[] = br.candidates.filter((x) => x.vote_destination === "Válido" || x.vote_destination === "Anulado sub judice");
  const order = [...new Set(shown.map((x) => x.number))].sort((a, b) => Number(a) - Number(b));
  // Precarga de candidatos (nombre, partido, color y foto ya cargados); los que no estén en la lista usan lo del TSE.
  const candidates: ElectionCandidate[] = shown.map((x) => {
    const pre = matchBrCandidate(x.ballot_name, x.name);
    return {
      name: pre?.name ?? (isUpper(x.ballot_name) ? titleCase(x.ballot_name) : x.ballot_name),
      party: pre?.party ?? x.party, color: pre?.color ?? colorOf(x.number, o, order), photo_url: pre?.photo_url ?? x.photo_url,
      pct: x.percentage_tse ?? x.percentage_valid_calc ?? 0, votes: x.votes,
    };
  });
  const idxById = new Map(shown.map((x, i) => [x.id, i]));
  const states: ElectionState[] = [];
  for (const sr of c.store.all()) {
    if (!sr.key.startsWith("uf:")) continue;
    const r = sr.result;
    const lead = r.candidates.filter((x) => idxById.has(x.id))[0]; // ya vienen ordenados por votos
    if (!lead || !r.geography.uf || !r.totals.valid) continue;
    states.push({ id: r.geography.uf, winner: idxById.get(lead.id)!, pct: lead.percentage_tse ?? lead.percentage_valid_calc ?? undefined, votes: lead.votes });
  }
  // Ciudades seguidas (en el orden de la configuración): los 4 más votados de cada una.
  const cities: ElectionCity[] = [];
  for (const m of c.trackedMunicipalities()) {
    if (m.uf === "ZZ") continue; // las ciudades del exterior van en `abroad`, no en "Principales ciudades"
    const r = c.store.get(`mun:${m.uf}:${m.code}`)?.result;
    if (!r || !r.totals.valid) continue;
    const top = r.candidates.filter((x) => idxById.has(x.id)).slice(0, 4).map((x) => ({ i: idxById.get(x.id)!, pct: x.percentage_tse ?? x.percentage_valid_calc ?? 0, votes: x.votes }));
    cities.push({ id: m.code, name: isUpper(m.name) ? titleCase(m.name) : m.name, uf: m.uf, counted_pct: r.totalization.percentage ?? 0, top });
  }
  const abroad = buildAbroad(c, shown.map((x) => x.id));
  const statuses = br.candidates.map((x) => x.status ?? "");
  let outcome: "open" | "winner" | "runoff" = statuses.some((s) => /^eleito/i.test(s)) ? "winner" : statuses.some((s) => /2º turno/i.test(s)) ? "runoff" : "open";
  const pct = br.totalization.percentage ?? 0;
  // Sellado y al 100 %: el TSE no llegó a marcar el desenlace, pero la cuenta es la de la ley (mayoría absoluta de válidos).
  if (c.store.frozen && outcome === "open" && pct >= 100 && candidates.length >= 2) outcome = candidates[0]!.pct > 50 ? "winner" : "runoff";
  return {
    available: true, updated_at: br.times.totalization_time, fetched_at: br.times.fetched_at, round: br.election.round,
    counted_pct: pct, candidates, states, cities, abroad, outcome, totalized_final: pct >= 100, source,
  };
}

// Brasileños en Argentina: suma de las ciudades consulares argentinas que informa el TSE (UF "ZZ"). Buenos Aires y Córdoba
// van aparte; el resto (Mendoza, Paso de los Libres, Puerto Iguazú) se agrupa en "Otras ciudades".
function buildAbroad(c: TseCollector, shownIds: string[]): ElectionAbroad | null {
  const idx = new Map(shownIds.map((id, i) => [id, i]));
  const rs = c.trackedMunicipalities().filter((m) => m.uf === "ZZ").map((m) => ({ m, r: c.store.get(`mun:ZZ:${m.code}`)?.result })).filter((x): x is { m: typeof x.m; r: NonNullable<typeof x.r> } => !!x.r);
  if (!rs.length) return null;
  const sum = (f: (r: (typeof rs)[number]["r"]) => number | null) => rs.reduce((a, x) => a + (f(x.r) ?? 0), 0);
  const votes = new Map<string, number>();
  for (const { r } of rs) for (const cd of r.candidates) if (idx.has(cd.id)) votes.set(cd.id, (votes.get(cd.id) ?? 0) + cd.votes);
  const valid = sum((r) => r.totals.valid);
  const cand = [...votes.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([id, v]) => ({ i: idx.get(id)!, votes: v, pct: valid ? (v / valid) * 100 : 0 }));
  const group = (n: string) => (n === "BUENOS AIRES" ? "Buenos Aires" : n === "CÓRDOBA" ? "Córdoba" : "Otras ciudades");
  // Por grupo: electores y los candidatos más votados (el primero es quien ganó en esa ciudad / grupo de ciudades).
  const byGroup = new Map<string, { electorate: number; valid: number; votes: Map<string, number> }>();
  for (const { m, r } of rs) {
    const g = byGroup.get(group(m.name)) ?? { electorate: 0, valid: 0, votes: new Map<string, number>() };
    g.electorate += r.totals.electorate ?? 0;
    g.valid += r.totals.valid ?? 0;
    for (const cd of r.candidates) if (idx.has(cd.id)) g.votes.set(cd.id, (g.votes.get(cd.id) ?? 0) + cd.votes);
    byGroup.set(group(m.name), g);
  }
  const cities = ["Buenos Aires", "Córdoba", "Otras ciudades"].filter((n) => byGroup.has(n)).map((name) => {
    const g = byGroup.get(name)!;
    const top = [...g.votes.entries()].filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([id, v]) => ({ i: idx.get(id)!, votes: v, pct: g.valid ? (v / g.valid) * 100 : 0 }));
    return { name, electorate: g.electorate || null, top };
  });
  const exp = sum((r) => r.totalization.sections_expected), tot = sum((r) => r.totalization.sections_totalized);
  const times = rs.map((x) => x.r.times.totalization_time).filter((t): t is string => !!t).sort();
  return {
    country_name: "Argentina", electorate: sum((r) => r.totals.electorate) || null,
    cities,
    bulletins_expected: exp || null, bulletins_received: sum((r) => r.totalization.sections_received) || null, bulletins_totalized: tot || null,
    totalized_pct: exp ? (tot / exp) * 100 : null, updated_at: times.length ? times[times.length - 1]! : null,
    candidates: cand,
  };
}
