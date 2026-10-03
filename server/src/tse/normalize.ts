import { createHash } from "node:crypto";
import { urls, type ResolvedElection } from "./catalog.js";
import type { AccompanimentEntry, CandidateResult, GroupingResult, Geography, NormalizedResult, PartyResult, Totalization, Totals } from "./types.js";

type J = Record<string, any>;

export const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

/** "7,527528669" → 7.527528669. Vacío/ausente → null. */
export function ptNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
const int = (v: unknown): number | null => { if (v == null || v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

/** Fecha/hora de los archivos del TSE ("29/09/2026", "16:29:12", hora de Brasilia, UTC-3 todo el año) → ISO inequívoco. */
export function tseDateTime(dt: unknown, ht: unknown): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(dt ?? ""));
  const t = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(ht ?? ""));
  if (!m || !t) return null;
  return `${m[3]}-${m[2]}-${m[1]}T${t[1]}:${t[2]}:${t[3] ?? "00"}-03:00`;
}

function totalization(s: J | undefined): Totalization {
  return { sections_expected: int(s?.ts), sections_totalized: int(s?.st), percentage: ptNum(s?.pstn), sections_not_totalized: int(s?.snt), sections_received: int(s?.sa) };
}

function totals(raw: J): Totals {
  const v: J = raw.v ?? {}; const e: J = raw.e ?? {};
  return {
    valid: int(v.vv), blank: int(v.vb), null: int(v.vn), annulled: int(v.van), annulled_sub_judice: int(v.vansj), counted_total: int(v.tv),
    electorate: int(e.te), electorate_totalized: int(e.est), turnout: int(e.c), turnout_pct: ptNum(e.pcn), abstention: int(e.a), abstention_pct: ptNum(e.pan),
  };
}

/** EA20 (resultado unificado) de UN cargo → resultado normalizado. Conserva el cuerpo crudo vía sha256 (el guardado lo hace el store). */
export function normalizeEa20(rawText: string, ctx: { el: ResolvedElection; geography: Geography; fetchedAt: string; lastModified: string | null; url: string; idg?: string | null }): NormalizedResult {
  const raw = JSON.parse(rawText) as J;
  const carg: J | undefined = (raw.carg ?? []).find((c: J) => String(Number(c.cd)) === String(Number(ctx.el.cargoCode)));
  if (!carg) throw new Error(`EA20 sin el cargo ${ctx.el.cargoCode} (${ctx.el.cargoName})`);
  const tt = totals(raw);
  const candidates: CandidateResult[] = [];
  const parties = new Map<string, PartyResult>();
  const groupings = new Map<string, GroupingResult>();
  for (const agr of carg.agr ?? []) {
    for (const par of agr.par ?? []) {
      for (const c of par.cand ?? []) {
        const vice = (c.vs ?? []).find((x: J) => x.tp === "v");
        const votes = int(c.vap) ?? 0;
        const cr: CandidateResult = {
          id: String(c.sqcand), number: String(c.n), name: String(c.nm ?? ""), ballot_name: String(c.nmu ?? c.nm ?? ""),
          party: String(par.sg ?? ""), party_number: String(par.n ?? ""), party_name: String(par.nm ?? ""),
          grouping_id: agr.n != null ? String(agr.n) : null, grouping_type: agr.tp ?? null, grouping_name: agr.nm ?? null, grouping_parties: agr.com ?? null,
          vice: vice ? { id: String(vice.sqcand), name: String(vice.nm ?? ""), ballot_name: String(vice.nmu ?? ""), party: String(vice.sgp ?? "") } : null,
          vote_destination: String(c.dvt ?? ""), votes,
          percentage_tse: ptNum(c.pvapn),
          percentage_valid_calc: c.dvt === "Válido" && tt.valid ? (votes / tt.valid) * 100 : null,
          status: c.st ?? null, elected_flag: c.e == null ? null : c.e === "s",
          photo_url: c.sqcand ? urls.photo(ctx.el, String(c.sqcand)) : null,
        };
        candidates.push(cr);
        // Partido: sólo votos "Válido" cuentan para el % válido; el resto se conserva en `votes` del candidato.
        const pk = cr.party_number;
        const p = parties.get(pk) ?? { party_code: pk, party_name: cr.party_name, party_acronym: cr.party, votes: 0, percentage_valid_calc: null, grouping_id: cr.grouping_id, grouping_type: cr.grouping_type, grouping_name: cr.grouping_name, candidates: [] };
        p.votes += votes; p.candidates.push(cr.id); parties.set(pk, p);
        if (cr.grouping_id) {
          const g = groupings.get(cr.grouping_id) ?? { id: cr.grouping_id, type: cr.grouping_type ?? "", name: cr.grouping_name ?? "", parties: cr.grouping_parties ?? "", votes: 0, percentage_valid_calc: null };
          g.votes += votes; groupings.set(cr.grouping_id, g);
        }
      }
    }
  }
  candidates.sort((a, b) => b.votes - a.votes);
  const validShare = (votes: number) => (tt.valid ? (votes / tt.valid) * 100 : null);
  for (const p of parties.values()) p.percentage_valid_calc = validShare(p.votes);
  for (const g of groupings.values()) g.percentage_valid_calc = validShare(g.votes);
  return {
    election: { cycle: ctx.el.cycle, election_id: ctx.el.electionId, election_name: ctx.el.electionName, round: ctx.el.round, office: String(carg.nmn ?? ctx.el.cargoName), office_code: ctx.el.cargoCode, pleito: ctx.el.pleito },
    geography: ctx.geography,
    times: { fetched_at: ctx.fetchedAt, file_generated_at: tseDateTime(raw.dg, raw.hg), source_updated_at: ctx.lastModified ? new Date(ctx.lastModified).toISOString() : null, totalization_time: tseDateTime(raw.dt, raw.ht) },
    idg: raw.idg != null ? String(raw.idg) : ctx.idg ?? null,
    state: raw.and ?? null,
    totalization: totalization(raw.s),
    totals: tt,
    candidates,
    parties: [...parties.values()].sort((a, b) => b.votes - a.votes),
    groupings: [...groupings.values()].sort((a, b) => b.votes - a.votes),
    raw_sha256: sha256(rawText), raw_bytes: Buffer.byteLength(rawText), source_url: ctx.url,
  };
}

export interface Accompaniment { idg: string | null; generated_at: string | null; entries: Map<string, AccompanimentEntry> }

/** EA14 (Brasil: abr[] = BR + UFs) o EA15 (UF: abr[] = municipios). Clave: "br", "uf:sp", "mun:71072". */
export function normalizeAccompaniment(rawText: string): Accompaniment {
  const raw = JSON.parse(rawText) as J;
  const entries = new Map<string, AccompanimentEntry>();
  for (const a of raw.abr ?? []) {
    const type = a.tpabr === "mun" || a.tpabr === "mu" ? "mun" : a.tpabr === "uf" ? "uf" : "br";
    const code = String(a.cdabr);
    const tz = totalization(a.s);
    const time = tseDateTime(a.dt, a.ht);
    entries.set(type === "br" ? "br" : `${type}:${code}`, {
      type, code, state: a.and ?? null, totalization_time: time, totalization: tz,
      electorate_totalized_pct: ptNum(a.e?.pestn),
      signature: [time, tz.sections_totalized, a.e?.c, a.and].join("|"),
    });
  }
  return { idg: raw.idg != null ? String(raw.idg) : null, generated_at: tseDateTime(raw.dg, raw.hg), entries };
}

export interface MunicipalityInfo { uf: string; code: string; ibge: string; name: string; capital: boolean; zones: string[] }
export interface Ea12Index { idg: string | null; ufs: Map<string, string>; municipalities: MunicipalityInfo[] }

/** EA12: abr[] = UFs, cada una con mu[] (cd = código TSE de 5 dígitos, cdi = IBGE, c = capital, z = zonas). */
export function normalizeEa12(rawText: string): Ea12Index {
  const raw = JSON.parse(rawText) as J;
  const ufs = new Map<string, string>();
  const municipalities: MunicipalityInfo[] = [];
  for (const a of raw.abr ?? []) {
    const uf = String(a.cd).toUpperCase();
    ufs.set(uf, String(a.ds));
    for (const m of a.mu ?? []) municipalities.push({ uf, code: String(m.cd), ibge: String(m.cdi ?? ""), name: String(m.nm), capital: m.c === "s", zones: m.z ?? [] });
  }
  return { idg: raw.idg != null ? String(raw.idg) : null, ufs, municipalities };
}

export interface SectionInfo { section: string; arrived_date: string | null; arrived_time: string | null; arrived_at: string | null }
/** EA16 de una UF: sólo las secciones de un municipio (el archivo completo de SP pesa ~6 MB). */
export function sectionsOfMunicipality(rawText: string, uf: string, mun: string): { zone: string; sections: SectionInfo[] }[] {
  const raw = JSON.parse(rawText) as J;
  const abr = (raw.abr ?? []).find((a: J) => String(a.cd).toLowerCase() === uf.toLowerCase());
  const m = (abr?.mu ?? []).find((x: J) => String(x.cd) === String(mun).padStart(5, "0"));
  return (m?.zon ?? []).map((z: J) => ({
    zone: String(z.cd),
    sections: (z.sec ?? []).map((s: J) => ({ section: String(s.ns), arrived_date: s.da ?? null, arrived_time: s.ha ?? null, arrived_at: tseDateTime(s.da, s.ha) })),
  }));
}

export interface BulletinFile { name: string; type: string; hash: string }
export interface BulletinInfo { generated_at: string | null; idg: string | null; section_status: string | null; files: BulletinFile[]; raw: unknown }
/** EA18: estado de la sección y archivos (hashes) disponibles. El BU en sí es un archivo binario (.bu) listado acá. */
export function normalizeEa18(rawText: string): BulletinInfo {
  const raw = JSON.parse(rawText) as J;
  const files: BulletinFile[] = [];
  for (const h of raw.hashes ?? []) for (const a of h.arq ?? []) if (a.nm) files.push({ name: String(a.nm), type: String(a.tp ?? ""), hash: String(h.hash ?? "") });
  return { generated_at: tseDateTime(raw.dg, raw.hg), idg: raw.idg != null ? String(raw.idg) : null, section_status: raw.st ?? null, files, raw };
}
