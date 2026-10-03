import { Link } from "react-router-dom";

// Mismo lugar y estilo que el toggle de Cartelera (teatro/cine/eventos), Shorts (1/2) o Promos (9:16/4:3): un campo
// más, arriba del todo en la card del formulario. La diferencia es que acá cada pestaña es en realidad OTRO tipo de
// contenido (navega a su propia página) — Efemérides y Retro (o Informe y Lista) siguen siendo bancos separados.
function Switch({ tabs, active }: { tabs: { key: string; to: string; label: string }[]; active: string }) {
  return (
    <div className="tabs" style={{ marginBottom: 0 }}>
      {tabs.map((t) => <Link key={t.key} to={t.to} className={"tab" + (active === t.key ? " active" : "")}>{t.label}</Link>)}
    </div>
  );
}

// "Informes" es una sola card del submenú de Contenido; adentro se elige la forma: Carrusel de slides o Lista.
export function InformesSwitch({ active }: { active: "informe" | "lista" | "elecciones" }) {
  return <Switch active={active} tabs={[
    { key: "informe", to: "/contenido/informe", label: "Carrusel" },
    { key: "lista", to: "/contenido/lista", label: "Lista" },
    { key: "elecciones", to: "/contenido/elecciones", label: "Elecciones" },
  ]} />;
}

// "Última Hora" también reúne el Obituario (despedida sobria, sin marco).
export function UltimaHoraSwitch({ active }: { active: "ultima_hora" | "obituario" }) {
  return <Switch active={active} tabs={[
    { key: "ultima_hora", to: "/contenido/ultima_hora", label: "Última Hora" },
    { key: "obituario", to: "/contenido/obituario", label: "Obituario" },
  ]} />;
}

// "Efemérides" también es una sola card: adentro se elige Efemérides (un día como hoy) o Retro.
export function EfemeridesSwitch({ active }: { active: "efemerides" | "retro" }) {
  return <Switch active={active} tabs={[
    { key: "efemerides", to: "/contenido/efemerides", label: "Efemérides" },
    { key: "retro", to: "/contenido/retro", label: "Retro" },
  ]} />;
}
