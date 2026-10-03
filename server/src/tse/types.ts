// Tipos del colector de resultados del TSE (Brasil). Los nombres de campo crudos (ele, abr, carg, vap, pvapn…) son
// los del TSE y se conservan en `raw` / `tse`; lo normalizado usa nombres propios.

export type TseEnv = "oficial" | "simulado";
export type GeoType = "BR" | "UF" | "MUNICIPIO";

export interface Geography {
  type: GeoType;
  country: "BR";
  uf: string | null; // sigla en mayúsculas ("SP"); null en BR
  municipality_code: string | null; // código TSE (5 dígitos, "71072")
  municipality_ibge: string | null; // código IBGE (7 dígitos), si EA12 lo informa
  name: string;
}

export interface TseTimes {
  fetched_at: string; // cuándo lo pedimos (UTC, ISO)
  file_generated_at: string | null; // dg+hg: generación del archivo (Brasilia → ISO con -03:00)
  source_updated_at: string | null; // Last-Modified HTTP (UTC, ISO)
  totalization_time: string | null; // dt+ht: última totalización del ámbito
}

export interface Totalization {
  sections_expected: number | null; // s.ts
  sections_totalized: number | null; // s.st
  percentage: number | null; // s.pstn
  sections_not_totalized: number | null; // s.snt
  sections_received: number | null; // s.sa (secciones/boletines apurados: el BU ya llegó y se procesó)
}

export interface Totals {
  valid: number | null; // v.vv
  blank: number | null; // v.vb
  null: number | null; // v.vn
  annulled: number | null; // v.van
  annulled_sub_judice: number | null; // v.vansj
  counted_total: number | null; // v.tv (votos apurados)
  electorate: number | null; // e.te
  electorate_totalized: number | null; // e.est
  turnout: number | null; // e.c (comparecimiento)
  turnout_pct: number | null; // e.pcn
  abstention: number | null; // e.a
  abstention_pct: number | null; // e.pan
}

export interface CandidateResult {
  id: string; // sqcand
  number: string; // n
  name: string; // nm
  ballot_name: string; // nmu
  party: string; // sigla del partido (par.sg)
  party_number: string; // par.n
  party_name: string; // par.nm
  grouping_id: string | null; // agr.n (federación / coalición / partido solo)
  grouping_type: string | null; // agr.tp: f = federación, c = coalición, i = partido individual
  grouping_name: string | null; // agr.nm
  grouping_parties: string | null; // agr.com (siglas de los partidos que lo integran)
  vice: { id: string; name: string; ballot_name: string; party: string } | null; // vs[tp="v"]
  vote_destination: string; // dvt: Válido | Anulado | Anulado sub judice
  votes: number; // vap
  percentage_tse: number | null; // pvapn, tal cual lo publica el TSE
  percentage_valid_calc: number | null; // votes / valid * 100 (sólo candidatos "Válido")
  status: string | null; // st: Eleito | Não eleito | 2º turno…
  elected_flag: boolean | null; // e === "s"
  photo_url: string | null;
}

export interface PartyResult {
  party_code: string; // número del partido
  party_name: string;
  party_acronym: string;
  votes: number;
  percentage_valid_calc: number | null;
  grouping_id: string | null;
  grouping_type: string | null;
  grouping_name: string | null;
  candidates: string[]; // ids
}

export interface GroupingResult {
  id: string; // agr.n
  type: string; // f | c | i
  name: string;
  parties: string; // agr.com
  votes: number;
  percentage_valid_calc: number | null;
}

export interface NormalizedResult {
  election: { cycle: string; election_id: string; election_name: string; round: 1 | 2; office: string; office_code: string; pleito: string };
  geography: Geography;
  times: TseTimes;
  idg: string | null; // identificador de generación (== ETag)
  state: string | null; // and: f = finalizado, a = en andamiento…
  totalization: Totalization;
  totals: Totals;
  candidates: CandidateResult[];
  parties: PartyResult[];
  groupings: GroupingResult[];
  raw_sha256: string;
  raw_bytes: number;
  source_url: string;
}

export interface AccompanimentEntry {
  type: "br" | "uf" | "mun";
  code: string; // "br", "sp", "71072"
  state: string | null; // and
  totalization_time: string | null;
  totalization: Totalization;
  electorate_totalized_pct: number | null;
  signature: string; // cambia cuando el ámbito cambió
}

export interface RequestLogEntry {
  at: string;
  url: string;
  status: number; // 0 = no se hizo (pausado) o error de red
  ms: number;
  bytes: number;
  note?: string;
}
