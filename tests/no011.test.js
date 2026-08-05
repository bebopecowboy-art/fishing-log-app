import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createEditedLog, updateFishingLog } from "../log-editor.js";

const original = {
  id: "log-1", date: "2026/8/1", time: "12:34", latitude: 34.2, longitude: 132.5,
  weather: "晴れ", temperature: 28, tide: { tideCycle: "中潮", estimatedHeight: 123 },
  place: "旧場所", name: "アジ", size: "20", method: "旧釣法", memo: "旧メモ",
  photoId: "photo-old", photo: { width: 800, height: 600, type: "image/jpeg" },
  snsPhotoAdjustment: { x: 0.2, y: -0.3, scale: 1.4 }, legacyField: "維持"
};

function dependencies(overrides = {}) {
  const photos = new Map([["photo-old", { id: "photo-old", logId: "log-1", blob: new Blob(["old"]) }]]);
  let persisted = null;
  return {
    photos,
    get persisted() { return persisted; },
    options: {
      resizePhoto: async () => ({ blob: new Blob(["new"]), width: 1600, height: 1200, type: "image/jpeg", originalName: "new.jpg" }),
      createUuid: () => "photo-new",
      getPhoto: async (id) => photos.get(id) || null,
      savePhoto: async (record) => { photos.set(record.id, record); },
      deletePhoto: async (id) => { photos.delete(id); },
      persistLogs: (logs) => { persisted = logs; },
      ...overrides
    }
  };
}

const values = { place: "新場所", name: "メバル", size: "25", method: "ルアー", memo: "更新" };

test("編集対象だけを変え、ID・保存時情報・旧フィールドを維持する", () => {
  const edited = createEditedLog(original, values);
  assert.deepEqual(Object.fromEntries(Object.keys(values).map((key) => [key, edited[key]])), values);
  for (const key of ["id", "date", "time", "latitude", "longitude", "weather", "temperature", "tide", "legacyField", "photoId", "photo", "snsPhotoAdjustment"])
    assert.deepEqual(edited[key], original[key]);
});

test("同一ログを同じ位置で更新し、件数を増やさない", async () => {
  const deps = dependencies();
  const other = { id: "log-2", name: "タイ" };
  const result = await updateFishingLog({ logs: [other, original], targetId: original.id, values, ...deps.options });
  assert.equal(result.logs.length, 2);
  assert.equal(result.logs[0], other);
  assert.equal(result.logs[1].id, original.id);
  assert.equal(result.logs[1].date, original.date);
});

test("写真未変更では写真・メタデータ・SNS調整値とIndexedDBを維持する", async () => {
  const deps = dependencies();
  const result = await updateFishingLog({ logs: [original], targetId: original.id, values, ...deps.options });
  assert.equal(result.updatedLog.photoId, "photo-old");
  assert.deepEqual(result.updatedLog.snsPhotoAdjustment, original.snsPhotoAdjustment);
  assert.equal(deps.photos.has("photo-old"), true);
});

test("写真差し替えは新写真を保存して旧写真を削除し、調整値を初期化する", async () => {
  const deps = dependencies();
  const result = await updateFishingLog({ logs: [original], targetId: original.id, values,
    photoChange: { type: "replace", file: new Blob(["input"]) }, ...deps.options });
  assert.equal(result.updatedLog.photoId, "photo-new");
  assert.deepEqual(result.updatedLog.snsPhotoAdjustment, { x: 0, y: 0, scale: 1 });
  assert.equal(deps.photos.has("photo-old"), false);
  assert.equal(deps.photos.has("photo-new"), true);
});

test("写真削除後もログ本体を残し、写真参照と調整値だけを除く", async () => {
  const deps = dependencies();
  const result = await updateFishingLog({ logs: [original], targetId: original.id, values,
    photoChange: { type: "remove" }, ...deps.options });
  assert.equal(result.logs.length, 1);
  assert.equal(result.updatedLog.id, original.id);
  assert.equal("photoId" in result.updatedLog, false);
  assert.equal("snsPhotoAdjustment" in result.updatedLog, false);
  assert.equal(deps.photos.has("photo-old"), false);
});

test("新写真保存・画像変換・旧写真削除失敗ではログを更新しない", async () => {
  for (const failing of ["resizePhoto", "savePhoto", "deletePhoto"]) {
    let persisted = false;
    const deps = dependencies({
      [failing]: async () => { throw new Error(failing); },
      persistLogs: () => { persisted = true; }
    });
    await assert.rejects(() => updateFishingLog({ logs: [original], targetId: original.id, values,
      photoChange: { type: "replace", file: new Blob(["input"]) }, ...deps.options }));
    assert.equal(persisted, false);
    assert.equal(deps.photos.has("photo-old"), true);
    assert.equal(deps.photos.has("photo-new"), failing === "deletePhoto");
  }
});

test("localStorage更新失敗時は旧写真を復元して新写真を除去する", async () => {
  const deps = dependencies({ persistLogs: () => { throw new Error("quota"); } });
  await assert.rejects(() => updateFishingLog({ logs: [original], targetId: original.id, values,
    photoChange: { type: "replace", file: new Blob(["input"]) }, ...deps.options }), /quota/);
  assert.equal(deps.photos.has("photo-old"), true);
  assert.equal(deps.photos.has("photo-new"), false);
});

test("旧形式・潮なし・写真なしログも既存フィールドを失わず編集できる", async () => {
  const legacy = { id: "legacy-id", name: "", custom: 42 };
  const deps = dependencies();
  const result = await updateFishingLog({ logs: [legacy], targetId: legacy.id, values, ...deps.options });
  assert.equal(result.updatedLog.custom, 42);
  assert.equal(result.updatedLog.name, "メバル");
});

test("詳細の編集導線と編集・キャンセルUIを備える", async () => {
  const [app, detail, html] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../catch-detail.js", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8")
  ]);
  assert.match(detail, /options\.onEdit/);
  assert.match(app, /startEditingLog/);
  assert.match(app, /updateFishingLog/);
  assert.match(html, /id="editModeStatus"/);
  assert.match(html, /id="editCancelButton"/);
});
