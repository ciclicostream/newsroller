import type { CifrasData, DolarData, DolarPayload, EfemeridesData, ObituarioData, PlacasData, RetroData, UltimaHoraData } from "@newsroller/shared";
import type { ItemProps } from "../../templates/items";
import { Ahora } from "./Ahora";
import { Obituario } from "./Obituario";
import { Placas } from "./Placas";
import { Dolar } from "./Dolar";
import { Cifras } from "./Cifras";
import { Efemerides } from "./Efemerides";
import { Retro } from "./Retro";

// Colección "Modernas" (paneles con profundidad y luces), portada desde la maqueta aprobada.
// Se suman de a una; mientras falten tipos no se puede habilitar (ready: false en TEMPLATE_COLLECTIONS).
export function ModernaItemView({ type, data, durationSec, createdAt, updatedAt, liveData }: ItemProps) {
  switch (type) {
    case "ultima_hora":
      return <Ahora data={data as UltimaHoraData} durationSec={durationSec} updatedAt={updatedAt ?? createdAt} />;
    case "obituario":
      return <Obituario data={data as ObituarioData} durationSec={durationSec} />;
    case "placas":
      return <Placas data={data as PlacasData} durationSec={durationSec} createdAt={createdAt} />;
    case "dolar":
      return <Dolar data={data as DolarData} live={liveData?.dolar as DolarPayload | undefined} durationSec={durationSec} />;
    case "cifras":
      return <Cifras data={data as CifrasData} durationSec={durationSec} />;
    case "efemerides":
      return <Efemerides data={data as EfemeridesData} durationSec={durationSec} />;
    case "retro":
      return <Retro data={data as RetroData} durationSec={durationSec} />;
    default:
      return null;
  }
}
