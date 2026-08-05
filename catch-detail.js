function textOrFallback(value, fallback = "未記録") {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function eventTime(event) {
  if (!event?.time) return "";
  const date = new Date(event.time);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

export function getCatchDetail(log = {}) {
  const temperature = textOrFallback(log.temperature, "");
  const weather = [textOrFallback(log.weather, ""), temperature ? `${temperature}℃` : ""]
    .filter(Boolean)
    .join(" / ");

  return {
    date: textOrFallback(log.date),
    time: textOrFallback(log.time),
    place: textOrFallback(log.place),
    name: textOrFallback(log.name, "魚種未記録"),
    size: textOrFallback(log.size, "") ? `${textOrFallback(log.size, "")} cm` : "未記録",
    weather: weather || "未記録",
    method: textOrFallback(log.method),
    memo: textOrFallback(log.memo, ""),
    tide: getTideDetail(log.tide)
  };
}

export function getTideDetail(tide) {
  if (!tide || typeof tide !== "object") {
    return { available: false, summary: "保存時の潮情報はありません" };
  }

  const stationName = textOrFallback(tide.station?.name, "");
  const cycle = textOrFallback(tide.tideCycle, "");
  const trend = textOrFallback(tide.trendLabel, "");
  const height = Number.isFinite(Number(tide.estimatedHeight))
    ? `約${Number(tide.estimatedHeight)} cm`
    : "";
  const summary = [cycle, trend, height].filter(Boolean).join("・");
  const previousLabel = tide.previousExtreme?.type === "high" ? "満潮" : tide.previousExtreme?.type === "low" ? "干潮" : "";
  const nextLabel = tide.nextExtreme?.type === "high" ? "満潮" : tide.nextExtreme?.type === "low" ? "干潮" : "";
  const previousHeight = textOrFallback(tide.previousExtreme?.height, "不明");
  const nextHeight = textOrFallback(tide.nextExtreme?.height, "不明");

  return {
    available: Boolean(summary || stationName),
    summary: summary || "保存時の潮情報はありません",
    station: stationName,
    previous: previousLabel && eventTime(tide.previousExtreme)
      ? `直前の${previousLabel} ${eventTime(tide.previousExtreme)}（${previousHeight} cm）`
      : "",
    next: nextLabel && eventTime(tide.nextExtreme)
      ? `次の${nextLabel} ${eventTime(tide.nextExtreme)}（${nextHeight} cm）`
      : ""
  };
}

function appendDetailRow(container, label, value) {
  const row = document.createElement("div");
  row.className = "detail-row";
  const term = document.createElement("dt");
  term.textContent = label;
  const description = document.createElement("dd");
  description.textContent = value;
  row.append(term, description);
  container.append(row);
}

export function renderCatchDetail(container, title, log, options = {}) {
  const detail = getCatchDetail(log);
  title.textContent = detail.name;
  container.replaceChildren();

  if (options.photoUrl) {
    const figure = document.createElement("figure");
    figure.className = "detail-photo-frame";
    const photo = document.createElement("img");
    photo.className = "detail-photo";
    photo.src = options.photoUrl;
    photo.alt = `${detail.name}の釣果写真`;
    figure.append(photo);
    container.append(figure);
  }

  const primary = document.createElement("dl");
  primary.className = "detail-list";
  appendDetailRow(primary, "日付", detail.date);
  appendDetailRow(primary, "時間", detail.time);
  appendDetailRow(primary, "場所", detail.place);
  appendDetailRow(primary, "魚種", detail.name);
  appendDetailRow(primary, "サイズ", detail.size);
  appendDetailRow(primary, "天気", detail.weather);
  appendDetailRow(primary, "釣り方", detail.method);
  container.append(primary);

  const tideSection = document.createElement("section");
  tideSection.className = "detail-tide";
  const tideHeading = document.createElement("h3");
  tideHeading.textContent = "保存時の潮情報";
  const tideSummary = document.createElement("p");
  tideSummary.className = "detail-tide-summary";
  tideSummary.textContent = detail.tide.summary;
  tideSection.append(tideHeading, tideSummary);
  if (detail.tide.station) appendDetailRow(tideSection, "基準地点", detail.tide.station);
  if (detail.tide.previous) appendDetailRow(tideSection, "直前", detail.tide.previous);
  if (detail.tide.next) appendDetailRow(tideSection, "次回", detail.tide.next);
  container.append(tideSection);

  if (detail.memo) {
    const memoSection = document.createElement("section");
    memoSection.className = "detail-memo";
    const memoHeading = document.createElement("h3");
    memoHeading.textContent = "メモ";
    const memo = document.createElement("p");
    memo.textContent = detail.memo;
    memoSection.append(memoHeading, memo);
    container.append(memoSection);
  }

  const cardButton = document.createElement("button");
  cardButton.className = "button button-secondary detail-card-button";
  cardButton.type = "button";
  cardButton.textContent = "SNSカードを作る";
  cardButton.addEventListener("click", () => options.onCreateCard?.());
  container.append(cardButton);

  const editButton = document.createElement("button");
  editButton.className = "button button-secondary detail-card-button";
  editButton.type = "button";
  editButton.textContent = "編集";
  editButton.addEventListener("click", () => options.onEdit?.());
  container.append(editButton);
}
