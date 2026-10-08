// Fotos que se suben a las placas: se encuadran (recorte) y se guardan livianas. Una foto de celular de 4000 px se
// decodifica entera al aire (~48 MB de memoria) y congela cuadros; el output sólo necesita 1920 px.
//  - Máximo MAX_BYTES (1 MB) por foto: el encuadrador la achica/comprime hasta que entre, y si no puede, no se sube.
//  - Lado mayor máximo MAX_SIDE px (el lienzo del output es de 1920).
//  - JPEG (con la calidad que haga falta); si la imagen tiene transparencia (logos) se mantiene PNG.
//  - No se tocan los GIF, SVG, videos ni audios.
export const MAX_BYTES = 1024 * 1024;
export const MAX_SIDE = 2048;

export interface CropOpts { aspect?: number | null } // proporción inicial del encuadre (ancho/alto); sin valor = la original

export const isRaster = (f: File): boolean => /^image\/(jpeg|png|webp)$/.test(f.type);
export const fmtSize = (n: number): string => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export interface Rect { x: number; y: number; w: number; h: number }

async function hasTransparency(bmp: ImageBitmap): Promise<boolean> {
  const k = Math.min(1, 96 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) return false;
  g.drawImage(bmp, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < d.length; i += 4) if (d[i]! < 250) return true;
  return false;
}

const toBlob = (c: HTMLCanvasElement, type: string, q?: number) => new Promise<Blob | null>((res) => c.toBlob(res, type, q));

// Recorta `src` y lo codifica para que pese ≤ MAX_BYTES: baja la calidad y, si hace falta, el tamaño.
export async function encode(bmp: ImageBitmap, src: Rect, name: string, alpha: boolean): Promise<File> {
  let side = Math.min(MAX_SIDE, Math.max(src.w, src.h));
  for (;;) {
    const k = side / Math.max(src.w, src.h);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(src.w * k)); c.height = Math.max(1, Math.round(src.h * k));
    const g = c.getContext("2d");
    if (!g) throw new Error("No se pudo procesar la imagen.");
    if (!alpha) { g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); }
    g.imageSmoothingQuality = "high";
    g.drawImage(bmp, src.x, src.y, src.w, src.h, 0, 0, c.width, c.height);
    const base = name.replace(/\.[^.]+$/, "");
    if (alpha) {
      const b = await toBlob(c, "image/png");
      if (b && b.size <= MAX_BYTES) return new File([b], `${base}.png`, { type: "image/png" });
    } else {
      for (const q of [0.92, 0.85, 0.78, 0.7, 0.62]) {
        const b = await toBlob(c, "image/jpeg", q);
        if (b && b.size <= MAX_BYTES) return new File([b], `${base}.jpg`, { type: "image/jpeg" });
      }
    }
    side = Math.round(side * 0.85);
    if (side < 640) throw new Error(`No se pudo bajar la imagen a ${fmtSize(MAX_BYTES)}. Probá con otra foto o más chica.`);
  }
}

export async function openBitmap(file: File): Promise<ImageBitmap> {
  try { return await createImageBitmap(file); } catch { throw new Error("No se pudo leer la imagen. Usá un JPG, PNG o WebP."); }
}

// Sin encuadre: sólo la adapta al límite (si ya entra, queda tal cual). La usa el Banco, que sube de a muchas.
export async function autoCompress(file: File): Promise<File> {
  if (!isRaster(file)) return file;
  const bmp = await openBitmap(file);
  try {
    if (file.size <= MAX_BYTES && Math.max(bmp.width, bmp.height) <= MAX_SIDE) return file;
    return await encode(bmp, { x: 0, y: 0, w: bmp.width, h: bmp.height }, file.name, file.type !== "image/jpeg" && (await hasTransparency(bmp)));
  } finally { bmp.close(); }
}

// Resultado del encuadre: si no se recortó nada y ya entra en el límite, se sube el archivo original.
export async function cropAndEncode(file: File, rect: Rect): Promise<File> {
  const bmp = await openBitmap(file);
  try {
    const whole = rect.x <= 0.5 && rect.y <= 0.5 && Math.abs(rect.w - bmp.width) < 1 && Math.abs(rect.h - bmp.height) < 1;
    if (whole && file.size <= MAX_BYTES && Math.max(bmp.width, bmp.height) <= MAX_SIDE) return file;
    const alpha = file.type !== "image/jpeg" && (await hasTransparency(bmp));
    return await encode(bmp, rect, file.name, alpha);
  } finally { bmp.close(); }
}

// ---- Pedido al encuadrador (un modal global en el Layout) ----
export interface CropRequest { file: File; opts: CropOpts; resolve: (f: File) => void; reject: (e: Error) => void }
let hostMounted = 0;
export const mountCropHost = (): (() => void) => { hostMounted++; return () => { hostMounted--; }; };

export function requestCrop(file: File, opts: CropOpts = {}): Promise<File> {
  if (!hostMounted) return autoCompress(file); // sin modal disponible: sólo se comprime
  return new Promise<File>((resolve, reject) => {
    window.dispatchEvent(new CustomEvent<CropRequest>("ciclico:crop", { detail: { file, opts, resolve, reject } }));
  });
}
