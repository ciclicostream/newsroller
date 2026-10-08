import { useContentSelect } from "../lib/contentSelect";
import { useEffect, useRef, useState } from "react";
import { PreviewMonitor } from "../components/PreviewMonitor";
import { InformesSwitch } from "../components/PlacaSwitch";
import { Plus, Trash2, Check, X, Loader2, Vote, Pencil, ArrowUp, ArrowDown } from "lucide-react";
import type { ContentItem, ElectionCandidate, ElectionData, ElectionIntroMode, ElectionKind, ElectionPhase, ElectionScreen, ElectionState } from "@newsroller/shared";
import { BR_CANDIDATES, ELECTION_COUNTRIES, ELECTION_MAX_CANDIDATES, ELECTION_ENTER_SEC, ELECTION_HOLD_MIN_SEC, ELECTION_PHASES, electionDuration, electionScreens } from "@newsroller/shared";
import { contentItems } from "../lib/content-items";
import { uploadMedia } from "../lib/content";
import { api } from "../lib/api";

const MIN_CAND = 2;
const SCR_LABEL: Record<ElectionScreen, string> = { intro: "Arranque", winner: "Ganador", runoff: "Segunda vuelta", top: "Más votados", states: "Por estado", cities: "Ciudades", abroad: "Argentina" };
const PALETTE = ["#2F6BFF", "#E0553A", "#2BB673", "#F2B134", "#A66BFF", "#12B5CB", "#E64A9B", "#8A93A6", "#7ED321", "#FF8A3D"];
const blankCand = (i: number): ElectionCandidate => ({ name: "", party: "", color: PALETTE[i % PALETTE.length]!, photo_url: null, pct: 0, votes: undefined });
const num = (v: string): number | undefined => { const n = Number(v.replace(",", ".")); return v.trim() === "" || Number.isNaN(n) ? undefined : n; };

export function EleccionesPlaca() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [country, setCountry] = useState("ar");
  const [kind, setKind] = useState<ElectionKind>("presidencial");
  const [round, setRound] = useState<1 | 2>(1);
  const [year, setYear] = useState("");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [counted, setCounted] = useState("0");
  const [phase, setPhase] = useState<ElectionPhase>("apertura");
  const [intro, setIntro] = useState<ElectionIntroMode>("con");
  const [hours, setHours] = useState("");
  const [electorate, setElectorate] = useState("");
  const [auto, setAuto] = useState(false);
  const [winnerOverride, setWinnerOverride] = useState("");
  const [tseInfo, setTseInfo] = useState<string | null>(null);
  const [scrWinner, setScrWinner] = useState(true);
  const [scrTop, setScrTop] = useState(true);
  const [scrStates, setScrStates] = useState(true);
  const [scrCities, setScrCities] = useState(true);
  const [scrAbroad, setScrAbroad] = useState(true);
  const [sec, setSec] = useState(ELECTION_HOLD_MIN_SEC);
  const [cands, setCands] = useState<ElectionCandidate[]>([blankCand(0), blankCand(1)]);
  const [act, setAct] = useState(0);
  const [states, setStates] = useState<Record<string, ElectionState>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const cinfo = ELECTION_COUNTRIES.find((c) => c.id === country)!;
  const autoOn = auto && country === "br";
  // Estado del colector del TSE (sólo informativo).
  useEffect(() => {
    if (!autoOn) { setTseInfo(null); return; }
    let on = true;
    Promise.all([api.get<{ phase: string; http_pause_reason: string | null; last_update_at: string | null }>("/api/tse/status"), api.get<{ available: boolean; counted_pct: number; updated_at: string | null }>("/api/tse/live/br-presidente")])
      .then(([st, lv]) => { if (on) setTseInfo(lv.available ? `Datos del TSE al ${lv.counted_pct.toString().replace(".", ",")} % escrutado · actualizado ${lv.updated_at?.slice(11, 16) ?? "?"} (hora de Brasilia)` : `El TSE todavía no publicó resultados (colector: ${st.phase}${st.http_pause_reason ? `, pausado: ${st.http_pause_reason}` : ""}).`); })
      .catch(() => { if (on) setTseInfo("No se pudo consultar el colector del TSE (¿TSE_ENABLED=1 en el servidor?)."); });
    return () => { on = false; };
  }, [autoOn]);
  const par = kind === "parlamentaria";
  const emitted = electionScreens(buildData());
  // En modo auto las pantallas aparecen solas durante la noche: la duración se calcula para el caso completo.
  const nScr = autoOn ? Math.max(emitted.length, [scrWinner, scrTop, scrStates, scrCities, scrAbroad].filter(Boolean).length) : emitted.length;
  const dur = electionDuration(nScr, sec);
  const cur = cands[act] ?? cands[0]!;
  const sumPct = cands.reduce((s, c) => s + (c.pct || 0), 0);

  const load = () => contentItems.list("elecciones").then(setItems).catch((e) => setErr(e.message));
  const sel = useContentSelect(items, load);
  useEffect(() => { void load(); }, []);

  const patchCand = (i: number, p: Partial<ElectionCandidate>) => setCands((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const addCand = () => { if (cands.length < ELECTION_MAX_CANDIDATES) { setCands((r) => [...r, blankCand(r.length)]); setAct(cands.length); } };
  function removeCand(i: number) {
    if (cands.length <= MIN_CAND) return setErr(`Se necesitan al menos ${MIN_CAND} candidatos.`);
    setCands((r) => r.filter((_, j) => j !== i));
    // los estados que apuntaban a este candidato quedan sin dato; los de índices mayores se corren
    setStates((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.winner === i ? { ...v, winner: -1 } : v.winner > i ? { ...v, winner: v.winner - 1 } : v])));
    setAct((a) => Math.max(0, Math.min(a > i ? a - 1 : a, cands.length - 2)));
  }
  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= cands.length) return;
    setCands((r) => { const x = [...r]; [x[i], x[j]] = [x[j]!, x[i]!]; return x; });
    setStates((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.winner === i ? { ...v, winner: j } : v.winner === j ? { ...v, winner: i } : v])));
    setAct(j);
  }
  const patchState = (id: string, p: Partial<ElectionState>) => setStates((s) => ({ ...s, [id]: { ...(s[id] ?? { winner: -1 }), ...p, id } }));

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null); setUploading(true);
    try { patchCand(act, { photo_url: await uploadMedia(file, "media") }); }
    catch (e) { setErr(e instanceof Error ? e.message : "error subiendo"); }
    finally { setUploading(false); if (photoRef.current) photoRef.current.value = ""; }
  }

  function buildData(): ElectionData {
    return {
      country, kind, round: par ? undefined : round,
      year: year.trim() || undefined, title: title.trim() || undefined,
      candidates: cands.map((c) => ({ name: c.name.trim(), party: par ? undefined : c.party?.trim() || undefined, color: c.color, photo_url: par ? null : c.photo_url || null, pct: c.pct || 0, votes: c.votes })),
      states: Object.values(states).filter((s) => s.winner >= 0 && cinfo.regions.some((r) => r.id === s.id)),
      source: source.trim(),
      counted_pct: Math.min(100, Math.max(0, num(counted) ?? 0)),
      auto: autoOn ? "tse-br" : undefined,
      winner_override: winnerOverride || undefined,
      phase, intro, voting_hours: hours.trim() || undefined, electorate: electorate.trim() || undefined,
      screens: { winner: scrWinner, top: scrTop, states: scrStates, cities: scrCities, abroad: scrAbroad },
      sec_per_screen: sec,
    };
  }

  function reset() {
    setEditingId(null); setCountry("ar"); setKind("presidencial"); setRound(1); setYear(""); setTitle(""); setSource(""); setCounted("0"); setPhase("apertura"); setIntro("con"); setHours(""); setElectorate(""); setAuto(false); setWinnerOverride("");
    setScrWinner(true); setScrTop(true); setScrStates(true); setScrCities(true); setScrAbroad(true); setSec(ELECTION_HOLD_MIN_SEC); setCands([blankCand(0), blankCand(1)]); setAct(0); setStates({});
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    const bad = cands.findIndex((c) => !c.name.trim());
    if (bad >= 0) { setAct(bad); return setErr(`El candidato ${bad + 1} no tiene nombre.`); }
    const rk = ELECTION_PHASES.findIndex((p) => p.id === phase);
    if (rk >= 2 && !source.trim()) return setErr("La fuente es obligatoria desde los primeros resultados.");
    if (sumPct > 100.05) return setErr(`Los porcentajes suman ${sumPct.toFixed(1)}%: no pueden pasar de 100.`);
    if (round === 2 && !par && cands.length !== 2) return setErr("El balotaje lleva exactamente 2 candidatos.");
    setSaving(true);
    try {
      const data = buildData() as unknown as Record<string, any>;
      if (editingId) { await contentItems.patch(editingId, { data, duration_sec: dur }); setMsg("Cambios guardados."); }
      else { await contentItems.create({ type: "elecciones", data, duration_sec: dur }); setMsg("Guardado en el banco."); }
      reset(); await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "error"); }
    finally { setSaving(false); }
  }

  function startEdit(it: ContentItem) {
    const d = it.data as ElectionData;
    setEditingId(it.id); setCountry(d.country); setKind(d.kind); setRound(d.round ?? 1); setYear(d.year ?? ""); setTitle(d.title ?? "");
    setSource(d.source ?? ""); setCounted(String(d.counted_pct ?? 0)); setPhase(d.phase ?? "apertura"); setIntro(d.intro ?? "con"); setHours(d.voting_hours ?? ""); setElectorate(d.electorate ?? ""); setAuto(d.auto === "tse-br"); setWinnerOverride(d.winner_override ?? "");
    setScrWinner(d.screens?.winner !== false); setScrTop(d.screens?.top !== false); setScrStates(d.screens?.states !== false); setScrCities(d.screens?.cities !== false); setScrAbroad(d.screens?.abroad !== false);
    setSec(Math.max(ELECTION_HOLD_MIN_SEC, d.sec_per_screen ?? ELECTION_HOLD_MIN_SEC));
    setCands(d.candidates?.length ? d.candidates.map((c, i) => ({ ...blankCand(i), ...c })) : [blankCand(0), blankCand(1)]);
    setStates(Object.fromEntries((d.states ?? []).map((s) => [s.id, s])));
    setAct(0); setErr(null); setMsg(null);
  }
  async function remove(it: ContentItem) {
    if (!confirm("¿Enviar estos resultados a la papelera?")) return;
    await contentItems.remove(it.id);
    if (editingId === it.id) reset();
    await load();
  }
  async function toggleDisponible(it: ContentItem) {
    await contentItems.patch(it.id, { in_parrilla: !(it.in_parrilla !== false) });
    await load();
  }

  const ready = true;
  const decided = Object.values(states).filter((s) => s.winner >= 0).length;

  return (
    <>
      <div className="page-head pm-head">
        <div>
          <h1>Informes</h1>
          <p>Resultados electorales: ganador, los más votados y votación por {cinfo.regionLabel.toLowerCase().replace(/s$/, "")}. Hasta {ELECTION_MAX_CANDIDATES} candidatos.</p>
        </div>
      </div>
      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      <div className="pm-layout">
        <form className="card" style={{ padding: 18 }} onSubmit={save}>
          <div style={{ fontWeight: 500, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {editingId ? "Editar resultados" : "Nuevos resultados"}
            {editingId && <button type="button" className="btn" onClick={reset}>Cancelar</button>}
          </div>
          <div className="field" style={{ marginBottom: 14 }}><label>Tipo</label><InformesSwitch active="elecciones" /></div>

          <div className="field xy" style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label>País</label>
              <select value={country} onChange={(e) => { setCountry(e.target.value); setStates({}); }}>
                {ELECTION_COUNTRIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ width: 110 }}><label>Año</label><input value={year} onChange={(e) => setYear(e.target.value.slice(0, 4))} placeholder="2027" /></div>
          </div>

          {country === "br" && (
            <div className="field">
              <label>Datos</label>
              <div className="tabs" style={{ marginBottom: 0 }}>
                <button type="button" className={"tab" + (!auto ? " active" : "")} onClick={() => setAuto(false)}>Manual</button>
                <button type="button" className={"tab" + (auto ? " active" : "")} onClick={() => setAuto(true)}>Automático (TSE)</button>
              </div>
              <div className="muted-note" style={{ marginTop: 6 }}>
                {auto ? "Candidatos (con su foto y partido), porcentajes, votos, estados, ciudades, el voto de brasileños en Argentina y el escrutinio salen solos del TSE (cada 30 s). La etapa avanza sola con los datos y nunca retrocede; las etapas de apertura y cierre las marcás vos. Lo cargado abajo se usa hasta que el TSE publique." : "Todo lo carga el editor."}
              </div>
              {tseInfo && <div className="muted-note" style={{ marginTop: 4 }}>{tseInfo}</div>}
            </div>
          )}

          <div className="field">
            <label>Elección</label>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button type="button" className={"tab" + (!par && round === 1 ? " active" : "")} onClick={() => { setKind("presidencial"); setRound(1); }}>Presidencial · 1ª vuelta</button>
              <button type="button" className={"tab" + (!par && round === 2 ? " active" : "")} onClick={() => { setKind("presidencial"); setRound(2); }}>Presidencial · 2ª vuelta</button>
              <button type="button" className={"tab" + (par ? " active" : "")} onClick={() => setKind("parlamentaria")}>Parlamentaria</button>
            </div>
            <div className="muted-note" style={{ marginTop: 6 }}>
              {par ? "Los 'candidatos' son partidos (sin foto): % y votos." : round === 2 ? "Balotaje: exactamente 2 candidatos, enfrentados." : "Hasta 10 candidatos; el aire muestra los 5 principales."}
            </div>
          </div>

          <div className="field">
            <label>Título (opcional)</label>
            <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 60))} placeholder={`${cinfo.name}${year ? " " + year : ""}`} />
          </div>

          <div className="field xy" style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><label>Fuente (obligatoria desde los resultados)</label><input value={source} onChange={(e) => setSource(e.target.value.slice(0, 90))} placeholder="Cámara Nacional Electoral · escrutinio provisorio" /></div>
            <div style={{ width: 150 }}><label>Escrutado (%)</label><input inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} /></div>
          </div>

          <div className="field">
            <label>Etapa de la elección</label>
            <div className="tabs" style={{ marginBottom: 0, flexWrap: "wrap" }}>
              {ELECTION_PHASES.map((p) => <button key={p.id} type="button" className={"tab" + (phase === p.id ? " active" : "")} onClick={() => setPhase(p.id)}>{p.label}</button>)}
            </div>
            <div className="muted-note" style={{ marginTop: 6 }}>{ELECTION_PHASES.find((p) => p.id === phase)?.hint} Avanzá la etapa a medida que cambia la noche; los resultados cargados se mantienen.</div>
          </div>

          <div className="field">
            <label>Ganador confirmado por el editor</label>
            <select value={winnerOverride} onChange={(e) => setWinnerOverride(e.target.value)}>
              <option value="">Ninguno: lo marca el TSE</option>
              {(country === "br" ? BR_CANDIDATES.map((c) => c.name) : cands.map((c) => c.name).filter(Boolean)).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <div className="muted-note" style={{ marginTop: 6 }}>
              {winnerOverride ? <b>Sale al aire como GANADOR (etapa definitiva) aunque el TSE no lo haya marcado. Sacalo apenas el TSE confirme algo distinto.</b> : "Para cuando las noticias ya dieron al ganador y el TSE no lo marca o falla. Si el TSE no responde, completá los % a mano abajo (modo Manual) y guardá."}
            </div>
          </div>

          <div className="field">
            <label>Placa de arranque</label>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button type="button" className={"tab" + (intro === "solo" ? " active" : "")} onClick={() => setIntro("solo")}>Sola</button>
              <button type="button" className={"tab" + (intro === "con" ? " active" : "")} onClick={() => setIntro("con")}>Antes de los resultados</button>
              <button type="button" className={"tab" + (intro === "sin" ? " active" : "")} onClick={() => setIntro("sin")}>No mostrar</button>
            </div>
            <div className="muted-note" style={{ marginTop: 6 }}>Presenta el país, el tipo de elección, la etapa y los candidatos. Con "Sola" salen solo ella, aunque ya haya resultados cargados. Mientras no haya resultados, siempre es lo único que sale.</div>
          </div>
          <div className="field xy" style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><label>Horario de votación (arranque)</label><input value={hours} onChange={(e) => setHours(e.target.value.slice(0, 30))} placeholder="08:00 a 17:00 hs" /></div>
            <div style={{ flex: 1 }}><label>Padrón (arranque)</label><input value={electorate} onChange={(e) => setElectorate(e.target.value.slice(0, 40))} placeholder="156 millones de electores" /></div>
          </div>

          <div className="field">
            <label>Candidatos ({cands.length}/{ELECTION_MAX_CANDIDATES}) · suman {sumPct.toFixed(1)}%</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {cands.map((c, i) => (
                <div key={i} className="card" onClick={() => setAct(i)} style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", borderColor: i === act ? "var(--accent)" : undefined }}>
                  <span style={{ width: 14, height: 14, borderRadius: 7, background: c.color, flex: "none" }} />
                  <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: c.name.trim() ? undefined : "#9aa5b6" }}>{c.name.trim() || "(sin nombre)"}</span>
                  <span style={{ color: "#6b7688", fontSize: 13 }}>{c.pct ? `${c.pct}%` : ""}</span>
                  <button type="button" className="icon-btn" onClick={(e) => { e.stopPropagation(); move(i, -1); }} disabled={i === 0}><ArrowUp size={14} /></button>
                  <button type="button" className="icon-btn" onClick={(e) => { e.stopPropagation(); move(i, 1); }} disabled={i === cands.length - 1}><ArrowDown size={14} /></button>
                  <button type="button" className="icon-btn" onClick={(e) => { e.stopPropagation(); removeCand(i); }}><X size={14} /></button>
                </div>
              ))}
            </div>
            {country === "br" && !par && (
              <button type="button" className="btn" style={{ marginTop: 8, marginRight: 8 }} onClick={() => { setCands(BR_CANDIDATES.map((c) => ({ name: c.name, party: c.party, color: c.color, photo_url: c.photo_url, pct: 0, votes: undefined }))); setStates({}); setAct(0); }}>
                <Plus size={14} /> Precargar los 12 candidatos de Brasil 2026
              </button>
            )}
            {cands.length < ELECTION_MAX_CANDIDATES && !(round === 2 && !par) && <button type="button" className="btn" style={{ marginTop: 8 }} onClick={addCand}><Plus size={14} /> Agregar {par ? "partido" : "candidato"}</button>}
          </div>

          <div className="card" style={{ padding: 14, marginBottom: 14, background: "#f7f9fc" }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>{par ? "Partido" : "Candidato"} {act + 1}</div>
            <div className="field xy" style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><label>{par ? "Partido" : "Nombre"}</label><input value={cur.name} onChange={(e) => patchCand(act, { name: e.target.value.slice(0, 40) })} /></div>
              <div style={{ width: 70 }}><label>Color</label><input type="color" value={cur.color} onChange={(e) => patchCand(act, { color: e.target.value })} style={{ padding: 2, height: 38 }} /></div>
            </div>
            {!par && <div className="field"><label>Partido o frente</label><input value={cur.party ?? ""} onChange={(e) => patchCand(act, { party: e.target.value.slice(0, 45) })} /></div>}
            <div className="field xy" style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><label>Porcentaje (%)</label><input inputMode="decimal" value={cur.pct || ""} onChange={(e) => patchCand(act, { pct: Math.min(100, num(e.target.value) ?? 0) })} /></div>
              <div style={{ flex: 1 }}><label>Votos</label><input inputMode="numeric" value={cur.votes ?? ""} onChange={(e) => patchCand(act, { votes: num(e.target.value.replace(/\./g, "")) })} /></div>
            </div>
            {!par && (
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Foto (opcional)</label>
                {cur.photo_url ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <img src={cur.photo_url} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 28 }} />
                    <button type="button" className="btn" onClick={() => patchCand(act, { photo_url: null })}><X size={14} /> quitar</button>
                  </div>
                ) : <input ref={photoRef} type="file" accept="image/*" onChange={onPhoto} disabled={uploading} />}
                {uploading && <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4 }}><Loader2 size={13} className="spin" /> subiendo…</div>}
                <div className="muted-note" style={{ marginTop: 4 }}>Vertical, con la cara en el tercio superior. Sin foto se muestran las iniciales sobre el color del partido.</div>
              </div>
            )}
          </div>

          <div className="field">
            <label>Pantallas que se emitirán ahora ({nScr})</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              {emitted.map((s) => <span key={s} className="tab active" style={{ cursor: "default" }}>{SCR_LABEL[s]}</span>)}
            </div>
            <div className="muted-note" style={{ marginBottom: 8 }}>Se calculan solas con lo que cargaste: una pantalla sin datos no se emite. Podés apagar las que no quieras:</div>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button type="button" className={"tab" + (scrWinner ? " active" : "")} onClick={() => setScrWinner(!scrWinner)}>Ganador</button>
              <button type="button" className={"tab" + (scrTop ? " active" : "")} onClick={() => setScrTop(!scrTop)}>Más votados</button>
              <button type="button" className={"tab" + (scrStates ? " active" : "")} onClick={() => setScrStates(!scrStates)}>Por {cinfo.regionLabel.toLowerCase().replace(/s$/, "")}</button>
              {autoOn && <button type="button" className={"tab" + (scrCities ? " active" : "")} onClick={() => setScrCities(!scrCities)}>Ciudades</button>}
              {autoOn && <button type="button" className={"tab" + (scrAbroad ? " active" : "")} onClick={() => setScrAbroad(!scrAbroad)}>Argentina</button>}
            </div>
            {emitted.length === 1 && emitted[0] === "intro" && electionScreens({ ...buildData(), intro: "con" }).length === 1 && <div className="muted-note" style={{ marginTop: 6 }}>Todavía no hay resultados con qué llenar otras pantallas (se necesita la etapa "Primeros resultados" o posterior, % escrutado y 2 candidatos con %).</div>}
          </div>

          {scrStates && (
            <div className="field">
              <label>{cinfo.regionLabel} · {decided}/{cinfo.regions.length} con resultado</label>
              <div style={{ maxHeight: 280, overflow: "auto", border: "1px solid #e1e6ef", borderRadius: 8, padding: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                {cinfo.regions.map((r) => {
                  const s = states[r.id];
                  return (
                    <div key={r.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ width: 150, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                      <select value={s?.winner ?? -1} onChange={(e) => patchState(r.id, { winner: Number(e.target.value) })} style={{ flex: 1, minWidth: 0 }}>
                        <option value={-1}>— sin dato</option>
                        {cands.map((c, i) => <option key={i} value={i}>{c.name || `Candidato ${i + 1}`}</option>)}
                      </select>
                      <input placeholder="%" inputMode="decimal" style={{ width: 56 }} value={s?.pct ?? ""} onChange={(e) => patchState(r.id, { pct: num(e.target.value) })} />
                      <input placeholder="votos" inputMode="numeric" style={{ width: 92 }} value={s?.votes ?? ""} onChange={(e) => patchState(r.id, { votes: num(e.target.value.replace(/\./g, "")) })} />
                    </div>
                  );
                })}
              </div>
              <div className="muted-note" style={{ marginTop: 6 }}>Por cada {cinfo.regionLabel.toLowerCase().replace(/s$/, "")}: quién ganó, su % y sus votos. La intensidad del color sigue al %, y el tamaño de la burbuja a los votos.</div>
            </div>
          )}

          <div className="field" style={{ width: 170 }}>
            <label>Segundos con la placa armada</label>
            <input type="number" min={ELECTION_HOLD_MIN_SEC} value={sec} onChange={(e) => setSec(Math.max(ELECTION_HOLD_MIN_SEC, Number(e.target.value) || ELECTION_HOLD_MIN_SEC))} />
          </div>
          <div className="muted-note" style={{ marginBottom: 14 }}>Duración del bloque: {nScr} pantalla{nScr === 1 ? "" : "s"} × ({ELECTION_ENTER_SEC} s de entrada + {sec} s armada) + 2 s de salida = <b>{dur} s</b> ({Math.floor(dur / 60)}:{String(dur % 60).padStart(2, "0")}). Solo versión horizontal por ahora. Cada vez que cambies la etapa o los datos, guardá: la duración se recalcula.</div>

          <button className="btn primary" type="submit" disabled={saving || uploading} style={{ width: "100%", justifyContent: "center" }}>
            <Plus size={16} /> {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Guardar en el banco"}
          </button>
        </form>

        <div className="pm-col">
          <PreviewMonitor type="elecciones" data={buildData() as unknown as Record<string, unknown>} dur={dur} ready={ready} />
          {items.length === 0 && <div className="card" style={{ padding: 18, color: "#6b7688" }}>Todavía no hay resultados cargados.</div>}
          {items.map((it) => {
            const d = it.data as ElectionData;
            const c = ELECTION_COUNTRIES.find((x) => x.id === d.country);
            const lead = [...(d.candidates ?? [])].sort((a, b) => b.pct - a.pct)[0];
            return (
              <div key={it.id} data-item={it.id} {...sel.row(it.id)} className="card" style={{ padding: 16, display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: "#0d2168", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}><Vote size={20} color="#fff" /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title || `${c?.name ?? d.country}${d.year ? " " + d.year : ""}`} · {d.kind === "parlamentaria" ? "Parlamentaria" : d.round === 2 ? "2ª vuelta" : "Presidencial"}</div>
                  <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4, display: "flex", gap: 12 }}>
                    {lead && <span>{lead.name} {lead.pct}%</span>}
                    <span>{ELECTION_PHASES.find((p) => p.id === (d.phase ?? "apertura"))?.short}</span>
                    <span>Escrutado {d.counted_pct}%</span>
                    <span>{it.duration_sec}s</span>
                  </div>
                </div>
                <button className={"toggle-pill" + (it.in_parrilla !== false ? " on" : "")} onClick={() => toggleDisponible(it)}>
                  {it.in_parrilla !== false && <Check size={14} />} {it.in_parrilla !== false ? "En parrilla" : "Disponible: no"}
                </button>
                <button className="btn" onClick={() => startEdit(it)}><Pencil size={15} /></button>
                <button className="btn" onClick={() => remove(it)}><Trash2 size={15} /></button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
