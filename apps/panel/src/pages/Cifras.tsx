import { useEffect, useRef, useState } from "react";
import { PreviewMonitor } from "../components/PreviewMonitor";
import { Plus, Trash2, Check, BarChart3, Sparkles, Pencil } from "lucide-react";
import * as Icons from "lucide-react";
import type { ContentItem, CifrasData, CifrasIcon, DatosGobPayload, CammesaPayload, DolarPayload } from "@newsroller/shared";
import { CIFRAS_ICONS, CIFRAS_METRICS } from "@newsroller/shared";
import { contentItems } from "../lib/content-items";
import { api } from "../lib/api";

const S_MAX = 90;
const E_MAX = 220;

// Resuelve cifra + fuente técnica desde el payload en vivo de la fuente correspondiente.
// Se llama al elegir la métrica; el resultado se CONGELA en el content_item al guardar.
async function resolveMetric(metric: string): Promise<{ value: string; valueNum: number; suffix: string; subtitle: string; source: string } | null> {
  if (metric === "dolar_oficial" || metric === "dolar_blue") {
    const casa = metric === "dolar_oficial" ? "oficial" : "blue";
    const d = await api.get<{ payload: DolarPayload; fetchedAt: string }>("/api/data/dolar");
    const c = d.payload.casas.find((x) => x.casa === casa);
    if (!c?.venta) return null;
    return {
      value: `$${Math.round(c.venta)}`, valueNum: c.venta, suffix: "",
      subtitle: `Cotización venta del dólar ${casa === "oficial" ? "oficial" : "blue"}`,
      source: `dolarapi.com · actualizado ${new Date(d.fetchedAt).toLocaleString("es-AR")}`,
    };
  }
  if (metric === "demanda_electrica") {
    const d = await api.get<{ payload: CammesaPayload; fetchedAt: string }>("/api/data/cammesa");
    const v = d.payload.demActual;
    if (v == null) return null;
    return {
      value: `${Math.round(v).toLocaleString("es-AR")} MW`, valueNum: v, suffix: " MW",
      subtitle: "Demanda eléctrica actual del sistema (SADI)",
      source: `CAMMESA · región ${d.payload.region} · ${new Date(d.fetchedAt).toLocaleString("es-AR")}`,
    };
  }
  // ipc / salarios / energia / petroleo → datos.gob.ar
  const d = await api.get<{ payload: DatosGobPayload; fetchedAt: string }>("/api/data/datosgob");
  const s = d.payload.series.find((x) => x.key === metric);
  if (!s?.latest) return null;
  if (metric === "ipc" || metric === "salarios") {
    const v = s.momPct;
    if (v == null) return null;
    return {
      value: `${v.toString().replace(".", ",")}%`, valueNum: v, suffix: "%",
      subtitle: `Variación mensual — ${s.label}`,
      source: `datos.gob.ar (INDEC) · serie ${s.id} · ${s.latest.date}`,
    };
  }
  return {
    value: `${s.latest.value.toLocaleString("es-AR")} ${s.unit}`, valueNum: s.latest.value, suffix: ` ${s.unit}`,
    subtitle: s.label,
    source: `datos.gob.ar · serie ${s.id} · ${s.latest.date}`,
  };
}

export function Cifras() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const skipNextAutoFetch = useRef(false);

  const [mode, setMode] = useState<"api" | "manual">("api");
  const [metric, setMetric] = useState("ipc");
  const [resolving, setResolving] = useState(false);
  const [value, setValue] = useState("");
  const [valueNum, setValueNum] = useState<number | "">("");
  const [suffix, setSuffix] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [source, setSource] = useState("");
  const [sourceAuto, setSourceAuto] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [icon, setIcon] = useState<CifrasIcon | "">("");
  const [dur, setDur] = useState(10);
  const [saving, setSaving] = useState(false);

  const load = () => contentItems.list("cifras").then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { void load(); }, []);

  async function pickMetric(m: string) {
    setMetric(m);
    setErr(null);
    setResolving(true);
    try {
      const r = await resolveMetric(m);
      if (!r) { setErr("Sin dato disponible para esa métrica todavía."); return; }
      setValue(r.value); setValueNum(r.valueNum); setSuffix(r.suffix);
      setSubtitle(r.subtitle); setSource(r.source); setSourceAuto(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "no se pudo resolver la métrica");
    } finally {
      setResolving(false);
    }
  }
  useEffect(() => {
    if (skipNextAutoFetch.current) { skipNextAutoFetch.current = false; return; }
    if (mode === "api") void pickMetric(metric);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [mode]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!value.trim() || valueNum === "" || !subtitle.trim() || !source.trim() || !explanation.trim()) {
      return setErr("Todos los campos son obligatorios (cifra, subtítulo, fuente, explicación).");
    }
    setSaving(true);
    try {
      const data: CifrasData = {
        mode, metric: mode === "api" ? metric : undefined,
        value: value.trim(), valueNum: Number(valueNum), suffix: suffix || undefined,
        subtitle: subtitle.trim().slice(0, S_MAX), source: source.trim(), sourceAuto: mode === "api" && sourceAuto,
        explanation: explanation.trim().slice(0, E_MAX), icon: (icon || null) as CifrasIcon | null,
      };
      if (editingId) {
        await contentItems.patch(editingId, { data, duration_sec: dur });
        setMsg("Cambios guardados.");
      } else {
        await contentItems.create({ type: "cifras", data, duration_sec: dur });
        setMsg("Guardado en el banco.");
      }
      cancelEdit();
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(it: ContentItem) {
    const d = it.data as CifrasData;
    setEditingId(it.id);
    skipNextAutoFetch.current = true;
    setMode(d.mode);
    setMetric(d.metric ?? "ipc");
    setValue(d.value ?? "");
    setValueNum(d.valueNum ?? "");
    setSuffix(d.suffix ?? "");
    setSubtitle(d.subtitle ?? "");
    setSource(d.source ?? "");
    setSourceAuto(!!d.sourceAuto);
    setExplanation(d.explanation ?? "");
    setIcon(d.icon ?? "");
    setDur(it.duration_sec);
    setErr(null); setMsg(null);
  }
  function cancelEdit() {
    setEditingId(null);
    setValue(""); setValueNum(""); setSuffix(""); setSubtitle(""); setSource(""); setSourceAuto(false);
    setExplanation(""); setIcon(""); setDur(10);
  }

  async function remove(it: ContentItem) {
    if (!confirm("¿Eliminar esta cifra?")) return;
    await contentItems.remove(it.id);
    if (editingId === it.id) cancelEdit();
    await load();
  }
  async function toggleDisponible(it: ContentItem) {
    await contentItems.patch(it.id, { in_parrilla: !(it.in_parrilla !== false) });
    await load();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Cifras</h1>
          <p>Dato destacado con fuente. Elegí una métrica de API (autoescribe cifra y fuente) o cargalo a mano. Todos los campos son obligatorios.</p>
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "440px 1fr", gap: 20, alignItems: "start" }}>
        <form className="card" style={{ padding: 18 }} onSubmit={save}>
          <div style={{ fontWeight: 500, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {editingId ? "Editar cifra" : "Nueva cifra"}
            {editingId && <button type="button" className="btn" onClick={cancelEdit}>Cancelar</button>}
          </div>

          <div className="field">
            <label>Origen del dato</label>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button type="button" className={"tab" + (mode === "api" ? " active" : "")} onClick={() => setMode("api")}>API</button>
              <button type="button" className={"tab" + (mode === "manual" ? " active" : "")} onClick={() => { setMode("manual"); setSourceAuto(false); }}>Manual</button>
            </div>
          </div>

          {mode === "api" && (
            <div className="field">
              <label>Métrica</label>
              <select value={metric} onChange={(e) => void pickMetric(e.target.value)}>
                {Object.entries(CIFRAS_METRICS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
              </select>
              {resolving && <div className="muted-note" style={{ marginTop: 4 }}>Resolviendo dato…</div>}
            </div>
          )}

          <div className="field">
            <label>Cifra (como se muestra)</label>
            <input value={value} onChange={(e) => { setValue(e.target.value); setSourceAuto(false); }} placeholder="5,2%" required disabled={mode === "api" && resolving} />
          </div>
          <div className="field">
            <label>Valor numérico (para el conteo)</label>
            <input type="number" step="any" value={valueNum} onChange={(e) => setValueNum(e.target.value === "" ? "" : Number(e.target.value))} required />
          </div>

          <div className="field">
            <label>Subtítulo (qué representa)</label>
            <input value={subtitle} onChange={(e) => setSubtitle(e.target.value.slice(0, S_MAX))} maxLength={S_MAX} required />
          </div>

          <div className="field">
            <label>Fuente técnica {mode === "api" && sourceAuto && <span className="pill" style={{ marginLeft: 6, fontSize: 10 }}><Sparkles size={11} /> AUTO</span>}</label>
            <input value={source} onChange={(e) => { setSource(e.target.value); setSourceAuto(false); }} required />
          </div>

          <div className="field">
            <label>Explicación</label>
            <textarea value={explanation} onChange={(e) => setExplanation(e.target.value.slice(0, E_MAX))} rows={3} maxLength={E_MAX} required />
            <div style={{ fontSize: 12, color: "#6b7688", textAlign: "right", marginTop: 4 }}>{explanation.length}/{E_MAX}</div>
          </div>

          <div className="field">
            <label>Ícono</label>
            <select value={icon} onChange={(e) => setIcon(e.target.value as CifrasIcon | "")}>
              <option value="">Sin ícono</option>
              {CIFRAS_ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Duración (segundos)</label>
            <input type="number" min={2} value={dur} onChange={(e) => setDur(Math.max(2, Number(e.target.value) || 10))} />
          </div>

          <button className="btn primary" type="submit" disabled={saving || resolving} style={{ width: "100%", justifyContent: "center" }}>
            <Plus size={16} /> {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Guardar en el banco"}
          </button>
        </form>

        <div className="pm-col">
          <PreviewMonitor type="cifras" data={{ mode, metric: mode === "api" ? metric : undefined, value, valueNum: Number(valueNum), suffix: suffix || undefined, subtitle, source, sourceAuto: mode === "api" && sourceAuto, explanation, icon: icon || null }} dur={dur} ready={!!value.trim() && !!subtitle.trim()} />
          {items.length === 0 && <div className="card" style={{ padding: 18, color: "#6b7688" }}>Todavía no hay cifras.</div>}
          {items.map((it) => {
            const d = it.data as CifrasData;
            const Ic = d.icon ? (Icons as any)[d.icon] : null;
            return (
              <div key={it.id} className="card" style={{ padding: 16, display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: "#0d2168", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {Ic ? <Ic size={20} color="#fff" /> : <BarChart3 size={20} color="#fff" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{d.value} — {d.subtitle}</div>
                  <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4, display: "flex", gap: 12 }}>
                    <span>{d.mode === "api" ? "API" : "manual"}</span>
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
