import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { generateSnsCardJpeg, SNS_CARD_HEIGHT, SNS_CARD_JPEG_QUALITY, SNS_CARD_WIDTH } from "../sns-card-export.js";
import { getCardViewModel } from "../sns-card.js";
import { renderSnsCardCanvas, SNS_CARD_LAYOUT, SNS_CARD_THEMES } from "../sns-card-renderer.js";

const expectedThemes = {
  cream: { label: "クリーム", background: "#F2E9D8", accent: "#173C5A", text: "#111820" },
  mint: { label: "ミント", background: "#BFE0D6", accent: "#146A65", text: "#15333A" },
  sky: { label: "スカイ", background: "#C6DAEE", accent: "#245F8B", text: "#172D40" },
  sand: { label: "サンド", background: "#DFC09C", accent: "#6F5728", text: "#392B23" }
};
const log = {
  name: "マダイ", size: "52", place: "東京湾",
  tide: { tideCycle: "大潮", trendLabel: "上げ" },
  weather: "晴れ", temperature: "24", method: "タイラバ",
  memo: "朝まずめ", date: "2026-08-20"
};
const allVisible = { place: true, tide: true, weather: true, method: true, memo: true, date: true };

function createEnvironment() {
  const operations = [];
  const context = {
    fillStyle: "", strokeStyle: "", lineWidth: 0, filter: "none", font: "", textAlign: "left", textBaseline: "top",
    fillRect(...args) { operations.push({ type: "fillRect", color: this.fillStyle, args }); },
    clearRect() {},
    drawImage(...args) { operations.push({ type: "drawImage", args }); },
    fillText(value, x, y) { operations.push({ type: "fillText", value, x, y, color: this.fillStyle }); },
    measureText: (value) => ({ width: Array.from(value).length * 20 }),
    save() {}, restore() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {},
    fill() { operations.push({ type: "fill", color: this.fillStyle }); },
    stroke() { operations.push({ type: "stroke", color: this.strokeStyle, width: this.lineWidth }); },
    clip() {}, translate() {}
  };
  const canvas = {
    width: 0, height: 0,
    getContext: () => context,
    toBlob(callback, type, quality) {
      operations.push({ type: "toBlob", mimeType: type, quality });
      callback(new Blob(["jpeg"], { type }));
    }
  };
  return { canvas, operations, documentObject: { createElement: () => canvas } };
}

class LoadedImage {
  naturalWidth = 100;
  naturalHeight = 100;
  set src(value) { this.source = value; queueMicrotask(() => this.onload()); }
}

function capturedColors(operations, model) {
  const text = operations.filter(({ type }) => type === "fillText");
  return {
    background: operations.find(({ type, args }) => type === "fillRect" && args[2] === SNS_CARD_WIDTH && args[3] === SNS_CARD_HEIGHT)?.color,
    heading: text.filter(({ value }) => value === model.name || value === model.size).map(({ color }) => color),
    icons: text.filter(({ value }) => model.rows.some(({ icon }) => icon === value)).map(({ color }) => color),
    body: text.filter(({ value }) => model.rows.some((row) => row.value === value)).map(({ color }) => color),
    strokes: operations.filter(({ type }) => type === "stroke").map(({ color }) => color)
  };
}

test("No.023: four theme background and accent values exactly match the instruction", () => {
  assert.deepEqual(SNS_CARD_THEMES, expectedThemes);
});

test("No.023: card background, frame, headings, rule, and icons use each theme accent", async () => {
  const model = getCardViewModel(log, allVisible);
  for (const [themeId, theme] of Object.entries(expectedThemes)) {
    const environment = createEnvironment();
    await renderSnsCardCanvas(environment.canvas, model, "photo.jpg", undefined, themeId, { ImageConstructor: LoadedImage });
    const colors = capturedColors(environment.operations, model);
    assert.equal(colors.background, theme.background);
    assert.deepEqual(colors.heading, [theme.accent, theme.accent]);
    assert.deepEqual(colors.icons, Array(6).fill(theme.accent));
    assert.deepEqual(colors.body, Array(6).fill(theme.text));
    assert(colors.strokes.includes(theme.accent), `${themeId} frame/rule must use its accent`);
    assert.equal(model.rows.length, 6);
    assert.equal(model.rows.at(-1).key, "date");
  }
});

test("No.023: preview and JPEG export resolve the same theme colors", async () => {
  const model = getCardViewModel(log, allVisible);
  for (const themeId of Object.keys(expectedThemes)) {
    const preview = createEnvironment();
    await renderSnsCardCanvas(preview.canvas, model, null, undefined, themeId, { ImageConstructor: LoadedImage });
    const exported = createEnvironment();
    await generateSnsCardJpeg(log, null, allVisible, {
      documentObject: exported.documentObject, ImageConstructor: LoadedImage, themeId
    });
    assert.deepEqual(capturedColors(exported.operations, model), capturedColors(preview.operations, model));
  }
});

test("No.023: color swatches use shared backgrounds and theme switching still redraws immediately", async () => {
  const [app, html, css] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../style.css", import.meta.url), "utf8")
  ]);
  assert.match(app, /sns-theme-swatch"\)\.style\.backgroundColor\s*=\s*SNS_CARD_THEMES\[button\.dataset\.theme\]\.background/);
  assert.match(app, /snsCardTheme\s*=\s*normalizeSnsCardTheme\(button\.dataset\.theme\)[\s\S]*redrawActiveSnsCard\(\)/);
  assert.match(html, /data-theme="cream"[\s\S]*data-theme="mint"[\s\S]*data-theme="sky"[\s\S]*data-theme="sand"/);
  assert.match(css, /\.sns-theme-options\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
});

test("No.023: layout, assets, photo treatment, JPEG contract, default theme, and version remain stable", async () => {
  const [html, renderer, photoAdjustment] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../sns-card-renderer.js", import.meta.url), "utf8"),
    readFile(new URL("../sns-photo-adjustment.js", import.meta.url), "utf8")
  ]);
  assert.equal(SNS_CARD_WIDTH, 1080);
  assert.equal(SNS_CARD_HEIGHT, 1350);
  assert.equal(SNS_CARD_JPEG_QUALITY, 0.92);
  assert.deepEqual(SNS_CARD_LAYOUT.photo, { x: 43, y: 43, width: 994, height: 740, radius: 30, borderWidth: 6 });
  assert.deepEqual(SNS_CARD_LAYOUT.wordmark, { x: 650, y: 1195, width: 390 });
  assert.deepEqual(SNS_CARD_LAYOUT.character, { x: 610, y: 970, width: 400 });
  assert.match(renderer, /SNS_CARD_DEFAULT_THEME\s*=\s*"cream"/);
  assert.match(renderer, /saturate\(92%\).*contrast\(96%\).*sepia\(6%\).*brightness\(102%\)/);
  assert.match(renderer, /otomo-fishing-wordmark\.png/);
  assert.match(renderer, /otomo-character-fishing-back-final\.png/);
  assert.match(photoAdjustment, /SNS_PHOTO_SCALE_MAX\s*=\s*3/);
  assert.match(html, /Otomo Fishing Beta \/ Version 0\.21\.3/);
});
