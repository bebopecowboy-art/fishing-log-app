import { eventDate, toJstDateKey } from "../tide/domain.js";

export class TideDataError extends Error {
  constructor(code, message) { super(message); this.name = "TideDataError"; this.code = code; }
}

const cache = new Map();

function normalizeEvents(dateKey, entries = []) {
  return entries.map(([type, time, height]) => ({ type, time: eventDate(dateKey, time), height }))
    .sort((a, b) => a.time - b.time);
}

function dateOffset(dateKey, amount) {
  const date = new Date(`${dateKey}T12:00:00+09:00`);
  date.setUTCDate(date.getUTCDate() + amount);
  return toJstDateKey(date);
}

async function loadJson(url) {
  if (!cache.has(url)) cache.set(url, fetch(url).then((response) => {
    if (!response.ok) throw new TideDataError("load-failed", `潮汐データを読み込めませんでした（HTTP ${response.status}）`);
    return response.json();
  }).catch((error) => { cache.delete(url); throw error; }));
  return cache.get(url);
}

export class JmaTideProvider {
  constructor({ stationsUrl = "./data/tides/stations.json", dataBaseUrl = "./data/tides" } = {}) {
    this.stationsUrl = stationsUrl;
    this.dataBaseUrl = dataBaseUrl;
  }

  async getStations() { return (await loadJson(this.stationsUrl)).stations; }

  async getTideDay({ stationId, date = new Date() } = {}) {
    if (!stationId) throw new TideDataError("station-unselected", "基準地点が選択されていません");
    const dateKey = typeof date === "string" ? date : toJstDateKey(date);
    const year = Number(dateKey.slice(0, 4));
    const station = (await this.getStations()).find((item) => item.stationId === stationId);
    if (!station) throw new TideDataError("station-invalid", "保存された基準地点は現在の地点一覧にありません");
    if (!station.dataYears.includes(year)) throw new TideDataError("year-unavailable", `この地点の${year}年データには対応していません`);
    const payload = await loadJson(`${this.dataBaseUrl}/${year}/${station.providerStationId}.json`);
    const raw = payload.days[dateKey];
    if (!raw) throw new TideDataError("date-unavailable", `この地点の${dateKey}データには対応していません`);
    const adjacentDateKeys = [-1, 1].map((offset) => dateOffset(dateKey, offset));
    const payloadsByYear = new Map([[year, payload]]);
    await Promise.all([...new Set(adjacentDateKeys.map((key) => Number(key.slice(0, 4))))]
      .filter((adjacentYear) => adjacentYear !== year && station.dataYears.includes(adjacentYear))
      .map(async (adjacentYear) => {
        try {
          const adjacentPayload = await loadJson(`${this.dataBaseUrl}/${adjacentYear}/${station.providerStationId}.json`);
          payloadsByYear.set(adjacentYear, adjacentPayload);
        } catch (_error) {
          // The selected day's official values are still useful when optional context cannot be loaded.
        }
      }));
    const dayForKey = (key) => payloadsByYear.get(Number(key.slice(0, 4)))?.days[key];
    const contextExtremes = [-1, 0, 1].flatMap((offset) => {
      const key = dateOffset(dateKey, offset);
      return normalizeEvents(key, dayForKey(key)?.e);
    }).sort((a, b) => a.time - b.time);
    const series = raw.h.map((height, hour) => ({ time: eventDate(dateKey, `${String(hour).padStart(2, "0")}:00`), height, official: true }));
    const nextDateKey = dateOffset(dateKey, 1);
    const nextMidnight = dayForKey(nextDateKey)?.h?.[0];
    const referenceSeries = Number.isFinite(nextMidnight)
      ? [...series, { time: eventDate(nextDateKey, "00:00"), height: nextMidnight, official: true }]
      : series;
    return {
      schemaVersion: 2,
      station: { id: station.stationId, providerStationId: station.providerStationId, name: station.displayName, region: station.region, latitude: station.latitude, longitude: station.longitude, distanceKm: null },
      date: dateKey,
      timezone: station.timezone,
      datum: station.datum,
      series,
      referenceSeries,
      extremes: normalizeEvents(dateKey, raw.e),
      contextExtremes,
      source: { provider: "jma-tide-table", url: `https://www.data.jma.go.jp/kaiyou/db/tide/suisan/suisan.php?stn=${station.providerStationId}&ys=${year}&ye=${year}`, attribution: "気象庁『潮位表』をもとにOtomo Fishingが加工", dataYear: year, processed: true },
      quality: { resolutionMinutes: 60, complete: series.length === 24 && series.every((point) => Number.isFinite(point.height)), estimated: false, warnings: ["毎時点の間を結ぶ線と正時以外の参考値はOtomo Fishingによる表示上の補間です"] }
    };
  }
}

export function clearTideDataCache() { cache.clear(); }
