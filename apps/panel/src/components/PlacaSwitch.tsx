import { Link } from "react-router-dom";

function Switch({ tabs, active }: { tabs: { key: string; to: string; label: string }[]; active: string }) {
  return (
    <div className="tabs" style={{ marginBottom: 16 }}>
      {tabs.map((t) => <Link key={t.key} to={t.to} className={"tab" + (active === t.key ? " active" : "")}>{t.label}</Link>)}
    </div>
  );
}

// "Informes" es una sola card del submenú de Contenido; adentro se elige la forma: Carrusel de slides o Lista.
export function InformesSwitch({ active }: { active: "informe" | "lista" }) {
  return <Switch active={active} tabs={[
    { key: "informe", to: "/contenido/informe", label: "Carrusel" },
    { key: "lista", to: "/contenido/lista", label: "Lista" },
  ]} />;
}

// "Efemérides" también es una sola card: adentro se elige Efemérides (un día como hoy) o Retro.
export function EfemeridesSwitch({ active }: { active: "efemerides" | "retro" }) {
  return <Switch active={active} tabs={[
    { key: "efemerides", to: "/contenido/efemerides", label: "Efemérides" },
    { key: "retro", to: "/contenido/retro", label: "Retro" },
  ]} />;
}
