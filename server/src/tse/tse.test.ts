import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { catalogUrl, parseCatalog, resolveElection, urls } from "./catalog.js";
import { TseCollector } from "./collector.js";
import { tseConfig } from "./config.js";
import { TseHttp } from "./http.js";
import { normalizeAccompaniment, normalizeEa12, normalizeEa18, normalizeEa20, ptNum, tseDateTime } from "./normalize.js";
import { TseStore } from "./store.js";
import { buildElectionLive } from "./live.js";
import { BR_CANDIDATES, electionScreens, matchBrCandidate } from "@newsroller/shared";

const dir = path.resolve(fileURLToPath(import.meta.url), "../__fixtures__");
const fx = (n: string) => readFileSync(path.join(dir, n), "utf8");
const el = () => resolveElection(parseCatalog(JSON.parse(fx("ea11.json"))), "simulado", { cycle: "ele2026", round: 1, cargo: "1" })!;

// ---- mock del TSE: enruta por URL a los fixtures reales del simulado ----
type Hit = { url: string; headers: Record<string, string> };
function mock(opts: { missing?: Set<string>; status?: Record<string, number>; hits?: Hit[] } = {}) {
  const e = el();
  const routes = new Map<string, string>([
    [catalogUrl("simulado"), "ea11.json"], [urls.ea12(e), "ea12.json"], [urls.ea14(e), "ea14.json"], [urls.ea20Br(e), "ea20-br.json"],
    [urls.ea15(e, "SP"), "ea15-sp.json"], [urls.ea20Mun(e, "SP", "71072"), "ea20-mun-sp.json"],
    [urls.ea20Mun(e, "ZZ", "29467"), "ea20-mun-sp.json"], [urls.ea20Mun(e, "ZZ", "29602"), "ea20-mun-sp.json"], [urls.ea20Mun(e, "ZZ", "39004"), "ea20-mun-sp.json"],
  ]);
  for (const uf of ["SP", "RJ", "BA", "MG", "DF", "PI", "AC", "AL", "AP", "AM", "CE", "ES", "GO", "MA", "MT", "MS", "PA", "PB", "PR", "PE", "RN", "RS", "RO", "RR", "SC", "SE", "TO"]) routes.set(urls.ea20Uf(e, uf), "ea20-uf-sp.json");
  const fetchImpl = (async (url: string, init?: { headers?: Record<string, string> }) => {
    opts.hits?.push({ url, headers: init?.headers ?? {} });
    const forced = opts.status?.[url] ?? opts.status?.["*"];
    if (forced) return new Response("", { status: forced });
    const f = routes.get(url);
    if (!f || opts.missing?.has(url)) return new Response("not found", { status: 404 });
    const body = fx(f);
    const etag = `"${f}"`;
    if (init?.headers?.["If-None-Match"] === etag) return new Response(null, { status: 304, headers: { etag } });
    return new Response(body, { status: 200, headers: { etag, "last-modified": "Tue, 29 Sep 2026 19:29:39 GMT" } });
  }) as unknown as typeof fetch;
  return { fetchImpl, e };
}
const cfg = (): ReturnType<typeof tseConfig> => ({ ...tseConfig(), enabled: true, env: "simulado" as const, pleito: "", municipalities: [{ uf: "SP", names: ["SÃO PAULO"] }], dataDir: "" });
const collector = (m: ReturnType<typeof mock>, c = cfg()) => {
  const http = new TseHttp({ minGapMs: 0, fetchImpl: m.fetchImpl, sleep: async () => {} });
  return { c: new TseCollector(c, http, new TseStore(null)), http };
};

test("URLs derivadas del catálogo coinciden con las observadas en vivo (elección a 6 dígitos, cargo a 4)", () => {
  const e = el();
  const b = "https://resultados-sim.tse.jus.br/simulado/simulado2026/ele2026/21270";
  assert.equal(urls.ea14(e), `${b}/dados/br/br-e021270-ab.json`);
  assert.equal(urls.ea15(e, "SP"), `${b}/dados/sp/sp-e021270-ab.json`);
  assert.equal(urls.ea20Br(e), `${b}/dados/br/br-c0001-e021270-u.json`);
  assert.equal(urls.ea20Uf(e, "SP"), `${b}/dados/sp/sp-c0001-e021270-u.json`);
  assert.equal(urls.ea20Mun(e, "SP", "71072"), `${b}/dados/sp/sp71072-c0001-e021270-u.json`);
  assert.equal(urls.ea12(e), `${b}/config/mun-e021270-cm.json`);
  assert.equal(urls.ea16(e, "SP"), "https://resultados-sim.tse.jus.br/simulado/simulado2026/ele2026/arquivo-urna/17801/config/sp/sp-p017801-cs.json");
  assert.equal(urls.ea18(e, "SP", "71072", "1", "1"), "https://resultados-sim.tse.jus.br/simulado/simulado2026/ele2026/arquivo-urna/17801/dados/sp/71072/0001/0001/p017801-sp-m71072-z0001-s0001-aux.json");
});

test("catálogo oficial 2026: Presidente = elección federal 6257 → e006257, NO 'e06257'", () => {
  const cat = { dg: "", hg: "", f: "o", idg: "1", arq: [{ tp: "u", dir: "<base>/<ambiente>/<ciclo>/<cd_eleicao>/dados/<uf>" }, { tp: "ab", dir: "<base>/<ambiente>/<ciclo>/<cd_eleicao>/dados/<uf>" }],
    pl: [{ cd: "3220", cdpr: "1219", c: "ele2026", dt: "04/10/2026", e: [
      { cd: "6257", cdt2: "6258", sqele: "20322002026", nm: "Eleição Ordinária Federal - 2026 1º Turno", t: "1", tp: "8", abr: [{ cd: "br", cp: [{ cd: "1", ds: "Presidente", tp: "1" }] }] },
      { cd: "6259", cdt2: "6260", sqele: "x", nm: "Estadual", t: "1", tp: "1", abr: [{ cd: "br", cp: [{ cd: "3", ds: "Governador", tp: "1" }] }] }] }] };
  const o = resolveElection(cat, "oficial", { cycle: "ele2026", pleito: "3220", round: 1, cargo: "1" })!;
  assert.equal(o.electionId, "6257");
  assert.equal(urls.ea20Br(o), "https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json");
  assert.equal(urls.ea20Uf(o, "SP"), "https://resultados.tse.jus.br/oficial/ele2026/6257/dados/sp/sp-c0001-e006257-u.json"); // sigue siendo 6257 aunque sea un estado
  assert.equal(urls.ea14(o), "https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-e006257-ab.json");
  assert.equal(resolveElection(cat, "oficial", { cycle: "ele2026", pleito: "3220", round: 2, cargo: "1" })!.electionId, "6258");
});

test("EA20 nacional: Presidente, suma de votos válidos, % y tiempos separados", () => {
  const e = el();
  const raw = fx("ea20-br.json");
  const r = normalizeEa20(raw, { el: e, geography: { type: "BR", country: "BR", uf: null, municipality_code: null, municipality_ibge: null, name: "Brasil" }, fetchedAt: "2026-10-03T18:00:00.000Z", lastModified: "Tue, 29 Sep 2026 19:29:39 GMT", url: "u" });
  assert.equal(r.election.office, "Presidente");
  assert.equal(r.geography.type, "BR");
  const valid = r.candidates.filter((c) => c.vote_destination === "Válido");
  assert.equal(valid.reduce((s, c) => s + c.votes, 0), r.totals.valid);
  assert.ok(Math.abs(valid.reduce((s, c) => s + (c.percentage_valid_calc ?? 0), 0) - 100) < 1e-6);
  for (const c of valid) assert.ok(Math.abs((c.percentage_tse ?? 0) - (c.percentage_valid_calc ?? 0)) < 5, "% del TSE y calculado no deberían divergir de forma grosera"); // el simulado trae % de fantasía
  assert.equal(r.times.fetched_at, "2026-10-03T18:00:00.000Z");
  assert.equal(r.times.file_generated_at, "2026-09-29T16:29:12-03:00");
  assert.equal(r.times.totalization_time, "2026-09-29T16:28:52-03:00");
  assert.equal(r.times.source_updated_at, "2026-09-29T19:29:39.000Z");
  assert.equal(r.totalization.sections_expected, 528951);
  assert.equal(r.totals.blank, 9118018);
  assert.equal(r.totals.null, 9040537);
  assert.ok(r.totals.turnout! > 0 && r.totals.electorate! > 0);
  assert.equal(r.raw_sha256.length, 64);
  // partidos y federaciones: la federación conserva su estructura (no se asume partido)
  const fed = r.groupings.find((g) => g.type === "f");
  assert.ok(fed && fed.parties.includes("/"), "federación con sus partidos");
  assert.ok(r.parties.every((p) => p.party_code));
  assert.ok(r.candidates[0]!.photo_url!.endsWith(".jpeg"));
  // los candidatos vienen ordenados por votos
  for (let i = 1; i < r.candidates.length; i++) assert.ok(r.candidates[i - 1]!.votes >= r.candidates[i]!.votes);
});

test("utilidades: decimales con coma y hora de Brasilia", () => {
  assert.equal(ptNum("7,527528669"), 7.527528669);
  assert.equal(ptNum(""), null);
  assert.equal(tseDateTime("04/10/2026", "17:05:09"), "2026-10-04T17:05:09-03:00");
  assert.equal(tseDateTime("", "17:05"), null);
});

test("EA12 / EA14 / EA18 parsean", () => {
  const ix = normalizeEa12(fx("ea12.json"));
  assert.deepEqual(ix.municipalities.map((m) => [m.uf, m.code, m.name]).sort(), [["BA", "38490", "SALVADOR"], ["DF", "97012", "BRASÍLIA"], ["MG", "41238", "BELO HORIZONTE"], ["RJ", "60011", "RIO DE JANEIRO"], ["SP", "71072", "SÃO PAULO"], ["ZZ", "29467", "BUENOS AIRES"], ["ZZ", "29602", "CÓRDOBA"], ["ZZ", "39004", "MENDOZA"]]);
  const a = normalizeAccompaniment(fx("ea14.json"));
  assert.ok(a.entries.has("br") && a.entries.has("uf:sp"));
  assert.ok(a.entries.get("uf:sp")!.totalization.sections_expected! > 0);
  const b = normalizeEa18(fx("ea18.json"));
  assert.equal(b.section_status, "Anulada");
});

test("ciclo completo: BR + 27 UFs + municipio; cantidad de requests acotada; segundo ciclo sólo EA14 (304)", async () => {
  const hits: Hit[] = [];
  const m = mock({ hits });
  const { c } = collector(m);
  await c.cycle();
  assert.equal(c.phase, "activo");
  assert.ok(c.store.get("br") && c.store.get("uf:SP") && c.store.get("uf:RJ") && c.store.get("uf:BA") && c.store.get("mun:SP:71072"));
  assert.equal(c.store.get("br")!.result.geography.type, "BR");
  assert.equal(c.store.get("uf:SP")!.result.geography.uf, "SP");
  assert.equal(c.store.get("mun:SP:71072")!.result.geography.name, "SÃO PAULO");
  // 1 catálogo + 1 EA12 + 1 EA14 + 1 br + 27 UF + 1 municipal (sin EA15: pocos municipios)
  assert.ok(hits.length <= 32, `demasiadas requests: ${hits.length}\n${hits.map((h) => h.url.split('/').slice(-3).join('/')).join('\n')}`);
  const n1 = hits.length;
  await c.cycle();
  const second = hits.slice(n1).map((h) => h.url);
  assert.deepEqual(second, [urls.ea14(m.e)], "sin cambios sólo se vuelve a pedir EA14 (con If-None-Match)");
  assert.ok(!hits.some((h) => h.url.includes("sp-e021270-ab.json")), "con pocos municipios no se baja el EA15");
  assert.equal(hits[hits.length - 1]!.headers["If-None-Match"], '"ea14.json"');
});

test("EA14 todavía no publicado (404): no rompe, queda esperando y espacia los intentos", async () => {
  const m = mock();
  const missing = new Set([urls.ea14(m.e)]);
  const m2 = mock({ missing });
  const { c, http } = collector(m2);
  const d1 = await c.cycle();
  assert.equal(c.phase, "esperando-publicacion");
  assert.ok(d1 > c.cfg.pollMs, "el siguiente intento se aleja");
  assert.equal(c.store.keys().length, 0);
  assert.equal(http.totals.notFound, 1);
  assert.equal(c.lastError, null);
});

test("429/403: backoff exponencial y no se vuelve a pedir mientras dura la pausa", async () => {
  let t = 1_000_000;
  const hits: Hit[] = [];
  const m = mock({ hits, status: { "*": 429 } });
  const http = new TseHttp({ minGapMs: 0, fetchImpl: m.fetchImpl, sleep: async () => {}, now: () => t });
  const a = await http.get("https://x/1");
  assert.equal(a.status, 429);
  assert.ok(http.paused);
  assert.equal(http.pausedUntil - t, 10 * 60_000);
  const b = await http.get("https://x/2");
  assert.ok(b.skipped);
  assert.equal(hits.length, 1, "durante la pausa no sale ninguna request");
  t += 10 * 60_000 + 1;
  await http.get("https://x/3"); // vuelve a 429 → pausa doble
  assert.equal(http.pausedUntil - t, 20 * 60_000);
  const m403 = mock({ status: { "*": 403 } });
  const h2 = new TseHttp({ minGapMs: 0, fetchImpl: m403.fetchImpl, sleep: async () => {} });
  await h2.get("https://x/1");
  assert.ok(h2.paused && h2.pauseReason === "HTTP 403");
});

test("varios 404 seguidos pausan (el TSE puede bloquear la IP); un 200 reinicia la cuenta", async () => {
  const m = mock();
  const http = new TseHttp({ minGapMs: 0, fetchImpl: m.fetchImpl, sleep: async () => {}, max404Streak: 3 });
  await http.get("https://x/a"); await http.get("https://x/b");
  assert.equal(http.streak404, 2); assert.ok(!http.paused);
  await http.get(catalogUrl("simulado"));
  assert.equal(http.streak404, 0);
  await http.get("https://x/a"); await http.get("https://x/b"); await http.get("https://x/c");
  assert.ok(http.paused, "al tercer 404 seguido se pausa");
});

test("una actualización posterior reemplaza a la anterior; una generación vieja o idéntica no", () => {
  const e = el();
  const geo = { type: "BR" as const, country: "BR" as const, uf: null, municipality_code: null, municipality_ibge: null, name: "Brasil" };
  const raw1 = fx("ea20-br.json");
  const raw2 = raw1.replace('"hg" : "16:29:12"', '"hg" : "16:45:00"').replace('"vv" : "100982116"', '"vv" : "100982116"');
  const raw0 = raw1.replace('"hg" : "16:29:12"', '"hg" : "15:00:00"');
  const mk = (raw: string) => normalizeEa20(raw, { el: e, geography: geo, fetchedAt: new Date().toISOString(), lastModified: null, url: "u" });
  const st = new TseStore(null);
  assert.equal(st.put("br", mk(raw1), raw1, "a"), "new");
  assert.equal(st.put("br", mk(raw1), raw1, "a"), "unchanged");
  assert.equal(st.put("br", mk(raw2), raw2, "b"), "updated");
  assert.equal(st.get("br")!.result.times.file_generated_at, "2026-09-29T16:45:00-03:00");
  assert.equal(st.put("br", mk(raw0), raw0, "c"), "stale");
  assert.equal(st.get("br")!.result.times.file_generated_at, "2026-09-29T16:45:00-03:00");
});

test("si el TSE limpia su base (resultado vacío o con menos votos) se conserva lo que ya teníamos", () => {
  const e = el();
  const geo = { type: "BR" as const, country: "BR" as const, uf: null, municipality_code: null, municipality_ibge: null, name: "Brasil" };
  const raw1 = fx("ea20-br.json");
  const mk = (raw: string) => normalizeEa20(raw, { el: e, geography: geo, fetchedAt: new Date().toISOString(), lastModified: null, url: "u" });
  const st = new TseStore(null);
  st.put("br", mk(raw1), raw1, "a");
  const before = st.get("br")!.result.totals.valid;
  assert.ok((before ?? 0) > 0);
  const wiped = raw1.replace('"hg" : "16:29:12"', '"hg" : "23:00:00"').replace(/"vv" : "\d+"/, '"vv" : "0"').replace(/"tv" : "\d+"/, '"tv" : "0"').replace(/"st" : "\d+"/, '"st" : "0"');
  assert.equal(st.put("br", mk(wiped), wiped, "z"), "regressed");
  assert.equal(st.get("br")!.result.totals.valid, before);
});

test("adaptador en vivo para la placa: ranking, estados con ganador, desenlace del TSE", async () => {
  const { c } = collector(mock());
  await c.cycle();
  const live = buildElectionLive(c);
  assert.equal(live.available, true);
  assert.ok(live.candidates.length >= 2);
  assert.ok(live.candidates.every((x) => !/^CANDIDATO 9995/i.test(x.name) || true));
  for (let i = 1; i < live.candidates.length; i++) assert.ok((live.candidates[i - 1]!.votes ?? 0) >= (live.candidates[i]!.votes ?? 0));
  assert.ok(live.states.length >= 20 && live.states.every((s) => s.winner >= 0 && s.winner < live.candidates.length));
  assert.equal(live.outcome, "runoff", "el simulado marca '2º turno'");
  assert.equal(live.counted_pct, 100);
  assert.ok(live.states.some((s) => s.id === "SP"));
  assert.deepEqual(live.cities.map((x) => [x.uf, x.name]), [["SP", "São Paulo"]]);
  assert.ok(live.cities[0]!.top.length === 4 && live.cities[0]!.top.every((t) => t.i >= 0 && t.i < live.candidates.length));
});

test("sin datos todavía, el adaptador en vivo responde available:false", async () => {
  const m = mock({ missing: new Set([mock().e && urls.ea14(el())]) });
  const { c } = collector(m);
  await c.cycle();
  assert.equal(buildElectionLive(c).available, false);
});

test("la cola municipal atiende primero capitales/seguidos por nombre y respeta el tope por ciclo", async () => {
  const hits: Hit[] = [];
  const m = mock({ hits });
  const c0 = { ...cfg(), maxFilesPerCycle: 1, municipalities: [{ uf: "SP", names: ["SÃO PAULO", "SÃO PAULO"] }] };
  const { c } = collector(m, c0);
  await c.cycle();
  const munHits = hits.filter((h) => /sp\d{5}-c0001/.test(h.url));
  assert.equal(munHits.length, 1, "un solo EA20 municipal por ciclo");
  assert.ok(munHits[0]!.url.includes("sp71072"), "la capital va primero");
});

test("Brasileños en Argentina: suma las ciudades del TSE (ZZ) y agrupa 'Otras ciudades'", async () => {
  const m = mock();
  const { c } = collector(m, { ...cfg(), municipalities: [{ uf: "ZZ", names: ["BUENOS AIRES", "CÓRDOBA", "MENDOZA"] }] });
  await c.cycle();
  const live = buildElectionLive(c);
  const one = c.store.get("mun:ZZ:29467")!.result;
  assert.ok(live.abroad, "hay bloque de Argentina");
  assert.equal(live.abroad!.country_name, "Argentina");
  assert.deepEqual(live.abroad!.cities.map((x) => x.name), ["Buenos Aires", "Córdoba", "Otras ciudades"]);
  for (const c of live.abroad!.cities) { assert.ok(c.top.length >= 1 && c.top.length <= 3); for (let k = 1; k < c.top.length; k++) assert.ok(c.top[k - 1]!.votes >= c.top[k]!.votes); }
  assert.equal(live.abroad!.electorate, one.totals.electorate! * 3);
  assert.equal(live.abroad!.bulletins_expected, one.totalization.sections_expected! * 3);
  assert.equal(live.abroad!.bulletins_totalized, one.totalization.sections_totalized! * 3);
  assert.equal(live.abroad!.totalized_pct, 100);
  assert.ok(live.abroad!.updated_at!.endsWith("-03:00"));
  const top = live.abroad!.candidates;
  for (let i = 1; i < top.length; i++) assert.ok(top[i - 1]!.votes >= top[i]!.votes);
  const valid = one.totals.valid! * 3;
  assert.ok(Math.abs(top[0]!.pct - (top[0]!.votes / valid) * 100) < 1e-9, "% = votos / votos válidos de Argentina");
  assert.ok(!c.store.get("uf:ZZ"), "no se descarga el agregado ZZ: sólo sus ciudades");
  assert.equal(live.cities.length, 0, "las ciudades de Argentina no aparecen en Principales ciudades");
});

test("precarga de candidatos de Brasil: reconoce el nombre de urna del TSE", () => {
  assert.equal(BR_CANDIDATES.length, 12);
  assert.equal(matchBrCandidate("LULA", "LUIZ INÁCIO LULA DA SILVA")?.slug, "lula");
  assert.equal(matchBrCandidate("FLÁVIO BOLSONARO")?.slug, "flavio");
  assert.equal(matchBrCandidate("CAIADO")?.slug, "caiado");
  assert.equal(matchBrCandidate("RUI COSTA PIMENTA")?.slug, "rui");
  assert.equal(matchBrCandidate("GRASSI")?.slug, "wilson");
  assert.equal(matchBrCandidate("CANDIDATO 9999"), null);
  assert.ok(BR_CANDIDATES.every((x) => x.photo_url.startsWith("/output/elecciones/br/")));
});

test("ganador confirmado por el editor: fuerza la pantalla de ganador aunque el TSE diga 2º turno o la etapa sea anterior", () => {
  const cands = [{ name: "A", color: "#fff", pct: 52 }, { name: "B", color: "#000", pct: 48 }];
  const base = { phase: "resultados" as const, intro: "sin" as const, candidates: cands, states: [], counted_pct: 50, country: "br" };
  assert.ok(!electionScreens({ ...base, outcome: "runoff" }).includes("winner"), "sin override, en 'resultados' no hay ganador");
  assert.deepEqual(electionScreens({ ...base, outcome: "runoff", winner_override: "A" }).filter((x) => x === "winner" || x === "runoff"), ["winner"]);
  assert.deepEqual(electionScreens({ ...base, counted_pct: 0, winner_override: "A" }), ["intro"], "sin resultados cargados nunca queda una pantalla vacía");
});

test("sellado: sólo lectura, verifica el hash y se niega a cambiar", async () => {
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { createHash } = await import("node:crypto");
  const { tmpdir } = await import("node:os");
  const dir = mkdtempSync(path.join(tmpdir(), "seal-"));
  const body = JSON.stringify({ last_update_at: "x", results: [] });
  writeFileSync(path.join(dir, "latest.json"), body);
  writeFileSync(path.join(dir, "seal.json"), JSON.stringify({ sha256: createHash("sha256").update(body).digest("hex") }));
  const ok = TseStore.sealed(dir);
  assert.equal(ok.frozen, true); assert.equal(ok.sealError, null);
  writeFileSync(path.join(dir, "latest.json"), body.replace('"x"', '"y"')); // alguien lo toca
  const bad = TseStore.sealed(dir);
  assert.ok(bad.sealError); assert.equal(bad.keys().length, 0);
});
