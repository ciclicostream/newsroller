// Avisos flotantes cortos (los muestra <Toaster/> en el Layout).
export type ToastKind = "ok" | "error" | "info";
export const toast = (msg: string, kind: ToastKind = "info") =>
  window.dispatchEvent(new CustomEvent("ciclico:toast", { detail: { msg, kind } }));
