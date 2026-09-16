import type { UltimaHoraData, PlacasData } from "@newsroller/shared";
import { UltimaHora } from "./UltimaHora";
import { Placas } from "./Placas";

// Despacha un contenido tipado del banco 2026 a su componente de output.
// A medida que se portan más tipos, se agregan acá.
export function ItemView({ type, data, durationSec }: { type: string; data: Record<string, any>; durationSec?: number }) {
  switch (type) {
    case "ultima_hora":
      return <UltimaHora data={data as UltimaHoraData} />;
    case "placas":
      return <Placas data={data as PlacasData} durationSec={durationSec} />;
    default:
      return null;
  }
}
