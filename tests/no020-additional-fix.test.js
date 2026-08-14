import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeSnsCardTheme, SNS_CARD_LAYOUT, SNS_CARD_THEMES, SNS_CARD_WORDMARK_URL } from "../sns-card-renderer.js";

test("No.020追加修正: 4テーマを指定色で一元管理する", () => {
  assert.deepEqual(Object.keys(SNS_CARD_THEMES), ["cream", "mint", "sky", "sand"]);
  assert.equal(SNS_CARD_THEMES.cream.background, "#F3E9D8");
  assert.equal(SNS_CARD_THEMES.mint.photoFrame, "#BBD8D1");
  assert.equal(SNS_CARD_THEMES.sky.text, "#172D40");
  assert.equal(SNS_CARD_THEMES.sand.icon, "#6E5B35");
  assert.equal(normalizeSnsCardTheme("invalid"), "cream");
});

test("No.020追加修正: ワードマークとOtomoの座標を集約する", () => {
  assert.equal(SNS_CARD_WORDMARK_URL, "assets/otomo-fishing-wordmark.png");
  assert.deepEqual(SNS_CARD_LAYOUT.wordmark, { x: 650, y: 1195, width: 390 });
  assert.deepEqual(SNS_CARD_LAYOUT.character, { x: 610, y: 970, width: 400 });
});

test("No.020追加修正: Canvasプレビュー、テーマUI、設定分離、0.20.1を備える", async () => {
  const [html, app, card, renderer] = await Promise.all(["index.html", "app.js", "sns-card.js", "sns-card-renderer.js"].map((file) => readFile(new URL(`../${file}`, import.meta.url), "utf8")));
  assert.match(html, /カードカラー[\s\S]+クリーム[\s\S]+ミント[\s\S]+スカイ[\s\S]+サンド/);
  assert.match(html, /Version 0\.20\.3/);
  assert.match(app, /otomoFishingSnsCardTheme/);
  assert.match(app, /canvas\.toBlob/);
  assert.match(card, /renderSnsCardCanvas/);
  assert.doesNotMatch(renderer, /Fishing Log/);
});
