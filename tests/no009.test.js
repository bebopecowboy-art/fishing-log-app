import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applySnsPhotoAdjustmentToLogs,
  calculateSnsPhotoCrop,
  normalizeSnsPhotoAdjustment,
  SNS_PHOTO_ADJUSTMENT_DEFAULTS,
  SNS_PHOTO_SCALE_MAX,
  SNS_PHOTO_SCALE_MIN
} from "../sns-photo-adjustment.js";

test("旧ログの調整値欠損は中央・100%として復元する", () => {
  assert.deepEqual(normalizeSnsPhotoAdjustment(undefined), SNS_PHOTO_ADJUSTMENT_DEFAULTS);
  assert.deepEqual(normalizeSnsPhotoAdjustment({ x: "invalid", y: null, scale: 0 }), { x: 0, y: 0, scale: 1 });
});

test("写真調整値を実用範囲へ制限する", () => {
  assert.deepEqual(normalizeSnsPhotoAdjustment({ x: 4, y: -8, scale: 10 }), {
    x: 1,
    y: -1,
    scale: SNS_PHOTO_SCALE_MAX
  });
  assert.equal(normalizeSnsPhotoAdjustment({ scale: 1.5 }).scale, 1.5);
  assert.equal(SNS_PHOTO_SCALE_MIN, 1);
  assert.equal(SNS_PHOTO_SCALE_MAX, 3);
});

test("中央・拡大・上下左右の調整を切り抜き座標へ反映する", () => {
  const center = calculateSnsPhotoCrop(1600, 900, 1080, 783, { x: 0, y: 0, scale: 1 });
  const leftTop = calculateSnsPhotoCrop(1600, 900, 1080, 783, { x: -1, y: -1, scale: 2 });
  const rightBottom = calculateSnsPhotoCrop(1600, 900, 1080, 783, { x: 1, y: 1, scale: 2 });
  assert.ok(center.sourceX > 0);
  assert.equal(center.sourceY, 0);
  assert.equal(leftTop.sourceX, 0);
  assert.equal(leftTop.sourceY, 0);
  assert.ok(rightBottom.sourceX > center.sourceX);
  assert.ok(rightBottom.sourceY > center.sourceY);
  assert.ok(rightBottom.sourceWidth < center.sourceWidth);
  assert.ok(rightBottom.sourceHeight < center.sourceHeight);
});

test("調整値は対象ログだけへ保存し、他ログと元配列を変更しない", () => {
  const logs = [{ id: "old", name: "旧ログ" }, { id: "target", name: "アジ" }];
  const result = applySnsPhotoAdjustmentToLogs(logs, "target", { x: 0.4, y: -0.2, scale: 1.8 });
  assert.equal(result.logs[0], logs[0]);
  assert.deepEqual(result.updatedLog.snsPhotoAdjustment, { x: 0.4, y: -0.2, scale: 1.8 });
  assert.equal(logs[1].snsPhotoAdjustment, undefined);
});

test("存在しないログと写真なし相当の配列を安全に扱う", () => {
  assert.deepEqual(applySnsPhotoAdjustmentToLogs([], "missing", {}).logs, []);
  assert.equal(applySnsPhotoAdjustmentToLogs([{ id: "old" }], "missing", {}).updatedLog, null);
});

test("写真調整UIはドラッグ・ピンチ・スライダー・リセット操作を備える", async () => {
  const [html, css, app, gesture] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../style.css", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../sns-photo-gesture.js", import.meta.url), "utf8")
  ]);
  assert.match(html, /id="snsPhotoScale"[^>]*type="range"[^>]*min="100"[^>]*max="300"/);
  assert.match(html, /id="snsPhotoResetButton"/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(app, /addEventListener\("pointermove"/);
  assert.match(gesture, /type:\s*"pinch"/);
  assert.match(app, /photoSelectionName\.textContent\s*=\s*""/);
});
