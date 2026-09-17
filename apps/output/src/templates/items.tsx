import type { UltimaHoraData, PlacasData, DolarData, DolarPayload, CifrasData, EfemeridesData, CarteleraData, DeclaracionesData, ClimaData, ClimaPayload, ShortsData, CamarasData, VideoFullData } from "@newsroller/shared";
import type { Camera } from "../lib/scene";
import { UltimaHora } from "./UltimaHora";
import { Placas } from "./Placas";
import { Dolar } from "./Dolar";
import { Cifras } from "./Cifras";
import { Efemerides } from "./Efemerides";
import { Cartelera } from "./Cartelera";
import { Declaraciones } from "./Declaraciones";
import { Clima } from "./Clima";
import { Shorts } from "./Shorts";
import { Camaras } from "./Camaras";
import { VideoFull } from "./VideoFull";

// Despacha un contenido tipado del banco 2026 a su componente de output.
// `liveData` = scene.data (payloads en vivo por fuente, ej. liveData.dolar) para
// los tipos que necesitan un valor de API además de lo cargado a mano.
// `cameras` = scene.cameras, para el tipo "camaras".
// A medida que se portan más tipos, se agregan acá.
export function ItemView({
  type,
  data,
  durationSec,
  liveData,
  cameras,
}: {
  type: string;
  data: Record<string, any>;
  durationSec?: number;
  liveData?: Record<string, unknown>;
  cameras?: Camera[];
}) {
  switch (type) {
    case "ultima_hora":
      return <UltimaHora data={data as UltimaHoraData} />;
    case "placas":
      return <Placas data={data as PlacasData} durationSec={durationSec} />;
    case "dolar":
      return <Dolar data={data as DolarData} live={liveData?.dolar as DolarPayload | undefined} durationSec={durationSec} />;
    case "cifras":
      return <Cifras data={data as CifrasData} durationSec={durationSec} />;
    case "efemerides":
      return <Efemerides data={data as EfemeridesData} durationSec={durationSec} />;
    case "cartelera":
      return <Cartelera data={data as CarteleraData} durationSec={durationSec} />;
    case "declaraciones":
      return <Declaraciones data={data as DeclaracionesData} durationSec={durationSec} />;
    case "clima":
      return <Clima data={data as ClimaData} live={liveData?.clima as ClimaPayload | undefined} durationSec={durationSec} />;
    case "shorts":
      return <Shorts data={data as ShortsData} durationSec={durationSec} />;
    case "camaras":
      return <Camaras data={data as CamarasData} durationSec={durationSec} cameras={cameras ?? []} />;
    case "video_full":
      return <VideoFull data={data as VideoFullData} />;
    default:
      return null;
  }
}
