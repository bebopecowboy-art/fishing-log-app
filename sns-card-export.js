import { getCardViewModel } from "./sns-card.js";
import { renderSnsCardCanvas, SNS_CARD_HEIGHT, SNS_CARD_WIDTH } from "./sns-card-renderer.js";

export { SNS_CARD_HEIGHT, SNS_CARD_WIDTH } from "./sns-card-renderer.js";
export { SNS_CARD_CHARACTER_URL, SNS_CARD_LAYOUT, SNS_CARD_PHOTO_FILTER, SNS_CARD_THEMES, SNS_CARD_WORDMARK_URL } from "./sns-card-renderer.js";
export const SNS_CARD_MIME_TYPE = "image/jpeg";
export const SNS_CARD_JPEG_QUALITY = 0.92;

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("JPEG画像を生成できませんでした"));
    }, SNS_CARD_MIME_TYPE, SNS_CARD_JPEG_QUALITY);
  });
}

export function createSnsCardFilename(log = {}) {
  const date = String(log.date || "").replace(/[^0-9]/g, "").slice(0, 8);
  const name = String(log.name || "catch").trim().replace(/[\\/:*?"<>|]/g, "-").slice(0, 40) || "catch";
  return `fishing-log-${date ? `${date}-` : ""}${name}.jpg`;
}

export function canShareSnsCard(navigatorObject = globalThis.navigator, file) {
  if (!navigatorObject || typeof navigatorObject.share !== "function") return false;
  if (typeof navigatorObject.canShare !== "function") return false;
  try {
    return navigatorObject.canShare({ files: [file] });
  } catch (_error) {
    return false;
  }
}

export function shareSnsCardFile(navigatorObject, file, metadata = {}) {
  if (!canShareSnsCard(navigatorObject, file)) {
    return Promise.reject(new Error("この環境では画像共有に対応していません"));
  }
  return navigatorObject.share({
    files: [file],
    ...(metadata.title ? { title: metadata.title } : {}),
    ...(metadata.text ? { text: metadata.text } : {})
  });
}

export async function generateSnsCardJpeg(log, photoUrl, visibility, options = {}) {
  const documentObject = options.documentObject || globalThis.document;
  const canvas = documentObject.createElement("canvas");
  canvas.width = SNS_CARD_WIDTH;
  canvas.height = SNS_CARD_HEIGHT;
  const model = getCardViewModel(log, visibility);
  await renderSnsCardCanvas(canvas, model, photoUrl, log.snsPhotoAdjustment, options.themeId, options);
  return canvasToBlob(canvas);
}

export function downloadSnsCard(blob, filename, documentObject = globalThis.document, urlObject = globalThis.URL) {
  const url = urlObject.createObjectURL(blob);
  const link = documentObject.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  documentObject.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => urlObject.revokeObjectURL(url), 1000);
}
