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

export async function renderSnsCard(container, log, photoUrl, visibility, adjustment = log.snsPhotoAdjustment, themeId = "cream") {
  const model = getCardViewModel(log, visibility);
  let canvas = container.querySelector(".sns-card-photo");
  if (!canvas) { canvas = document.createElement("canvas"); canvas.className = "sns-card-photo"; canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", `${model.name}のSNSカード`); container.replaceChildren(canvas); }
  const token = Symbol("sns-card-render"); canvas.snsCardRenderToken = token;
  await renderSnsCardCanvas(canvas, model, photoUrl, normalizeSnsPhotoAdjustment(adjustment), themeId);
  return canvas.snsCardRenderToken === token ? canvas : null;
}
import { normalizeSnsPhotoAdjustment } from "./sns-photo-adjustment.js";
import { renderSnsCardCanvas } from "./sns-card-renderer.js";
