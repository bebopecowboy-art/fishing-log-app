import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SNS_CARD_LAYOUT, SNS_CARD_PHOTO_FILTER, SNS_CARD_THEMES } from "../sns-card-renderer.js";

test("No.020追加修正2: Otomoだけを下げ、ワードマークと写真枠を維持する", () => {
  assert.deepEqual(SNS_CARD_LAYOUT.character, { x: 610, y: 970, width: 400 });
  assert.deepEqual(SNS_CARD_LAYOUT.wordmark, { x: 650, y: 1195, width: 390 });
  assert.deepEqual(SNS_CARD_LAYOUT.photo, { x: 43, y: 43, width: 994, height: 740, radius: 30, borderWidth: 6 });
});

test("No.020追加修正2: 背景と写真枠だけを指定色へ更新する", () => {
  assert.deepEqual(SNS_CARD_THEMES, {
    cream: { label: "クリーム", background: "#F2E9D8", accent: "#173C5A", text: "#111820" },
    mint: { label: "ミント", background: "#BFE0D6", accent: "#146A65", text: "#15333A" },
    sky: { label: "スカイ", background: "#C6DAEE", accent: "#245F8B", text: "#172D40" },
    sand: { label: "サンド", background: "#DFC09C", accent: "#6F5728", text: "#392B23" }
  });
  assert.equal(SNS_CARD_PHOTO_FILTER.canvas, "saturate(92%) contrast(96%) sepia(6%) brightness(102%)");
});

test("No.020追加修正2: 現行表示バージョンと4枚の1080×1350確認画像がある", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /Otomo Fishing Beta \/ Version 0\.22\.1/);
  for (const theme of Object.keys(SNS_CARD_THEMES)) {
    const png = await readFile(new URL(`../docs/no020-additional-fix-2-verification/sns-card-${theme}.png`, import.meta.url));
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.readUInt32BE(16), 1080);
    assert.equal(png.readUInt32BE(20), 1350);
  }
});
