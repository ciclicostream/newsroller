import type { LinkConfig } from "./params";

// Lo que el arranque (main.tsx) ya averiguó antes de cargar la app, para no pedirlo dos veces
// ni mostrar un cuadro con la colección equivocada.
export const boot: { link: (LinkConfig & { slug: string }) | null; defaultCollection: string | null } = { link: null, defaultCollection: null };
