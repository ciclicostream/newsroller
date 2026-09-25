import { Link } from "react-router-dom";

// "Informes" es una sola card del submenú de Contenido; adentro se elige la forma: Carrusel de slides o Lista.
export function InformesSwitch({ active }: { active: "informe" | "lista" }) {
  return (
    <div className="tabs" style={{ marginBottom: 16 }}>
      <Link to="/contenido/informe" className={"tab" + (active === "informe" ? " active" : "")}>Carrusel</Link>
      <Link to="/contenido/lista" className={"tab" + (active === "lista" ? " active" : "")}>Lista</Link>
    </div>
  );
}
