import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { resetCatchTimeIfCleared } from "../catch-form.js";

test("cleared time resets to local current time and preserves the selected date", () => {
  const elements = { catchDate: { value: "2026-08-08" }, catchTime: { value: "" } };
  assert.equal(resetCatchTimeIfCleared(elements, new Date(2026, 7, 12, 6, 7)), true);
  assert.deepEqual([elements.catchDate.value, elements.catchTime.value], ["2026-08-08", "06:07"]);

  elements.catchTime.value = "05:30";
  assert.equal(resetCatchTimeIfCleared(elements, new Date(2026, 7, 12, 8, 9)), false);
  assert.deepEqual([elements.catchDate.value, elements.catchTime.value], ["2026-08-08", "05:30"]);
});

test("time clear handler resets before recalculating tide", () => {
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /catchTime\.addEventListener\("change", \(\) => \{\s*resetCatchTimeIfCleared\(elements\);\s*void initializeTide\(\)/);
});

test("backup UI uses plain language and explains emergency file saving", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(html, />データを保存する</);
  assert.match(html, />保存したデータを読み込む</);
  assert.match(html, /端末のデータが消えた場合に備えて/);
  assert.match(html, /写真は含まれません/);
  assert.match(html, /保存するたびに新しいファイルが作成されます/);
  assert.doesNotMatch(html, /バックアップを書き出す|バックアップから復元/);
  assert.match(app, /保存画面を開きました/);
  assert.match(app, /iPhoneなどでは共有メニューから「ファイルに保存」/);
  assert.doesNotMatch(app, /件の釣果をバックアップしました/);
  assert.match(app, /件の釣果データを読み込みました/);
});
