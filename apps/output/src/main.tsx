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
};

function DemoStage({ id }: { id: string }) {
  const d = DEMOS[id] ?? DEMOS.ultima_hora;
  const [scale, setScale] = React.useState(1);
  const [loop, setLoop] = React.useState(0);
  React.useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener("resize", fit);
    const t = setInterval(() => setLoop((n) => n + 1), 9000);
    return () => { window.removeEventListener("resize", fit); clearInterval(t); };
  }, []);
  return (
    <div className="viewport">
      <div className="stage" style={{ transform: `scale(${scale})` }}>
        <ItemView key={loop} type={d.type} data={d.data} />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {demo ? <DemoStage id={demo} /> : preview ? <Preview id={preview} /> : <Output />}
  </React.StrictMode>,
);
