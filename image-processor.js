export const PHOTO_MAX_EDGE = 1600;
export const PHOTO_JPEG_QUALITY = 0.82;
export const UNSUPPORTED_IMAGE_MESSAGE = "この画像形式は現在対応していません。JPEGまたはPNGを選択してください";

export function calculateContainedSize(width, height, maxEdge = PHOTO_MAX_EDGE) {
  if (!(width > 0) || !(height > 0)) throw new Error("画像サイズを取得できません");
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("画像をJPEGへ変換できませんでした"));
    }, type, quality);
  });
}

export async function resizePhoto(file, options = {}) {
  if (!(file instanceof Blob) || !file.size) throw new Error("画像ファイルを選択してください");
  const maxEdge = options.maxEdge ?? PHOTO_MAX_EDGE;
  const quality = options.quality ?? PHOTO_JPEG_QUALITY;
  const createBitmap = options.createBitmap ?? globalThis.createImageBitmap;
  const createCanvas = options.createCanvas ?? (() => document.createElement("canvas"));
  if (typeof createBitmap !== "function") throw new Error(UNSUPPORTED_IMAGE_MESSAGE);
  let bitmap;
  try {
    bitmap = await createBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(UNSUPPORTED_IMAGE_MESSAGE);
  }

  try {
    const size = calculateContainedSize(bitmap.width, bitmap.height, maxEdge);
    const canvas = createCanvas();
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("画像を処理できませんでした");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await canvasToBlob(canvas, "image/jpeg", quality);
    return {
      blob,
      width: size.width,
      height: size.height,
      type: "image/jpeg",
      originalName: typeof file.name === "string" ? file.name : ""
    };
  } finally {
    bitmap.close();
  }
}
