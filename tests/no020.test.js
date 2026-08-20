import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  generateSnsCardJpeg,
  SNS_CARD_CHARACTER_URL,
  SNS_CARD_HEIGHT,
  SNS_CARD_LAYOUT,
  SNS_CARD_PHOTO_FILTER,
  SNS_CARD_WIDTH
} from "../sns-card-export.js";
import { SNS_CARD_DEFAULTS } from "../sns-card.js";

const ASSETS = [
  ["otomo-fishing-logo-horizontal.png", 2172, 724],
  ["otomo-character-empty-history.png", 756, 925],
  ["otomo-character-search-empty.png", 676, 971],
  ["otomo-character-fishing-back-final.png", 1402, 1122]
];

test("No.020: supplied RGBA PNG assets retain their names and dimensions", async () => {
  for (const [name, width, height] of ASSETS) {
    const bytes = await readFile(new URL(`../assets/${name}`, import.meta.url));
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(bytes.readUInt32BE(16), width);
    assert.equal(bytes.readUInt32BE(20), height);
    assert.equal(bytes[25], 6, `${name} must remain RGBA`);
  }
});

test("No.020: logo, distinct empty states, responsive sizing, and display version are wired", async () => {
  const [html, app, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../style.css", import.meta.url), "utf8")
  ]);
  assert.match(html, /assets\/otomo-fishing-logo-horizontal\.png[^>]+alt="Otomo Fishing"/);
  assert.doesNotMatch(html, />FISHING LOG<|<h1>Otomo Fishing<\/h1>/);
  assert.match(html, /釣れた瞬間を、30秒で記録。/);
  assert.match(html, /Otomo Fishing Beta \/ Version 0\.22\.1/);
  assert.match(app, /fishingLogs\.length === 0 && !isSearching[\s\S]+otomo-character-empty-history\.png/);
  assert.match(app, /displayedLogs\.length === 0[\s\S]+otomo-character-search-empty\.png/);
  assert.match(app, /aria-hidden/);
  assert.match(css, /\.app-logo[^}]+width: min\(100%, 430px\)[^}]+height: auto/);
  assert.match(css, /--empty-history-width/);
  assert.match(css, /--empty-search-width/);
});

function createCanvasEnvironment(operations) {
  const context = {
    fillStyle: "", strokeStyle: "", lineWidth: 0, filter: "none", font: "", textAlign: "left", textBaseline: "top",
    fillRect: (...args) => operations.push(["fillRect", ...args]),
    clearRect: (...args) => operations.push(["clearRect", ...args]),
    drawImage: (...args) => operations.push(["drawImage", ...args]),
    fillText: (...args) => operations.push(["fillText", ...args]),
    measureText: (value) => ({ width: Array.from(value).length * 20 }),
    save() {}, restore() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {},
    fill() {}, stroke() {}, clip() {}, translate() {}
  };
  return {
    createElement() {
      return {
        width: 0, height: 0,
        getContext: () => context,
        toBlob(callback, type) { callback(new Blob(["jpeg"], { type })); }
      };
    }
  };
}

class DeferredImage {
  naturalWidth = 1402;
  naturalHeight = 1122;
  set src(value) {
    this.source = value;
    setTimeout(() => this.onload(), value === SNS_CARD_CHARACTER_URL ? 5 : 0);
  }
}

test("No.020: export keeps 4:5 output, frames and tones only the card photo, then draws Otomo", async () => {
  const operations = [];
  const blob = await generateSnsCardJpeg(
    { name: "マダイ" }, "assets/test-photo.png", SNS_CARD_DEFAULTS,
    { documentObject: createCanvasEnvironment(operations), ImageConstructor: DeferredImage }
  );
  assert.equal(SNS_CARD_WIDTH, 1080);
  assert.equal(SNS_CARD_HEIGHT, 1350);
  assert.equal(blob.type, "image/jpeg");
  assert.deepEqual(SNS_CARD_LAYOUT.photo, {
    x: 43, y: 43, width: 994, height: 740, radius: 30, borderWidth: 6
  });
  assert.match(SNS_CARD_PHOTO_FILTER.canvas, /saturate\(92%\).*contrast\(96%\).*sepia\(6%\)/);
  const draws = operations.filter(([operation]) => operation === "drawImage");
  assert.equal(draws.length, 3, "photo, wordmark, and fully loaded character must all be drawn");
  assert.deepEqual(draws.at(-1).slice(-4, -1), [610, 970, 400]);
});

test("No.020: a missing catch photo falls back to a card with Otomo and no empty frame", async () => {
  const operations = [];
  await generateSnsCardJpeg(
    { name: "写真なし" }, null, SNS_CARD_DEFAULTS,
    { documentObject: createCanvasEnvironment(operations), ImageConstructor: DeferredImage }
  );
  assert.equal(operations.filter(([operation]) => operation === "drawImage").length, 2);
});
