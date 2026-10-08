import { supabase } from "./supabase";
import { friendlyError } from "./errors";

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader()),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(friendlyError(e)); // sin conexión con el server ("Failed to fetch")
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = (data as { code?: string }).code;
    // Sesión cerrada por inactividad o usuario desactivado: el AuthProvider lo escucha y saca a la persona.
    if ((res.status === 401 && code === "idle") || (res.status === 403 && code === "disabled")) {
      window.dispatchEvent(new CustomEvent("ciclico:session-ended", { detail: code }));
    }
    throw new Error((data as { error?: string }).error ?? (res.status >= 500
      ? `El servidor tuvo un problema (error ${res.status}). Probá de nuevo en unos segundos; si sigue, avisale a un administrador.`
      : `El servidor no pudo completar la acción (error ${res.status}).`));
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};
