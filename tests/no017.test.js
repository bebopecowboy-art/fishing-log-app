import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { resetCatchDateTimeIfDateCleared } from "../catch-form.js";
import {
  BACKUP_APP, BACKUP_FORMAT, BACKUP_VERSION, createBackupFilename,
  mergeFishingLogs, parseFishingLogBackup, serializeFishingLogBackup
} from "../log-backup.js";

test("cleared date resets both local date and time", () => {
  const elements = { catchDate: { value: "" }, catchTime: { value: "05:30" } };
  assert.equal(resetCatchDateTimeIfDateCleared(elements, new Date(2026, 7, 11, 23, 10)), true);
  assert.deepEqual([elements.catchDate.value, elements.catchTime.value], ["2026-08-11", "23:10"]);
  elements.catchDate.value = "2026-08-08";
  assert.equal(resetCatchDateTimeIfDateCleared(elements, new Date(2026, 7, 11, 23, 20)), false);
  assert.deepEqual([elements.catchDate.value, elements.catchTime.value], ["2026-08-08", "23:10"]);
});

test("date clear handler resets before recalculating tide", () => {
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /catchDate\.addEventListener\("change", \(\) => \{\s*resetCatchDateTimeIfDateCleared\(elements\);\s*void initializeTide\(\)/);
});

test("backup JSON identifies Otomo Fishing and preserves complete log fields", () => {
  const logs = [{ id: "log-1", date: "2026/8/8", time: "05:30", name: "アジ", photoId: "photo-1", custom: { safe: true } }];
  const text = serializeFishingLogBackup(logs, new Date("2026-08-11T14:10:00.000Z"));
  const backup = JSON.parse(text);
  assert.equal(backup.app, BACKUP_APP);
  assert.equal(backup.format, BACKUP_FORMAT);
  assert.equal(backup.version, BACKUP_VERSION);
  assert.equal(backup.exportedAt, "2026-08-11T14:10:00.000Z");
  assert.deepEqual(backup.logs, logs);
  assert.equal(text.includes("Blob"), false);
});

test("empty and multiple log backups remain parseable UTF-8 JSON", () => {
  assert.deepEqual(JSON.parse(serializeFishingLogBackup([])).logs, []);
  const logs = [{ id: "1", name: "鯵" }, { id: "2", memo: "日本語メモ" }];
  assert.deepEqual(JSON.parse(serializeFishingLogBackup(logs)).logs, logs);
});

test("backup filename uses safe local date and time", () => {
  assert.equal(createBackupFilename(new Date(2026, 7, 11, 23, 10)), "otomo-fishing-backup-20260811-2310.json");
});

test("valid backup restores logs and existing IDs win conflicts", () => {
  const text = serializeFishingLogBackup([
    { id: "existing", name: "古いバックアップ値", date: "2026/8/1", time: "10:00" },
    { id: "new", name: "メバル", date: "2026/8/10", time: "18:25", photoId: "missing-photo" }
  ]);
  const restored = parseFishingLogBackup(text);
  const existing = [{ id: "existing", name: "端末の新しい値", date: "2026/8/11", time: "07:40" }];
  const result = mergeFishingLogs(existing, restored);
  assert.equal(result.addedCount, 1);
  assert.equal(result.logs.length, 2);
  assert.equal(result.logs.find((log) => log.id === "existing").name, "端末の新しい値");
  assert.equal(result.logs.find((log) => log.id === "new").photoId, "missing-photo");
  assert.deepEqual(result.logs.map((log) => log.id), ["existing", "new"]);
});

test("duplicate restored IDs and empty logs do not create duplicates", () => {
  const duplicate = { id: "same", name: "アジ" };
  assert.equal(mergeFishingLogs([], [duplicate, { ...duplicate }]).addedCount, 1);
  assert.deepEqual(mergeFishingLogs([{ id: "same", name: "existing" }], []).logs, [{ id: "same", name: "existing" }]);
});

test("legacy logs without IDs use existing compatibility normalization", () => {
  const text = serializeFishingLogBackup([{ name: "旧ログ", date: "2026/8/1" }]);
  const restored = parseFishingLogBackup(text, () => "generated-id");
  assert.equal(restored[0].id, "generated-id");
});

test("invalid backups are rejected before existing logs can change", () => {
  const existing = [{ id: "safe", name: "既存" }];
  const invalidTexts = [
    "broken",
    JSON.stringify({ format: BACKUP_FORMAT, version: 1, logs: [] }),
    JSON.stringify({ app: BACKUP_APP, format: "other", version: 1, exportedAt: new Date().toISOString(), logs: [] }),
    JSON.stringify({ app: BACKUP_APP, format: BACKUP_FORMAT, version: 2, exportedAt: new Date().toISOString(), logs: [] }),
    JSON.stringify({ app: BACKUP_APP, format: BACKUP_FORMAT, version: 1, exportedAt: new Date().toISOString(), logs: {} }),
    JSON.stringify({ app: BACKUP_APP, format: BACKUP_FORMAT, version: 1, exportedAt: new Date().toISOString(), logs: ["bad"] }),
    JSON.stringify({ app: BACKUP_APP, format: BACKUP_FORMAT, version: 1, exportedAt: new Date().toISOString(), logs: [{ id: 123 }] })
  ];
  for (const text of invalidTexts) assert.throws(() => parseFishingLogBackup(text));
  assert.deepEqual(existing, [{ id: "safe", name: "既存" }]);
});

test("backup UI exports, imports, redraws, and reports restore counts", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(html, /データを保存する/);
  assert.match(html, /保存したデータを読み込む/);
  assert.match(html, /写真は含まれません/);
  assert.match(app, /persistFishingLogs\(merged\.logs\)[\s\S]*?fishingLogs = merged\.logs;[\s\S]*?showLogs\(\)/);
  assert.match(app, /件の釣果データを読み込みました/);
  assert.doesNotMatch(app, /localStorage\.clear|deleteDatabase/);
});
