import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createLatestFrameScheduler } from "../latest-frame-scheduler.js";
import {
  SNS_PINCH_MIN_DISTANCE,
  cancelSnsPhotoGesture,
  createSnsPhotoGestureState,
  finishSnsPhotoPointer,
  moveSnsPhotoPointer,
  startSnsPhotoPointer
} from "../sns-photo-gesture.js";

const pointer = (pointerId, clientX, clientY) => ({ pointerId, clientX, clientY });

test("No.025: pinch starts, clamps scale, changes to drag, and ends safely", () => {
  const state = createSnsPhotoGestureState();
  let adjustment = { x: 0, y: 0, scale: 1 };
  assert.equal(startSnsPhotoPointer(state, pointer(1, 0, 0), adjustment).type, "drag");
  assert.equal(startSnsPhotoPointer(state, pointer(2, 100, 0), adjustment).type, "pinch");
  adjustment = moveSnsPhotoPointer(state, pointer(2, 400, 0), adjustment, { width: 300, height: 300 });
  assert.equal(adjustment.scale, 3);
  assert.equal(finishSnsPhotoPointer(state, 2, adjustment).type, "drag");
  adjustment = moveSnsPhotoPointer(state, pointer(1, 30, 15), adjustment, { width: 300, height: 150 });
  assert.deepEqual(adjustment, { x: -0.2, y: -0.2, scale: 3 });
  assert.equal(finishSnsPhotoPointer(state, 1, adjustment), null);
  assert.equal(state.pointers.size, 0);
});

test("No.025: zero, tiny, and invalid pinch distances never reach adjustment", () => {
  for (const second of [
    pointer(2, 0, 0),
    pointer(2, SNS_PINCH_MIN_DISTANCE / 2, 0),
    pointer(2, Number.NaN, 0),
    pointer(2, Number.POSITIVE_INFINITY, 0)
  ]) {
    const state = createSnsPhotoGestureState();
    const adjustment = { x: 0, y: 0, scale: 1.5 };
    startSnsPhotoPointer(state, pointer(1, 0, 0), adjustment);
    assert.equal(startSnsPhotoPointer(state, second, adjustment), null);
    assert.deepEqual(moveSnsPhotoPointer(state, second, adjustment), adjustment);
  }
});

test("No.025: invalid adjustment values and out-of-range pinch results are normalized", () => {
  const state = createSnsPhotoGestureState();
  let adjustment = { x: Number.NaN, y: Number.NEGATIVE_INFINITY, scale: -10 };
  startSnsPhotoPointer(state, pointer(1, 0, 0), adjustment);
  startSnsPhotoPointer(state, pointer(2, 10, 0), adjustment);
  adjustment = moveSnsPhotoPointer(state, pointer(2, 1_000_000, 0), adjustment);
  assert.deepEqual(adjustment, { x: 0, y: 0, scale: 3 });
  cancelSnsPhotoGesture(state);
  assert.equal(state.pointers.size, 0);
  assert.equal(state.gesture, null);
});

test("No.025: rapid updates schedule at most one frame and one latest follow-up", async () => {
  const frames = [];
  let releases = [];
  let runs = 0;
  const scheduler = createLatestFrameScheduler(
    () => new Promise((resolve) => { runs += 1; releases.push(resolve); }),
    { requestFrame: (callback) => (frames.push(callback), frames.length), cancelFrame: () => {} }
  );
  for (let index = 0; index < 100; index += 1) scheduler.request();
  assert.equal(frames.length, 1);
  const firstFrame = frames.shift();
  const firstRun = firstFrame();
  scheduler.request();
  scheduler.request();
  assert.deepEqual(scheduler.getState(), { pending: true, running: true, scheduled: false });
  releases.shift()();
  await firstRun;
  assert.equal(frames.length, 1);
  const secondRun = frames.shift()();
  releases.shift()();
  await secondRun;
  assert.equal(runs, 2);
  assert.deepEqual(scheduler.getState(), { pending: false, running: false, scheduled: false });
});

test("No.025: integration keeps pointer cancellation, non-passive handling, image reuse, export render, and current Version", async () => {
  const [app, renderer, css, html] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../sns-card-renderer.js", import.meta.url), "utf8"),
    readFile(new URL("../style.css", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8")
  ]);
  assert.match(app, /createLatestFrameScheduler/);
  assert.match(app, /pointercancel/);
  assert.match(app, /lostpointercapture/);
  assert.match(app, /passive:\s*false/);
  assert.match(app, /generateSnsCardJpeg\(exportLog/);
  assert.match(renderer, /imageCache/);
  assert.match(css, /\.sns-card-photo[\s\S]*?touch-action:\s*none/);
  assert.match(html, /Otomo Fishing Beta \/ Version 0\.22\.3/);
});
