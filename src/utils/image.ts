// src/utils/image.ts
export async function compressImage(
  file: File,
  maxW = 1280,
  quality = 0.85
): Promise<Blob> {
  // 画像以外はそのまま返す
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file);
  const ratio = bitmap.width > maxW ? maxW / bitmap.width : 1;
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);

  return await new Promise<Blob>((res) =>
    canvas.toBlob((b) => res(b || file), "image/jpeg", quality)
  );
}
