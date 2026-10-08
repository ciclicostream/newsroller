// Mensajes de error en español y explicados. Las librerías (el navegador, Supabase) devuelven textos en inglés
// que no le dicen nada a quien edita: acá se traducen y se aclara qué pasó y qué hacer. Lo que no se reconoce
// (por ejemplo, los mensajes del propio server, que ya vienen en español) queda como está.
const RULES: [RegExp, string][] = [
  [/failed to fetch|networkerror|network request failed|load failed|fetch failed|err_connection|err_internet|err_network/i,
    "No se pudo conectar con el servidor. Puede ser que se haya cortado internet o que el servidor no responda en este momento. No es un problema de lo que cargaste: esperá unos segundos y volvé a intentar."],
  [/aborted|timed? ?out|timeout/i, "La conexión tardó demasiado en responder. Revisá tu internet y volvé a intentar."],
  [/invalid login credentials/i, "El email o la contraseña no son correctos."],
  [/email not confirmed/i, "Todavía no confirmaste tu email. Revisá tu casilla."],
  [/jwt expired|invalid jwt|token has expired|session.*(expired|not found)|refresh token/i, "Tu sesión venció. Volvé a ingresar."],
  [/row-level security|not authorized|unauthorized|permission denied|insufficient/i, "No tenés permiso para hacer esto. Si te corresponde, pedile acceso a un administrador."],
  [/exceeded the maximum allowed size|payload too large|entity too large|file size/i, "El archivo es demasiado pesado para subirlo. Probá con uno más liviano."],
  [/mime type.*not supported|invalid mime|unsupported (media|file)/i, "Ese tipo de archivo no está permitido."],
  [/already exists|duplicate/i, "Ya existe un archivo con ese nombre. Probá de nuevo."],
  [/rate limit|too many requests|over_email_send_rate_limit/i, "Hiciste demasiados intentos seguidos. Esperá un rato y probá de nuevo."],
  [/should be different from the old password/i, "La contraseña nueva tiene que ser distinta de la actual."],
  [/password should be at least|password is too short/i, "La contraseña es demasiado corta."],
  [/unable to validate email|invalid email|email address.*invalid/i, "El email no es válido."],
  [/user not found/i, "No existe un usuario con ese email."],
];

// `ctx` antepone qué se estaba haciendo cuando el mensaje no se reconoce ("No se pudo subir el archivo: …").
export function friendlyError(raw: unknown, ctx?: string): string {
  const msg = raw instanceof Error ? raw.message : typeof raw === "string" ? raw : "";
  const hit = RULES.find(([re]) => re.test(msg));
  if (hit) return hit[1];
  if (!msg) return ctx ? `${ctx}.` : "Ocurrió un error. Volvé a intentar.";
  return ctx ? `${ctx}: ${msg}` : msg;
}
