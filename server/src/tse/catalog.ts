import type { TseEnv } from "./types.js";

// EA11 (catálogo `ele-c.json`): lista de ciclos/pleitos/elecciones y las PLANTILLAS de directorio de cada tipo de
// archivo (`arq[]`). Nada de rutas inventadas: toda URL sale de esas plantillas + los códigos del propio catálogo.
export interface Ea11Cargo { cd: string; ds: string; tp: string }
export interface Ea11Election { cd: string; cdt2: string; sqele: string; nm: string; t: string; tp: string; abr: { cd: string; cp: Ea11Cargo[] }[] }
export interface Ea11Pleito { cd: string; cdpr: string; c: string; dt: string; dtlim?: string; e: Ea11Election[] }
export interface Ea11 { dg: string; hg: string; f: string; idg: string; arq: { tp: string; dir: string }[]; pl: Ea11Pleito[] }

export const TSE_BASES: Record<TseEnv, { base: string; ambiente: string }> = {
  oficial: { base: "https://resultados.tse.jus.br", ambiente: "oficial" },
  // Entorno de simulado del propio TSE (ver README del colector). Mismas plantillas, otros códigos de elección.
  simulado: { base: "https://resultados-sim.tse.jus.br", ambiente: "simulado/simulado2026" },
};

export const catalogUrl = (env: TseEnv): string => `${TSE_BASES[env].base}/${TSE_BASES[env].ambiente}/comum/config/ele-c.json`;

export const pad = (v: string | number, n: number): string => String(v).padStart(n, "0");

export interface ResolvedElection {
  env: TseEnv;
  cycle: string; // ele2026
  pleito: string; // cd del pleito (3220)
  electionId: string; // cd de la elección: 1ª vuelta = e.cd, 2ª = e.cdt2
  electionName: string;
  round: 1 | 2;
  date: string; // dt del pleito
  cargoCode: string; // "1"
  cargoName: string;
  templates: Record<string, string>; // tp → dir
}

export function parseCatalog(raw: unknown): Ea11 {
  const c = raw as Ea11;
  if (!c || !Array.isArray(c.arq) || !Array.isArray(c.pl)) throw new Error("EA11 inválido: faltan arq[] / pl[]");
  return c;
}

/** Busca la elección que contiene el cargo pedido (Presidente = 1) para el ciclo/pleito/vuelta indicados. */
export function resolveElection(cat: Ea11, env: TseEnv, o: { cycle: string; pleito?: string; round: 1 | 2; cargo: string }): ResolvedElection | null {
  const pls = cat.pl.filter((p) => p.c === o.cycle && (!o.pleito || p.cd === o.pleito));
  for (const pl of pls) {
    for (const e of pl.e) {
      const cargo = e.abr.flatMap((a) => a.cp).find((cp) => cp.cd === o.cargo);
      if (!cargo) continue;
      const id = o.round === 1 ? e.cd : e.cdt2;
      if (!id) continue;
      return {
        env, cycle: pl.c, pleito: pl.cd, electionId: id, electionName: o.round === 1 ? e.nm : e.nm.replace("1º Turno", "2º Turno"),
        round: o.round, date: pl.dt, cargoCode: cargo.cd, cargoName: cargo.ds,
        templates: Object.fromEntries(cat.arq.map((a) => [a.tp, a.dir])),
      };
    }
  }
  return null;
}

/** Rellena los placeholders literales de una plantilla de directorio del catálogo. */
export function fillDir(el: ResolvedElection, tp: string, p: { uf?: string; municipio?: string; zona?: string; secao?: string } = {}): string {
  const tpl = el.templates[tp];
  if (!tpl) throw new Error(`el catálogo no publica plantilla para el tipo de archivo "${tp}"`);
  const b = TSE_BASES[el.env];
  return tpl
    .replace("<base>", b.base).replace("<ambiente>", b.ambiente).replace("<ciclo>", el.cycle)
    .replace("<cd_eleicao>", el.electionId).replace("<cd_pleito>", el.pleito)
    .replace("<uf>", p.uf ?? "br").replace("<municipio>", p.municipio ?? "").replace("<zona>", p.zona ?? "").replace("<secao>", p.secao ?? "");
}

const e6 = (el: ResolvedElection) => pad(el.electionId, 6);
const c4 = (el: ResolvedElection) => pad(el.cargoCode, 4);

/** URLs de cada tipo de archivo (nombres: <ámbito>-c<cargo 4 díg>-e<elección 6 díg>-<tipo>.json). */
export const urls = {
  ea12: (el: ResolvedElection) => `${fillDir(el, "cm")}/mun-e${e6(el)}-cm.json`,
  ea14: (el: ResolvedElection) => `${fillDir(el, "ab", { uf: "br" })}/br-e${e6(el)}-ab.json`,
  ea15: (el: ResolvedElection, uf: string) => `${fillDir(el, "ab", { uf: uf.toLowerCase() })}/${uf.toLowerCase()}-e${e6(el)}-ab.json`,
  ea20Br: (el: ResolvedElection) => `${fillDir(el, "u", { uf: "br" })}/br-c${c4(el)}-e${e6(el)}-u.json`,
  ea20Uf: (el: ResolvedElection, uf: string) => `${fillDir(el, "u", { uf: uf.toLowerCase() })}/${uf.toLowerCase()}-c${c4(el)}-e${e6(el)}-u.json`,
  ea20Mun: (el: ResolvedElection, uf: string, mun: string) => `${fillDir(el, "u", { uf: uf.toLowerCase() })}/${uf.toLowerCase()}${pad(mun, 5)}-c${c4(el)}-e${e6(el)}-u.json`,
  ea16: (el: ResolvedElection, uf: string) => `${fillDir(el, "cs", { uf: uf.toLowerCase() })}/${uf.toLowerCase()}-p${pad(el.pleito, 6)}-cs.json`,
  ea18: (el: ResolvedElection, uf: string, mun: string, zona: string, secao: string) =>
    `${fillDir(el, "aux", { uf: uf.toLowerCase(), municipio: pad(mun, 5), zona: pad(zona, 4), secao: pad(secao, 4) })}/p${pad(el.pleito, 6)}-${uf.toLowerCase()}-m${pad(mun, 5)}-z${pad(zona, 4)}-s${pad(secao, 4)}-aux.json`,
  photo: (el: ResolvedElection, sqcand: string) => `${fillDir(el, "ft", { uf: "br" })}/${sqcand}.jpeg`,
};
