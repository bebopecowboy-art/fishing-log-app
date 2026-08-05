import test from "node:test";
import assert from "node:assert/strict";
import { getCatchDetail, getTideDetail } from "../catch-detail.js";

test("新規データの詳細に保存時の潮汐スナップショットを表示できる", () => {
  const detail = getCatchDetail({
    date: "2026/7/25",
    time: "14:30",
    place: "呉港",
    name: "アジ",
    size: "24.5",
    weather: "晴れ",
    temperature: 28,
    memo: "表層で反応",
    tide: {
      tideCycle: "中潮",
      trendLabel: "上げ潮",
      estimatedHeight: 182,
      station: { name: "呉" },
      previousExtreme: { type: "low", time: "2026-07-25T01:00:00.000Z", height: 42 },
      nextExtreme: { type: "high", time: "2026-07-25T07:00:00.000Z", height: 281 }
    }
  });

  assert.equal(detail.name, "アジ");
  assert.equal(detail.size, "24.5 cm");
  assert.equal(detail.weather, "晴れ / 28℃");
  assert.equal(detail.tide.summary, "中潮・上げ潮・約182 cm");
  assert.equal(detail.tide.station, "呉");
  assert.equal(detail.memo, "表層で反応");
});

test("潮情報を持たない以前のデータも安全に詳細化できる", () => {
  const detail = getCatchDetail({ name: "メバル" });
  assert.equal(detail.date, "未記録");
  assert.equal(detail.place, "未記録");
  assert.equal(detail.weather, "未記録");
  assert.equal(detail.tide.available, false);
  assert.equal(detail.tide.summary, "保存時の潮情報はありません");
});

test("不完全な旧形式の潮情報でもエラーにならない", () => {
  assert.doesNotThrow(() => getTideDetail({ station: null, estimatedHeight: "不明" }));
  assert.equal(getTideDetail({ station: null }).available, false);
});
