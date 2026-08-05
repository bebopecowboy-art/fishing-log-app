import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  canShareSnsCard,
  createSnsCardFilename,
  generateSnsCardJpeg,
  SNS_CARD_HEIGHT,
  SNS_CARD_JPEG_QUALITY,
  SNS_CARD_MIME_TYPE,
  SNS_CARD_WIDTH
} from "../sns-card-export.js";
import { SNS_CARD_DEFAULTS } from "../sns-card.js";

function createFakeDocument(operations) {
  const context = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "left",
    textBaseline: "top",
    fillRect: (...args) => operations.push(["fillRect", ...args]),
    clearRect: (...args) => operations.push(["clearRect", ...args]),
    drawImage: (...args) => operations.push(["drawImage", ...args]),
    fillText: (...args) => operations.push(["fillText", ...args]),
    measureText: (value) => ({ width: Array.from(value).length * 20 }),
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {}
  };
  return {
    createElement(type) {
      assert.equal(type, "canvas");
      return {
        width: 0,
        height: 0,
        getContext: () => context,
        toBlob: (callback, mimeType, quality) => {
          operations.push(["toBlob", mimeType, quality]);
          callback(new Blob(["jpeg"], { type: mimeType }));
        }
      };
    }
  };
}

class FakeImage {
  naturalWidth = 1600;
  naturalHeight = 900;
  set src(_value) { queueMicrotask(() => this.onload()); }
}

test("SNSカードJPEGは1080×1350、品質0.92で生成する", async () => {
  const operations = [];
  let canvas;
  const documentObject = createFakeDocument(operations);
  const originalCreate = documentObject.createElement;
  documentObject.createElement = (...args) => (canvas = originalCreate(...args));
  const blob = await generateSnsCardJpeg(
    { name: "アジ", size: "24", place: "呉港", memo: "釣果メモ" },
    "blob:photo",
    SNS_CARD_DEFAULTS,
    { documentObject, ImageConstructor: FakeImage }
  );
  assert.equal(canvas.width, SNS_CARD_WIDTH);
  assert.equal(canvas.height, SNS_CARD_HEIGHT);
  assert.equal(blob.type, SNS_CARD_MIME_TYPE);
  assert.equal(SNS_CARD_MIME_TYPE, "image/jpeg");
  assert.equal(SNS_CARD_JPEG_QUALITY, 0.92);
  assert.ok(operations.some(([type, mimeType, quality]) => type === "toBlob" && mimeType === "image/jpeg" && quality === 0.92));
  assert.ok(operations.some(([type]) => type === "drawImage"));
});

test("場所OFFではJPEG描画データにも場所を含めない", async () => {
  const operations = [];
  await generateSnsCardJpeg(
    { name: "アジ", place: "秘密の釣り場", memo: "あ".repeat(100) },
    null,
    { ...SNS_CARD_DEFAULTS, place: false },
    { documentObject: createFakeDocument(operations) }
  );
  const paintedText = operations.filter(([type]) => type === "fillText").map(([, value]) => value).join("|");
  assert.doesNotMatch(paintedText, /秘密の釣り場/);
  assert.match(paintedText, /…/);
});

test("共有可否はWeb Share APIと画像ファイル対応を確認する", () => {
  const file = { name: "card.jpg", type: "image/jpeg" };
  assert.equal(canShareSnsCard({}, file), false);
  assert.equal(canShareSnsCard({ share() {} }, file), false);
  assert.equal(canShareSnsCard({ share() {}, canShare: ({ files }) => files[0] === file }, file), true);
  assert.equal(canShareSnsCard({ share() {}, canShare: () => false }, file), false);
  assert.equal(canShareSnsCard({ share() {}, canShare: () => { throw new Error("unsupported"); } }, file), false);
});

test("保存ファイル名からOSで使用できない文字を除去する", () => {
  assert.equal(createSnsCardFilename({ date: "2026/8/1", name: "アジ:大/物" }), "fishing-log-202681-アジ-大-物.jpg");
});

test("画面に保存結果の通知領域と保存・共有ボタンがある", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /id="snsActionStatus"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="snsSaveButton"/);
  assert.match(html, /id="snsShareButton"/);
});
