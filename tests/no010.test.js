import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { resetCatchForm } from "../catch-form.js";

test("resetCatchForm clears every catch input and delegates photo cleanup", () => {
  const elements = Object.fromEntries(
    ["fishingPlace", "fishName", "fishSize", "fishingMethod", "memo"]
      .map((name) => [name, { value: `previous-${name}` }])
  );
  let photoWasCleared = false;
  resetCatchForm(elements, () => { photoWasCleared = true; });
  for (const element of Object.values(elements)) assert.equal(element.value, "");
  assert.equal(photoWasCleared, true);
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
