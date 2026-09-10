import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, Loader2, Plus, Image as ImageIcon } from "lucide-react";
import type { Asset, AssetKind, Placa } from "@newsroller/shared";
import { content, uploadAsset } from "../lib/content";

type Tab = AssetKind | "placa";
const TABS: { key: Tab; label: string }[] = [
  { key: "background", label: "Fondos" },
  { key: "logo", label: "Logos" },
  { key: "ad", label: "Publicidad" },
  { key: "placa", label: "Placas" },
];

export function Content() {
  const [tab, setTab] = useState<Tab>("background");
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Contenido</h1>
          <p>Cargá y administrá lo que rota al aire: fondos, logos, publicidad y placas.</p>
        </div>
      </div>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={"tab" + (tab === t.key ? " active" : "")} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "placa" ? <PlacasManager /> : <AssetManager kind={tab} />}
    </>
  );
}

const ACCEPT: Record<AssetKind, string> = {
  background: "image/*,video/*",
  logo: "image/*",
  ad: "image/*,video/*",
};

function AssetManager({ kind }: { kind: AssetKind }) {
  const [items, setItems] = useState<Asset[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => content.listAssets(kind).then(setItems).catch((e) => setErr(e.message));
  useEffect(() => {
    setItems([]);
    setErr(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setErr(null);
    try {
      for (const f of Array.from(files)) await uploadAsset(kind, f);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error al subir");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function toggle(a: Asset) {
    await content.patchAsset(a.id, { active: !a.active });
    await load();
  }
  async function remove(a: Asset) {
    if (!confirm(`¿Eliminar "${a.name}"?`)) return;
    await content.deleteAsset(a.id);
    await load();
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 16, justifyContent: "space-between" }}>
        <div className="muted-note">
          {items.length} elemento{items.length === 1 ? "" : "s"}
        </div>
        <button className="btn primary" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Upload size={16} /> Subir
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          multiple
          accept={ACCEPT[kind]}
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>

      {busy && (
        <div className="uploading">
          <Loader2 size={16} className="spin" /> Subiendo…
        </div>
      )}
      {err && <div className="alert error">{err}</div>}

      <div className="asset-grid">
        {items.map((a) => (
          <div key={a.id} className={"asset-card" + (a.active ? " on" : "")}>
            <div className={"asset-thumb" + (kind === "logo" ? " logo" : "")}>
              {a.mime?.startsWith("image/") ? (
                <img src={a.url} alt={a.name ?? ""} />
              ) : a.mime?.startsWith("video/") ? (
                <video src={a.url} muted />
              ) : (
                <ImageIcon size={26} />
              )}
            </div>
            <div className="asset-body">
              <div className="asset-name">{a.name}</div>
              <div className="asset-actions">
                <button className={"toggle-pill" + (a.active ? " on" : "")} onClick={() => toggle(a)}>
                  {a.active && <span className="live-dot" />}
                  {a.active ? "Al aire" : "Poner al aire"}
                </button>
                <button className="icon-btn" onClick={() => remove(a)} aria-label="Eliminar">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && !busy && <div className="muted-note">Todavía no hay nada acá. Subí el primero.</div>}
      </div>
    </>
  );
}

function PlacasManager() {
  const [items, setItems] = useState<Placa[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [accent, setAccent] = useState("#e8542f");

  const load = () => content.listPlacas().then(setItems).catch((e) => setErr(e.message));
  useEffect(() => {
    void load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await content.createPlaca({ title: title.trim(), body: body.trim() || undefined, accent });
      setTitle("");
      setBody("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    }
  }
  async function toggle(p: Placa) {
    await content.patchPlaca(p.id, { active: !p.active });
    await load();
  }
  async function remove(p: Placa) {
    if (!confirm(`¿Eliminar la placa "${p.title}"?`)) return;
    await content.deletePlaca(p.id);
    await load();
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>
      <form className="card" style={{ padding: 18 }} onSubmit={create}>
        <div style={{ fontWeight: 500, marginBottom: 14 }}>Nueva placa</div>
        <div className="field">
          <label>Título</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="field">
          <label>Cuerpo</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} style={{ resize: "vertical" }} />
        </div>
        <div className="field">
          <label>Color de acento</label>
          <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ height: 40, padding: 4 }} />
        </div>
        <button className="btn primary" type="submit" style={{ width: "100%", justifyContent: "center" }}>
          <Plus size={16} /> Crear placa
        </button>
      </form>

      <div className="card">
        {err && <div className="alert error" style={{ margin: 14 }}>{err}</div>}
        {items.map((p) => (
          <div className="placa-item" key={p.id}>
            <div className="placa-accent" style={{ background: p.accent ?? "var(--accent)" }} />
            <div className="placa-main">
              <div className="placa-title">{p.title}</div>
              {p.body && <div className="placa-body">{p.body}</div>}
            </div>
            <button className={"toggle-pill" + (p.active ? " on" : "")} onClick={() => toggle(p)}>
              {p.active && <span className="live-dot" />}
              {p.active ? "Al aire" : "Poner al aire"}
            </button>
            <button className="icon-btn" onClick={() => remove(p)} aria-label="Eliminar">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {items.length === 0 && !err && <div className="muted-note" style={{ padding: 16 }}>Sin placas todavía.</div>}
      </div>
    </div>
  );
}
