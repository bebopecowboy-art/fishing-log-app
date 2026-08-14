export const SNS_CARD_DEFAULTS = Object.freeze({
  place: true,
  tide: true,
  weather: true,
  method: false,
  memo: true,
  date: false
});

function clean(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" ? value.trim() : "";
}

export function truncateText(value, maxLength = 60) {
  const characters = Array.from(clean(value));
  return characters.length <= maxLength ? characters.join("") : `${characters.slice(0, maxLength).join("")}…`;
}

export function formatCardDate(value) {
  const match = clean(value).match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (!match) return clean(value);
  return `${match[1]}.${match[2].padStart(2, "0")}.${match[3].padStart(2, "0")}`;
}

export function getCardViewModel(log = {}, visibility = SNS_CARD_DEFAULTS) {
  const temperature = clean(log.temperature);
  const weather = [clean(log.weather), temperature ? `${temperature}℃` : ""].filter(Boolean).join(" ");
  const tide = [clean(log.tide?.tideCycle), clean(log.tide?.trendLabel)].filter(Boolean).join("・");
  const optionalRows = [
    { key: "place", icon: "●", label: "場所", value: clean(log.place) },
    { key: "tide", icon: "≋", label: "潮", value: tide },
    { key: "weather", icon: "☀", label: "天気", value: weather },
    { key: "method", icon: "□", label: "釣り方", value: clean(log.method) },
    { key: "memo", icon: "✎", label: "メモ", value: truncateText(log.memo) },
    { key: "date", icon: "◇", label: "日付", value: formatCardDate(log.date) }
  ].filter((row) => visibility[row.key] && row.value);

  return {
    name: clean(log.name) || "魚種未記録",
    size: clean(log.size) ? `${clean(log.size)}cm` : "サイズ未記録",
    appName: "Fishing Log",
    rows: optionalRows
  };
}

export function renderSnsCardPhoto(canvas, photoUrl, adjustment) {
  const image = new Image();
  const renderId = Symbol("sns-photo-render");
  canvas.snsPhotoRenderId = renderId;
  image.onload = () => {
    if (canvas.snsPhotoRenderId !== renderId) return;
    canvas.snsPhotoImage = image;
    redrawSnsCardPhoto(canvas, adjustment);
  };
  image.onerror = () => {
    canvas.setAttribute("aria-label", "釣果写真を読み込めませんでした");
  };
  image.src = photoUrl;
}

export function redrawSnsCardPhoto(canvas, adjustment) {
  if (!canvas?.snsPhotoImage) return false;
  const context = canvas.getContext("2d");
  drawAdjustedSnsPhoto(context, canvas.snsPhotoImage, canvas.width, canvas.height, normalizeSnsPhotoAdjustment(adjustment));
  return true;
}

export function renderSnsCard(container, log, photoUrl, visibility, adjustment = log.snsPhotoAdjustment) {
  const model = getCardViewModel(log, visibility);
  container.replaceChildren();

  const photo = document.createElement("canvas");
  photo.className = "sns-card-photo";
  photo.width = 1080;
  photo.height = 783;
  photo.setAttribute("role", "img");
  photo.setAttribute("aria-label", `${model.name}の釣果写真`);
  renderSnsCardPhoto(photo, photoUrl, adjustment);

  const information = document.createElement("div");
  information.className = "sns-card-information";
  const headline = document.createElement("div");
  headline.className = "sns-card-headline";
  const fishName = document.createElement("strong");
  fishName.className = "sns-card-fish";
  fishName.textContent = model.name;
  const size = document.createElement("strong");
  size.className = "sns-card-size";
  size.textContent = model.size;
  headline.append(fishName, size);
  information.append(headline);

  const rows = document.createElement("div");
  rows.className = "sns-card-rows";
  model.rows.forEach((item) => {
    const row = document.createElement("p");
    row.className = `sns-card-row sns-card-row-${item.key}`;
    const icon = document.createElement("span");
    icon.className = "sns-card-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = item.icon;
    const value = document.createElement("span");
    value.className = "sns-card-value";
    value.textContent = item.value;
    row.append(icon, value);
    rows.append(row);
  });
  information.append(rows);

  const brand = document.createElement("span");
  brand.className = "sns-card-brand";
  brand.textContent = model.appName;
  information.append(brand);
  const character = document.createElement("img");
  character.className = "sns-card-character";
  character.src = "assets/otomo-character-fishing-back-final.png";
  character.alt = "";
  character.setAttribute("aria-hidden", "true");
  information.append(character);
  container.append(photo, information);
}
import { drawAdjustedSnsPhoto, normalizeSnsPhotoAdjustment } from "./sns-photo-adjustment.js";
