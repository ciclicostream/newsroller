// Lo que el arranque (main.tsx) ya averiguó antes de cargar la app, para no pedirlo dos veces
// ni mostrar un cuadro con el estilo equivocado.
export const boot: { style: string | null } = { style: null };
