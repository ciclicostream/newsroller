import type { UltimaHoraData, PlacasData } from "@newsroller/shared";
import { UltimaHora } from "./UltimaHora";
import { Placas } from "./Placas";

// Despacha un contenido tipado del banco 2026 a su componente de output.
// A medida que se portan más tipos, se agregan acá.
export function ItemView({ type, data }: { type: string; data: Record<string, any> }) {
  switch (type) {
    case "ultima_hora":
      return <UltimaHora data={data as UltimaHoraData} />;
    case "placas":
      return <Placas data={data as PlacasData} />;
    default:
      return null;
  }
}
