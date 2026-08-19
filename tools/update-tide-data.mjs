import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseTideLine } from "./tide-parser.js";

const BASE = "https://www.data.jma.go.jp/kaiyou";
const OUT = resolve("data/tides");
const years = process.argv.slice(2).map(Number);
if (!years.length || years.some((year) => !Number.isInteger(year))) {
  throw new Error("Usage: node tools/update-tide-data.mjs 2026 2027");
}

function text(value) {
  return value.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
}

function coordinate(value) {
  const match = value.match(/(\d+)[゜°](\d+)'/);
  return match ? Number(match[1]) + Number(match[2]) / 60 : null;
}

function regionFor(latitude, longitude) {
  if (latitude < 29) return "沖縄・離島";
  if (latitude >= 41.3) return "北海道";
  if (latitude >= 36.5) return longitude < 140 ? "日本海北部" : "東北太平洋";
  if (latitude >= 34.5) return longitude >= 138 ? "関東・東海" : longitude >= 134 ? "近畿・瀬戸内" : "中国・日本海";
  if (latitude >= 32.5) return longitude >= 132 ? "四国・瀬戸内" : "九州";
  return "九州・南西諸島";
}

function parseStations(html, year) {
  const rows = [...html.matchAll(/<tr[^>]*class="mtx"[^>]*>([\s\S]*?)<\/tr>/g)];
  return rows.map((row) => [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => text(cell[1])))
    .filter((cells) => /^\d+$/.test(cells[0] || "") && /^[A-Z0-9]{2}$/.test(cells[1] || ""))
    .map((cells) => {
      const latitude = coordinate(cells[3]);
      const longitude = coordinate(cells[4]);
      return {
        stationId: `jma-${cells[1]}`,
        providerStationId: cells[1],
        displayName: cells[2],
        searchText: `${cells[2]} ${cells[1]}`.toLowerCase(),
        region: regionFor(latitude, longitude),
        latitude,
        longitude,
        timezone: "Asia/Tokyo",
        dataYears: [year],
        sourceUrl: `${BASE}/db/tide/suisan/suisan.php?stn=${cells[1]}&ys=${year}&ye=${year}`,
        datum: cells[5] && cells[5] !== "-" ? { mslToDatumCm: Number(cells[5]) } : null,
        qualityFlags: cells[17] ? [cells[17]] : []
      };
    });
}

async function download(url, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(url, { headers: { "User-Agent": "Otomo-Fishing-tide-data-updater/1.0" } });
    if (response.ok) return response;
    if (attempt === attempts) throw new Error(`HTTP ${response.status}: ${url}`);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 750));
  }
}

await mkdir(OUT, { recursive: true });
const master = new Map();
const manifest = { schemaVersion: 1, generatedAt: new Date().toISOString(), converterVersion: "1.0.0", source: `${BASE}/db/tide/suisan/index.php`, years: {} };

for (const year of years) {
  const stationUrl = `${BASE}/db/tide/suisan/${year === 2026 ? "station" : `station${year}.php`}`;
  const stations = parseStations(await (await download(stationUrl)).text(), year);
  const failures = [];
  let bytes = 0;
  for (const station of stations) {
    const sourceUrl = `${BASE}/data/db/tide/suisan/txt/${year}/${station.providerStationId}.txt`;
    try {
      const raw = await (await download(sourceUrl)).text();
      const lines = raw.replace(/\r/g, "").split("\n").filter(Boolean);
      const days = Object.fromEntries(lines.map(parseTideLine).map((day) => [day.date, { h: day.hourly, e: day.extremes }]));
      if (new Set(Object.keys(days)).size !== lines.length) throw new Error("duplicate date");
      const payload = { schemaVersion: 1, stationId: station.stationId, providerStationId: station.providerStationId, year, days };
      const json = JSON.stringify(payload);
      await mkdir(resolve(OUT, String(year)), { recursive: true });
      await writeFile(resolve(OUT, String(year), `${station.providerStationId}.json`), json);
      bytes += Buffer.byteLength(json);
      station.dataYears = [year];
      const existing = master.get(station.stationId);
      if (existing) existing.dataYears.push(year); else master.set(station.stationId, station);
      manifest.years[year] ??= { stationListUrl: stationUrl, files: {}, failures: [] };
      manifest.years[year].files[station.providerStationId] = { sourceUrl, days: lines.length, bytes: Buffer.byteLength(json), sha256: createHash("sha256").update(raw).digest("hex") };
    } catch (error) {
      failures.push({ stationId: station.stationId, reason: error.message });
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 35));
  }
  manifest.years[year] ??= { stationListUrl: stationUrl, files: {} };
  manifest.years[year].stationCount = Object.keys(manifest.years[year].files).length;
  manifest.years[year].bytes = bytes;
  manifest.years[year].failures = failures;
}

const stations = [...master.values()].map((station) => ({ ...station, dataYears: [...new Set(station.dataYears)].sort() }));
await writeFile(resolve(OUT, "stations.json"), JSON.stringify({ schemaVersion: 1, stations }));
await writeFile(resolve(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ stations: stations.length, years: manifest.years }, null, 2));
