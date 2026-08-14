import { drawAdjustedSnsPhoto } from "./sns-photo-adjustment.js";

export const SNS_CARD_WIDTH = 1080;
export const SNS_CARD_HEIGHT = 1350;
export const SNS_CARD_CHARACTER_URL = "assets/otomo-character-fishing-back-final.png";
export const SNS_CARD_WORDMARK_URL = "assets/otomo-fishing-wordmark.png";
export const SNS_CARD_LAYOUT = Object.freeze({
  photo: Object.freeze({ x: 43, y: 43, width: 994, height: 740, radius: 30, borderWidth: 6 }),
  wordmark: Object.freeze({ x: 650, y: 1195, width: 390 }),
  character: Object.freeze({ x: 580, y: 900, width: 400 })
});
export const SNS_CARD_THEMES = Object.freeze({
  cream: Object.freeze({ label: "クリーム", background: "#F7F3EA", photoFrame: "#EEE7D9", text: "#111820", rule: "#C7C0B3", icon: "#173E67" }),
  mint: Object.freeze({ label: "ミント", background: "#E1F0EC", photoFrame: "#CFE3DD", text: "#15333A", rule: "#B5D0C8", icon: "#1F6F6A" }),
  sky: Object.freeze({ label: "スカイ", background: "#E4EDF5", photoFrame: "#D0DEE9", text: "#172D40", rule: "#B8CAD8", icon: "#2D6080" }),
  sand: Object.freeze({ label: "サンド", background: "#F0E4D5", photoFrame: "#DFCFBC", text: "#392B23", rule: "#CAB8A3", icon: "#6E5B35" })
});
export const SNS_CARD_DEFAULT_THEME = "cream";
export const SNS_CARD_PHOTO_FILTER = Object.freeze({ canvas: "saturate(92%) contrast(96%) sepia(6%) brightness(102%)", warmOverlay: "rgba(244, 218, 178, 0.055)" });
const FONT = '"Hiragino Sans", "Yu Gothic UI", sans-serif';

export function normalizeSnsCardTheme(value) { return Object.hasOwn(SNS_CARD_THEMES, value) ? value : SNS_CARD_DEFAULT_THEME; }

function loadImage(source, ImageConstructor, label, optional = false) {
  if (!source || typeof ImageConstructor !== "function") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const image = new ImageConstructor();
    image.onload = () => resolve(image);
    image.onerror = () => optional ? resolve(null) : reject(new Error(`${label}を読み込めませんでした`));
    image.src = source;
  });
}
function path(context, { x, y, width, height, radius }) {
  context.beginPath(); context.moveTo(x + radius, y); context.lineTo(x + width - radius, y); context.quadraticCurveTo(x + width, y, x + width, y + radius); context.lineTo(x + width, y + height - radius); context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height); context.lineTo(x + radius, y + height); context.quadraticCurveTo(x, y + height, x, y + height - radius); context.lineTo(x, y + radius); context.quadraticCurveTo(x, y, x + radius, y); context.closePath();
}
function fit(context, value, width) { const chars = Array.from(value); while (chars.length && context.measureText(chars.join("") + "…").width > width) chars.pop(); return context.measureText(value).width <= width ? value : chars.join("") + "…"; }

export async function renderSnsCardCanvas(canvas, model, photoUrl, adjustment, themeId, options = {}) {
  canvas.width = SNS_CARD_WIDTH; canvas.height = SNS_CARD_HEIGHT;
  const context = canvas.getContext("2d"); if (!context) throw new Error("このブラウザではカードを描画できません");
  const ImageConstructor = options.ImageConstructor || globalThis.Image;
  const [photo, wordmark, character] = await Promise.all([
    loadImage(photoUrl, ImageConstructor, "カードの写真", true),
    loadImage(options.wordmarkUrl || SNS_CARD_WORDMARK_URL, ImageConstructor, "Otomo Fishingロゴ"),
    loadImage(options.characterUrl || SNS_CARD_CHARACTER_URL, ImageConstructor, "Otomoの画像")
  ]);
  const theme = SNS_CARD_THEMES[normalizeSnsCardTheme(themeId)];
  context.fillStyle = theme.background; context.fillRect(0, 0, SNS_CARD_WIDTH, SNS_CARD_HEIGHT);
  if (photo) {
    const frame = SNS_CARD_LAYOUT.photo;
    if (typeof context.save !== "function") { drawAdjustedSnsPhoto(context, photo, frame.width, frame.height, adjustment); }
    else { context.save(); context.fillStyle = theme.photoFrame; path(context, frame); context.fill(); context.clip(); context.translate(frame.x, frame.y);
    if ("filter" in context) context.filter = SNS_CARD_PHOTO_FILTER.canvas;
    drawAdjustedSnsPhoto(context, photo, frame.width, frame.height, adjustment);
    if ("filter" in context) context.filter = "none";
    context.fillStyle = SNS_CARD_PHOTO_FILTER.warmOverlay; context.fillRect(0, 0, frame.width, frame.height); context.restore();
    context.save(); context.strokeStyle = theme.photoFrame; context.lineWidth = frame.borderWidth; path(context, frame); context.stroke(); context.restore(); }
  }
  const left = 59, right = 59, top = 828; context.textBaseline = "top"; context.fillStyle = theme.text; context.font = `700 80px ${FONT}`;
  context.fillText(fit(context, model.name, 645), left, top); context.font = `700 60px ${FONT}`; context.textAlign = "right"; context.fillText(fit(context, model.size, 285), 1021, top + 13); context.textAlign = "left";
  context.strokeStyle = theme.rule; context.lineWidth = 2; context.beginPath(); context.moveTo(left, top + 97); context.lineTo(1021, top + 97); context.stroke();
  let rowY = top + 123; for (const row of model.rows) { if (rowY > 1160) break; context.fillStyle = theme.icon; context.font = `700 37px ${FONT}`; context.textAlign = "center"; context.fillText(row.icon, left + 28, rowY); context.fillStyle = theme.text; context.font = `400 35px ${FONT}`; context.textAlign = "left"; context.fillText(fit(context, row.value, 500), left + 75, rowY); rowY += 48; }
  if (wordmark) { const l = SNS_CARD_LAYOUT.wordmark; context.drawImage(wordmark, l.x, l.y, l.width, l.width * ((wordmark.naturalHeight || wordmark.height) / (wordmark.naturalWidth || wordmark.width))); }
  if (character) { const l = SNS_CARD_LAYOUT.character; context.drawImage(character, l.x, l.y, l.width, l.width * ((character.naturalHeight || character.height) / (character.naturalWidth || character.width))); }
  return canvas;
}
