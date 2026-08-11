import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { KureTideProvider } from "../providers/kure-provider.js";
import { createTideSnapshot } from "../tide/domain.js";
import { renderTideUnavailable } from "../tide/view.js";

test("user-facing application name is Otomo Fishing and No.015 icons remain", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /<title>Otomo Fishing<\/title>/);
  assert.match(html, /name="application-name" content="Otomo Fishing"/);
  assert.match(html, /name="apple-mobile-web-app-title" content="Otomo Fishing"/);
  assert.match(html, /<h1>Otomo Fishing<\/h1>/);
  assert.doesNotMatch(html, /釣果メモアプリ|<h1>釣果メモ<\/h1>/);
  assert.match(html, /otomo-icon-32\.png\?v=15/);
  assert.match(html, /otomo-icon-180\.png\?v=15/);
});

test("another available date and selected time produce a matching tide snapshot", async () => {
  const provider = new KureTideProvider();
  const tideDay = await provider.getTideDay({ date: "2026-08-08" });
  const selectedTime = new Date("2026-08-08T05:30:00+09:00");
  const snapshot = createTideSnapshot(tideDay, selectedTime);
  assert.equal(tideDay.date, "2026-08-08");
  assert.equal(snapshot.observedAt, selectedTime.toISOString());
  assert.equal(snapshot.source.dataYear, 2026);
});

test("an unavailable year is rejected instead of substituting another tide day", async () => {
  await assert.rejects(
    () => new KureTideProvider().getTideDay({ date: "2025-08-08" }),
    /対象期間外/
  );
});

test("unavailable rendering clears stale tide information", () => {
  const textElement = (textContent = "stale") => ({
    textContent,
    removeAttribute(name) { delete this[name]; }
  });
  const childrenElement = () => ({ cleared: false, replaceChildren() { this.cleared = true; } });
  const elements = {
    panel: { classList: { remove() {} } },
    status: textElement(), level: textElement(), next: textElement(), station: textElement(),
    source: { ...textElement(), href: "old" }, graph: childrenElement(), extremes: childrenElement()
  };
  renderTideUnavailable(elements);
  assert.equal(elements.status.textContent, "この日時の潮データはありません");
  assert.equal(elements.level.textContent, "潮情報なしで保存できます");
  assert.equal(elements.graph.cleared, true);
  assert.equal(elements.extremes.cleared, true);
  assert.equal("href" in elements.source, false);
});

test("date and time changes trigger tide refresh and save revalidates selected tide data", () => {
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /catchDate\.addEventListener\("change", \(\) => void initializeTide\(\)\)/);
  assert.match(app, /catchTime\.addEventListener\("change", \(\) => void initializeTide\(\)\)/);
  assert.match(app, /const tideDay = await getTideDayForCatchDateTime\(catchDateTime\)/);
  assert.match(app, /createTideSnapshot\(tideDay, catchDateTime\.caughtAt\)/);
  assert.match(app, /renderTideUnavailable\(elements\.tide\)/);
});
