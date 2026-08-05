import { KURE_TIDE_DATA } from "../data/kure-2026.js";
import { eventDate, interpolateHeight, toJstDateKey } from "../tide/domain.js";

function offsetDateKey(dateKey, offsetDays) {
  const date = new Date(`${dateKey}T00:00:00+09:00`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return toJstDateKey(date);
}

function normalizeEvents(dateKey, entries = []) {
  return entries.map(([type, time, height]) => ({
    type,
    time: eventDate(dateKey, time),
    height
  }));
}

function createSeries(dateKey, contextExtremes) {
  return Array.from({ length: 25 }, (_, hour) => {
    const time = eventDate(dateKey, `${String(hour % 24).padStart(2, "0")}:00`);
    if (hour === 24) time.setDate(time.getDate() + 1);
    const before = [...contextExtremes].reverse().find((event) => event.time <= time);
    const after = contextExtremes.find((event) => event.time > time);
    return {
      time,
      height: before && after ? interpolateHeight(before, after, time) : null
    };
  }).filter((point) => point.height !== null);
}

export class KureTideProvider {
  async getTideDay({ date = new Date() } = {}) {
    const dateKey = typeof date === "string" ? date : toJstDateKey(date);
    const raw = KURE_TIDE_DATA.days[dateKey];
    if (!raw) {
      throw new Error(`呉潮汐データの対象期間外です（${dateKey}）`);
    }
    const contextExtremes = [-1, 0, 1]
      .flatMap((offset) => {
        const key = offsetDateKey(dateKey, offset);
        return normalizeEvents(key, KURE_TIDE_DATA.days[key]);
      })
      .sort((a, b) => a.time - b.time);
    const extremes = normalizeEvents(dateKey, raw);
    return {
      schemaVersion: 1,
      station: { ...KURE_TIDE_DATA.station, distanceKm: null },
      date: dateKey,
      timezone: KURE_TIDE_DATA.timezone,
      datum: { ...KURE_TIDE_DATA.datum },
      series: createSeries(dateKey, contextExtremes),
      extremes,
      contextExtremes,
      source: { ...KURE_TIDE_DATA.source },
      quality: {
        resolutionMinutes: 60,
        complete: contextExtremes.length >= 6,
        estimated: true,
        warnings: ["潮位曲線と現在潮位は、気象庁の満干潮値から補間した推定値です"]
      }
    };
  }
}
