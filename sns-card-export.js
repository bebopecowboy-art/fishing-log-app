import { getCardViewModel } from "./sns-card.js";
import { drawAdjustedSnsPhoto } from "./sns-photo-adjustment.js";

export const SNS_CARD_WIDTH = 1080;
export const SNS_CARD_HEIGHT = 1350;
export const SNS_CARD_MIME_TYPE = "image/jpeg";
export const SNS_CARD_JPEG_QUALITY = 0.92;

const PHOTO_HEIGHT = 783;
const FONT_FAMILY = '"Hiragino Sans", "Yu Gothic UI", sans-serif';

function loadImage(source, ImageConstructor = globalThis.Image) {
  if (!source) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const image = new ImageConstructor();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("カードの写真を読み込めませんでした"));
    image.src = source;
  });
}

function fitText(context, value, maxWidth) {
  if (context.measureText(value).width <= maxWidth) return value;
  const characters = Array.from(value);
  while (characters.length && context.measureText(`${characters.join("")}…`).width > maxWidth) characters.pop();
  return `${characters.join("")}…`;
}

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
  const context = canvas.getContext("2d");
  if (!context) throw new Error("このブラウザではJPEG画像を生成できません");

  const image = await loadImage(photoUrl, options.ImageConstructor);
  context.fillStyle = "#fbfbf8";
  context.fillRect(0, 0, SNS_CARD_WIDTH, SNS_CARD_HEIGHT);
  if (image) drawAdjustedSnsPhoto(context, image, SNS_CARD_WIDTH, PHOTO_HEIGHT, log.snsPhotoAdjustment);

  const model = getCardViewModel(log, visibility);
  const left = 59;
  const right = 59;
  const top = PHOTO_HEIGHT + 45;
  context.textBaseline = "top";
  context.fillStyle = "#15181a";
  context.font = `700 80px ${FONT_FAMILY}`;
  const sizeWidth = 285;
  context.fillText(fitText(context, model.name, SNS_CARD_WIDTH - left - right - sizeWidth - 32), left, top);
  context.font = `700 60px ${FONT_FAMILY}`;
  context.textAlign = "right";
  context.fillText(fitText(context, model.size, sizeWidth), SNS_CARD_WIDTH - right, top + 13);
  context.textAlign = "left";
  context.strokeStyle = "#c8cccd";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(left, top + 97);
  context.lineTo(SNS_CARD_WIDTH - right, top + 97);
  context.stroke();

  let rowY = top + 123;
  context.font = `400 35px ${FONT_FAMILY}`;
  for (const row of model.rows) {
    if (rowY > SNS_CARD_HEIGHT - 105) break;
    context.fillStyle = "#102e5d";
    context.font = `700 37px ${FONT_FAMILY}`;
    context.textAlign = "center";
    context.fillText(row.icon, left + 28, rowY);
    context.fillStyle = "#15181a";
    context.font = `400 35px ${FONT_FAMILY}`;
    context.textAlign = "left";
    context.fillText(fitText(context, row.value, SNS_CARD_WIDTH - left - right - 75), left + 75, rowY);
    rowY += 48;
  }

  context.fillStyle = "#555b5f";
  context.font = `400 30px ${FONT_FAMILY}`;
  context.textAlign = "right";
  context.fillText(model.appName, SNS_CARD_WIDTH - right, SNS_CARD_HEIGHT - 59);
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
