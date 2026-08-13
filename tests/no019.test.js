import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createSearchTerms, filterFishingLogs, normalizeSearchText } from "../log-search.js";

const logs = [
  { name: "マダイ", place: "音戸町波多見", method: "ジグヘッド", memo: "NIGHT GAME", date: "2026-08-13" },
  { name: "アジ", place: "呉港", method: "サビキ", memo: "常夜灯", date: "2026-08-12" },
  { name: null, place: undefined, method: 123, memo: "", weather: "マダイ" },
  { name: "ひらめ", place: "はたみ", method: "みゃく釣り", memo: "ぱわー", date: "2026-08-11" }
];

test("No.019: searches only the four specified fields by partial match", () => {
  assert.deepEqual(filterFishingLogs(logs, "波多見").map(({ index }) => index), [0]);
  assert.deepEqual(filterFishingLogs(logs, "ジグ").map(({ index }) => index), [0]);
  assert.deepEqual(filterFishingLogs(logs, "夜灯").map(({ index }) => index), [1]);
  assert.deepEqual(filterFishingLogs(logs, "2026").map(({ index }) => index), []);
  assert.deepEqual(filterFishingLogs(logs, "weather").map(({ index }) => index), []);
});

test("No.019: normalizes case, width, and whitespace", () => {
  assert.equal(normalizeSearchText(" ＮＩＧＨＴ "), "night");
  assert.deepEqual(filterFishingLogs(logs, "ｎｉｇｈｔ").map(({ index }) => index), [0]);
  assert.deepEqual(createSearchTerms("  マダイ　　波多見  "), ["まだい", "波多見"]);
});

test("No.019 additional fix: treats hiragana, katakana, and half-width katakana equally", () => {
  assert.deepEqual(filterFishingLogs(logs, "あ").map(({ index }) => index), [1]);
  assert.deepEqual(filterFishingLogs(logs, "あじ").map(({ index }) => index), [1]);
  assert.deepEqual(filterFishingLogs(logs, "アジ").map(({ index }) => index), [1]);
  assert.deepEqual(filterFishingLogs(logs, "ｱｼﾞ").map(({ index }) => index), [1]);
  assert.deepEqual(filterFishingLogs(logs, "まだい").map(({ index }) => index), [0]);
  assert.deepEqual(filterFishingLogs(logs, "じぐへっど").map(({ index }) => index), [0]);
  assert.deepEqual(filterFishingLogs(logs, "ヒラメ ハタミ").map(({ index }) => index), [3]);
});

test("No.019 additional fix: preserves voiced, semi-voiced, small kana, and long sound marks", () => {
  assert.equal(normalizeSearchText("ジグヘッド"), "じぐへっど");
  assert.equal(normalizeSearchText("パワー"), "ぱわー");
  assert.equal(normalizeSearchText("ミャク"), "みゃく");
  assert.deepEqual(filterFishingLogs(logs, "パワー ミャク").map(({ index }) => index), [3]);
});

test("No.019 additional fix: does not convert kanji to kana", () => {
  const kanjiLogs = [
    { name: "鯵", place: "音戸町波多見", method: "", memo: "" },
    { name: "真鯛", place: "", method: "", memo: "" }
  ];
  assert.deepEqual(filterFishingLogs(kanjiLogs, "アジ"), []);
  assert.deepEqual(filterFishingLogs(kanjiLogs, "マダイ"), []);
  assert.deepEqual(filterFishingLogs(kanjiLogs, "はたみ"), []);
  assert.deepEqual(filterFishingLogs(kanjiLogs, "波多見").map(({ index }) => index), [0]);
});

test("No.019: applies AND matching across the searchable fields", () => {
  assert.deepEqual(filterFishingLogs(logs, "マダイ ジグ").map(({ index }) => index), [0]);
  assert.deepEqual(filterFishingLogs(logs, "マダイ 波多見").map(({ index }) => index), [0]);
  assert.deepEqual(filterFishingLogs(logs, "マダイ サビキ").map(({ index }) => index), []);
});

test("No.019: blank searches preserve order and tolerate legacy values", () => {
  assert.deepEqual(filterFishingLogs(logs, "　 ").map(({ index }) => index), [0, 1, 2, 3]);
  assert.deepEqual(filterFishingLogs(logs, "123").map(({ index }) => index), [2]);
});

test("No.019: required UI and version text are present", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /id="logsHeading"[\s\S]*id="logSearchInput"[\s\S]*id="resultArea"/);
  assert.match(html, /placeholder="魚種・場所・釣り方・メモを検索"/);
  assert.match(html, /Otomo Fishing Beta \/ Version 0\.19\.1/);
});
