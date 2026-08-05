import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  canShareSnsCard,
  createSnsCardFilename,
  generateSnsCardJpeg,
  shareSnsCardFile,
  SNS_CARD_HEIGHT,
  SNS_CARD_JPEG_QUALITY,
  SNS_CARD_MIME_TYPE,
  SNS_CARD_WIDTH
} from "../sns-card-export.js";
import { SNS_CARD_DEFAULTS } from "../sns-card.js";

function fakeCanvasEnvironment(operations) {
  const context = {
    fillStyle: "", strokeStyle: "", lineWidth: 0, font: "", textAlign: "left", textBaseline: "top",
    fillRect: (...args) => operations.push(["fillRect", ...args]),
    drawImage: (...args) => operations.push(["drawImage", ...args]),
    fillText: (...args) => operations.push(["fillText", ...args]),
    measureText: (value) => ({ width: Array.from(value).length * 20 }),
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}
  };
  let canvas;
  return {
    documentObject: {
      createElement() {
        canvas = {
          width: 0, height: 0,
          getContext: () => context,
          toBlob(callback, type, quality) {
            operations.push(["toBlob", type, quality]);
            callback(new Blob(["encoded-pixels-only"], { type }));
          }
        };
        return canvas;
      }
    },
    get canvas() { return canvas; }
  };
}

test("JPEG標準仕様は1080×1350、image/jpeg、品質0.92、拡張子.jpg", async () => {
  const operations = [];
  const environment = fakeCanvasEnvironment(operations);
  const blob = await generateSnsCardJpeg(
    { name: "日本語の魚", memo: "長いメモ".repeat(40) }, null, SNS_CARD_DEFAULTS,
    { documentObject: environment.documentObject }
  );
  assert.equal(environment.canvas.width, SNS_CARD_WIDTH);
  assert.equal(environment.canvas.height, SNS_CARD_HEIGHT);
  assert.equal(SNS_CARD_WIDTH, 1080);
  assert.equal(SNS_CARD_HEIGHT, 1350);
  assert.equal(blob.type, SNS_CARD_MIME_TYPE);
  assert.equal(SNS_CARD_MIME_TYPE, "image/jpeg");
  assert.equal(SNS_CARD_JPEG_QUALITY, 0.92);
  assert.match(createSnsCardFilename({ name: "アジ:/?" }), /\.jpg$/);
  assert.ok(operations.some((operation) => operation.join("|").includes("…")));
});

test("JPEGは白背景へ再描画し、ログ座標や元画像メタデータを渡さない", async () => {
  const operations = [];
  const environment = fakeCanvasEnvironment(operations);
  await generateSnsCardJpeg(
    { name: "アジ", latitude: 34.1234, longitude: 132.5678, exif: "secret" },
    null, SNS_CARD_DEFAULTS, { documentObject: environment.documentObject }
  );
  assert.deepEqual(operations[0], ["fillRect", 0, 0, 1080, 1350]);
  const output = JSON.stringify(operations);
  assert.doesNotMatch(output, /34\.1234|132\.5678|secret/);
});

test("共有可否はWeb Share APIとcanShareのJPEGファイル判定を両方要求する", () => {
  const jpeg = { name: "card.jpg", type: "image/jpeg" };
  assert.equal(canShareSnsCard(null, jpeg), false);
  assert.equal(canShareSnsCard({ share() {} }, jpeg), false);
  assert.equal(canShareSnsCard({ share() {}, canShare: ({ files }) => files[0] === jpeg }, jpeg), true);
  assert.equal(canShareSnsCard({ share() {}, canShare: () => false }, jpeg), false);
});

test("共有APIへJPEGファイルを1件だけ渡し、自動ダウンロードしない", async () => {
  const jpeg = { name: "card.jpg", type: "image/jpeg" };
  let payload;
  const navigatorObject = {
    canShare: ({ files }) => files.length === 1 && files[0] === jpeg,
    share: async (value) => { payload = value; }
  };
  await shareSnsCardFile(navigatorObject, jpeg, { title: "Fishing Log", text: "アジの釣果カード" });
  assert.deepEqual(payload, { files: [jpeg], title: "Fishing Log", text: "アジの釣果カード" });
  assert.equal("download" in payload, false);
});

test("UIは共有を主ボタン、JPEG保存を代替導線として表示する", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8")
  ]);
  const actions = html.match(/<div class="sns-actions">[\s\S]*?<\/div>/)?.[0] || "";
  assert.match(actions, /id="snsShareButton" class="button button-primary/);
  assert.match(actions, /id="snsSaveButton" class="button button-secondary"[^>]*>JPEGを保存/);
  assert.ok(actions.indexOf("snsShareButton") < actions.indexOf("snsSaveButton"));
  assert.match(app, /shareSnsCardFile\(navigator, file/);
  assert.match(app, /error\?\.name === "AbortError"/);
  assert.match(app, /共有をキャンセルしました/);
  assert.match(app, /JPEGを保存/);
  assert.doesNotMatch(app, /downloadSnsCard\(blob, filename\)[\s\S]{0,200}navigator\.share/);
});
