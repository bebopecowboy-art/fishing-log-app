import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createLogYearOptions, filterFishingLogs, readLogYearMonth } from "../log-search.js";

const logs = [
  { name: "マダイ", place: "瀬戸内海", method: "タイラバ", memo: "朝", date: "2026-08-25" },
  { name: "アジ", place: "呉港", method: "サビキ", memo: "夜", date: "2025-08-10" },
  { name: "メバル", place: "呉港", method: "ワーム", memo: "夜", date: "2025-01-15" },
  { name: "旧データ", place: "不明", method: "", memo: "", date: "不明" },
  { name: "不正日付", place: "不明", method: "", memo: "", date: "2026-02-30" }
];

test("No.027: 年選択肢は実在する年だけを新しい順に生成する", () => {
  assert.deepEqual(createLogYearOptions(logs), [2026, 2025]);
});

test("No.027: 年、月、年と月、キーワードとのAND条件で絞り込む", () => {
  assert.deepEqual(filterFishingLogs(logs, "", { year: "2025" }).map(({ index }) => index), [1, 2]);
  assert.deepEqual(filterFishingLogs(logs, "", { month: "8" }).map(({ index }) => index), [0, 1]);
  assert.deepEqual(filterFishingLogs(logs, "", { year: "2025", month: "1" }).map(({ index }) => index), [2]);
  assert.deepEqual(filterFishingLogs(logs, "呉港 夜", { year: "2025", month: "8" }).map(({ index }) => index), [1]);
  assert.deepEqual(filterFishingLogs(logs, "", { year: "2024" }), []);
});

test("No.027: 全期間では不正・旧日付も表示し、ローカル日付を厳密に判定する", () => {
  assert.deepEqual(filterFishingLogs(logs, "").map(({ index }) => index), [0, 1, 2, 3, 4]);
  assert.deepEqual(readLogYearMonth("2026-12-31"), { year: 2026, month: 12 });
  assert.deepEqual(readLogYearMonth("2027-01-01T00:00:00Z"), { year: 2027, month: 1 });
  assert.equal(readLogYearMonth("2026-02-30"), null);
  assert.equal(readLogYearMonth("old"), null);
});

test("No.027: 年月UI、クリア連携、紹介ページ案内、Version 0.23.0が存在する", async () => {
  const [html, app, css, aboutHtml, aboutCss] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../style.css", import.meta.url), "utf8"),
    readFile(new URL("../about/index.html", import.meta.url), "utf8"),
    readFile(new URL("../about/about.css", import.meta.url), "utf8")
  ]);
  assert.match(html, /id="logYearFilter"[\s\S]*すべての年/);
  assert.match(html, /id="logMonthFilter"[\s\S]*すべての月[\s\S]*12月/);
  assert.match(app, /logYearFilter\.value = ""[\s\S]*logMonthFilter\.value = ""/);
  assert.match(css, /\.log-date-filters[^{]*\{[^}]*min-width:\s*0/);
  assert.match(aboutHtml, /ホーム画面に追加して、すぐ記録。/);
  assert.match(aboutHtml, /iPhone（Safari）[\s\S]*共有ボタン[\s\S]*Android（Chrome）[\s\S]*アプリをインストール/);
  assert.match(aboutCss, /\.home-screen-grid[\s\S]*@media \(max-width: 700px\)[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(html, /Otomo Fishing Beta \/ Version 0\.23\.0/);
});
