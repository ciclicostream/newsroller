import React from "react";
import ReactDOM from "react-dom/client";
import { Output } from "./Output";
import { RadioOutput } from "./RadioOutput";
import { Preview, DraftPreview } from "./Preview";
import { ItemView } from "./templates/items";
import { fitScale, stageStyle } from "./lib/orientation";
import "./styles.css";

const params = new URLSearchParams(window.location.search);
const preview = params.get("preview");
const draft = params.get("draft"); // monitor de edición de los formularios del panel
const radio = params.get("radio"); // Stream (radio manual): recibe mic/cámara del Host por WebRTC
const demo = params.get("demo"); // vista local SIN Supabase (para revisar placas portadas)

// Datos de ejemplo para el modo demo.
const DEMOS: Record<string, { type: string; data: Record<string, any>; dur?: number }> = {
  cartelera_cine: {
    type: "cartelera", dur: 15,
    data: { kind: "cine", photo_url: "", title: "Interestelar", synopsis: "Un grupo de astronautas viaja a través de un agujero de gusano en busca de un nuevo hogar para la humanidad, mientras la Tierra se queda sin tiempo.", author: "Christopher Nolan", cast: "Matthew McConaughey, Anne Hathaway, Jessica Chastain, Michael Caine", duration_text: "169 min", genre: "Ciencia ficción", ticker: "recomendada", trailer_id: "zSWdZVtXT7E", poster_url: "https://picsum.photos/seed/poster/600/900" },
  },
  cartelera_serie: {
    type: "cartelera", dur: 15,
    data: { kind: "cine", photo_url: "", title: "Cien años de soledad", synopsis: "La saga de la familia Buendía en Macondo, adaptada por primera vez a la pantalla.", author: "Alex García López, Laura Mora", cast: "Claudio Cataño, Marco González, Susana Morales", duration_text: "60 min por capítulo", genre: "Drama", is_series: true, platform: "netflix", platform_name: "Netflix", seasons: 2, episodes: 8, ticker: "estreno", trailer_id: "zSWdZVtXT7E", short_id: "bxskJgShC38", short_thumb: "https://i.ytimg.com/vi/bxskJgShC38/mqdefault.jpg" },
  },
  cartelera_cine_min: {
    type: "cartelera", dur: 12,
    data: { kind: "cine", photo_url: "", title: "Una película con un título bastante largo para ver cómo se acomoda", synopsis: "Sin póster, sin short y sin newsticker.", author: "Director de prueba", cast: "Actriz Uno, Actor Dos", duration_text: "95 min", genre: "Comedia", trailer_id: "zSWdZVtXT7E" },
  },
  cartelera_evento: {
    type: "cartelera", dur: 12,
    data: { kind: "evento", photo_url: "https://picsum.photos/seed/evento/1600/900", title: "Festival de Jazz en el Parque Centenario", author: "", cast: "", description: "Una tarde con bandas de jazz locales, feria de discos y food trucks. Entrada libre y gratuita para toda la familia.", venue: "Parque Centenario", address: "Av. Díaz Vélez 4821", city: "Caballito - CABA", days: "Sábado 27", time: "16:00 hs" },
  },
  cartelera_teatro: {
    type: "cartelera", dur: 12,
    data: { kind: "teatro", photo_url: "https://picsum.photos/seed/teatro/1600/900", title: "¡Oh cabezas locas de las religiosas!", author: "Mía Micelli", cast: "Ana Luz Camps, Melina Del Valle Villar, Miranda Di Lorenzo, Agustín Gagliardi, Mía Miceli", venue: "Espacio Callejón", address: "Humahuaca 3759", city: "Almagro - CABA", days: "Sábados", time: "16:00 hs" },
  },
  efemerides_multi: {
    type: "efemerides",
    dur: 24,
    data: {
      dateKind: "anniversary", day: 21, month: 8,
      title: "Día Mundial del Alzheimer",
      body: "Jornada destinada a aumentar la concienciación sobre la enfermedad de Alzheimer, combatir el estigma asociado a la demencia y promover el apoyo a las personas afectadas y sus familias.",
      media_url: "https://upload.wikimedia.org/wikipedia/commons/a/ad/Alois_Alzheimer_003.jpg", media_kind: "image",
      more: [
        { dateKind: "full", day: 21, month: 8, year: 1937, title: "Tolkien publica El Hobbit", body: "Se publica en Londres la novela de J. R. R. Tolkien, que abre la saga de la Tierra Media.", media_url: "https://picsum.photos/seed/hobbit/600/800", media_kind: "image" },
        { dateKind: "full", day: 21, month: 8, year: 1964, title: "Malta se independiza del Reino Unido", body: "Malta obtiene la independencia del Reino Unido y pasa a integrar la Commonwealth.", media_url: "https://picsum.photos/seed/malta/600/800", media_kind: "image" },
      ],
    },
  },
  lista_albumes: {
    type: "lista", dur: 57,
    data: {
      title: "Los 10 álbumes más escuchados del año", numbered: true, sec_per_item: 5,
      items: [
        { title: "Costanera", subtitle: "Marea Alta", value: "4,8 M", text: "Disco debut de la banda, grabado en vivo en doce tomas.", image_url: "https://picsum.photos/seed/a1/600/600" },
        { title: "Cuarto Menguante", subtitle: "Lía Ferrer", value: "4,3 M", text: "Once canciones de cámara con arreglos de cuerdas.", image_url: "https://picsum.photos/seed/a2/600/600" },
        { title: "Papel Moneda", subtitle: "Los Hijos del Sur", value: "3,9 M", text: "El regreso del trío después de seis años sin editar." },
        { title: "Ruido Blanco", subtitle: "Tomás Ibarra", value: "3,5 M", text: "Electrónica de dormitorio que llegó a los festivales." },
        { title: "Diciembre", subtitle: "Cielo Arriba", value: "3,2 M", text: "Un disco de verano pensado para escuchar de corrido." },
        { title: "Fuego Lento", subtitle: "Renata Quiroga", value: "2,9 M" },
        { title: "Sur Profundo", subtitle: "Bandurria", value: "2,6 M" },
        { title: "La Última Fila", subtitle: "Mateo Salas", value: "2,4 M" },
        { title: "Aguas Bajas", subtitle: "Perla Norte", value: "2,1 M" },
        { title: "Trasnoche", subtitle: "Los Ferroviarios", value: "1,9 M" },
      ],
    },
  },
  lista_mujeres: {
    type: "lista", dur: 27,
    data: {
      title: "5 mujeres que hicieron historia en la Argentina", numbered: false, sec_per_item: 5,
      items: [
        { title: "Juana Azurduy", subtitle: "Jefa militar", value: "1780–1862", text: "Comandó tropas en la guerra de la independencia en el Alto Perú." },
        { title: "Cecilia Grierson", subtitle: "Primera médica argentina", value: "1889", text: "Se recibió en la Universidad de Buenos Aires y fundó la primera escuela de enfermería." },
        { title: "Alfonsina Storni", subtitle: "Poeta y docente", value: "1892–1938", text: "Una de las voces centrales de la poesía argentina del siglo XX." },
        { title: "Julieta Lanteri", subtitle: "Sufragista", value: "1873–1932", text: "En 1911 fue la primera mujer en votar en la Argentina." },
        { title: "Eva Perón", subtitle: "Dirigente política", value: "1919–1952", text: "Impulsó la ley del voto femenino, sancionada en 1947." },
      ],
    },
  },
  retro: {
    type: "retro", dur: 15,
    data: {
      media_url: "https://picsum.photos/seed/retro/1200/900", media_kind: "image", chip: "PROGRAMA", year: "Años 90",
      title: "Videomatch", subtitle: "Programa de televisión",
      text: "Ciclo de entretenimiento que marcó la televisión de la década. Combinaba humor, juegos y bloques deportivos, y se volvió un clásico de la pantalla argentina.",
    },
  },
  retro_afiche: {
    type: "retro", dur: 15,
    data: {
      media_url: "https://picsum.photos/seed/afiche/800/1200", media_kind: "image", chip: "PROGRAMA", year: "1985",
      title: "Un título de programa bastante largo que ocupa dos renglones", subtitle: "Ciclo de humor",
      text: "Descripción de prueba para ver cómo se acomoda un afiche vertical con bastante texto en la ficha, que se corta solo si no entra.",
    },
  },
  ultima_hora: {
    type: "ultima_hora",
    data: { text: 'Abogados de Cristina presentaron una "prueba trascendente" para refutar la condena.', media_url: null, media_kind: null },
  },
  ultima_hora_media: {
    type: "ultima_hora",
    data: {
      text: 'Abogados de Cristina presentaron una **"prueba trascendente"** para refutar la condena.',
      media_url: "https://picsum.photos/seed/uh/640/640",
      media_kind: "image",
    },
  },
  declaraciones: {
    type: "declaraciones", dur: 15,
    data: { name: "Juan Pérez", role: "Ministro de Economía", place: "Casa Rosada", headline: "\"Vamos a bajar la inflación\"", quote: "Esta es una cita de prueba bastante larga para ver cómo queda la placa, con varias líneas de texto que ocupan bien la tarjeta azul y se escriben de a poco.", photo_url: "https://fffefldkgcylqfbvshet.supabase.co/storage/v1/object/public/media/1789625617327-6a1c6562-3dcf-4a08-a877-de6b667e2db0-piel-1---Avon.jpeg", interview_program: "EPA!" },
  },
  publicidad_vertical: {
    type: "publicidad", dur: 15,
    data: { format: "vertical", media_url: "https://fffefldkgcylqfbvshet.supabase.co/storage/v1/object/public/media/1789625617327-6a1c6562-3dcf-4a08-a877-de6b667e2db0-piel-1---Avon.jpeg", media_kind: "image", logo_url: "https://fffefldkgcylqfbvshet.supabase.co/storage/v1/object/public/media/1789625617327-6a1c6562-3dcf-4a08-a877-de6b667e2db0-piel-1---Avon.jpeg", brand_qr_url: "https://fffefldkgcylqfbvshet.supabase.co/storage/v1/object/public/media/1789625617327-6a1c6562-3dcf-4a08-a877-de6b667e2db0-piel-1---Avon.jpeg" },
  },
  promos: {
    type: "promos", dur: 15,
    data: { title: "AVANCE", body: "Texto de la promo de prueba: una bajada que explica de qué trata el avance.", format: "916", video_id: "zSWdZVtXT7E" },
  },
  shorts: {
    type: "shorts", dur: 15,
    data: { count: 1, video1: "bxskJgShC38", title: "Título del short de prueba que puede ser algo largo" },
  },
  placas: {
    type: "placas",
    data: {
      label: "17 de septiembre",
      title: "A 50 años de la Noche de los Lápices, estudiantes marchan en todo el país para no olvidar",
      body:
        "Este miércoles 16 de septiembre se cumplen exactamente 50 años de la Noche de los Lápices, el operativo represivo que en 1976 ordenó el general Ramón Camps y que derivó en el secuestro de once estudiantes secundarios de La Plata de entre 16 y 18 años, de los cuales seis permanecen desaparecidos:\n\nFrancisco López Muntaner, María Claudia Falcone, Claudio de Acha, Horacio Ángel Ungaro, Daniel Alberto Racero y María Clara Ciocchini.\n\nSu crimen fue reclamar por el boleto estudiantil secundario.",
      media_url: "https://picsum.photos/seed/plc/900/600",
      media_kind: "image",
    },
  },
  placas_notext: {
    type: "placas",
    data: {
      label: "Economía",
      title: "El Gobierno anunció un **nuevo esquema** cambiario para las próximas semanas",
      body:
        "La medida busca contener la brecha y llega tras una semana de fuerte demanda de divisas.\n\nEl anuncio se oficializará mañana por la mañana con la publicación en el Boletín Oficial.",
      media_url: null,
    },
  },
};

function DemoStage({ id }: { id: string }) {
  const d = DEMOS[id] ?? DEMOS.ultima_hora;
  const DUR = d.dur ?? 8;
  const [scale, setScale] = React.useState(1);
  const [loop, setLoop] = React.useState(0);
  React.useEffect(() => {
    const fit = () => setScale(fitScale());
    fit();
    window.addEventListener("resize", fit);
    const t = setInterval(() => setLoop((n) => n + 1), (DUR + 1) * 1000);
    return () => { window.removeEventListener("resize", fit); clearInterval(t); };
  }, []);
  return (
    <div className="viewport">
      <div className="stage" style={stageStyle(scale)}>
        <ItemView key={loop} type={d.type} data={d.data} durationSec={DUR} />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {radio ? <RadioOutput /> : demo ? <DemoStage id={demo} /> : draft ? <DraftPreview /> : preview ? <Preview id={preview} /> : <Output />}
  </React.StrictMode>,
);
