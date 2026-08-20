import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { generateSnsCardJpeg } from "../sns-card-export.js";
import { getCardViewModel } from "../sns-card.js";
import { renderSnsCardCanvas, SNS_CARD_THEMES } from "../sns-card-renderer.js";

const log = {
  name: "マダイ",
  size: "52",
  place: "東京湾",
  tide: { tideCycle: "大潮", trendLabel: "上げ" },
  weather: "晴れ",
  temperature: "24",
  method: "タイラバ",
  memo: "朝まずめ",
  date: "2026-08-20"
};
const allVisible = { place: true, tide: true, weather: true, method: true, memo: true, date: true };

function createCanvasEnvironment(operations = []) {
  const context = {
    fillStyle: "", strokeStyle: "", lineWidth: 0, filter: "none", font: "", textAlign: "left", textBaseline: "top",
    fillRect() {}, drawImage() {},
    fillText: (...args) => operations.push(args),
    measureText: (value) => ({ width: Array.from(value).length * 20 }),
    save() {}, restore() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {},
    fill() {}, stroke() {}, clip() {}, translate() {}
  };
  const canvas = {
    width: 0, height: 0,
    getContext: () => context,
    toBlob(callback, type) { callback(new Blob(["jpeg"], { type })); }
  };
  return { canvas, documentObject: { createElement: () => canvas }, operations };
}

class LoadedImage {
  naturalWidth = 100;
  naturalHeight = 100;
  set src(_value) { queueMicrotask(() => this.onload()); }
}

function rowValues(operations) {
  return operations
    .filter(([value, x]) => x === 134 && !["マダイ", "52cm"].includes(value))
    .map(([value]) => value);
}

test("No.022-B: all six selected non-empty fields remain in defined order", () => {
  const model = getCardViewModel(log, allVisible);
  assert.deepEqual(model.rows.map(({ key }) => key), ["place", "tide", "weather", "method", "memo", "date"]);
  assert.deepEqual(model.rows.map(({ value }) => value), ["東京湾", "大潮・上げ", "晴れ 24℃", "タイラバ", "朝まずめ", "2026.08.20"]);
});

test("No.022-B: date works alone and closes gaps after any preceding field is disabled", () => {
  assert.deepEqual(getCardViewModel(log, { date: true }).rows.map(({ key }) => key), ["date"]);
  for (const disabled of ["place", "tide", "weather", "method", "memo", "date"]) {
    const visibility = { ...allVisible, [disabled]: false };
    const keys = getCardViewModel(log, visibility).rows.map(({ key }) => key);
    assert.equal(keys.length, 5);
    assert(!keys.includes(disabled));
    if (disabled !== "date") assert.equal(keys.at(-1), "date");
  }
});

test("No.022-B: renderer draws six compact rows within the card for every theme", async () => {
  const model = getCardViewModel(log, allVisible);
  for (const theme of Object.keys(SNS_CARD_THEMES)) {
    const environment = createCanvasEnvironment();
    await renderSnsCardCanvas(environment.canvas, model, null, undefined, theme, { ImageConstructor: LoadedImage });
    assert.deepEqual(rowValues(environment.operations), model.rows.map(({ value }) => value));
    const rows = environment.operations.filter(([_value, x]) => x === 134);
    assert.deepEqual(rows.map(([, , y]) => y), [951, 999, 1047, 1095, 1143, 1191]);
    assert(rows.every(([, x, y]) => x < 610 && y + 42 < 1350), `${theme} rows must avoid Otomo and card edge`);
  }
});

test("No.022-B: JPEG export uses the same six-row model as preview", async () => {
  const preview = createCanvasEnvironment();
  await renderSnsCardCanvas(preview.canvas, getCardViewModel(log, allVisible), null, undefined, "cream", { ImageConstructor: LoadedImage });
  const exported = createCanvasEnvironment();
  const blob = await generateSnsCardJpeg(log, null, allVisible, {
    documentObject: exported.documentObject,
    ImageConstructor: LoadedImage,
    themeId: "cream"
  });
  assert.equal(blob.type, "image/jpeg");
  assert.deepEqual(rowValues(exported.operations), rowValues(preview.operations));
  assert.equal(rowValues(exported.operations).length, 6);
});

test("No.022-B: current display version and no five-row cutoff remain", async () => {
  const [html, renderer] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../sns-card-renderer.js", import.meta.url), "utf8")
  ]);
  assert.match(html, /Otomo Fishing Beta \/ Version 0\.22\.1/);
  assert.doesNotMatch(renderer, /rowY\s*>\s*1160/);
});
