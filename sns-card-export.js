import { getCardViewModel } from "./sns-card.js";
import { drawAdjustedSnsPhoto } from "./sns-photo-adjustment.js";

export const SNS_CARD_WIDTH = 1080;
export const SNS_CARD_HEIGHT = 1350;
export const SNS_CARD_MIME_TYPE = "image/jpeg";
export const SNS_CARD_JPEG_QUALITY = 0.92;
export const SNS_CARD_LAYOUT = Object.freeze({
  photo: Object.freeze({ x: 43, y: 43, width: 994, height: 740, radius: 30, borderWidth: 6, borderColor: "#eee7d9" }),
  character: Object.freeze({ x: 410, y: 700, width: 680 })
});
export const SNS_CARD_PHOTO_FILTER = Object.freeze({
  canvas: "saturate(92%) contrast(96%) sepia(6%) brightness(102%)",
  warmOverlay: "rgba(244, 218, 178, 0.055)"
});
export const SNS_CARD_CHARACTER_URL = "assets/otomo-character-fishing-back-final.png";

const PHOTO_HEIGHT = SNS_CARD_LAYOUT.photo.y + SNS_CARD_LAYOUT.photo.height;
const FONT_FAMILY = '"Hiragino Sans", "Yu Gothic UI", sans-serif';

function loadImage(source, ImageConstructor = globalThis.Image, label = "画像") {
  if (!source) return Promise.resolve(null);
  if (typeof ImageConstructor !== "function") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const image = new ImageConstructor();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`${label}を読み込めませんでした`));
    image.src = source;
  });
}

function roundedRectPath(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function drawFramedPhoto(context, image, adjustment) {
  const frame = SNS_CARD_LAYOUT.photo;
  if (typeof context.save !== "function") {
    drawAdjustedSnsPhoto(context, image, frame.width, frame.height, adjustment);
    return;
  }
  context.save();
  context.fillStyle = frame.borderColor;
  roundedRectPath(context, frame.x, frame.y, frame.width, frame.height, frame.radius);
  context.fill();
  context.clip();
  context.translate(frame.x, frame.y);
  if ("filter" in context) context.filter = SNS_CARD_PHOTO_FILTER.canvas;
  drawAdjustedSnsPhoto(context, image, frame.width, frame.height, adjustment);
  if ("filter" in context) context.filter = "none";
  context.fillStyle = SNS_CARD_PHOTO_FILTER.warmOverlay;
  context.fillRect(0, 0, frame.width, frame.height);
  context.restore();
  context.save();
  context.strokeStyle = frame.borderColor;
  context.lineWidth = frame.borderWidth;
  roundedRectPath(context, frame.x, frame.y, frame.width, frame.height, frame.radius);
  context.stroke();
  context.restore();
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

  const ImageConstructor = options.ImageConstructor;
  const [image, character] = await Promise.all([
    loadImage(photoUrl, ImageConstructor, "カードの写真").catch(() => null),
    loadImage(options.characterUrl || SNS_CARD_CHARACTER_URL, ImageConstructor, "Otomoの画像")
  ]);
  context.fillStyle = "#fbfbf8";
  context.fillRect(0, 0, SNS_CARD_WIDTH, SNS_CARD_HEIGHT);
  if (image) drawFramedPhoto(context, image, log.snsPhotoAdjustment);

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
    context.fillText(fitText(context, row.value, 620), left + 75, rowY);
    rowY += 48;
  }

  context.fillStyle = "#555b5f";
  context.font = `400 30px ${FONT_FAMILY}`;
  context.textAlign = "right";
  context.fillText(model.appName, SNS_CARD_WIDTH - right, SNS_CARD_HEIGHT - 59);
  const characterLayout = SNS_CARD_LAYOUT.character;
  if (character) {
    const characterHeight = characterLayout.width * ((character.naturalHeight || character.height) / (character.naturalWidth || character.width));
    context.drawImage(character, characterLayout.x, characterLayout.y, characterLayout.width, characterHeight);
  }
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
