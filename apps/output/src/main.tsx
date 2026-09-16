import React from "react";
import ReactDOM from "react-dom/client";
import { Output } from "./Output";
import { Preview } from "./Preview";
import { ItemView } from "./templates/items";
import "./styles.css";

const params = new URLSearchParams(window.location.search);
const preview = params.get("preview");
const demo = params.get("demo"); // vista local SIN Supabase (para revisar placas portadas)

// Datos de ejemplo para el modo demo.
const DEMOS: Record<string, { type: string; data: Record<string, any> }> = {
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
  placas: {
    type: "placas",
    data: {
      label: "17 de septiembre",
      title: "A 50 años de la Noche de los Lápices, estudiantes marchan en todo el país para no olvidar",
      temp: "13C",
      city: "CABA",
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
      temp: "21C",
      city: "CABA",
      body:
        "La medida busca contener la brecha y llega tras una semana de fuerte demanda de divisas.\n\nEl anuncio se oficializará mañana por la mañana con la publicación en el Boletín Oficial.",
      media_url: null,
    },
  },
};

function DemoStage({ id }: { id: string }) {
  const d = DEMOS[id] ?? DEMOS.ultima_hora;
  const DUR = 8;
  const [scale, setScale] = React.useState(1);
  const [loop, setLoop] = React.useState(0);
  React.useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener("resize", fit);
    const t = setInterval(() => setLoop((n) => n + 1), (DUR + 1) * 1000);
    return () => { window.removeEventListener("resize", fit); clearInterval(t); };
  }, []);
  return (
    <div className="viewport">
      <div className="stage" style={{ transform: `scale(${scale})` }}>
        <ItemView key={loop} type={d.type} data={d.data} durationSec={DUR} />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {demo ? <DemoStage id={demo} /> : preview ? <Preview id={preview} /> : <Output />}
  </React.StrictMode>,
);
