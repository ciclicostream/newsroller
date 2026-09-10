import { FileStack } from "lucide-react";

export function Content() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Contenido</h1>
          <p>Gestor de contenidos: fondos, logos, placas, publicidad, shorts y ticker.</p>
        </div>
      </div>
      <div className="card stat" style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <FileStack size={28} color="var(--muted)" />
        <div>
          <div style={{ fontWeight: 500 }}>En construcción</div>
          <div className="muted-note">
            Acá el gestor de contenidos podrá subir assets y armar la rotación del autopilot. Disponible para
            administradores y gestores de contenido.
          </div>
        </div>
      </div>
    </>
  );
}
