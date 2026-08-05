import { deriveTideState, formatTime, getTideCycle } from "./domain.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function minutesFromStart(date, dateKey) {
  return (date - new Date(`${dateKey}T00:00:00+09:00`)) / 60000;
}

export function renderTideGraph(svg, tideDay, at) {
  svg.replaceChildren();
  const width = 640;
  const height = 180;
  const padding = { left: 34, right: 18, top: 20, bottom: 28 };
  const values = tideDay.series.map((point) => point.height);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const x = (date) => padding.left + Math.min(1440, Math.max(0, minutesFromStart(date, tideDay.date))) / 1440 * (width - padding.left - padding.right);
  const y = (value) => padding.top + (max - value) / range * (height - padding.top - padding.bottom);

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `${tideDay.station.name}の${tideDay.date}の推定潮位グラフ`);

  [0, 6, 12, 18, 24].forEach((hour) => {
    const gridX = padding.left + hour / 24 * (width - padding.left - padding.right);
    svg.append(svgElement("line", { x1: gridX, x2: gridX, y1: padding.top, y2: height - padding.bottom, class: "tide-grid" }));
    const label = svgElement("text", { x: gridX, y: height - 7, class: "tide-axis-label", "text-anchor": "middle" });
    label.textContent = `${hour}`;
    svg.append(label);
  });

  const pathData = tideDay.series.map((point, index) => `${index ? "L" : "M"}${x(point.time).toFixed(1)},${y(point.height).toFixed(1)}`).join(" ");
  svg.append(svgElement("path", { d: pathData, class: "tide-area" }));
  svg.append(svgElement("path", { d: pathData, class: "tide-line" }));

  tideDay.extremes.forEach((event) => {
    const eventX = x(event.time);
    const eventY = y(event.height);
    svg.append(svgElement("circle", { cx: eventX, cy: eventY, r: 4, class: `tide-point tide-point-${event.type}` }));
    const label = svgElement("text", {
      x: eventX,
      y: event.type === "high" ? eventY - 9 : eventY + 16,
      class: "tide-event-label",
      "text-anchor": "middle"
    });
    label.textContent = `${formatTime(event.time)} ${event.height}cm`;
    svg.append(label);
  });

  if (toDateKey(at) === tideDay.date) {
    const nowX = x(at);
    svg.append(svgElement("line", { x1: nowX, x2: nowX, y1: padding.top, y2: height - padding.bottom, class: "tide-now-line" }));
    const nowLabel = svgElement("text", { x: nowX, y: 13, class: "tide-now-label", "text-anchor": "middle" });
    nowLabel.textContent = "現在";
    svg.append(nowLabel);
  }
}

function toDateKey(date) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(date);
}

export function renderTidePanel(elements, tideDay, at) {
  const state = deriveTideState(tideDay, at);
  elements.status.textContent = `${getTideCycle(at)} ・ ${state.trendLabel}`;
  elements.level.textContent = `現在 約${state.estimatedHeight}cm`;
  const nextLabel = state.nextExtreme.type === "high" ? "次の満潮" : "次の干潮";
  elements.next.textContent = `${nextLabel} ${formatTime(state.nextExtreme.time)}（${state.nextExtreme.height}cm）`;
  elements.station.textContent = `基準地点：${tideDay.station.name}`;
  elements.extremes.replaceChildren();
  tideDay.extremes.forEach((event) => {
    const item = document.createElement("li");
    item.textContent = `${event.type === "high" ? "満潮" : "干潮"} ${formatTime(event.time)}　${event.height}cm`;
    elements.extremes.append(item);
  });
  elements.source.textContent = tideDay.source.attribution;
  elements.source.href = tideDay.source.url;
  renderTideGraph(elements.graph, tideDay, at);
}

export function renderTideError(elements, error) {
  elements.panel.classList.add("tide-panel-error");
  elements.status.textContent = "潮汐データを表示できません";
  elements.level.textContent = "釣果は潮汐情報なしで保存できます";
  elements.next.textContent = error.message;
  elements.graph.replaceChildren();
}
