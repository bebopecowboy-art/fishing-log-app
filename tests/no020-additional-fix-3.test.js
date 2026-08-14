import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SNS_CARD_LAYOUT } from "../sns-card-renderer.js";

test("No.020追加修正3: プレビュー、写真調整、カードカラーのDOM順を維持する", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const preview = html.indexOf('id="snsCardPreview"');
  const photo = html.indexOf('class="sns-photo-controls"');
  const theme = html.indexOf('id="snsThemeControls"');
  const followingControls = html.indexOf('id="snsCardControls"');

  assert.ok(preview >= 0 && preview < photo);
  assert.ok(photo < theme);
  assert.ok(theme < followingControls);
  assert.match(html.slice(photo, theme), /snsPhotoScale[\s\S]+snsPhotoResetButton/);
  assert.match(html.slice(theme, followingControls), /data-theme="cream"[\s\S]+data-theme="mint"[\s\S]+data-theme="sky"[\s\S]+data-theme="sand"/);
});

test("No.020追加修正3: Otomoだけを右へ移動しワードマークを維持する", () => {
  assert.deepEqual(SNS_CARD_LAYOUT.character, { x: 610, y: 970, width: 400 });
  assert.deepEqual(SNS_CARD_LAYOUT.wordmark, { x: 650, y: 1195, width: 390 });
});

test("No.020追加修正3: 表示バージョンだけを0.20.3へ更新する", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /Otomo Fishing Beta \/ Version 0\.20\.3/);
  assert.doesNotMatch(html, /Otomo Fishing Beta \/ Version 0\.20\.2/);
});
