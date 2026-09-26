import type { ObituarioData, PlacasData, UltimaHoraData } from "@newsroller/shared";
import type { ItemProps } from "../../templates/items";
import { Ahora } from "./Ahora";
import { Obituario } from "./Obituario";
import { Placas } from "./Placas";

// Colección "Modernas" (paneles con profundidad y luces), portada desde la maqueta aprobada.
// Se suman de a una; mientras falten tipos no se puede habilitar (ready: false en TEMPLATE_COLLECTIONS).
export function ModernaItemView({ type, data, durationSec, createdAt, updatedAt }: ItemProps) {
  switch (type) {
    case "ultima_hora":
      return <Ahora data={data as UltimaHoraData} durationSec={durationSec} updatedAt={updatedAt ?? createdAt} />;
    case "obituario":
      return <Obituario data={data as ObituarioData} durationSec={durationSec} />;
    case "placas":
      return <Placas data={data as PlacasData} durationSec={durationSec} createdAt={createdAt} />;
    default:
      return null;
  }
}
