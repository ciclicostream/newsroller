import { P } from "./lib/params";
import { BR_CANDIDATES } from "@newsroller/shared";
import React from "react";
import ReactDOM from "react-dom/client";
import { Output } from "./Output";
import { RadioOutput } from "./RadioOutput";
import { CanalOutput } from "./CanalOutput";
import { Preview, DraftPreview } from "./Preview";
import { ItemView } from "./collections";
import { fitScale, stageStyle } from "./lib/orientation";
import "./styles.css";

const params = P;
const preview = params.get("preview");
const draft = params.get("draft"); // monitor de edición de los formularios del panel
const radio = params.get("radio"); // Stream (radio manual): recibe mic/cámara del Host por WebRTC
const demo = params.get("demo"); // vista local SIN Supabase (para revisar placas portadas)

// Demo "Brasil con candidatos reales precargados" (cifras ficticias): para revisar el diseño con nombres y fotos finales.
const BR_PCT = [41.2, 37.8, 7.9, 4.1, 3.3, 2.2, 1.4, 0.8, 0.5, 0.4, 0.2, 0.2];
const BR_TOTAL = 118_400_000;
const brCands = (pcts: number[] = BR_PCT) => BR_CANDIDATES.map((c, i) => ({ name: c.name, party: c.party, color: c.color, photo_url: c.photo_url, pct: pcts[i] ?? 0, votes: pcts[i] ? Math.round(BR_TOTAL * pcts[i]! / 100) : undefined }));
const BR_UF_WIN: Record<string, [number, number, number]> = { AC: [1, 58, 330000], AL: [0, 61, 1150000], AP: [0, 52, 280000], AM: [0, 49, 1250000], BA: [0, 64, 5100000], CE: [0, 66, 4300000], DF: [1, 54, 1450000], ES: [1, 51, 1500000], GO: [1, 56, 3000000], MA: [0, 69, 3150000], MT: [1, 60, 1700000], MS: [1, 57, 1200000], MG: [0, 48, 6900000], PA: [0, 50, 3200000], PB: [0, 62, 1800000], PR: [1, 55, 4300000], PE: [0, 63, 3900000], PI: [0, 71, 1700000], RJ: [1, 47, 5600000], RN: [0, 59, 1400000], RS: [1, 50, 4200000], RO: [1, 62, 620000], RR: [1, 65, 260000], SC: [1, 63, 3100000], SP: [1, 46, 14300000], SE: [0, 60, 900000], TO: [1, 53, 600000] };
const brStates = () => Object.entries(BR_UF_WIN).map(([id, [winner, pct, votes]]) => ({ id, winner, pct, votes }));
const brCities = () => [
  { id: "71072", name: "São Paulo", uf: "SP", counted_pct: 99.1, top: [{ i: 1, pct: 44.3, votes: 3200000 }, { i: 0, pct: 41.9, votes: 3030000 }, { i: 2, pct: 6.1, votes: 440000 }, { i: 3, pct: 3.2, votes: 230000 }] },
  { id: "60011", name: "Rio de Janeiro", uf: "RJ", counted_pct: 98.7, top: [{ i: 1, pct: 46.8, votes: 1700000 }, { i: 0, pct: 40.2, votes: 1460000 }, { i: 2, pct: 5.4, votes: 196000 }, { i: 4, pct: 3.1, votes: 112000 }] },
  { id: "38490", name: "Salvador", uf: "BA", counted_pct: 97.9, top: [{ i: 0, pct: 66.1, votes: 1200000 }, { i: 1, pct: 25.7, votes: 466000 }, { i: 2, pct: 3.9, votes: 70000 }, { i: 3, pct: 2.0, votes: 36000 }] },
  { id: "41238", name: "Belo Horizonte", uf: "MG", counted_pct: 98.4, top: [{ i: 0, pct: 45.2, votes: 740000 }, { i: 1, pct: 38.9, votes: 637000 }, { i: 2, pct: 8.8, votes: 144000 }, { i: 3, pct: 3.6, votes: 59000 }] },
  { id: "97012", name: "Brasília", uf: "DF", counted_pct: 99.6, top: [{ i: 1, pct: 52.7, votes: 770000 }, { i: 0, pct: 37.5, votes: 548000 }, { i: 2, pct: 4.4, votes: 64000 }, { i: 4, pct: 2.6, votes: 38000 }] },
];
const brAbroad = () => ({
  country_name: "Argentina", electorate: 13138,
  cities: [
    { name: "Buenos Aires", electorate: 9612, top: [{ i: 0, votes: 2540, pct: 49.2 }, { i: 1, votes: 1630, pct: 31.6 }, { i: 2, votes: 410, pct: 7.9 }] },
    { name: "Córdoba", electorate: 1894, top: [{ i: 1, votes: 520, pct: 41.3 }, { i: 0, votes: 470, pct: 37.3 }, { i: 2, votes: 120, pct: 9.5 }] },
    { name: "Otras ciudades", electorate: 1632, top: [{ i: 0, votes: 402, pct: 44.8 }, { i: 1, votes: 255, pct: 28.4 }, { i: 3, votes: 70, pct: 7.8 }] },
  ],
  bulletins_expected: 41, bulletins_received: 37, bulletins_totalized: 34, totalized_pct: 82.9, updated_at: "2026-10-04T18:42:10-03:00",
  candidates: [{ i: 0, votes: 3412, pct: 47.9 }, { i: 1, votes: 2305, pct: 32.4 }, { i: 2, votes: 598, pct: 8.4 }, { i: 3, votes: 321, pct: 4.5 }, { i: 4, votes: 187, pct: 2.6 }, { i: 5, votes: 122, pct: 1.7 }, { i: 6, votes: 64, pct: 0.9 }, { i: 7, votes: 41, pct: 0.6 }, { i: 8, votes: 28, pct: 0.4 }, { i: 9, votes: 22, pct: 0.3 }, { i: 10, votes: 14, pct: 0.2 }, { i: 11, votes: 11, pct: 0.2 }],
});
const brBase = { country: "br", kind: "presidencial", round: 1, year: "2026", intro: "con", source: "TSE · Tribunal Superior Eleitoral", counted_pct: 91.3, states: brStates(), cities: brCities(), abroad: brAbroad() };

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
  cartelera_teatro_video: {
    type: "cartelera", dur: 12,
    data: { kind: "teatro", ticker: "estreno", photo_url: "https://picsum.photos/seed/teatro/1600/900", title: "Los días quietos", author: "Laura Ferrer", cast: "Ana Quiroga, Pablo Salas y Mirta Ibarra", venue: "Teatro Sur", address: "Av. Corrientes 1500", city: "San Nicolás, CABA", days: "Jueves a domingo", time: "20 y 22:30 h", video_url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" },
  },
  cartelera_teatro: {
    type: "cartelera", dur: 12,
    data: { kind: "teatro", photo_url: "https://picsum.photos/seed/teatro/1600/900", title: "¡Oh cabezas locas de las religiosas!", author: "Mía Micelli", cast: "Ana Luz Camps, Melina Del Valle Villar, Miranda Di Lorenzo, Agustín Gagliardi, Mía Miceli", venue: "Espacio Callejón", address: "Humahuaca 3759", city: "Almagro - CABA", days: "Sábados", time: "16:00 hs" },
  },
  musica: {
    type: "musica", dur: 60,
    data: {
      album: "10 Obras Argentinas para Guitarra", title: "Girls in the party con el auto rojo", artist: "Juan Pablo Ferreyra", cover_url: "https://picsum.photos/seed/guitarra/900/900", photos: ["https://picsum.photos/seed/guitarra2/900/900", "https://picsum.photos/seed/guitarra3/900/900"], release_date: "2026-06-26",
      description: "10 obras argentinas para guitarra contiene las obras del libro homónimo publicado en 2023 por el compositor Juan Pablo Ferreyra, con el apoyo de Fondo Nacional de Las Artes y Municipio de Pilar. Contiene 10 obras originales para guitarra solista y dúo de guitarras sobre ritmos característicos del folklore argentino como chamamé, bailecito y milonga.",
      genres: ["Chamamé", "Folclore nacional"], credits: "Letra y música: Juan Pablo Ferreyra", instagram: "@losbandaloschinos",
      audio_url: "", lyrics: [
        { t: 0, text: "Girls in the party and you are alone" },
        { t: 5, text: "Watching your cell phone, what’s goin’ on?" },
        { t: 10, text: "Boys in the party and you are alone" },
        { t: 15, text: "Watching your cell phone, what’s goin’ on?" },
        { t: 20, text: "You have yous shinin’ shoes..." },
        { t: 25, text: "Llamè a tu vieja, y ella dijo mm, està todo bien" },
        { t: 30, text: "Llamè al doctor, y el tordo dijo iii, masomeno ahì va" },
        { t: 35, text: "But you are burnin’ yeee" },
        { t: 40, text: "Burnin, iiii Activeishon baby" }
      ],
    },
  },
  musica_largo: {
    type: "musica", dur: 20,
    data: {
      album: "Un álbum con un nombre larguísimo para probar la volanta", title: "Un título de tema muy largo que ocupa varias líneas en la pantalla completa", artist: "Un nombre de artista también bastante largo para probar cómo se acomoda", cover_url: "https://picsum.photos/seed/portada3/900/900",
      genres: ["Académica - Clásica", "Contemporánea - experimental", "Folclore latinoamericano"], audio_url: "",
      lyrics: [{ t: 0, text: "Y una línea muy larga para ver cómo se acomoda cuando el verso no entra en un solo renglón de la pantalla y hay que achicarlo bastante más" }],
    },
  },
  musica_creditos: {
    type: "musica", dur: 20,
    data: { album: "Sin letra ni descripción", title: "Tema con créditos", artist: "A. Pérez", cover_url: "https://picsum.photos/seed/portada4/900/900", genres: ["Tango"], credits: "Letra y música: A. Pérez", audio_url: "" },
  },
  musica_ig: {
    type: "musica", dur: 20,
    data: { album: "Sólo Instagram", title: "Tema con Instagram", artist: "Los Banda Los Chinos", cover_url: "https://picsum.photos/seed/portada5/900/900", genres: ["Rock"], instagram: "losbandaloschinos", audio_url: "", lyrics: [{ t: 0, text: "Una línea de prueba" }] },
  },
  musica_min: {
    type: "musica", dur: 20,
    data: { album: "Sin letra", title: "Tema instrumental", artist: "Trío Jazz", cover_url: "https://picsum.photos/seed/portada2/900/900", genres: ["Jazz"], audio_url: "" },
  },
  clima: { type: "clima", dur: 12, data: { city: "Buenos Aires" } },
  clima_lluvia: { type: "clima", dur: 12, data: { city: "Posadas" } },
  clima_parcial: { type: "clima", dur: 12, data: { city: "Paraná" } },
  clima_neuquen: { type: "clima", dur: 12, data: { city: "Neuquén" } },
  clima_preview: { type: "clima", dur: 12, data: { city: "Buenos Aires", preview: { code: 45, isDay: false } } },
  clima_sol: { type: "clima", dur: 12, data: { city: "Mendoza", preview: { code: 0, isDay: true } } },
  clima_lluvia_fuerte: { type: "clima", dur: 12, data: { city: "Buenos Aires", preview: { code: 65, isDay: true } } },
  clima_nieve: { type: "clima", dur: 12, data: { city: "Ushuaia", preview: { code: 75, isDay: true } } },
  clima_brisa: { type: "clima", dur: 12, data: { city: "La Plata" } },
  clima_largo: { type: "clima", dur: 12, data: { city: "San Fernando del Valle de Catamarca" } },
  dolar: {
    type: "dolar", dur: 12,
    data: { casas: ["oficial", "blue", "bolsa"] },
  },
  cifras: {
    type: "cifras", dur: 12,
    data: { mode: "manual", value: "2,9", valueNum: 2.9, suffix: "%", subtitle: "La inflación de la Ciudad **se aceleró** en julio", source: "IDECBA · IPCBA", sourceAuto: false, explanation: "Cortó cuatro meses de baja consecutiva. La suba de precios venía desacelerando desde marzo y en julio se dio vuelta.", icon: "TrendingUp" },
  },
  cifras_big: {
    type: "cifras", dur: 12,
    data: { mode: "manual", value: "600.000.000", valueNum: 600000000, prefix: "$", subtitle: "Cifra de prueba con muchos dígitos para ver el ancho", source: "Fuente de prueba", sourceAuto: false, explanation: "Sin ícono: la explicación ocupa todo el ancho de la tarjeta.", icon: null },
  },
  cifras_unit: {
    type: "cifras", dur: 12,
    data: { mode: "api", metric: "energia", value: "1.245", valueNum: 1245, prefix: "US$", suffix: "millones de dólares", subtitle: "Dato de prueba con unidad larga", source: "Fuente automática de prueba", sourceAuto: true, explanation: "La unidad larga va chica al lado del número.", icon: "Banknote" },
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
  elecciones_presidencial: {
    type: "elecciones", dur: 190,
    data: {
      country: "ar", kind: "presidencial", round: 1, year: "2027", phase: "preliminar", counted_pct: 87.4,
      source: "Cámara Nacional Electoral · escrutinio provisorio",
      candidates: [
        { name: "Lucía Ferrante", party: "Frente Horizonte", color: "#2F6BFF", photo_url: "https://picsum.photos/seed/cand1/700/900", pct: 38.4, votes: 9984000 },
        { name: "Martín Olivera", party: "Alianza Futuro Común", color: "#E0553A", photo_url: "https://picsum.photos/seed/cand2/700/900", pct: 31.7, votes: 8242000 },
        { name: "Camila Brandt", party: "Partido del Sur", color: "#2BB673", photo_url: "https://picsum.photos/seed/cand3/700/900", pct: 14.2, votes: 3692000 },
        { name: "Ignacio Duarte", party: "Convergencia Libre", color: "#F2B134", photo_url: null, pct: 9.6, votes: 2496000 },
        { name: "Sofía Navarro", party: "Unidad Federal", color: "#A66BFF", photo_url: "https://picsum.photos/seed/cand5/700/900", pct: 4.1, votes: 1066000 },
      ],
      states: [
        { id: "B", winner: 0, pct: 36.9, votes: 3920000 },
        { id: "C", winner: 1, pct: 41.2, votes: 610000 },
        { id: "S", winner: 1, pct: 40.3, votes: 1010000 },
        { id: "X", winner: 1, pct: 44.8, votes: 1290000 },
        { id: "M", winner: 0, pct: 39.5, votes: 590000 },
        { id: "T", winner: 0, pct: 45.1, votes: 540000 },
        { id: "E", winner: 1, pct: 37.7, votes: 430000 },
        { id: "N", winner: 0, pct: 48.2, votes: 260000 },
        { id: "H", winner: 0, pct: 43.6, votes: 310000 },
        { id: "W", winner: 0, pct: 41.4, votes: 300000 },
        { id: "A", winner: 0, pct: 42.3, votes: 420000 },
        { id: "Y", winner: 0, pct: 38.9, votes: 215000 },
        { id: "P", winner: 0, pct: 46.0, votes: 170000 },
        { id: "K", winner: 0, pct: 40.8, votes: 120000 },
        { id: "F", winner: 1, pct: 39.9, votes: 115000 },
        { id: "J", winner: 1, pct: 42.7, votes: 230000 },
        { id: "Q", winner: 2, pct: 35.1, votes: 260000 },
        { id: "U", winner: 2, pct: 37.4, votes: 210000 },
        { id: "R", winner: 1, pct: 36.2, votes: 250000 },
        { id: "Z", winner: 2, pct: 41.8, votes: 95000 },
        { id: "V", winner: 2, pct: 39.2, votes: 55000 },
        { id: "G", winner: 0, pct: 52.4, votes: 320000 },
        { id: "D", winner: 1, pct: 38.5, votes: 180000 },
        { id: "L", winner: 1, pct: 40.1, votes: 145000 }
      ],
    },
  },
  elecciones_arranque: {
    type: "elecciones", dur: 49,
    data: {
      country: "br", kind: "presidencial", round: 1, year: "2026", phase: "apertura", intro: "solo", counted_pct: 0,
      voting_hours: "08:00 a 17:00 hs", electorate: "156 millones de electores", source: "TSE · Tribunal Superior Eleitoral",
      candidates: brCands([]),
      states: [],
    },
  },
  elecciones_auto_br: {
    type: "elecciones", dur: 237,
    data: {
      country: "br", kind: "presidencial", round: 1, year: "2026", phase: "apertura", intro: "con", auto: "tse-br", counted_pct: 0,
      voting_hours: "08:00 a 17:00 hs", electorate: "156 millones de electores", source: "TSE · Tribunal Superior Eleitoral",
      candidates: brCands([]),
      states: [],
    },
  },
  elecciones_br_runoff: { type: "elecciones", dur: 330, data: { ...brBase, phase: "preliminar", outcome: "runoff", candidates: brCands() } },
  elecciones_br_ganador: { type: "elecciones", dur: 330, data: { ...brBase, phase: "preliminar", outcome: "winner", counted_pct: 97.2, candidates: brCands([52.6, 33.1, 5.2, 3.0, 2.4, 1.4, 0.8, 0.5, 0.4, 0.3, 0.2, 0.1]) } },
  elecciones_balotaje: {
    type: "elecciones", dur: 143,
    data: {
      country: "br", kind: "presidencial", round: 2, year: "2026", phase: "definitivo", counted_pct: 99.1, screens: { states: false },
      source: "TSE · Tribunal Superior Eleitoral",
      candidates: [
        { name: "Helena Vasconcelos", party: "Partido Nova Aliança", color: "#1FA85A", photo_url: "https://picsum.photos/seed/br1/700/900", pct: 52.8, votes: 61200000 },
        { name: "Rafael Montenegro", party: "Movimento Brasil Unido", color: "#2F6BFF", photo_url: "https://picsum.photos/seed/br2/700/900", pct: 47.2, votes: 54700000 },
      ],
      states: [],
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
  retro_youtube: {
    type: "retro", dur: 20,
    data: {
      media_url: "dQw4w9WgXcQ", media_kind: "youtube", chip: "PROGRAMA", year: "1987",
      title: "Un tema en la tele", subtitle: "Video de YouTube",
      text: "Retro con el video pegado por link de YouTube en vez de un archivo subido.",
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
  ultima_hora_dev: {
    type: "ultima_hora",
    data: { text: 'Corte de luz en el sur del AMBA: la distribuidora estima **reponer el servicio** en las próximas horas.', media_url: null, media_kind: null, developing: true },
  },
  ultima_hora_media_dev: {
    type: "ultima_hora",
    data: { text: 'Abogados de Cristina presentaron una **"prueba trascendente"** para refutar la condena.', media_url: "https://picsum.photos/seed/uh/640/640", media_kind: "image", developing: true },
  },
  obituario: {
    type: "obituario", dur: 15,
    data: { name: "Nombre Apellido", years: "1941 — 2026", role: "Locutor y periodista", photo_url: "https://picsum.photos/seed/obit/600/800",
      text: "Texto de prueba: una semblanza breve de dos o tres líneas para ver cómo se acomoda en la placa." },
  },
  declaraciones: {
    type: "declaraciones", dur: 15,
    data: { name: "Juan Pérez", role: "Ministro de Economía", place: "Casa Rosada", headline: "\"Vamos a bajar la inflación\"", quote: "Esta es una cita de prueba bastante larga para ver cómo queda la placa, con varias líneas de texto que ocupan bien la tarjeta azul y se escriben de a poco.", photo_url: "https://fffefldkgcylqfbvshet.supabase.co/storage/v1/object/public/media/1789625617327-6a1c6562-3dcf-4a08-a877-de6b667e2db0-piel-1---Avon.jpeg", interview_program: "EPA!" },
  },
  declaraciones_min: {
    type: "declaraciones", dur: 15,
    data: { name: "Laura Méndez", role: "Meteoróloga", place: "Buenos Aires", quote: "Con las primeras lluvias de la primavera vuelve el riesgo de anegamientos. Pedimos que no se tire basura a la calle.", photo_url: "https://picsum.photos/seed/retrato/800/800" },
  },
  publicidad_vertical: {
    type: "publicidad", dur: 15,
    data: { format: "vertical", media_url: "https://fffefldkgcylqfbvshet.supabase.co/storage/v1/object/public/media/1789625617327-6a1c6562-3dcf-4a08-a877-de6b667e2db0-piel-1---Avon.jpeg", media_kind: "image", logo_url: "https://fffefldkgcylqfbvshet.supabase.co/storage/v1/object/public/media/1789625617327-6a1c6562-3dcf-4a08-a877-de6b667e2db0-piel-1---Avon.jpeg", brand_qr_url: "https://fffefldkgcylqfbvshet.supabase.co/storage/v1/object/public/media/1789625617327-6a1c6562-3dcf-4a08-a877-de6b667e2db0-piel-1---Avon.jpeg" },
  },
  promos: {
    type: "promos", dur: 15,
    data: { title: "AVANCE", body: "Texto de la promo de prueba: una bajada que explica de qué trata el avance.", format: "916", video_id: "zSWdZVtXT7E" },
  },
  shorts_two: {
    type: "shorts", dur: 15,
    data: { count: 2, video1: "bxskJgShC38", video2: "bxskJgShC38", title: "Dos ideas para mejorar tu escritorio" },
  },
  promos_43: {
    type: "promos", dur: 15,
    data: { title: "Esta noche", body: "Un nuevo capítulo de EPA! a las 22, con invitados sorpresa y música en vivo.", format: "43", video_id: "zSWdZVtXT7E" },
  },
  informe: {
    type: "informe", dur: 22,
    data: { title: "Inflación en la Ciudad: qué pasó en julio", sec_per_slide: 5, slides: [1, 2, 3, 4, 5].map((k) => `https://picsum.photos/seed/inf${k}/1080/1350`) },
  },
  camaras: {
    type: "camaras", dur: 15,
    data: { camera_id: "demo", location: "Obelisco · CABA", ads: ["https://picsum.photos/seed/ad1/520/560", "https://picsum.photos/seed/ad2/520/560"] },
  },
  publicidad_sola: {
    type: "publicidad", dur: 15,
    data: { format: "vertical", media_url: "https://picsum.photos/seed/aviso/405/720", media_kind: "image" },
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

const DEMO_TIME = new Date().toISOString();
const API_DEMO = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function DemoStage({ id }: { id: string }) {
  const d = DEMOS[id] ?? DEMOS.ultima_hora;
  const DUR = d.dur ?? 8;
  const [scale, setScale] = React.useState(1);
  const [loop, setLoop] = React.useState(0);
  const [live, setLive] = React.useState<Record<string, unknown>>({});
  React.useEffect(() => {
    for (const k of ["dolar", "clima"]) {
      fetch(`${API_DEMO}/api/data/${k}`).then((r) => r.json()).then((d) => setLive((l) => ({ ...l, [k]: d?.payload }))).catch(() => {});
    }
  }, []);
  React.useEffect(() => {
    const fit = () => setScale(fitScale());
    fit();
    window.addEventListener("resize", fit);
    const t = setInterval(() => setLoop((n) => n + 1), (DUR + 1) * 1000);
    return () => { window.removeEventListener("resize", fit); clearInterval(t); };
  }, []);
  return (
    <div className="viewport">
      {/* ?freeze: sólo para revisar demos: salta las animaciones de entrada y muestra la placa ya armada. */}
      {P.has("freeze") && <style>{"*,*::before,*::after{animation-delay:0s!important;animation-duration:1ms!important;transition:none!important}"}</style>}
      <div className="stage" style={stageStyle(scale)}>
        <ItemView key={loop} type={d.type} data={d.data} durationSec={DUR} createdAt={DEMO_TIME} updatedAt={DEMO_TIME} liveData={live} />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {P.has("canal") ? <CanalOutput /> : radio ? <RadioOutput /> : demo ? <DemoStage id={demo} /> : draft ? <DraftPreview /> : preview ? <Preview id={preview} /> : <Output />}
  </React.StrictMode>,
);
