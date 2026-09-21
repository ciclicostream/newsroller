import { useEffect, useState } from "react";
import { PreviewMonitor } from "../components/PreviewMonitor";
import { Plus, Trash2, Check, DollarSign, Pencil } from "lucide-react";
import type { ContentItem, DolarData, DolarPayload } from "@newsroller/shared";
import { DOLAR_CASAS } from "@newsroller/shared";
import { contentItems } from "../lib/content-items";
import { api } from "../lib/api";

const CASA_OPTS = Object.entries(DOLAR_CASAS); // [id, label][]

export function Dolar() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [live, setLive] = useState<DolarPayload | null>(null);

  // 3 cotizaciones elegidas: [izquierda, centro/ancla, derecha].
  const [izq, setIzq] = useState("oficial");
  const [centro, setCentro] = useState("blue");
  const [der, setDer] = useState("bolsa");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [dur, setDur] = useState(10);
  const [saving, setSaving] = useState(false);

  const load = () => contentItems.list("dolar").then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    api.get<{ payload: DolarPayload }>("/api/data/dolar").then((d) => setLive(d.payload)).catch(() => {});
  }, []);

  const liveVenta = (casa: string) => live?.casas.find((c) => c.casa === casa)?.venta ?? null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    const casas = [izq, centro, der] as [string, string, string];
    if (new Set(casas).size !== 3) return setErr("Elegí 3 cotizaciones distintas.");
    setSaving(true);
    try {
      const ov: Record<string, number> = {};
      for (const id of casas) {
        const raw = overrides[id];
        if (raw != null && raw.trim() !== "") ov[id] = Number(raw);
      }
      const data: DolarData = { casas, overrides: Object.keys(ov).length ? ov : undefined };
      if (editingId) {
        await contentItems.patch(editingId, { data, duration_sec: dur });
        setMsg("Cambios guardados.");
      } else {
        await contentItems.create({ type: "dolar", data, duration_sec: dur });
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
    const d = it.data as DolarData;
    setEditingId(it.id);
    setIzq(d.casas?.[0] ?? "oficial");
    setCentro(d.casas?.[1] ?? "blue");
    setDer(d.casas?.[2] ?? "bolsa");
    setOverrides(
      Object.fromEntries(Object.entries(d.overrides ?? {}).map(([k, v]) => [k, String(v)])),
    );
    setDur(it.duration_sec);
    setErr(null); setMsg(null);
  }
  function cancelEdit() {
    setEditingId(null);
    setOverrides({});
    setDur(10);
  }

  async function remove(it: ContentItem) {
    if (!confirm("¿Eliminar esta placa?")) return;
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
      <div className="page-head pm-head">
        <div>
          <h1>Dólar</h1>
          <p>Elegí 3 cotizaciones. La del centro es la ancla (pill "EL DÓLAR"). Valor en vivo de dolarapi.com; podés forzar un valor manual por cotización.</p>
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      <div className="pm-layout">
        <form className="card" style={{ padding: 18 }} onSubmit={save}>
          <div style={{ fontWeight: 500, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {editingId ? "Editar placa" : "Nueva placa"}
            {editingId && <button type="button" className="btn" onClick={cancelEdit}>Cancelar</button>}
          </div>

          {[
            { label: "Izquierda", val: izq, set: setIzq },
            { label: "Centro (ancla)", val: centro, set: setCentro },
            { label: "Derecha", val: der, set: setDer },
          ].map((s) => (
            <div className="field" key={s.label}>
              <label>{s.label}</label>
              <select value={s.val} onChange={(e) => s.set(e.target.value)}>
                {CASA_OPTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <span className="muted-note" style={{ fontSize: 12 }}>
                  API: {liveVenta(s.val) != null ? `$${liveVenta(s.val)}` : "—"}
                </span>
                <input
                  type="number"
                  placeholder="Override manual"
                  value={overrides[s.val] ?? ""}
                  onChange={(e) => setOverrides((o) => ({ ...o, [s.val]: e.target.value }))}
                  style={{ flex: 1 }}
                />
              </div>
            </div>
          ))}

          <div className="field">
            <label>Duración (segundos)</label>
            <input type="number" min={2} value={dur} onChange={(e) => setDur(Math.max(2, Number(e.target.value) || 10))} />
          </div>

          <button className="btn primary" type="submit" disabled={saving} style={{ width: "100%", justifyContent: "center" }}>
            <Plus size={16} /> {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Guardar en el banco"}
          </button>
        </form>

        <div className="pm-col">
          <PreviewMonitor type="dolar" data={{ casas: [izq, centro, der], overrides: Object.fromEntries(Object.entries(overrides).filter(([, v]) => v != null && v.trim() !== "").map(([k, v]) => [k, Number(v)])) }} dur={dur} ready={new Set([izq, centro, der]).size === 3} />
          {items.length === 0 && <div className="card" style={{ padding: 18, color: "#6b7688" }}>Todavía no hay placas de Dólar.</div>}
          {items.map((it) => {
            const d = it.data as DolarData;
            return (
              <div key={it.id} data-item={it.id} className="card" style={{ padding: 16, display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: "#0d2168", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <DollarSign size={22} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>
                    {d.casas?.map((id) => DOLAR_CASAS[id] ?? id).join(" · ")}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4, display: "flex", gap: 12 }}>
                    <span>ancla: {DOLAR_CASAS[d.casas?.[1]] ?? "—"}</span>
                    {d.overrides && Object.keys(d.overrides).length > 0 && <span>con override</span>}
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
