import { api } from "./api";
import { supabase } from "./supabase";

export interface ProfileFields { first_name: string | null; last_name: string | null; phone: string | null; avatar_url: string | null }

export const profileApi = {
  update: (p: Partial<ProfileFields>) => api.patch<ProfileFields>("/api/me/profile", p),
};

// Recorta al centro en cuadrado y reduce (la foto de perfil no necesita más de 512px).
async function toSquareJpeg(file: File, size = 512): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(size, side);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no se pudo procesar la imagen"))), "image/jpeg", 0.88));
}

// Sube la foto al bucket de perfiles (carpeta propia) y devuelve la URL pública.
export async function uploadAvatar(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("La foto tiene que ser una imagen.");
  const blob = await toSquareJpeg(file);
  const sign = await api.post<{ bucket: string; path: string; token: string }>("/api/me/avatar/sign", {});
  const { error } = await supabase.storage.from(sign.bucket).uploadToSignedUrl(sign.path, sign.token, blob, { contentType: "image/jpeg" });
  if (error) throw new Error(`subida de la foto: ${error.message}`);
  return supabase.storage.from(sign.bucket).getPublicUrl(sign.path).data.publicUrl;
}
