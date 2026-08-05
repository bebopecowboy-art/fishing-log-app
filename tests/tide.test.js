import test from "node:test";
import assert from "node:assert/strict";
import { KureTideProvider } from "../providers/kure-provider.js";
import { createTideSnapshot, deriveTideState, getTideCycle, interpolateHeight } from "../tide/domain.js";
import { renderTideGraph } from "../tide/view.js";

class FakeElement {
  constructor(name) {
    this.name = name;
    this.attributes = {};
    this.children = [];
    this.textContent = "";
  }

  setAttribute(key, value) {
    this.attributes[key] = String(value);
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = children;
  }
}

test("呉Providerが共通TideDayを返す", async () => {
  const tideDay = await new KureTideProvider().getTideDay({ date: "2026-07-21" });
  assert.equal(tideDay.schemaVersion, 1);
  assert.equal(tideDay.station.id, "jma-Q9");
  assert.equal(tideDay.extremes.length, 4);
  assert.equal(tideDay.series.length, 25);
  assert.equal(tideDay.source.provider, "jma");
});

test("満干潮の中間潮位を余弦補間する", () => {
  const before = { time: new Date("2026-07-21T08:00:00+09:00"), height: 100 };
  const after = { time: new Date("2026-07-21T10:00:00+09:00"), height: 300 };
  assert.equal(interpolateHeight(before, after, new Date("2026-07-21T09:00:00+09:00")), 200);
});

test("次の満潮へ向かう時間帯を上げ潮と判定する", async () => {
  const tideDay = await new KureTideProvider().getTideDay({ date: "2026-07-21" });
  const state = deriveTideState(tideDay, new Date("2026-07-21T12:00:00+09:00"));
  assert.equal(state.trend, "rising");
  assert.equal(state.nextExtreme.type, "high");
});

test("満潮直前を潮止まり付近と判定する", async () => {
  const tideDay = await new KureTideProvider().getTideDay({ date: "2026-07-21" });
  const state = deriveTideState(tideDay, new Date("2026-07-21T14:20:00+09:00"));
  assert.equal(state.trend, "slack");
});

test("上弦の日を小潮として表示する", () => {
  assert.equal(getTideCycle(new Date("2026-07-21T12:00:00+09:00")), "小潮");
});

test("保存用TideSnapshotは共通情報だけを保持する", async () => {
  const tideDay = await new KureTideProvider().getTideDay({ date: "2026-07-21" });
  const snapshot = createTideSnapshot(tideDay, new Date("2026-07-21T12:00:00+09:00"));
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.station.name, "呉");
  assert.equal(snapshot.source.provider, "jma");
  assert.equal(snapshot.trendLabel, "上げ潮");
  assert.equal("series" in snapshot, false);
});

test("SVGタイドグラフへ潮位線・満干潮・現在時刻を描画する", async () => {
  const originalDocument = globalThis.document;
  globalThis.document = {
    createElementNS: (_namespace, name) => new FakeElement(name)
  };
  try {
    const tideDay = await new KureTideProvider().getTideDay({ date: "2026-07-21" });
    const svg = new FakeElement("svg");
    renderTideGraph(svg, tideDay, new Date("2026-07-21T12:00:00+09:00"));
    assert.equal(svg.attributes.role, "img");
    assert.ok(svg.children.some((child) => child.name === "path" && child.attributes.class === "tide-line"));
    assert.equal(svg.children.filter((child) => child.name === "circle").length, 4);
    assert.ok(svg.children.some((child) => child.attributes.class === "tide-now-line"));
  } finally {
    globalThis.document = originalDocument;
  }
});

test("対象期間外は説明可能なエラーを返す", async () => {
  await assert.rejects(
    () => new KureTideProvider().getTideDay({ date: "2027-01-01" }),
    /対象期間外/
  );
});
