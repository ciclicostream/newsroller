import { useEffect, useState } from "react";
import { Plus, Trash2, Check, CloudSun } from "lucide-react";
import type { ContentItem, ClimaData, ClimaPayload } from "@newsroller/shared";
import { contentItems } from "../lib/content-items";
import { api } from "../lib/api";

export function Clima() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [live, setLive] = useState<ClimaPayload | null>(null);

  const [city, setCity] = useState("Buenos Aires");
  const [dur, setDur] = useState(10);
  const [saving, setSaving] = useState(false);

  const load = () => contentItems.list("clima").then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    api.get<{ payload: ClimaPayload }>("/api/data/clima").then((d) => setLive(d.payload)).catch(() => {});
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    setSaving(true);
    try {
      const data: ClimaData = { city };
      await contentItems.create({ type: "clima", data, duration_sec: dur });
      setMsg("Guardado en el banco.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(it: ContentItem) {
    if (!confirm("¿Eliminar esta placa de clima?")) return;
    await contentItems.remove(it.id);
    await load();
  }
  async function toggleDisponible(it: ContentItem) {
    await contentItems.patch(it.id, { in_parrilla: !(it.in_parrilla !== false) });
    await load();
  }

  const curTemp = live?.cities.find((c) => c.city === city)?.tempC;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Clima</h1>
          <p>Elegí la ciudad. La temperatura y el pronóstico se toman en vivo de la fuente Clima (no se congelan).</p>
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}
      {msg && <div className="alert">{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", gap: 20, alignItems: "start" }}>
        <form className="card" style={{ padding: 18 }} onSubmit={save}>
          <div style={{ fontWeight: 500, marginBottom: 14 }}>Nueva placa de clima</div>

          <div className="field">
            <label>Ciudad</label>
            <select value={city} onChange={(e) => setCity(e.target.value)}>
              {(live?.cities ?? [{ city }]).map((c) => (
                <option key={c.city} value={c.city}>{c.city}</option>
              ))}
            </select>
            <div className="muted-note" style={{ marginTop: 6 }}>
              Ahora: {curTemp != null ? `${curTemp}°` : "—"}
            </div>
          </div>

          <div className="field">
            <label>Duración (segundos)</label>
            <input type="number" min={2} value={dur} onChange={(e) => setDur(Math.max(2, Number(e.target.value) || 10))} />
          </div>

          <button className="btn primary" type="submit" disabled={saving} style={{ width: "100%", justifyContent: "center" }}>
            <Plus size={16} /> {saving ? "Guardando…" : "Guardar en el banco"}
          </button>
        </form>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.length === 0 && <div className="card" style={{ padding: 18, color: "#6b7688" }}>Todavía no hay placas de clima.</div>}
          {items.map((it) => {
            const d = it.data as ClimaData;
            return (
              <div key={it.id} className="card" style={{ padding: 16, display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: "#0d2168", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CloudSun size={20} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{d.city}</div>
                  <div style={{ fontSize: 12, color: "#6b7688", marginTop: 4 }}>{it.duration_sec}s</div>
                </div>
                <button className={"toggle-pill" + (it.in_parrilla !== false ? " on" : "")} onClick={() => toggleDisponible(it)}>
                  {it.in_parrilla !== false && <Check size={14} />} {it.in_parrilla !== false ? "En parrilla" : "Disponible: no"}
                </button>
                <button className="btn" onClick={() => remove(it)}><Trash2 size={15} /></button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
