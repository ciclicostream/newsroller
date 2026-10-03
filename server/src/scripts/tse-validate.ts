// Validación EN VIVO del colector contra el entorno de simulado del TSE (nunca contra producción).
//   npx tsx src/scripts/tse-validate.ts            → simulado
// Ejecuta 2 ciclos con los 9 ámbitos pedidos y verifica estructura, sumas, tiempos y volumen de requests.
import { TseCollector } from "../tse/collector.js";
import { tseConfig } from "../tse/config.js";
import { TseHttp } from "../tse/http.js";
import { TseStore } from "../tse/store.js";
import { buildElectionLive } from "../tse/live.js";

const cfg = {
  ...tseConfig(), enabled: true, env: "simulado" as const, pleito: "", dataDir: "",
  municipalities: [
    { uf: "SP", names: ["SÃO PAULO"] }, { uf: "RJ", names: ["RIO DE JANEIRO"] }, { uf: "BA", names: ["SALVADOR"] },
    { uf: "MG", names: ["BELO HORIZONTE"] }, { uf: "DF", names: ["BRASÍLIA"] },
  ],
};
const http = new TseHttp({ minGapMs: cfg.minGapMs, userAgent: cfg.userAgent });
const c = new TseCollector(cfg, http, new TseStore(null));

let fails = 0;
const check = (ok: boolean, msg: string) => { if (!ok) fails++; console.log(`${ok ? "  ✔" : "  ✘"} ${msg}`); };

const t0 = Date.now();
await c.cycle();
const n1 = http.totals.requests;
console.log(`\nCiclo 1: ${n1} requests en ${((Date.now() - t0) / 1000).toFixed(1)} s · ${(http.totals.bytes / 1024).toFixed(0)} KB · 404: ${http.totals.notFound}`);
console.log(`Elección: ${c.election?.electionName} (${c.election?.electionId}) · fase: ${c.phase}\n`);

const targets: [string, string][] = [
  ["Brasil", "br"], ["São Paulo (UF)", "uf:SP"], ["Rio de Janeiro (UF)", "uf:RJ"], ["Bahia (UF)", "uf:BA"],
  ["São Paulo (municipio)", "mun:SP:71072"], ["Rio de Janeiro (municipio)", "mun:RJ:60011"], ["Salvador", "mun:BA:38490"],
  ["Belo Horizonte", "mun:MG:41238"], ["Brasília", "mun:DF:97012"],
];
for (const [label, key] of targets) {
  console.log(label);
  const s = c.store.get(key);
  check(!!s, `existe en el almacén (${key})`);
  if (!s) continue;
  const r = s.result;
  check(r.election.office === "Presidente" && r.election.office_code === "1", `cargo = ${r.election.office}`);
  check(r.election.election_id === c.election!.electionId, `elección federal ${r.election.election_id}`);
  const valid = r.candidates.filter((x) => x.vote_destination === "Válido");
  check(valid.reduce((a, x) => a + x.votes, 0) === r.totals.valid, `votos de candidatos válidos suman los votos válidos (${r.totals.valid})`);
  const pct = valid.reduce((a, x) => a + (x.percentage_valid_calc ?? 0), 0);
  check(Math.abs(pct - 100) < 1e-6, `% calculados suman 100 (${pct.toFixed(4)})`);
  check(!!r.times.fetched_at && !!r.times.file_generated_at && !!r.times.totalization_time && !!r.idg, `tiempos separados: consulta ${r.times.fetched_at.slice(11, 19)}Z · archivo ${r.times.file_generated_at} · totalización ${r.times.totalization_time}`);
  check(r.raw_sha256.length === 64, `sha256 ${r.raw_sha256.slice(0, 12)}…`);
  check(r.totalization.sections_expected !== null, `secciones ${r.totalization.sections_totalized}/${r.totalization.sections_expected} (${r.totalization.percentage} %)`);
  check(r.parties.length > 0, `${r.parties.length} partidos agregados, ${r.groupings.length} agrupamientos (federaciones/coaliciones)`);
}

console.log("\nNo confundir ámbitos");
const br = c.store.get("br")!.result;
check(br.geography.type === "BR", "el resultado nacional es BR, no una suma de UFs");
const ufs = c.store.all().filter((s) => s.key.startsWith("uf:"));
const sumUf = ufs.reduce((a, s) => a + (s.result.totals.valid ?? 0), 0);
console.log(`  · ${ufs.length} UFs descargadas; Σ votos válidos de UFs = ${sumUf.toLocaleString("es")} vs nacional ${br.totals.valid?.toLocaleString("es")} (el simulado no garantiza coincidencia; el colector nunca reemplaza uno por el otro)`);
check(br.totals.valid! >= Math.max(...ufs.map((s) => s.result.totals.valid ?? 0)), "el nacional es ≥ cualquier UF");
const mun = c.store.get("mun:SP:71072")!.result, sp = c.store.get("uf:SP")!.result;
check(mun.geography.type === "MUNICIPIO" && mun.totals.valid! <= sp.totals.valid!, "municipio SP ≤ UF SP (ámbitos distintos)");

const live = buildElectionLive(c);
console.log(`\nAdaptador para la placa: ${live.candidates.length} candidatos, ${live.states.length} estados, escrutado ${live.counted_pct} %, desenlace "${live.outcome}"`);
check(live.available && live.states.length >= 20, "placa 'Por estado' recibe ganador de las UFs");

const t1 = Date.now();
await c.cycle();
const n2 = http.totals.requests - n1;
console.log(`\nCiclo 2 (sin cambios): ${n2} request(s)`);
check(n2 <= 2, `sólo EA14 con If-None-Match${n2 ? "" : ""} (304: ${http.totals.notModified})`);

const perSec = n1 / Math.max(1, (t1 - t0) / 1000);
console.log(`\nVolumen: ${http.totals.requests} requests totales, pico ≈ ${perSec.toFixed(1)}/s (límite del TSE: 100/s) · bloqueos: ${http.totals.blocked}`);
check(perSec < 10, "ritmo muy por debajo del límite");
check(http.totals.blocked === 0, "sin 429/403");
console.log(fails ? `\n✘ ${fails} verificación(es) fallaron` : "\n✔ todo OK");
process.exit(fails ? 1 : 0);
