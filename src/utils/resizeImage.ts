// Redimensiona y comprime una imagen del usuario (foto de perfil) a un
// data URL pequeño que cabe en Firebase Auth.photoURL (~2 KB de límite
// práctico). Recorta a cuadrado centrado y devuelve jpeg.
//
// Cuando activemos Firebase Storage (paso 5-7 del roadmap futuro)
// reemplazaremos esta utilidad por un upload real con la URL pública.

export async function resizeImageToDataUrl(
  file: File,
  size = 96,
  quality = 0.55,
): Promise<string> {
  const img = await loadImage(file);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context no disponible');

  // Recorte cuadrado centrado: el lado más corto define el cuadrado.
  const minDim = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - minDim) / 2;
  const sy = (img.naturalHeight - minDim) / 2;
  ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

  return canvas.toDataURL('image/jpeg', quality);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
