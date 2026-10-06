import { useEffect, useMemo, useRef, useState } from "react";
import type { ElectionCandidate, ElectionData, ElectionLive, ElectionPhase } from "@newsroller/shared";
import { ELECTION_COUNTRIES, ELECTION_ENTER_SEC, ELECTION_PHASES, normName, ELECTION_TOP_N, electionHold, electionPhase, electionScreens, type ElectionScreen } from "@newsroller/shared";
import ciclicoWhite from "../../assets/ciclico-white.png";
import { P } from "../../lib/params";
import { API_BASE } from "../../lib/scene";
import { IS_VERTICAL } from "../../lib/orientation";
import { useForcePlay } from "../../lib/autoplay";
import maps from "../../lib/electionMaps.json";
import { Grain, Kick, Lights, NM_CSS, Words, fmtNum, useCount, useFitMax, useLife } from "./base";
import { ModernChrome } from "./Chrome";

// Resultados electorales, colección Modernas (sólo 16:9 por ahora). Fondo: loop de la bandera del país, oscurecido y
// teñido de azul, con líneas de luz. Arriba, fijos: volanta + título y el escrutinio (barra de mesas contabilizadas);
// abajo, la fuente. En el medio rotan hasta tres pantallas cada `sec_per_screen` segundos:
//  1. Ganador (o "Lidera" si el editor no confirmó): foto, % grande y ventaja sobre el segundo.
//  2. Los más votados: barras horizontales (5 en presidencial 1ª vuelta y parlamentaria; 2 en balotaje).
//  3. Por estado: silueta del país como mapa de calor (color del ganador, intensidad según su %) con burbujas
//     dimensionadas por votos, y el conteo de estados ganados.
// Entre pantallas: una barra de luz barre y la nueva se revela. Sale en fade.
const INTRO_MS = 1000;
const FLAG_BASE = `${import.meta.env.BASE_URL}elecciones/flag-`;
type MapDef = { viewBox: number[]; regions: { id: string; name: string; d: string; cx: number; cy: number; area: number }[] };
const MAPS = maps as unknown as Record<string, MapDef>;

const SING: Record<string, string> = { Provincias: "provincia", Estados: "estado", Regiones: "región", Departamentos: "departamento" };
const fmtPct = (n: number) => n.toFixed(1).replace(".", ",");
const hexA = (hex: string, a: number) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(47,107,255,${a})`;
  const n = parseInt(m[1]!, 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};
const initials = (t: string) => t.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
// Color sólido (sin transparencia): mezcla del color del candidato sobre el fondo del mapa. Así el video de la bandera no se trasluce.
const MAP_BASE = [14, 28, 72];
const solid = (hex: string, a: number): string => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#2F6BFF";
  const n = parseInt(m[1]!, 16);
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map((v, i) => Math.round(MAP_BASE[i]! * (1 - a) + v * a));
  return `rgb(${ch[0]},${ch[1]},${ch[2]})`;
};
type Ranked = ElectionCandidate & { i: number };

function Avatar({ c, size, className = "" }: { c: Ranked; size: number; className?: string }) {
  const st = { width: size, height: size, background: c.photo_url ? `url(${c.photo_url}) center/cover` : `linear-gradient(150deg,${hexA(c.color, 1)},${hexA(c.color, .55)})`, boxShadow: `0 0 0 3px ${hexA(c.color, .9)},0 14px 30px -10px ${hexA(c.color, .7)}` };
  return <div className={"ne-av " + className} style={st}>{!c.photo_url && <span style={{ fontSize: size * 0.38 }}>{initials(c.name)}</span>}</div>;
}

// ---- Placa de arranque ----
const MAX_INTRO_CANDS = 6; // más filas pisarían la leyenda de abajo
const STATUS: Record<string, string> = { apertura: "COMICIOS ABIERTOS", cierre: "SE CIERRAN LAS URNAS", resultados: "PRIMEROS RESULTADOS", preliminar: "CONTEO PRELIMINAR", definitivo: "GANADOR DEFINITIVO" };
function IntroScreen({ d, kind }: { d: ElectionData; kind: string }) {
  const country = ELECTION_COUNTRIES.find((c) => c.id === d.country);
  const ph = electionPhase(d);
  const step = ELECTION_PHASES.findIndex((p) => p.id === ph);
  const named = (d.candidates ?? []).filter((c) => c.name.trim());
  const ref = useRef<HTMLDivElement>(null);
  const title = d.title?.trim() || `${(country?.name ?? "").toUpperCase()} VOTA`;
  // Hora de cierre: la última HH:MM del horario cargado ("08:00 a 17:00 hs"); sin horario, 17:00 para Brasil.
  const closeTime = d.voting_hours?.match(/\d{1,2}:\d{2}(?!.*\d{1,2}:\d{2})/)?.[0] ?? (d.country === "br" ? "17:00" : "");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let sz = IS_VERTICAL ? 320 : 230;
    el.style.fontSize = sz + "px";
    while (el.scrollWidth > el.clientWidth + 1 && sz > 90) { sz -= 6; el.style.fontSize = sz + "px"; }
  }, [title, named.length >= 2]);
  const facts = [
    ph === "apertura" && closeTime && ["Cierre de comicios", closeTime],
    ph !== "apertura" && d.voting_hours?.trim() && ["Horario", d.voting_hours.trim()],
    d.electorate?.trim() && ["Padrón", d.electorate.trim()],
    named.length >= 2 && ["Candidatos", String(named.length)],
  ].filter(Boolean) as string[][];
  return (
    <div className="ne-intro">
      <div className="ne-ileft">
        <div className="ne-ikick">{kind}{d.year ? ` · ${d.year}` : ""}</div>
        <div className={"ne-it" + (named.length >= 2 ? " wp" : "")} ref={ref}><Words text={title} t0={0.6} className="ne-itw" /></div>
        <div className="ne-irule" />
        <div className="ne-istatus"><i />{STATUS[ph]}</div>
        {facts.length > 0 && (
          <div className="ne-ifacts">
            {facts.map(([k, v], i) => <div key={k} className="f" style={{ ["--k" as string]: i }}><span>{k}</span><b>{v}</b></div>)}
          </div>
        )}
      </div>
      {named.length >= 2 && (
        <div className="nm-panel ne-icands" style={{ height: 100 + Math.min(MAX_INTRO_CANDS, named.length) * 72 + (named.length > MAX_INTRO_CANDS ? 44 : 0) }}>
          <div className="nm-inner">
            <div className="nm-lab">Candidatos</div>
            <div className="grid">
              {named.slice(0, MAX_INTRO_CANDS).map((c, k) => (
                <div key={k} className="cd" style={{ ["--k" as string]: k }}>
                  <Avatar c={{ ...c, i: k }} size={62} />
                  <span><b>{c.name}</b>{c.party && d.kind === "presidencial" && <small>{c.party}</small>}</span>
                </div>
              ))}
              {named.length > MAX_INTRO_CANDS && <div className="more">y {named.length - MAX_INTRO_CANDS} más</div>}
            </div>
          </div>
        </div>
      )}
      <div className="ne-ibot">
        <div className="ne-tl">
          {ELECTION_PHASES.map((p, k) => (
            <div key={p.id} className={"n" + (k < step ? " done" : k === step ? " now" : "")} style={{ ["--k" as string]: k }}>
              <i /><span>{p.short}</span>
            </div>
          ))}
        </div>
        <div className="ne-tag"><img src={ciclicoWhite} alt="Cíclico" /><span>Toda la información en<b>www.somosciclico.com</b></span></div>
      </div>
    </div>
  );
}

// Tarjeta vertical: la foto de fondo, el nombre abajo y una columna de porcentaje que sube desde abajo (escala 0–100 %).
function VCard({ c, b, k = 0, d: dd, label }: { c: Ranked; b: number; k?: number; d: ElectionData; label?: string }) {
  const pct = useCount(c.pct, b * 1000 + 1500 + k * 450, 2200);
  const par = dd.kind === "parlamentaria";
  return (
    <div className="ne-vc" style={{ ["--b" as string]: `${b + k * 0.45}s`, ["--c" as string]: c.color, ["--p" as string]: Math.min(100, c.pct) }}>
      <div className="bg" style={{ background: c.photo_url ? `url(${c.photo_url}) 50% 14%/cover` : `linear-gradient(160deg,${hexA(c.color, 1)},${hexA(c.color, .35)})` }}>
        {!c.photo_url && <span>{initials(c.name)}</span>}
      </div>
      <div className="shade" />
      {label && <div className="tag">{label}</div>}
      <div className="col"><div className="trk" /><i /><b className="lab">{fmtPct(pct)}<small>%</small></b></div>
      <div className="info">
        <b>{c.name}</b>
        {!par && c.party && <small>{c.party}</small>}
        {c.votes != null && <em>{fmtNum(c.votes)} votos</em>}
      </div>
      <div className="edge" />
    </div>
  );
}

// ---- Pantalla 1: ganador ----
function WinnerScreen({ d, ranked: byVotes, b }: { d: ElectionData; ranked: Ranked[]; b: number }) {
  // Si el editor confirmó a alguien, ése va primero (aunque el conteo lo muestre detrás); el resto, por votos.
  const forced = d.winner_override ? byVotes.find((c) => normName(c.name) === normName(d.winner_override!)) : undefined;
  const ranked = forced ? [forced, ...byVotes.filter((c) => c !== forced)] : byVotes;
  const w = ranked[0]!;
  const second = ranked[1];
  const par = d.kind === "parlamentaria";
  const pct = useCount(w.pct, b * 1000 + 2900, 2000);
  const final = electionPhase(d) === "definitivo";
  const label = final ? (par ? "PRIMERA FUERZA" : "GANADOR") : "CONTEO PRELIMINAR";
  const lead = second ? w.pct - second.pct : 0;
  const top = byVotes.slice(0, ELECTION_TOP_N);
  const rest = Math.max(0, 100 - top.reduce((s, c) => s + c.pct, 0));
  return (
    <div className="ne-win" style={{ ["--b" as string]: `${b}s`, ["--c" as string]: w.color }}>
      <VCard c={w} b={b} d={d} />
      <div className="ne-wtxt">
        <div className={"ne-flag-pill" + (final ? " called" : "")}><i />{label}</div>
        <div className="ne-wname">{w.name}</div>
        {!par && w.party && <div className="ne-wparty"><i style={{ background: w.color }} />{w.party}</div>}
        <div className="ne-wpct"><span>{fmtPct(pct)}</span><small>%</small></div>
        <div className="ne-wmeta">
          {w.votes != null && <span><b>{fmtNum(w.votes)}</b> votos</span>}
          {second && lead > 0 && <span className="lead">+{fmtPct(lead)} puntos sobre <b>{second.name}</b></span>}
        </div>
        <div className="ne-stack">
          {top.map((c) => <i key={c.i} style={{ width: `${c.pct}%`, background: c.color }} />)}
          {rest > 0.2 && <i style={{ width: `${rest}%`, background: "rgba(169,182,214,.3)" }} />}
        </div>
      </div>
    </div>
  );
}

// ---- Segunda vuelta: dos tarjetas verticales enfrentadas ----
function RunoffScreen({ d, ranked, b }: { d: ElectionData; ranked: Ranked[]; b: number }) {
  const [x, y] = ranked;
  if (!x || !y) return null;
  return (
    <div className="ne-vs" style={{ ["--b" as string]: `${b}s` }}>
      <VCard c={x} b={b} k={0} d={d} />
      <div className="mid">
        <div className="pill"><i />VAN A SEGUNDA VUELTA</div>
        <div className="vs">VS</div>
        <div className="gap">{fmtPct(Math.abs(x.pct - y.pct))} <small>puntos de diferencia</small></div>
      </div>
      <VCard c={y} b={b} k={1} d={d} />
    </div>
  );
}

// ---- Pantalla 2: principales ----
function TopScreen({ d, ranked, b, hold }: { d: ElectionData; ranked: Ranked[]; b: number; hold: number }) {
  const n = d.kind === "presidencial" && d.round === 2 ? 2 : Math.min(ELECTION_TOP_N, ranked.length);
  const rows = ranked.slice(0, n);
  const max = Math.max(...rows.map((r) => r.pct), 1);
  const par = d.kind === "parlamentaria";
  // Énfasis: una vez armada la placa, cada tarjeta toma el foco por turnos (las demás se apagan un poco).
  const [foc, setFoc] = useState(-1);
  useEffect(() => {
    const per = Math.max(3000, ((hold - 2) * 1000) / n);
    let iv: ReturnType<typeof setInterval> | undefined;
    let k = 0;
    const t0 = setTimeout(() => { setFoc(0); iv = setInterval(() => { k = (k + 1) % n; setFoc(k); }, per); }, (ELECTION_ENTER_SEC - 0.5) * 1000);
    return () => { clearTimeout(t0); if (iv) clearInterval(iv); };
  }, [n, hold]);
  const rh = IS_VERTICAL ? 0 : Math.min(112, Math.floor(520 / n));
  const av = IS_VERTICAL ? 84 : Math.min(92, rh - 14);
  return (
    <div className="ne-top" style={{ ["--b" as string]: `${b}s` }}>
      <div className="ne-sec">{n === 2 ? "BALOTAJE" : par ? "PARTIDOS MÁS VOTADOS" : `LOS ${n} MÁS VOTADOS`}</div>
      {rows.map((r, k) => (
        <div key={r.i} className={"ne-row" + (k === 0 && foc < 0 ? " lead" : "") + (foc === k ? " foc" : foc >= 0 ? " dim" : "")} style={{ ["--k" as string]: k, ["--c" as string]: r.color, ...(rh ? { height: rh } : {}) }}>
          <span className="rk">{k + 1}</span>
          <Avatar c={r} size={av} />
          <span className="nn"><b>{r.name}</b>{!par && r.party && <small>{r.party}</small>}</span>
          <span className="trk"><i style={{ width: `${(r.pct / max) * 100}%`, background: `linear-gradient(90deg,${hexA(r.color, .55)},${r.color})`, boxShadow: `0 0 26px ${hexA(r.color, .55)}` }} /></span>
          <span className="pc">{fmtPct(r.pct)}<small>%</small></span>
          <span className="vt">{r.votes != null ? fmtNum(r.votes) : ""}</span>
        </div>
      ))}
    </div>
  );
}

// ---- Pantalla de ciudades (capitales seguidas, sólo con datos del TSE) ----
function CitiesScreen({ d, b }: { d: ElectionData; b: number }) {
  const cities = d.cities ?? [];
  return (
    <div className="ne-cities" style={{ ["--b" as string]: `${b}s` }}>
      <div className="ne-sec">Principales ciudades</div>
      <div className="row">
        {cities.map((c, k) => {
          const lead = c.top[0];
          const lc = lead ? d.candidates[lead.i] : undefined;
          return (
            <div key={c.id} className="ne-city" style={{ ["--k" as string]: k, ["--c" as string]: lc?.color ?? "#2F6BFF" }}>
              <div className="hd"><b>{c.name}</b><small>{c.uf} · {fmtPct(c.counted_pct)} % escrutado</small></div>
              {lead && lc && <div className="lead"><Avatar c={{ ...lc, i: lead.i }} size={132} /><span><b>{lc.name}</b>{lc.party && <small>{lc.party}</small>}</span></div>}
              {lead && <div className="pct">{fmtPct(lead.pct)}<small>%</small></div>}
              <div className="stk">{c.top.map((t) => <i key={t.i} style={{ flex: t.pct, background: d.candidates[t.i]?.color }} />)}</div>
              <div className="oth">{c.top.slice(1, 3).map((t) => <span key={t.i}><i style={{ background: d.candidates[t.i]?.color }} />{d.candidates[t.i]?.name}<em>{fmtPct(t.pct)}%</em></span>)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Brasileños en Argentina (voto en el exterior, sólo con datos del TSE) ----
// Izquierda: electores y estado del conteo. Derecha: quién ganó en cada ciudad (Buenos Aires, Córdoba, otras) y el podio del país.
function AbroadScreen({ d, b }: { d: ElectionData; b: number }) {
  const a = d.abroad;
  const el = useCount(a?.electorate ?? 0, b * 1000 + 900, 1800);
  if (!a) return null;
  const hm = a.updated_at ? `${a.updated_at.slice(8, 10)}/${a.updated_at.slice(5, 7)} · ${a.updated_at.slice(11, 16)} hs` : "—";
  const stat = (lab: string, v: string | number | null | undefined, k: number) => v != null && v !== "" && <div className="st" style={{ ["--k" as string]: k }}><span>{lab}</span><b>{typeof v === "number" ? fmtNum(v) : v}</b></div>;
  const podium = a.candidates.slice(0, 3);
  const maxP = Math.max(...podium.map((p) => p.pct), 1);
  return (
    <div className="ne-ab" style={{ ["--b" as string]: `${b}s` }}>
      <div className="left">
        <div className="ne-sec">Brasileños en {a.country_name}</div>
        <div className="elec"><span>Electores habilitados</span><b>{fmtNum(el)}</b></div>
        <div className="stats">
          {stat("Boletines recibidos", a.bulletins_received, 0)}
          {stat("Boletines totalizados", a.bulletins_totalized, 1)}
          {a.totalized_pct != null && <div className="st" style={{ ["--k" as string]: 2 }}><span>% totalizado</span><b>{fmtPct(a.totalized_pct)}<small>%</small></b><i className="bar"><u style={{ width: `${Math.min(100, a.totalized_pct)}%` }} /></i></div>}
          <div className="st wide" style={{ ["--k" as string]: 3 }}><span>Hora de actualización</span><b>{hm}</b></div>
        </div>
      </div>
      <div className="right">
        <div className="ne-sec">Quién ganó en cada ciudad</div>
        <div className="wins">
          {a.cities.map((c, k) => {
            const w = c.top[0];
            const wc = w ? d.candidates[w.i] : undefined;
            return (
              <div key={c.name} className="win" style={{ ["--k" as string]: k, ["--c" as string]: wc?.color ?? "#2F6BFF" }}>
                <b className="city">{c.name}</b>
                {w && wc && <><Avatar c={{ ...wc, i: w.i }} size={92} /><span className="who">{wc.name}</span><strong>{fmtPct(w.pct)}<small>%</small></strong></>}
                <small className="el">{c.electorate != null ? `${fmtNum(c.electorate)} electores` : ""}</small>
              </div>
            );
          })}
        </div>
        <div className="ne-sec pod-t">Los tres primeros en {a.country_name}</div>
        <div className="pod">
          {podium.map((p, k) => {
            const c = d.candidates[p.i];
            if (!c) return null;
            return (
              <div key={p.i} className={"pl" + (k === 0 ? " first" : "")} style={{ ["--k" as string]: k, ["--c" as string]: c.color }}>
                <span className="n">{k + 1}</span>
                <Avatar c={{ ...c, i: p.i }} size={64} />
                <span className="nm2"><b>{c.name}</b><em>{fmtNum(p.votes)} votos</em></span>
                <i className="trk"><u style={{ width: `${(p.pct / maxP) * 100}%`, background: c.color }} /></i>
                <strong>{fmtPct(p.pct)}<small>%</small></strong>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---- Pantalla 3: por estado ----
function StatesScreen({ d, b }: { d: ElectionData; b: number }) {
  const map = MAPS[d.country];
  const country = ELECTION_COUNTRIES.find((c) => c.id === d.country);
  const byId = useMemo(() => new Map(d.states.map((s) => [s.id, s])), [d.states]);
  const maxVotes = Math.max(1, ...d.states.map((s) => s.votes ?? 0));
  const wins = useMemo(() => {
    const m = new Map<number, number>();
    d.states.forEach((s) => { if (s.winner >= 0) m.set(s.winner, (m.get(s.winner) ?? 0) + 1); });
    return d.candidates.map((c, i) => ({ ...c, i, n: m.get(i) ?? 0 })).filter((c) => c.n > 0).sort((a, b2) => b2.n - a.n).slice(0, 5); // con muchos candidatos sólo los 5 con más estados
  }, [d]);
  const total = (country?.regions.length ?? 0) || 1;
  const decided = d.states.filter((s) => s.winner >= 0).length;
  const [x0, y0, w, h] = map?.viewBox ?? [0, 0, 1, 1];
  const tall = h / w > 0.7;
  const nameOf = (id: string) => map?.regions.find((r) => r.id === id)?.name ?? id;
  const topStates = [...d.states].filter((s) => s.winner >= 0 && s.votes).sort((a, b2) => (b2.votes ?? 0) - (a.votes ?? 0)).slice(0, 5);
  const rmax = Math.max(w, h) * 0.05;
  if (!map) return null;
  return (
    <div className={"ne-sts" + (tall ? " tall" : "")} style={{ ["--b" as string]: `${b}s` }}>
      {tall && (
        <div className="ne-big">
          <div className="ne-sec">Mayor votación</div>
          {topStates.map((s, k) => { const c = d.candidates[s.winner]!; return (
            <div key={s.id} className="ne-bigrow" style={{ ["--k" as string]: k, ["--c" as string]: c.color }}>
              <i className="dot" style={{ background: c.color, boxShadow: `0 0 16px ${hexA(c.color, .8)}` }} />
              <span className="nn"><b>{nameOf(s.id)}</b><small>{c.name}</small></span>
              <span className="pc">{s.pct != null ? fmtPct(s.pct) : ""}<small>%</small></span>
              <span className="vt">{s.votes != null ? fmtNum(s.votes) : ""}</span>
            </div>); })}
        </div>
      )}
      <div className="ne-map">
        <svg viewBox={`${x0} ${y0} ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
          <defs><filter id="ne-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" /></filter></defs>
          <g>
            {map.regions.map((r, k) => {
              const s = byId.get(r.id);
              const c = s && s.winner >= 0 ? d.candidates[s.winner] : undefined;
              const t = c ? Math.min(1, Math.max(0, ((s!.pct ?? 55) - 30) / 40)) : 0;
              return <path key={r.id} className="rg" d={r.d} style={{ ["--k" as string]: k, fill: c ? solid(c.color, 0.3 + 0.62 * t) : "#13214D" }} />;
            })}
          </g>
          <g>
            {map.regions.map((r, k) => {
              const s = byId.get(r.id);
              const c = s && s.winner >= 0 ? d.candidates[s.winner] : undefined;
              if (!c || !s?.votes) return null;
              const rad = Math.max(rmax * 0.28, rmax * Math.sqrt(s.votes / maxVotes));
              return (
                <g key={r.id} className="bb" style={{ ["--k" as string]: k }}>
                  <circle cx={r.cx} cy={r.cy} r={rad * 1.5} fill={c.color} opacity=".35" filter="url(#ne-glow)" />
                  <circle cx={r.cx} cy={r.cy} r={rad} fill={solid(c.color, .95)} stroke="#fff" strokeWidth={Math.max(1, w / 700)} />
                </g>
              );
            })}
          </g>
        </svg>
        <div className="ne-scan" />
      </div>
      <div className="ne-side">
        <div className="ne-sec">Ganador por {SING[country?.regionLabel ?? ""] ?? "estado"}</div>
        {wins.map((c, k) => (
          <div key={c.i} className="ne-win-row" style={{ ["--k" as string]: k }}>
            <i className="dot" style={{ background: c.color, boxShadow: `0 0 18px ${hexA(c.color, .8)}` }} />
            <span className="nn"><b>{c.name}</b>{c.party && d.kind === "presidencial" && <small>{c.party}</small>}</span>
            <span className="n">{c.n}</span>
            <span className="bar"><i style={{ width: `${(c.n / total) * 100}%`, background: c.color }} /></span>
          </div>
        ))}
        <div className="ne-heat">
          <span>Menor ventaja</span><i /><span>Mayor ventaja</span>
        </div>
        <div className="ne-note"><i /> Tamaño de la burbuja: votos del ganador · {decided} de {total} {country?.regionLabel.toLowerCase() ?? "estados"} con resultado</div>
      </div>
    </div>
  );
}

type Scr = ElectionScreen;
const PHASE_RANK: ElectionPhase[] = ["apertura", "cierre", "resultados", "preliminar", "definitivo"];
// Modo auto (TSE): el servidor ya normalizó los resultados; acá se piden cada 30 s y pisan candidatos, estados y % escrutado.
// La etapa nunca retrocede: manda la más avanzada entre la que puso el editor y la que deducen los datos.
function useLiveTse(auto: ElectionData["auto"]): ElectionLive | null {
  const [live, setLive] = useState<ElectionLive | null>(null);
  useEffect(() => {
    if (!auto) return;
    let on = true;
    const load = () => fetch(`${API_BASE}/api/tse/live/br-presidente`).then((r) => r.json()).then((j: ElectionLive) => { if (on) setLive(j); }).catch(() => {});
    load();
    const iv = setInterval(load, 30_000);
    return () => { on = false; clearInterval(iv); };
  }, [auto]);
  return live;
}
function mergeLive(d: ElectionData, live: ElectionLive | null): ElectionData {
  if (!d.auto || !live?.available || live.candidates.length < 2) return d;
  let hint: ElectionPhase = live.counted_pct > 0 ? "resultados" : "apertura";
  if (live.outcome !== "open") hint = live.totalized_final ? "definitivo" : "preliminar";
  const phase = PHASE_RANK.indexOf(hint) > PHASE_RANK.indexOf(d.phase ?? "apertura") ? hint : d.phase;
  return { ...d, candidates: live.candidates, states: live.states, counted_pct: live.counted_pct, cities: live.cities, abroad: live.abroad ?? undefined, outcome: live.outcome, source: live.source, round: live.round, phase };
}

// Ganador confirmado a mano por el editor (las noticias lo dieron y el TSE no lo marcó): manda sobre lo que diga el TSE.
function applyOverride(d: ElectionData): ElectionData {
  if (!d.winner_override) return d;
  return { ...d, outcome: "winner", phase: "definitivo" };
}

export function Elecciones({ data: manual, durationSec }: { data: ElectionData; durationSec?: number }) {
  const { cls } = useLife(durationSec, 1);
  const live = useLiveTse(manual.auto);
  const data = useMemo(() => applyOverride(mergeLive(manual, live)), [manual, live]);
  const videoRef = useForcePlay<HTMLVideoElement>();
  const country = ELECTION_COUNTRIES.find((c) => c.id === data.country);
  // Tiempo con la placa ya armada: nunca menos de 20 s (`?hold=N` sólo para revisar demos).
  const hold = Number(P.get("hold")) || electionHold(data.sec_per_screen);
  const stepMs = (ELECTION_ENTER_SEC + hold) * 1000;
  const ranked: Ranked[] = useMemo(() => (data.candidates ?? []).map((c, i) => ({ ...c, i })).sort((a, b) => b.pct - a.pct), [data.candidates]);
  const screens = useMemo(() => electionScreens(data), [data]);
  const n = screens.length;
  const [idx, setIdx] = useState(() => Math.min(n - 1, Math.max(0, Number(P.get("scr")) || 0))); // ?scr=N: sólo para revisar demos
  const idx0 = useRef(idx);
  // ?scr=N (revisión): con datos en vivo las pantallas aparecen después de montar; se salta a N cuando existe.
  const wantScr = useRef(Number(P.get("scr")) || 0);
  useEffect(() => { if (wantScr.current > 0 && n > wantScr.current) { setIdx(wantScr.current); idx0.current = wantScr.current; wantScr.current = 0; } }, [n]);
  const [prev, setPrev] = useState<number | null>(null);
  const tRef = useRef<HTMLDivElement>(null);
  useFitMax(tRef, 64, 38, 90, [data.title, data.country]);

  useEffect(() => {
    if (n <= 1) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let k = idx0.current;
    const step = () => {
      const from = k % n;
      k++;
      setPrev(from); setIdx(k % n);
      timers.push(setTimeout(() => setPrev(null), 750));
      timers.push(setTimeout(step, stepMs));
    };
    timers.push(setTimeout(step, INTRO_MS + stepMs));
    return () => timers.forEach(clearTimeout);
  }, [n, stepMs]);

  const kind = data.kind === "parlamentaria" ? "Elecciones parlamentarias" : data.round === 2 ? "Elecciones presidenciales · Segunda vuelta" : data.round === 1 ? "Elecciones presidenciales · Primera vuelta" : "Elecciones presidenciales";
  const title = data.title?.trim() || `${country?.name ?? ""}${data.year ? " " + data.year : ""}`;
  const counted = Math.min(100, Math.max(0, data.counted_pct ?? 0));
  const cn = useCount(counted, 1400, 1500);

  const render = (s: Scr, b: number) => s === "intro" ? <IntroScreen d={data} kind={kind} /> : s === "cities" ? <div className="ne-pad"><CitiesScreen d={data} b={b} /></div> : s === "abroad" ? <div className="ne-pad"><AbroadScreen d={data} b={b} /></div> : s === "runoff" ? <div className="ne-pad"><RunoffScreen d={data} ranked={ranked} b={b} /></div> : s === "winner" ? <div className="ne-pad"><WinnerScreen d={data} ranked={ranked} b={b} /></div> : s === "top" ? <div className="ne-pad"><TopScreen d={data} ranked={ranked} b={b} hold={hold} /></div> : <div className="ne-pad"><StatesScreen d={data} b={b} /></div>;
  const cur = screens[idx] ?? screens[0]!;
  const old = prev != null ? screens[prev] : undefined;

  return (
    <div className={"nm ne" + (IS_VERTICAL ? " v" : "") + cls + (cur === "intro" ? " on-intro" : "") + (counted > 0 ? "" : " no-count")}>
      <style>{NM_CSS + CSS + (IS_VERTICAL ? CSS_V : "")}</style>
      <div className="nm-bg" />
      <video ref={videoRef} className="ne-vid" src={`${FLAG_BASE}${data.country}.mp4`} autoPlay muted loop playsInline />
      <div className="ne-tint" />
      <div className="ne-lines"><i /><i /><i /><i /><i /></div>
      <Grain />
      <Lights />
      <div className="nm-sc">
        <div className="ne-head">
          <Kick text={kind} />
          <div className="ne-title" ref={tRef}><Words text={title} /></div>
        </div>
        <div className="ne-count">
          <div className="lab">ESCRUTINIO</div>
          <div className="big">{fmtPct(cn)}<small>%</small></div>
          <div className="trk"><i style={{ ["--w" as string]: `${counted}%` }} /></div>
        </div>
        <div className="ne-stage">
          {old && <div className="ne-s old" key={"o" + prev}>{render(old, 0)}</div>}
          <div className={"ne-s" + (prev != null ? " new" : " first")} key={"n" + idx + (prev != null ? "x" : "")}>{render(cur, prev != null ? 0.35 : 1.2)}</div>
          {prev != null && <div className="ne-bar" key={"b" + idx} />}
        </div>
        <div className="ne-src"><span>FUENTE</span>{data.source}</div>
      </div>
      <ModernChrome />
    </div>
  );
}

const CSS = `
.ne-vid{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;filter:saturate(.85) brightness(.58) contrast(1.05) blur(1px);transform:scale(1.04)}
.in .ne-vid{animation:ne-vidin 1.6s ease .1s forwards}
@keyframes ne-vidin{to{opacity:.8}}
.ne-tint{position:absolute;inset:0;mix-blend-mode:multiply;background:linear-gradient(180deg,rgba(6,16,48,.78) 0%,rgba(8,26,86,.58) 50%,rgba(3,8,26,.92) 100%)}
.ne-tint::after{content:"";position:absolute;inset:0;background:radial-gradient(900px 600px at 85% 0%,rgba(47,107,255,.35),transparent 65%)}
.ne-lines{position:absolute;inset:0;overflow:hidden;pointer-events:none;mix-blend-mode:screen}
.ne-lines i{position:absolute;top:-30%;height:160%;width:2px;opacity:0;transform:skewX(-18deg);background:linear-gradient(180deg,transparent,rgba(127,162,255,.0) 10%,rgba(160,190,255,.7) 50%,rgba(127,162,255,0) 90%,transparent);box-shadow:0 0 18px 2px rgba(47,107,255,.5)}
.ne-lines i:nth-child(1){left:12%}.ne-lines i:nth-child(2){left:31%}.ne-lines i:nth-child(3){left:57%}.ne-lines i:nth-child(4){left:76%}.ne-lines i:nth-child(5){left:91%}
.in .ne-lines i{animation:ne-line 7s ease-in-out infinite}
.ne-lines i:nth-child(2){animation-delay:-2s!important}.ne-lines i:nth-child(3){animation-delay:-4s!important}.ne-lines i:nth-child(4){animation-delay:-1s!important}.ne-lines i:nth-child(5){animation-delay:-5s!important}
@keyframes ne-line{0%{opacity:0;transform:translateX(-60px) skewX(-18deg)}30%{opacity:.7}70%{opacity:.5}100%{opacity:0;transform:translateX(120px) skewX(-18deg)}}
.ne .nm-grain{opacity:.05}

.ne-head{position:absolute;left:96px;top:150px;width:1200px;display:flex;flex-direction:column;gap:14px}
.ne-title{font-size:64px;max-height:90px}
.ne-title .nm-ttl{font-size:inherit;line-height:1.02}
.ne-count{position:absolute;right:96px;top:150px;width:360px;display:flex;flex-direction:column;gap:8px;opacity:0}
.in .ne-count{animation:nm-up .8s cubic-bezier(.2,.8,.2,1) 1.1s forwards}
.ne-count .lab{font-family:var(--display);font-weight:700;font-stretch:115%;font-size:15px;letter-spacing:.3em;color:var(--blue-soft);text-align:right}
.ne-count .big{font-family:var(--display);font-weight:800;font-stretch:80%;font-size:78px;line-height:.9;text-align:right;font-variant-numeric:tabular-nums;color:var(--paper);text-shadow:0 0 40px rgba(47,107,255,.5)}
.ne-count .big small{font-size:.5em;margin-left:4px;color:var(--blue-soft)}
.ne-count .trk{height:8px;border-radius:5px;background:rgba(169,182,214,.2);overflow:hidden}
.ne-count .trk i{display:block;height:100%;width:0;border-radius:5px;background:linear-gradient(90deg,#2F6BFF,#9DB8FF);box-shadow:0 0 14px rgba(127,162,255,.9)}
.in .ne-count .trk i{animation:ne-w 1.5s cubic-bezier(.2,.8,.2,1) 1.4s forwards}
@keyframes ne-w{to{width:var(--w)}}
.ne-src{position:absolute;left:96px;top:906px;font-size:19px;color:var(--mist);display:flex;gap:14px;align-items:center;opacity:0}
.in .ne-src{animation:nm-fade .6s ease 1.6s forwards}
.ne-src span{font-family:var(--display);font-weight:700;font-stretch:115%;font-size:13px;letter-spacing:.28em;color:var(--blue-soft)}
.out .ne-head,.out .ne-count,.out .ne-src{transition:opacity .4s;opacity:0!important}

.ne-stage{position:absolute;left:96px;top:150px;width:1728px;height:740px;overflow:hidden}
.ne-pad{position:absolute;left:0;right:0;top:150px;height:580px}
.on-intro .ne-head,.on-intro .ne-count,.on-intro .ne-src,.no-count .ne-count{opacity:0!important;transition:opacity .4s}
.ne-s{position:absolute;inset:0}
.ne-s.first{opacity:0}
.in .ne-s.first{animation:nm-fade .5s ease 1s forwards}
.ne-s.new{clip-path:inset(0 100% 0 0);animation:ne-reveal .7s cubic-bezier(.65,0,.35,1) forwards}
.ne-s.old{animation:ne-hide .7s cubic-bezier(.65,0,.35,1) forwards}
@keyframes ne-reveal{to{clip-path:inset(0 0 0 0)}}
@keyframes ne-hide{from{clip-path:inset(0 0 0 0)}to{clip-path:inset(0 0 0 100%)}}
.ne-bar{position:absolute;top:-4%;bottom:-4%;left:0;width:34px;background:#fff;z-index:8;opacity:0;box-shadow:0 0 40px 12px rgba(200,220,255,.8),0 0 120px 30px rgba(47,107,255,.5);animation:ne-barx .7s cubic-bezier(.65,0,.35,1) forwards}
@keyframes ne-barx{0%{opacity:1;left:-40px}90%{opacity:1}100%{opacity:0;left:100%}}
.ne-sec{font-family:var(--display);font-weight:700;font-stretch:115%;font-size:18px;letter-spacing:.3em;text-transform:uppercase;color:var(--blue-soft);margin-bottom:6px}
.ne-av{border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;color:#fff;font-family:var(--display);font-weight:800}

/* Ganador */
.ne-win{position:absolute;inset:0;display:flex;gap:56px;align-items:stretch}
/* Tarjeta vertical: foto de fondo + columna de porcentaje que sube */
.ne-vc{position:relative;width:540px;flex:none;height:100%;border-radius:22px;overflow:hidden;opacity:0;transform:translateY(70px) rotateX(10deg);transform-origin:50% 100%;
  box-shadow:0 40px 90px -30px rgba(0,0,0,.9),0 0 90px -20px color-mix(in srgb,var(--c) 55%,transparent);animation:ne-vcin 1.5s cubic-bezier(.16,.9,.2,1) var(--b) forwards}
@keyframes ne-vcin{to{opacity:1;transform:none}}
.ne-vc .bg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:var(--display);font-weight:800;font-size:200px;color:rgba(255,255,255,.85);transform:scale(1.08);animation:ne-kb 14s ease-out forwards}
@keyframes ne-kb{to{transform:scale(1)}}
.ne-vc .shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,11,31,.1) 0%,rgba(5,11,31,0) 30%,rgba(5,11,31,.55) 62%,rgba(5,11,31,.94) 100%)}
.ne-vc::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 1px rgba(255,255,255,.2),inset 0 1px 0 rgba(255,255,255,.35);pointer-events:none}
.ne-vc .edge{position:absolute;left:0;right:0;bottom:0;height:8px;background:var(--c);box-shadow:0 0 24px var(--c)}
.ne-vc .tag{position:absolute;left:22px;top:22px;font-family:var(--display);font-weight:800;font-stretch:112%;font-size:15px;letter-spacing:.26em;color:#fff;background:rgba(5,11,31,.6);padding:8px 14px;border-radius:6px}
.ne-vc .col{position:absolute;right:26px;top:26px;bottom:34px;width:78px}
.ne-vc .col .trk{position:absolute;inset:0;border-radius:39px;background:rgba(5,11,31,.45);box-shadow:inset 0 0 0 1px rgba(255,255,255,.16)}
.ne-vc .col i{position:absolute;left:0;right:0;bottom:0;height:calc(var(--p) * 1%);min-height:12px;border-radius:39px;transform-origin:50% 100%;transform:scaleY(0);
  background:linear-gradient(0deg,color-mix(in srgb,var(--c) 70%,#000),var(--c));box-shadow:0 0 34px color-mix(in srgb,var(--c) 80%,transparent),inset 0 1px 0 rgba(255,255,255,.5);animation:ne-rise 2.2s cubic-bezier(.2,.8,.2,1) calc(var(--b) + 1.5s) forwards}
@keyframes ne-rise{to{transform:scaleY(1)}}
.ne-vc .col .lab{position:absolute;left:50%;transform:translateX(-50%);bottom:0;margin-bottom:12px;white-space:nowrap;font-family:var(--display);font-weight:900;font-stretch:80%;font-size:46px;color:#fff;text-shadow:0 4px 18px rgba(0,0,0,.7);opacity:0;
  animation:ne-lab 2.2s cubic-bezier(.2,.8,.2,1) calc(var(--b) + 1.5s) forwards}
@keyframes ne-lab{0%{bottom:0%;opacity:1}100%{bottom:calc(var(--p) * 1%);opacity:1}}
.ne-vc .col .lab small{font-size:.5em;margin-left:2px;color:var(--blue-soft)}
.ne-vc .info{position:absolute;left:26px;right:130px;bottom:30px;display:flex;flex-direction:column;gap:6px;opacity:0;animation:nm-up 1.2s cubic-bezier(.2,.8,.2,1) calc(var(--b) + .8s) forwards}
.ne-vc .info b{font-family:var(--display);font-weight:800;font-stretch:86%;font-size:46px;line-height:1.02;color:#fff;text-shadow:0 4px 24px rgba(0,0,0,.7);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ne-vc .info small{font-size:22px;color:var(--mist)}
.ne-vc .info em{font-style:normal;font-size:24px;color:var(--paper);font-variant-numeric:tabular-nums}
.ne-win{gap:56px}
.ne-win .ne-vc{width:620px}
.ne-vs{position:absolute;inset:0;display:flex;justify-content:center;gap:40px}
.ne-vs .ne-vc{width:620px}
.ne-vs .mid{width:300px;flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center}
.ne-vs .mid>*{opacity:0;animation:nm-up 1.1s cubic-bezier(.2,.8,.2,1) calc(var(--b) + 1.6s) forwards}
.ne-vs .mid .pill{display:inline-flex;align-items:center;gap:12px;background:var(--red);color:#fff;font-family:var(--display);font-weight:800;font-stretch:112%;font-size:17px;letter-spacing:.24em;padding:12px 18px 11px;border-radius:7px;box-shadow:0 14px 30px -10px rgba(238,34,12,.8);animation-delay:calc(var(--b) + 2.4s)}
.ne-vs .mid .pill i{width:10px;height:10px;border-radius:50%;background:#fff;animation:nm-blink 1.1s steps(1) infinite}
.ne-vs .mid .vs{font-family:var(--display);font-weight:900;font-stretch:72%;font-size:130px;line-height:.9;color:#fff;text-shadow:1px 1px 0 #4F6FD0,2px 2px 0 #4566C8,3px 3px 0 #3C5DBF,4px 4px 0 #3454B5,6px 8px 22px rgba(0,0,0,.55),0 0 70px rgba(47,107,255,.5);animation-delay:calc(var(--b) + 1.8s)}
.ne-vs .mid .gap{font-family:var(--display);font-weight:800;font-stretch:84%;font-size:50px;color:var(--paper);animation-delay:calc(var(--b) + 3.2s)}
.ne-vs .mid .gap small{display:block;font-size:19px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--mist);margin-top:4px}
.ne-wtxt{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:16px}
.ne-wtxt>*{opacity:0;animation:nm-up 1.2s cubic-bezier(.2,.8,.2,1) forwards}
.ne-flag-pill{align-self:flex-start;display:inline-flex;align-items:center;gap:12px;border-radius:7px;padding:11px 20px 10px;font-family:var(--display);font-weight:800;font-stretch:112%;font-size:19px;letter-spacing:.3em;color:#fff;border:1px solid rgba(127,162,255,.5);background:rgba(47,107,255,.2);animation-delay:calc(var(--b) + .6s)!important}
.ne-flag-pill i{width:10px;height:10px;border-radius:50%;background:var(--blue-soft);box-shadow:0 0 12px var(--blue-soft);animation:nm-blink 1.2s steps(1) infinite}
.ne-flag-pill.called{background:var(--red);border-color:transparent;box-shadow:0 14px 30px -10px rgba(238,34,12,.8)}
.ne-flag-pill.called i{background:#fff;box-shadow:0 0 12px #fff}
.ne-wname{font-family:var(--display);font-weight:800;font-stretch:84%;font-size:100px;line-height:.98;letter-spacing:-.015em;color:var(--paper);animation-delay:calc(var(--b) + 1.2s)!important;text-shadow:0 10px 40px rgba(0,0,0,.5)}
.ne-wparty{display:flex;align-items:center;gap:14px;font-size:30px;color:var(--mist);animation-delay:calc(var(--b) + 2s)!important}
.ne-wparty i{width:16px;height:16px;border-radius:50%}
.ne-wpct{font-family:var(--display);font-weight:900;font-stretch:72%;font-size:210px;line-height:.86;letter-spacing:-.03em;color:#fff;font-variant-numeric:tabular-nums;animation-delay:calc(var(--b) + 2.7s)!important;
  text-shadow:1px 1px 0 #4F6FD0,2px 2px 0 #4566C8,3px 3px 0 #3C5DBF,4px 4px 0 #3454B5,5px 5px 0 #2D4CAB,6px 6px 0 #2744A1,8px 10px 26px rgba(0,0,0,.55),0 0 80px color-mix(in srgb,var(--c) 55%,transparent)}
.ne-wpct small{font-size:.42em;margin-left:6px;color:var(--blue-soft);text-shadow:none}
.ne-wmeta{display:flex;gap:34px;align-items:center;font-size:27px;color:var(--mist);animation-delay:calc(var(--b) + 3.7s)!important}
.ne-wmeta b{color:var(--paper);font-weight:700}
.ne-wmeta .lead{border-left:2px solid rgba(127,162,255,.35);padding-left:34px}
.ne-stack{display:flex;height:14px;border-radius:7px;overflow:hidden;gap:3px;animation-delay:calc(var(--b) + 4.5s)!important}
.ne-stack i{display:block;height:100%;border-radius:3px;transform-origin:left;animation:nm-growX 1.6s cubic-bezier(.2,.8,.2,1) calc(var(--b) + 4.6s) both}

/* Principales */
.ne-top{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;gap:10px}
.ne-top .ne-sec{opacity:0;animation:nm-fade .5s ease var(--b) forwards}
.ne-row{display:flex;align-items:center;gap:26px;padding:0 28px;border-radius:16px;position:relative;opacity:0;
  background:linear-gradient(90deg,rgba(14,30,80,.78),rgba(8,18,50,.55));box-shadow:inset 0 0 0 1px rgba(127,162,255,.14),0 24px 50px -24px rgba(0,0,0,.8);
  animation:ne-rin 1.2s cubic-bezier(.2,.9,.2,1) calc(var(--b) + .4s + var(--k) * 480ms) forwards}
@keyframes ne-rin{from{opacity:0;transform:translateX(-120px) rotateY(18deg)}to{opacity:1;transform:none}}
.ne-row.lead{background:linear-gradient(90deg,rgba(47,107,255,.4),rgba(14,30,80,.65));box-shadow:inset 0 0 0 1px rgba(127,162,255,.5),0 0 50px -8px rgba(47,107,255,.5)}
.ne-row{transition:scale .7s cubic-bezier(.2,.8,.2,1),filter .7s ease,box-shadow .7s ease,background .7s ease}
.ne-row.foc{scale:1.025;z-index:3;background:linear-gradient(90deg,color-mix(in srgb,var(--c) 38%,rgba(14,30,80,.9)),rgba(8,18,50,.7));box-shadow:inset 0 0 0 2px var(--c),0 0 70px -6px var(--c)}
.ne-row.dim{filter:brightness(.55) saturate(.65)}
.ne-row.foc .trk i{filter:brightness(1.25);box-shadow:0 0 40px var(--c)}
.ne-row.foc .nn b{font-size:38px}
.ne-row .nn b{transition:font-size .6s ease}
.ne-row .rk{width:36px;text-align:center;font-family:var(--display);font-weight:800;font-size:34px;color:var(--mist)}
.ne-row.lead .rk{color:#fff}
.ne-row .nn{width:420px;flex:none;display:flex;flex-direction:column;gap:2px;min-width:0}
.ne-row .nn b{font-family:var(--display);font-weight:800;font-stretch:90%;font-size:34px;line-height:1.05;color:var(--paper);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ne-row .nn small{font-size:21px;color:var(--mist);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ne-row .trk{flex:1;height:30px;border-radius:15px;background:rgba(169,182,214,.12);overflow:hidden}
.ne-row .trk i{display:block;height:100%;border-radius:15px;transform-origin:left;animation:nm-growX 1.7s cubic-bezier(.2,.8,.2,1) calc(var(--b) + 1.2s + var(--k) * 480ms) both}
.ne-row .pc{width:150px;text-align:right;font-family:var(--display);font-weight:800;font-stretch:84%;font-size:62px;line-height:1;color:#fff;font-variant-numeric:tabular-nums}
.ne-row .pc small{font-size:.5em;color:var(--blue-soft);margin-left:3px}
.ne-row .vt{width:190px;text-align:right;font-size:26px;color:var(--mist);font-variant-numeric:tabular-nums}

/* Por estado */
.ne-sts{position:absolute;inset:0;display:flex;gap:40px}
.ne-map{position:relative;flex:1 1 0;min-width:0;opacity:0;animation:nm-fade .5s ease var(--b) forwards;overflow:hidden}
.ne-map svg{position:absolute;inset:0;width:100%;height:100%;filter:drop-shadow(0 20px 30px rgba(0,0,0,.5))}
.ne-map .rg{stroke:rgba(255,255,255,.4);stroke-width:1.2;stroke-linejoin:round;opacity:0;animation:ne-rg 1s ease calc(var(--b) + .4s + var(--k) * 65ms) forwards}
@keyframes ne-rg{from{opacity:0}to{opacity:1}}
.ne-map .bb{transform-box:fill-box;transform-origin:center;opacity:0;animation:ne-pop .9s cubic-bezier(.3,1.5,.5,1) calc(var(--b) + 2.4s + var(--k) * 65ms) forwards}
@keyframes ne-pop{from{opacity:0;transform:scale(0)}to{opacity:1;transform:none}}
.ne-scan{position:absolute;top:0;bottom:0;left:0;width:3px;background:linear-gradient(180deg,transparent,#fff,transparent);box-shadow:0 0 30px 8px rgba(127,162,255,.7);opacity:0;animation:ne-scan 2.6s ease-in-out calc(var(--b) + .2s) forwards}
@keyframes ne-scan{0%{opacity:0;left:0}15%{opacity:.9}85%{opacity:.9}100%{opacity:0;left:100%}}
.ne-big{width:520px;flex:none;display:flex;flex-direction:column;gap:12px;justify-content:center}
.ne-big .ne-sec{opacity:0;animation:nm-fade .5s ease var(--b) forwards}
.ne-bigrow{display:grid;grid-template-columns:20px 1fr auto;column-gap:16px;align-items:center;padding:12px 20px;border-radius:14px;background:linear-gradient(90deg,rgba(14,30,80,.78),rgba(8,18,50,.55));box-shadow:inset 0 0 0 1px rgba(127,162,255,.14);border-left:4px solid var(--c);opacity:0;animation:nm-up 1s cubic-bezier(.2,.8,.2,1) calc(var(--b) + 1s + var(--k) * 380ms) forwards}
.ne-bigrow .dot{width:20px;height:20px;border-radius:50%}
.ne-bigrow .nn{display:flex;flex-direction:column;min-width:0}
.ne-bigrow .nn b{font-family:var(--display);font-weight:800;font-stretch:90%;font-size:28px;line-height:1.05;color:var(--paper);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ne-bigrow .nn small{font-size:18px;color:var(--mist)}
.ne-bigrow .pc{font-family:var(--display);font-weight:800;font-stretch:84%;font-size:36px;color:#fff;text-align:right}
.ne-bigrow .pc small{font-size:.55em;color:var(--blue-soft);margin-left:2px}
.ne-bigrow .vt{grid-column:2 / -1;font-size:17px;color:var(--mist);text-align:left;margin-top:-2px;font-variant-numeric:tabular-nums}
.ne-side{width:520px;padding-right:24px;flex:none;display:flex;flex-direction:column;gap:14px;justify-content:center}
.ne-side .ne-sec{opacity:0;animation:nm-fade .5s ease var(--b) forwards}
.ne-win-row{display:grid;grid-template-columns:22px 1fr auto;grid-template-rows:auto 8px;column-gap:18px;row-gap:8px;align-items:center;opacity:0;animation:nm-up 1s cubic-bezier(.2,.8,.2,1) calc(var(--b) + 1s + var(--k) * 380ms) forwards}
.ne-win-row .dot{width:22px;height:22px;border-radius:50%}
.ne-win-row .nn{display:flex;flex-direction:column;min-width:0}
.ne-win-row .nn b{font-family:var(--display);font-weight:800;font-stretch:90%;font-size:31px;line-height:1.05;color:var(--paper);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ne-win-row .nn small{font-size:19px;color:var(--mist)}
.ne-win-row .n{font-family:var(--display);font-weight:900;font-stretch:78%;font-size:64px;line-height:1;color:#fff;font-variant-numeric:tabular-nums}
.ne-win-row .bar{grid-column:1 / -1;height:8px;border-radius:4px;background:rgba(169,182,214,.15);overflow:hidden}
.ne-win-row .bar i{display:block;height:100%;border-radius:4px;transform-origin:left;animation:nm-growX 1.5s cubic-bezier(.2,.8,.2,1) calc(var(--b) + 1.7s + var(--k) * 380ms) both}
.ne-heat{margin-top:12px;display:flex;align-items:center;gap:14px;font-size:16px;color:var(--mist);opacity:0;animation:nm-fade 1s ease calc(var(--b) + 3.6s) forwards}
.ne-heat i{flex:1;height:8px;border-radius:4px;background:linear-gradient(90deg,rgba(127,162,255,.25),rgba(127,162,255,1))}
.ne-note{display:flex;align-items:center;gap:12px;font-size:16px;color:var(--mist);opacity:0;animation:nm-fade 1s ease calc(var(--b) + 4.1s) forwards}
.ne-note i{width:14px;height:14px;border-radius:50%;border:2px solid #fff;background:rgba(127,162,255,.7);flex:none}

/* Ciudades */
.ne-cities{position:absolute;inset:0;display:flex;flex-direction:column;gap:14px}
.ne-cities .ne-sec{opacity:0;animation:nm-fade 1s ease var(--b) forwards}
.ne-cities .row{flex:1;display:flex;gap:18px;min-height:0}
.ne-city{flex:1;min-width:0;border-radius:18px;padding:26px 20px 22px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;position:relative;overflow:hidden;opacity:0;
  background:linear-gradient(160deg,rgba(26,46,104,.92),rgba(8,18,50,.9));box-shadow:inset 0 0 0 1px rgba(127,162,255,.18),0 30px 60px -30px rgba(0,0,0,.85);
  animation:ne-cin 1.3s cubic-bezier(.16,.9,.2,1) calc(var(--b) + .4s + var(--k) * 520ms) forwards}
.ne-city::before{content:"";position:absolute;left:0;right:0;top:0;height:6px;background:var(--c);box-shadow:0 0 24px var(--c)}
@keyframes ne-cin{from{opacity:0;transform:translateY(60px) rotateX(18deg)}to{opacity:1;transform:none}}
.ne-city .hd{display:flex;flex-direction:column;gap:4px;align-items:center}
.ne-city .hd b{font-family:var(--display);font-weight:800;font-stretch:84%;font-size:44px;line-height:1.02;color:var(--paper)}
.ne-city .hd small{font-size:16px;color:var(--mist);letter-spacing:.04em}
.ne-city .lead{display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:8px}
.ne-city .lead>span{display:flex;flex-direction:column;align-items:center;min-width:0}
.ne-city .lead b{font-family:var(--display);font-weight:800;font-stretch:90%;font-size:25px;line-height:1.05;color:var(--paper)}
.ne-city .lead small{font-size:15px;color:var(--mist)}
.ne-city .pct{font-family:var(--display);font-weight:900;font-stretch:76%;font-size:104px;line-height:.9;color:#fff;font-variant-numeric:tabular-nums;text-shadow:0 0 40px color-mix(in srgb,var(--c) 60%,transparent)}
.ne-city .pct small{font-size:.42em;margin-left:4px;color:var(--blue-soft);text-shadow:none}
.ne-city .stk{display:flex;height:12px;border-radius:6px;overflow:hidden;gap:3px;margin-top:auto;width:100%}
.ne-city .stk i{display:block;height:100%;border-radius:3px;transform-origin:left;animation:nm-growX 1.4s cubic-bezier(.2,.8,.2,1) calc(var(--b) + 1.6s + var(--k) * 520ms) both}
.ne-city .oth{display:flex;flex-direction:column;gap:6px;font-size:16px;color:var(--mist);width:100%}
.ne-city .oth span{display:flex;align-items:center;gap:8px;white-space:nowrap}
.ne-city .oth span i{width:10px;height:10px;border-radius:50%;flex:none}
.ne-city .oth em{margin-left:auto;font-style:normal;color:var(--paper);font-weight:600}

/* Brasileños en Argentina */
.ne-ab{position:absolute;inset:0;display:flex;gap:36px}
.ne-ab .ne-sec{opacity:0;animation:nm-fade 1s ease var(--b) forwards}
.ne-ab .left{width:600px;flex:none;display:flex;flex-direction:column;gap:8px}
.ne-ab .elec{display:flex;flex-direction:column;gap:2px;opacity:0;animation:nm-up 1.1s cubic-bezier(.2,.8,.2,1) calc(var(--b) + .5s) forwards}
.ne-ab .elec span,.ne-ab .cities>span,.ne-ab .st span{font-family:var(--display);font-weight:700;font-stretch:115%;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--blue-soft)}
.ne-ab .elec b{font-family:var(--display);font-weight:900;font-stretch:76%;font-size:96px;line-height:.95;color:#fff;font-variant-numeric:tabular-nums;text-shadow:0 0 50px rgba(47,107,255,.45)}
.ne-ab .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:auto}
.ne-ab .st{padding:8px 12px;border-radius:12px;background:linear-gradient(155deg,rgba(26,46,104,.9),rgba(8,18,50,.85));box-shadow:inset 0 0 0 1px rgba(127,162,255,.2);display:flex;flex-direction:column;gap:2px;opacity:0;animation:nm-up 1s cubic-bezier(.2,.8,.2,1) calc(var(--b) + 3s + var(--k) * 400ms) forwards}
.ne-ab .st.wide{grid-column:1 / -1}
.ne-ab .st b{font-family:var(--display);font-weight:800;font-stretch:88%;font-size:30px;color:var(--paper);font-variant-numeric:tabular-nums}
.ne-ab .st b small{font-size:.55em;color:var(--blue-soft);margin-left:3px}
.ne-ab .st .bar{display:block;height:8px;border-radius:4px;background:rgba(169,182,214,.18);overflow:hidden;margin-top:4px}
.ne-ab .st .bar u{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,#2F6BFF,#9DB8FF);box-shadow:0 0 14px rgba(127,162,255,.9);transform-origin:left;animation:nm-growX 1.8s cubic-bezier(.2,.8,.2,1) calc(var(--b) + 3.8s) both}
.ne-ab .right{flex:1;min-width:0;display:flex;flex-direction:column;gap:10px}
.ne-ab .right .ne-sec{opacity:0;animation:nm-fade 1s ease var(--b) forwards}
.ne-ab .right .pod-t{margin-top:8px;animation-delay:calc(var(--b) + 2.8s)}
.ne-ab .wins{display:flex;gap:16px;height:270px}
.ne-ab .win{flex:1;min-width:0;border-radius:16px;padding:16px 14px 12px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;position:relative;overflow:hidden;opacity:0;
  background:linear-gradient(160deg,rgba(26,46,104,.92),rgba(8,18,50,.9));box-shadow:inset 0 0 0 1px rgba(127,162,255,.18),0 24px 50px -28px rgba(0,0,0,.85);
  animation:ne-cin 1.3s cubic-bezier(.16,.9,.2,1) calc(var(--b) + .6s + var(--k) * 520ms) forwards}
.ne-ab .win::before{content:"";position:absolute;left:0;right:0;top:0;height:5px;background:var(--c);box-shadow:0 0 20px var(--c)}
.ne-ab .win .city{font-family:var(--display);font-weight:800;font-stretch:86%;font-size:30px;line-height:1.05;color:var(--paper)}
.ne-ab .win .who{font-family:var(--display);font-weight:800;font-stretch:90%;font-size:21px;line-height:1.05;color:var(--paper)}
.ne-ab .win strong{font-family:var(--display);font-weight:900;font-stretch:76%;font-size:62px;line-height:.95;color:#fff;font-variant-numeric:tabular-nums;text-shadow:0 0 30px color-mix(in srgb,var(--c) 60%,transparent)}
.ne-ab .win strong small{font-size:.45em;color:var(--blue-soft);margin-left:3px;text-shadow:none}
.ne-ab .win .el{margin-top:auto;font-size:14px;color:var(--mist)}
.ne-ab .pod{display:flex;flex-direction:column;gap:8px;flex:1;min-height:0}
.ne-ab .pl{flex:1;min-height:0;display:grid;grid-template-columns:38px 64px 360px 1fr 120px;align-items:center;column-gap:16px;padding:0 20px;border-radius:14px;opacity:0;
  background:linear-gradient(90deg,rgba(14,30,80,.78),rgba(8,18,50,.55));box-shadow:inset 0 0 0 1px rgba(127,162,255,.14);
  animation:nm-up 1s cubic-bezier(.2,.8,.2,1) calc(var(--b) + 3.2s + var(--k) * 450ms) forwards}
.ne-ab .pl.first{background:linear-gradient(90deg,rgba(47,107,255,.4),rgba(14,30,80,.65));box-shadow:inset 0 0 0 1px rgba(127,162,255,.5),0 0 40px -8px rgba(47,107,255,.5)}
.ne-ab .pl .n{font-family:var(--display);font-weight:800;font-size:34px;color:var(--mist);text-align:center}
.ne-ab .pl.first .n{color:#fff}
.ne-ab .pl .nm2{display:flex;flex-direction:column;min-width:0}
.ne-ab .pl .nm2 b{font-family:var(--display);font-weight:800;font-stretch:90%;font-size:27px;line-height:1.05;color:var(--paper);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ne-ab .pl .nm2 em{font-style:normal;font-size:18px;color:var(--mist);font-variant-numeric:tabular-nums}
.ne-ab .pl .trk{display:block;height:16px;border-radius:8px;background:rgba(169,182,214,.14);overflow:hidden}
.ne-ab .pl .trk u{display:block;height:100%;border-radius:8px;transform-origin:left;animation:nm-growX 1.5s cubic-bezier(.2,.8,.2,1) calc(var(--b) + 4s + var(--k) * 450ms) both}
.ne-ab .pl strong{text-align:right;font-family:var(--display);font-weight:800;font-stretch:84%;font-size:44px;color:#fff;font-variant-numeric:tabular-nums}
.ne-ab .pl strong small{font-size:.5em;color:var(--blue-soft);margin-left:2px}
.ne-ab .pl .ne-av{width:64px!important;height:64px!important}

/* Placa de arranque */
.ne-intro{position:absolute;inset:0}
.ne-ileft{position:absolute;left:0;top:0;width:1200px}
.ne-ikick{display:flex;align-items:center;gap:18px;font-family:var(--display);font-weight:700;font-stretch:115%;font-size:22px;letter-spacing:.3em;text-transform:uppercase;color:var(--blue-soft);opacity:0;animation:nm-fade 1s ease .6s forwards}
.ne-ikick::before{content:"";width:64px;height:3px;background:var(--blue);box-shadow:0 0 14px rgba(47,107,255,.9)}
.ne-it{margin-top:16px;width:1728px;white-space:nowrap;font-family:var(--display);font-weight:900;font-stretch:72%;font-size:230px;line-height:.98;letter-spacing:-.02em;color:#fff;
  text-shadow:1px 1px 0 #4F6FD0,2px 2px 0 #4566C8,3px 3px 0 #3C5DBF,4px 4px 0 #3454B5,5px 5px 0 #2D4CAB,6px 6px 0 #2744A1,8px 10px 26px rgba(0,0,0,.55),0 0 90px rgba(47,107,255,.45)}
.ne-it.wp{width:1170px}
.in .ne-it .nm-w>span{animation-duration:1.1s!important;animation-delay:calc(var(--t0,1s) + var(--i) * 260ms)!important}
.ne-it .nm-w{padding-bottom:.12em;margin-bottom:-.12em;margin-right:.18em}
.ne-itw{display:inline}
.ne-irule{height:4px;width:0;margin:6px 0 26px;border-radius:2px;background:linear-gradient(90deg,#2F6BFF,#9DB8FF 60%,transparent);box-shadow:0 0 18px rgba(47,107,255,.8);animation:ne-ruled 1.6s cubic-bezier(.2,.8,.2,1) 2.4s forwards}
@keyframes ne-ruled{to{width:1100px}}
.ne-istatus{display:inline-flex;align-items:center;gap:16px;padding:14px 26px 13px;border-radius:8px;font-family:var(--display);font-weight:800;font-stretch:112%;font-size:26px;letter-spacing:.26em;color:#fff;background:var(--red);box-shadow:0 18px 36px -12px rgba(238,34,12,.8);opacity:0;animation:nm-up 1s cubic-bezier(.2,.8,.2,1) 3s forwards}
.ne-istatus i{width:12px;height:12px;border-radius:50%;background:#fff;box-shadow:0 0 14px #fff;animation:nm-blink 1.1s steps(1) infinite}
.ne-ifacts{display:flex;gap:22px;margin-top:30px}
.ne-ifacts .f{display:flex;flex-direction:column;gap:6px;padding:16px 26px;border-radius:14px;background:linear-gradient(155deg,rgba(26,46,104,.9),rgba(8,18,50,.85));box-shadow:inset 0 0 0 1px rgba(127,162,255,.2);opacity:0;animation:nm-up 1s cubic-bezier(.2,.8,.2,1) calc(3.7s + var(--k) * 450ms) forwards}
.ne-ifacts .f span{font-family:var(--display);font-weight:700;font-stretch:115%;font-size:14px;letter-spacing:.28em;text-transform:uppercase;color:var(--blue-soft)}
.ne-ifacts .f b{font-family:var(--display);font-weight:800;font-stretch:88%;font-size:34px;color:var(--paper)}
.ne-icands{left:1230px;top:34px;width:498px;height:470px;opacity:0;animation:nm-up 1.3s cubic-bezier(.2,.8,.2,1) 1.8s forwards}
.ne-icands .nm-inner{padding:30px 34px;gap:16px}
.ne-icands .grid{display:flex;flex-direction:column;gap:10px;overflow:hidden}
.ne-icands .more{font-size:20px;color:var(--mist);padding-left:78px;margin-top:2px}
.ne-icands .cd{display:flex;align-items:center;gap:16px;opacity:0;animation:nm-up .9s cubic-bezier(.2,.8,.2,1) calc(3.1s + var(--k) * 330ms) forwards}
.ne-icands .cd .ne-av{box-shadow:0 0 0 2px rgba(255,255,255,.4)}
.ne-icands .cd span{display:flex;flex-direction:column;min-width:0}
.ne-icands .cd b{font-family:var(--display);font-weight:800;font-stretch:90%;font-size:25px;line-height:1.05;color:var(--paper);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ne-icands .cd small{font-size:16px;color:var(--mist);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ne-ibot{position:absolute;left:0;right:0;bottom:36px;height:96px;display:flex;align-items:center;justify-content:space-between;gap:40px}
.ne-tl{display:flex;flex:1;max-width:980px;position:relative}
.ne-tl::before{content:"";position:absolute;left:10%;right:10%;top:11px;height:2px;background:rgba(169,182,214,.25)}
.ne-tl .n{flex:1;display:flex;flex-direction:column;align-items:center;gap:12px;position:relative;opacity:0;animation:nm-fade 1s ease calc(4.4s + var(--k) * 320ms) forwards}
.ne-tl .n i{width:24px;height:24px;border-radius:50%;background:#0A1636;box-shadow:inset 0 0 0 2px rgba(169,182,214,.4)}
.ne-tl .n span{font-family:var(--display);font-weight:700;font-stretch:108%;font-size:15px;letter-spacing:.14em;text-transform:uppercase;color:rgba(169,182,214,.6);text-align:center}
.ne-tl .n.done i{background:var(--blue);box-shadow:0 0 14px rgba(47,107,255,.8)}
.ne-tl .n.done span{color:var(--mist)}
.ne-tl .n.now i{background:#fff;box-shadow:0 0 0 5px rgba(47,107,255,.6),0 0 24px 6px rgba(127,162,255,.9);animation:ne-pulse 1.6s ease-in-out infinite}
.ne-tl .n.now span{color:#fff}
@keyframes ne-pulse{50%{box-shadow:0 0 0 9px rgba(47,107,255,.3),0 0 34px 10px rgba(127,162,255,.9)}}
.ne-tag{display:flex;align-items:center;gap:18px;font-size:26px;color:var(--mist);opacity:0;animation:nm-fade 1.2s ease 6s forwards;line-height:1.15;font-size:23px}
.ne-tag img{height:56px}
.ne-tag span{display:flex;flex-direction:column}
.ne-tag b{color:#fff;font-family:var(--display);font-weight:800;font-size:30px;letter-spacing:.01em}
`;

const CSS_V = `
.ne-head{left:60px;top:170px;width:960px;gap:12px}
.ne-title{font-size:68px;max-height:100px}
.ne-count{left:60px;right:60px;top:300px;width:auto;display:grid;grid-template-columns:1fr auto;column-gap:20px;row-gap:12px;align-items:center}
.ne-count .lab{grid-area:1/1;text-align:left;font-size:18px}
.ne-count .big{grid-area:1/2;font-size:84px}
.ne-count .trk{grid-area:2/1/3/3;height:10px}
.ne-src{left:60px;top:1668px;font-size:21px}
.ne-stage{left:60px;top:170px;width:960px;height:1550px}
.ne-pad{top:270px;height:1190px}

/* Ganador */
.ne-win{flex-direction:column;gap:30px}
.ne-win .ne-vc{width:100%;height:600px;flex:none}
.ne-vs{flex-direction:column;gap:20px}
.ne-vs .ne-vc{width:100%;height:auto;flex:1}
.ne-vs .mid{width:100%;flex-direction:row;justify-content:space-between;gap:20px}
.ne-vs .mid .vs{font-size:90px}
.ne-vs .mid .gap{font-size:36px}
.ne-vs .mid .pill{font-size:13px;padding:9px 12px}
.ne-wtxt{gap:12px;justify-content:flex-start}
.ne-wname{font-size:84px}
.ne-wparty{font-size:30px}
.ne-wpct{font-size:210px}
.ne-wmeta{flex-direction:column;align-items:flex-start;gap:6px;font-size:28px}
.ne-wmeta .lead{border-left:0;padding-left:0}

/* Principales */
.ne-top{justify-content:flex-start;gap:14px}
.ne-row{display:grid;grid-template-columns:48px 84px 1fr auto;grid-template-areas:"rk av nn pc" "rk trk trk vt";align-items:center;column-gap:20px;row-gap:12px;flex:1;max-height:230px;padding:18px 26px}
.ne-row .rk{grid-area:rk;width:auto;text-align:center}
.ne-row .ne-av{grid-area:av}
.ne-row .nn{grid-area:nn;width:auto}
.ne-row .nn b{font-size:34px}
.ne-row .trk{grid-area:trk;height:26px;flex:none}
.ne-row .pc{grid-area:pc;width:auto;font-size:64px}
.ne-row .vt{grid-area:vt;width:170px;font-size:24px}

/* Por estado */
.ne-sts{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:720px 1fr;gap:26px 30px}
.ne-map{grid-column:1 / -1;grid-row:1}
.ne-sts.tall .ne-map{grid-column:2}
.ne-big{grid-column:1;grid-row:1;width:auto;justify-content:flex-start}
.ne-bigrow{padding:10px 16px}
.ne-bigrow .nn b{font-size:24px}
.ne-bigrow .pc{font-size:32px}
.ne-side{grid-column:1 / -1;grid-row:2;width:auto;padding-right:0;justify-content:flex-start}

/* Ciudades */
.ne-cities .row{flex-direction:column;gap:12px}
.ne-city{flex:1;display:grid;grid-template-columns:1fr auto;grid-template-areas:"hd pct" "lead pct" "stk stk" "oth oth";align-content:center;column-gap:20px;row-gap:10px;padding:18px 26px}
.ne-city{align-items:stretch;text-align:left}
.ne-city .hd{grid-area:hd;align-items:flex-start}.ne-city .hd b{font-size:42px}.ne-city .lead{grid-area:lead;margin-top:0;flex-direction:row;align-items:center}.ne-city .lead>span{align-items:flex-start}.ne-city .lead .ne-av{width:72px!important;height:72px!important}.ne-city .pct{grid-area:pct;align-self:center;font-size:84px}
.ne-city .stk{grid-area:stk;margin-top:0}.ne-city .oth{grid-area:oth;flex-direction:row;gap:26px}.ne-city .oth em{margin-left:8px}

/* Arranque */
.ne-intro{display:flex;flex-direction:column;gap:34px}
.ne-ileft{position:relative;width:960px}
.ne-ikick{font-size:18px;letter-spacing:.16em;gap:14px}
.ne-ikick::before{width:44px}
.ne-it,.ne-it.wp{width:960px;white-space:normal;line-height:.94}
.ne-it .nm-w{display:block;margin-right:0}
.ne-irule{margin:10px 0 28px}
@keyframes ne-ruled{to{width:960px}}
.ne-ifacts{flex-wrap:wrap;gap:16px}
.ne-icands{position:relative;left:0;top:0;width:960px;height:auto!important}
.ne-icands .nm-inner{position:relative;padding:30px 34px}
.ne-icands .grid{display:grid;grid-template-columns:1fr 1fr;gap:26px 24px}
.ne-ibot{position:relative;margin-top:auto;height:auto;flex-direction:column;align-items:stretch;gap:36px;bottom:0}
.ne-tl{max-width:none}
.ne-tag{justify-content:center}

/* Brasileños en Argentina */
.ne-ab{flex-direction:column;gap:16px}
.ne-ab .left{width:100%}
.ne-ab .elec b{font-size:100px}
.ne-ab .wins{height:330px}
.ne-ab .win strong{font-size:56px}
.ne-ab .win .city{font-size:26px}
.ne-ab .pl{grid-template-columns:34px 64px 1fr 130px;max-height:120px}
.ne-ab .pl .trk{display:none}
`;
