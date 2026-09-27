import type { CamarasData, InformeData, ListaData, PromosData, PublicidadData, ShortsData, VideoFullData, CarteleraData, CifrasData, ClimaData, ClimaPayload, DeclaracionesData, DolarData, DolarPayload, EfemeridesData, MusicaData, ObituarioData, PlacasData, RetroData, UltimaHoraData } from "@newsroller/shared";
import type { ItemProps } from "../../templates/items";
import { Ahora } from "./Ahora";
import { Obituario } from "./Obituario";
import { Musica } from "./Musica";
import { Placas } from "./Placas";
import { Dolar } from "./Dolar";
import { Cifras } from "./Cifras";
import { Efemerides } from "./Efemerides";
import { Retro } from "./Retro";
import { Clima } from "./Clima";
import { Declaraciones } from "./Declaraciones";
import { Cartelera } from "./Cartelera";
import { Shorts } from "./Shorts";
import { Informe } from "./Informe";
import { Lista } from "./Lista";
import { Promos } from "./Promos";
import { Camaras } from "./Camaras";
import { Publicidad } from "./Publicidad";
import { VideoFull } from "../../templates/VideoFull";

// Colección "Modernas" (paneles con profundidad y luces), portada desde la maqueta aprobada.
// Cubre todos los tipos; el Master la habilita en Ajustes → Suites y se usa eligiéndola en una suite.
export function ModernaItemView({ id, type, cameras, data, durationSec, createdAt, updatedAt, liveData }: ItemProps) {
  switch (type) {
    case "ultima_hora":
      return <Ahora data={data as UltimaHoraData} durationSec={durationSec} updatedAt={updatedAt ?? createdAt} />;
    case "obituario":
      return <Obituario data={data as ObituarioData} durationSec={durationSec} />;
    case "musica":
      return <Musica data={data as MusicaData} durationSec={durationSec} />;
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
    case "clima":
      return <Clima data={data as ClimaData} live={liveData?.clima as ClimaPayload | undefined} durationSec={durationSec} />;
    case "declaraciones":
      return <Declaraciones data={data as DeclaracionesData} durationSec={durationSec} />;
    case "cartelera":
      return <Cartelera data={data as CarteleraData} durationSec={durationSec} />;
    case "shorts":
      return <Shorts data={data as ShortsData} durationSec={durationSec} />;
    case "informe":
      return <Informe data={data as InformeData} durationSec={durationSec} />;
    case "lista":
      return <Lista data={data as ListaData} durationSec={durationSec} />;
    case "promos":
      return <Promos data={data as PromosData} durationSec={durationSec} />;
    case "camaras":
      return <Camaras data={data as CamarasData} durationSec={durationSec} cameras={cameras ?? []} />;
    case "publicidad":
      return <Publicidad id={id} data={data as PublicidadData} />;
    case "video_full":
      // Pantalla completa sin nada encima: es la misma en todas las colecciones.
      return <VideoFull data={data as VideoFullData} />;
    default:
      return null;
  }
}
