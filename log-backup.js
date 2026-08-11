import { ensureLogIds } from "./log-model.js";

export const BACKUP_APP = "Otomo Fishing";
export const BACKUP_FORMAT = "otomo-fishing-backup";
export const BACKUP_VERSION = 1;

function pad(value) {
  return String(value).padStart(2, "0");
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function isValidLog(log) {
  if (!isPlainObject(log)) return false;
  if (log.id !== undefined && (typeof log.id !== "string" || !log.id.trim())) return false;
  const stringFields = ["date", "time", "place", "weather", "name", "size", "method", "memo", "photoId"];
  if (stringFields.some((key) => log[key] !== undefined && typeof log[key] !== "string")) return false;
  const objectFields = ["tide", "photo", "snsPhotoAdjustment"];
  if (objectFields.some((key) => log[key] !== undefined && log[key] !== null && !isPlainObject(log[key]))) return false;
  return Boolean(log.id || stringFields.some((key) => key in log));
}

export function createFishingLogBackup(logs, now = new Date()) {
  if (!Array.isArray(logs)) throw new Error("バックアップ対象の釣果データが正しくありません");
  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    logs
  };
}

export function serializeFishingLogBackup(logs, now = new Date()) {
  return JSON.stringify(createFishingLogBackup(logs, now), null, 2);
}

export function createBackupFilename(now = new Date()) {
  return `otomo-fishing-backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

export function parseFishingLogBackup(text, uuidFactory) {
  let backup;
  try {
    backup = JSON.parse(text);
  } catch (_error) {
    throw new Error("JSONとして読み込めません");
  }
  if (!isPlainObject(backup)
      || backup.app !== BACKUP_APP
      || backup.format !== BACKUP_FORMAT) {
    throw new Error("Otomo Fishingのバックアップファイルではありません");
  }
  if (backup.version !== BACKUP_VERSION) throw new Error("対応していないバックアップバージョンです");
  if (typeof backup.exportedAt !== "string" || Number.isNaN(Date.parse(backup.exportedAt))) {
    throw new Error("バックアップ作成日時が正しくありません");
  }
  if (!Array.isArray(backup.logs) || !backup.logs.every(isValidLog)) {
    throw new Error("バックアップ内の釣果データが正しくありません");
  }
  return ensureLogIds(backup.logs.map((log) => ({ ...log })), uuidFactory).logs;
}

function logTimestamp(log) {
  const dateMatch = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(log?.date || "");
  const timeMatch = /^(\d{1,2}):(\d{2})/.exec(log?.time || "");
  if (!dateMatch) return Number.NEGATIVE_INFINITY;
  const [, year, month, day] = dateMatch;
  const hour = timeMatch ? Number(timeMatch[1]) : 0;
  const minute = timeMatch ? Number(timeMatch[2]) : 0;
  const timestamp = new Date(Number(year), Number(month) - 1, Number(day), hour, minute).getTime();
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

export function mergeFishingLogs(existingLogs, restoredLogs) {
  if (!Array.isArray(existingLogs) || !Array.isArray(restoredLogs)) {
    throw new Error("統合する釣果データが正しくありません");
  }
  const existingIds = new Set(existingLogs.map((log) => log?.id).filter(Boolean));
  const addedLogs = [];
  for (const log of restoredLogs) {
    if (existingIds.has(log.id)) continue;
    existingIds.add(log.id);
    addedLogs.push(log);
  }
  const logs = [...existingLogs, ...addedLogs]
    .map((log, index) => ({ log, index }))
    .sort((left, right) => logTimestamp(right.log) - logTimestamp(left.log) || left.index - right.index)
    .map(({ log }) => log);
  return { logs, addedCount: addedLogs.length };
}
