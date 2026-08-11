import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { readCatchDateTime, resetCatchForm, setCatchDateTime } from "../catch-form.js";

test("resetCatchForm clears every catch input and delegates photo cleanup", () => {
  const elements = Object.fromEntries(
    ["fishingPlace", "fishName", "fishSize", "fishingMethod", "memo", "catchDate", "catchTime"]
      .map((name) => [name, { value: `previous-${name}` }])
  );
  let photoWasCleared = false;
  resetCatchForm(elements, () => { photoWasCleared = true; }, new Date(2026, 7, 11, 7, 43));
  for (const name of ["fishingPlace", "fishName", "fishSize", "fishingMethod", "memo"])
    assert.equal(elements[name].value, "");
  assert.equal(elements.catchDate.value, "2026-08-11");
  assert.equal(elements.catchTime.value, "07:43");
  assert.equal(photoWasCleared, true);
});

test("catch date and time initialize from local current time", () => {
  const elements = { catchDate: { value: "" }, catchTime: { value: "" } };
  setCatchDateTime(elements, new Date(2026, 7, 11, 7, 40));
  assert.deepEqual([elements.catchDate.value, elements.catchTime.value], ["2026-08-11", "07:40"]);
});

test("manually selected past date and time are preserved for saving", () => {
  const elements = { catchDate: { value: "2026-08-10" }, catchTime: { value: "18:25" } };
  const result = readCatchDateTime(elements);
  assert.equal(result.date, "2026/8/10");
  assert.equal(result.time, "18:25");
  assert.equal(result.caughtAt.getFullYear(), 2026);
  assert.equal(result.caughtAt.getMonth(), 7);
  assert.equal(result.caughtAt.getDate(), 10);
});

test("save success resets the form and starts a reusable environment refresh", () => {
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /resetCatchForm\(elements, clearSelectedPhoto\)/);
  assert.match(app, /void refreshEnvironment\(\)/);
  assert.match(app, /function refreshEnvironment\(\)/);
  assert.match(app, /initializeTide\(\)/);
});

test("location and weather failures clear stale state without disabling saving", () => {
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /function handleLocationFailure[\s\S]*?fishingPlace\.value = ""/);
  assert.match(app, /現在地を取得できませんでした。場所を手入力してください。/);
  assert.match(app, /currentTemperature = "";[\s\S]*?currentWeather = "";[\s\S]*?天気を取得できませんでした/);
});
