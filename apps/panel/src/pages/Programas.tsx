import { Hash, Construction } from "lucide-react";

export function Programas() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Programas</h1>
          <p>Trae los programas del canal buscándolos por hashtags en YouTube.</p>
        </div>
      </div>

      <div className="card" style={{ padding: 18, maxWidth: 560 }}>
        <div className="field">
          <label>Hashtags</label>
          <div className="row" style={{ gap: 8 }}>
            <span className="pill" style={{ gap: 4 }}><Hash size={13} /> ciclico</span>
            <span className="pill" style={{ gap: 4 }}><Hash size={13} /> programa</span>
          </div>
        </div>
        <div className="muted-note" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
          <Construction size={16} /> Sección en construcción — falta conectar la búsqueda por hashtags con la API de YouTube.
        </div>
      </div>
    </>
  );
}
