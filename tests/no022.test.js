import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseTideLine } from "../tools/tide-parser.js";
import { filterStations, nearestStations, readSelectedStationId, saveSelectedStationId } from "../tide/station-selection.js";
import { clearTideDataCache, JmaTideProvider } from "../providers/jma-tide-provider.js";
import { deriveTideState, getTideCycle } from "../tide/domain.js";
import { renderTidePanel } from "../tide/view.js";

test("No.022: 136カラムから毎時24値、負潮位、最大4組、欠損を解析する", () => {
  const hourly = Array.from({ length: 24 }, (_, hour) => String(hour === 0 ? -5 : hour).padStart(3)).join("");
  const events = "0030 10" + "1234-12" + "2359 99" + "9999999" + "0100 -1" + "9999999".repeat(3);
  const parsed = parseTideLine(`${hourly}260101Q9${events}`);
  assert.equal(parsed.hourly.length, 24);
  assert.equal(parsed.hourly[0], -5);
  assert.equal(parsed.extremes.length, 4);
  assert.equal(parsed.extremes.at(-1)[2], -1);
  assert.equal(parsed.extremes[0][1], "00:30");
  assert.throws(() => parseTideLine("short"), /136 columns/);
});

test("No.022: 地点保存、検索、近隣3候補は自動確定なしで動く", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  saveSelectedStationId("jma-Q9", storage);
  assert.equal(readSelectedStationId(storage), "jma-Q9");
  const stations = [
    { stationId: "a", displayName: "呉", searchText: "くれ q9", region: "瀬戸内", latitude: 34.2, longitude: 132.5 },
    { stationId: "b", displayName: "広島", searchText: "ひろしま", region: "瀬戸内", latitude: 34.3, longitude: 132.4 },
    { stationId: "c", displayName: "松山", searchText: "まつやま", region: "四国", latitude: 33.8, longitude: 132.7 },
    { stationId: "d", displayName: "大阪", searchText: "おおさか", region: "近畿", latitude: 34.6, longitude: 135.4 }
  ];
  assert.deepEqual(filterStations(stations, { region: "瀬戸内", query: "Q9" }).map((item) => item.stationId), ["a"]);
  assert.equal(nearestStations(stations, 34.2, 132.5).length, 3);
  assert.equal(readSelectedStationId(storage), "jma-Q9");
});

test("No.022: 2026/2027の239地点をmanifestと地点マスタが保持する", async () => {
  const manifest = JSON.parse(await readFile(new URL("../data/tides/manifest.json", import.meta.url)));
  const master = JSON.parse(await readFile(new URL("../data/tides/stations.json", import.meta.url)));
  assert.equal(manifest.years[2026].stationCount, 239);
  assert.equal(manifest.years[2027].stationCount, 239);
  assert.deepEqual(manifest.years[2026].failures, []);
  assert.deepEqual(manifest.years[2027].failures, []);
  assert.equal(master.stations.length, 239);
});

test("No.022: 汎用Providerは公式毎時値を返し正時外を線形参考値にする", async () => {
  const originalFetch = globalThis.fetch;
  const stations = { stations: [{ stationId: "jma-Q9", providerStationId: "Q9", displayName: "呉", region: "瀬戸内", latitude: 34.2, longitude: 132.5, timezone: "Asia/Tokyo", dataYears: [2026], sourceUrl: "https://example.test", datum: null }] };
  const day = { h: Array.from({ length: 24 }, (_, hour) => hour * 10), e: [["low", "00:30", 0], ["high", "12:30", 120]] };
  globalThis.fetch = async (url) => ({ ok: true, json: async () => String(url).includes("stations") ? stations : { days: { "2026-01-01": day } } });
  try {
    const tideDay = await new JmaTideProvider({ stationsUrl: "stations-test", dataBaseUrl: "data-test" }).getTideDay({ stationId: "jma-Q9", date: "2026-01-01" });
    assert.equal(tideDay.series.length, 24);
    assert.equal(tideDay.series[12].height, 120);
    assert.equal(tideDay.quality.estimated, false);
  } finally { globalThis.fetch = originalFetch; }
});

test("No.022追加確認: 国立天文台の四分位相と年境界で潮回り目安が整合する", () => {
  const officialPhases = [
    ["2026-01-03T19:03:00+09:00", "大潮"], ["2026-01-11T00:48:00+09:00", "小潮"],
    ["2026-01-19T04:52:00+09:00", "大潮"], ["2026-01-26T13:47:00+09:00", "小潮"],
    ["2026-07-14T18:44:00+09:00", "大潮"], ["2026-07-21T20:06:00+09:00", "小潮"],
    ["2026-07-29T23:36:00+09:00", "大潮"], ["2026-12-31T03:59:00+09:00", "小潮"],
    ["2027-01-08T05:24:00+09:00", "大潮"], ["2027-01-16T05:35:00+09:00", "小潮"],
    ["2027-01-22T21:17:00+09:00", "大潮"], ["2027-01-29T19:55:00+09:00", "小潮"],
    ["2027-12-28T05:12:00+09:00", "大潮"], ["2027-12-31T12:00:00+09:00", "中潮"]
  ];
  officialPhases.forEach(([at, expected]) => assert.equal(getTideCycle(new Date(at)), expected, at));
  assert.equal(getTideCycle(new Date("2028-01-01T00:00:00+09:00")), null);
});

test("No.022回帰: 2026年末と2027年始は前後年の満干潮を使い境界時刻を算出できる", async () => {
  const originalFetch = globalThis.fetch;
  const stations = JSON.parse(await readFile(new URL("../data/tides/stations.json", import.meta.url)));
  const data2026 = JSON.parse(await readFile(new URL("../data/tides/2026/Q9.json", import.meta.url)));
  const data2027 = JSON.parse(await readFile(new URL("../data/tides/2027/Q9.json", import.meta.url)));
  clearTideDataCache();
  globalThis.fetch = async (url) => ({
    ok: true,
    json: async () => String(url).includes("stations-boundary")
      ? stations
      : String(url).includes("/2026/") ? data2026 : data2027
  });
  try {
    const provider = new JmaTideProvider({ stationsUrl: "stations-boundary", dataBaseUrl: "tides-boundary" });
    const dec31 = await provider.getTideDay({ stationId: "jma-Q9", date: "2026-12-31" });
    const jan01 = await provider.getTideDay({ stationId: "jma-Q9", date: "2027-01-01" });
    const cases = [
      [dec31, "2026-12-31T21:41:00+09:00"],
      [dec31, "2026-12-31T21:42:00+09:00"],
      [dec31, "2026-12-31T21:43:00+09:00"],
      [dec31, "2026-12-31T23:59:00+09:00"],
      [jan01, "2027-01-01T00:00:00+09:00"],
      [jan01, "2027-01-01T04:08:00+09:00"],
      [jan01, "2027-01-01T04:09:00+09:00"],
      [jan01, "2027-01-01T04:10:00+09:00"]
    ];
    cases.forEach(([day, at]) => assert.doesNotThrow(() => deriveTideState(day, new Date(at)), at));
    assert.equal(deriveTideState(dec31, new Date("2026-12-31T21:42:00+09:00")).previousExtreme.time.toISOString(), new Date("2026-12-31T21:42:00+09:00").toISOString());
    assert.equal(deriveTideState(jan01, new Date("2027-01-01T04:09:00+09:00")).previousExtreme.time.toISOString(), new Date("2027-01-01T04:09:00+09:00").toISOString());
    assert.ok(dec31.contextExtremes.some((event) => event.time.toISOString() === new Date("2026-12-31T21:42:00+09:00").toISOString()));
    assert.ok(dec31.contextExtremes.some((event) => event.time.toISOString() === new Date("2027-01-01T04:09:00+09:00").toISOString()));
    assert.equal(dec31.referenceSeries.length, 25);
  } finally {
    globalThis.fetch = originalFetch;
    clearTideDataCache();
  }
});

test("No.022回帰: 対応外年が必要な外側境界でも公式グラフと選択地点を残す", async () => {
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  const stations = JSON.parse(await readFile(new URL("../data/tides/stations.json", import.meta.url)));
  const data2026 = JSON.parse(await readFile(new URL("../data/tides/2026/Q9.json", import.meta.url)));
  clearTideDataCache();
  globalThis.fetch = async (url) => ({ ok: true, json: async () => String(url).includes("stations-outer") ? stations : data2026 });
  class FakeElement {
    constructor(name = "div") { this.name = name; this.children = []; this.attributes = {}; this.textContent = ""; this.classList = { remove() {} }; }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
  }
  globalThis.document = { createElement: (name) => new FakeElement(name), createElementNS: (_ns, name) => new FakeElement(name) };
  try {
    const tideDay = await new JmaTideProvider({ stationsUrl: "stations-outer", dataBaseUrl: "tides-outer" }).getTideDay({ stationId: "jma-Q9", date: "2026-01-01" });
    const elements = Object.fromEntries(["panel", "heading", "status", "level", "next", "station", "graph", "extremes", "source"].map((key) => [key, new FakeElement()]));
    renderTidePanel(elements, tideDay, new Date("2026-01-01T00:00:00+09:00"));
    assert.equal(elements.station.textContent, `基準地点：${tideDay.station.name}`);
    assert.match(elements.level.textContent, /表示できません/);
    assert.ok(elements.graph.children.some((child) => child.attributes.class === "tide-line"));
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.document = originalDocument;
    clearTideDataCache();
  }
});

test("No.022追加修正: 地点選択は現在地を主操作にし入力欄へ初期フォーカスしない", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const nearbyIndex = html.indexOf('id="tideNearbyButton"');
  const regionIndex = html.indexOf('id="tideRegionFilter"');
  const searchIndex = html.indexOf('id="tideStationSearch"');
  assert.ok(nearbyIndex > 0 && nearbyIndex < regionIndex && regionIndex < searchIndex);
  assert.match(html, /id="tideNearbyButton"[^>]*button-primary[^>]*autofocus/);
  assert.doesNotMatch(html, /id="tideRegionFilter"[^>]*autofocus/);
  assert.doesNotMatch(html, /id="tideStationSearch"[^>]*autofocus/);
  assert.doesNotMatch(app, /tide(?:RegionFilter|StationSearch)\.(?:focus|showPicker)\s*\(/);
  assert.doesNotMatch(html, /<h2[^>]*(?:tabindex|autofocus)/);
  const dialogMarkup = html.slice(html.indexOf('id="tideStationDialog"'), html.indexOf("</dialog>", html.indexOf('id="tideStationDialog"')));
  assert.equal((dialogMarkup.match(/autofocus/g) || []).length, 1);
  assert.match(app, /tideStationDialog\.showModal\(\);\s*elements\.tideStationDialog\.scrollTop = 0;\s*elements\.tideNearbyButton\.focus\(\{ preventScroll: true \}\);/);
  const nearbyHandler = app.indexOf('elements.tideNearbyButton.addEventListener("click"');
  const geolocationRequest = app.indexOf("navigator.geolocation.getCurrentPosition", nearbyHandler);
  assert.ok(nearbyHandler > 0 && geolocationRequest > nearbyHandler);
  assert.match(html, /Otomo Fishing Beta \/ Version 0\.21\.1/);
});
