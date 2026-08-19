const JST_OFFSET = "+09:00";
import { officialLunarAgeDays } from "./lunar-phases.js";

export function toJstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function eventDate(dateKey, time) {
  return new Date(`${dateKey}T${time}:00${JST_OFFSET}`);
}

export function getTideCycle(date) {
  const age = officialLunarAgeDays(date);
  if (age === null) return null;
  const day = Math.round(age) % 30;
  if ([0, 1, 2, 14, 15, 16, 17, 29].includes(day)) return "大潮";
  if ([7, 8, 9, 22, 23, 24].includes(day)) return "小潮";
  if ([10, 25].includes(day)) return "長潮";
  if ([11, 26].includes(day)) return "若潮";
  return "中潮";
}

export function interpolateHeight(before, after, at) {
  const span = after.time.getTime() - before.time.getTime();
  if (span <= 0) throw new Error("潮汐イベントの時系列が不正です");
  const ratio = Math.min(1, Math.max(0, (at.getTime() - before.time.getTime()) / span));
  const eased = (1 - Math.cos(Math.PI * ratio)) / 2;
  return Math.round(before.height + (after.height - before.height) * eased);
}

export function deriveTideState(tideDay, at) {
  const events = tideDay.contextExtremes || tideDay.extremes;
  const previous = [...events].reverse().find((event) => event.time <= at);
  const next = events.find((event) => event.time > at);
  if (!previous || !next) {
    throw new Error("現在潮位の推定に必要な前後の満干潮データがありません");
  }
  const minutesToNext = (next.time - at) / 60000;
  const trend = minutesToNext <= 30 || (at - previous.time) / 60000 <= 30
    ? "slack"
    : next.type === "high" ? "rising" : "falling";
  const hourlyPoints = tideDay.referenceSeries || tideDay.series;
  const beforePoint = [...hourlyPoints].reverse().find((point) => point.time <= at);
  const afterPoint = hourlyPoints.find((point) => point.time >= at);
  const exactOfficial = beforePoint && beforePoint.time.getTime() === at.getTime();
  const referenceHeight = beforePoint && afterPoint
    ? Math.round(beforePoint.height + (afterPoint.height - beforePoint.height) * ((at - beforePoint.time) / Math.max(1, afterPoint.time - beforePoint.time)))
    : interpolateHeight(previous, next, at);
  return {
    estimatedHeight: referenceHeight,
    referenceHeight,
    officialHourlyValue: exactOfficial,
    trend,
    trendLabel: trend === "rising" ? "上げ潮" : trend === "falling" ? "下げ潮" : "潮止まり付近",
    previousExtreme: previous,
    nextExtreme: next
  };
}

export function createTideSnapshot(tideDay, at) {
  const state = deriveTideState(tideDay, at);
  const serializeEvent = (event) => ({
    type: event.type,
    time: event.time.toISOString(),
    height: event.height
  });
  return {
    schemaVersion: 1,
    observedAt: at.toISOString(),
    station: {
      id: tideDay.station.id,
      name: tideDay.station.name,
      distanceKm: tideDay.station.distanceKm ?? null
    },
    tideCycle: getTideCycle(at),
    estimatedHeight: state.estimatedHeight,
    referenceHeight: state.referenceHeight,
    referenceValue: !state.officialHourlyValue,
    trend: state.trend,
    trendLabel: state.trendLabel,
    previousExtreme: serializeEvent(state.previousExtreme),
    nextExtreme: serializeEvent(state.nextExtreme),
    source: {
      provider: tideDay.source.provider,
      prediction: true,
      dataYear: Number(tideDay.date.slice(0, 4)),
      sourceType: "official-hourly-tide-table",
      processed: true
    }
  };
}

export function formatTime(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}
