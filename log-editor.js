import { SNS_PHOTO_ADJUSTMENT_DEFAULTS } from "./sns-photo-adjustment.js";

export const EDITABLE_LOG_FIELDS = ["place", "name", "size", "method", "memo"];

export function createEditedLog(log, values, photoUpdate = { type: "keep" }) {
  const edited = { ...log };
  for (const field of EDITABLE_LOG_FIELDS) edited[field] = values[field] ?? "";
  if (photoUpdate.type === "remove") {
    delete edited.photoId;
    delete edited.photo;
    delete edited.snsPhotoAdjustment;
  } else if (photoUpdate.type === "replace") {
    edited.photoId = photoUpdate.photoId;
    edited.photo = { ...photoUpdate.photo };
    edited.snsPhotoAdjustment = { ...SNS_PHOTO_ADJUSTMENT_DEFAULTS };
  }
  return edited;
}

function replaceLog(logs, id, editedLog) {
  const index = logs.findIndex((log) => log?.id === id);
  if (index < 0) throw new Error("編集対象の釣果ログが見つかりません。");
  const nextLogs = [...logs];
  nextLogs[index] = editedLog;
  return nextLogs;
}

export async function updateFishingLog(options) {
  const { logs, targetId, values, photoChange = { type: "keep" }, resizePhoto,
    createUuid, getPhoto, savePhoto, deletePhoto, persistLogs, now = new Date() } = options;
  const currentLog = logs.find((log) => log?.id === targetId);
  if (!currentLog) throw new Error("編集対象の釣果ログが見つかりません。");
  if (photoChange.type === "keep") {
    const editedLog = createEditedLog(currentLog, values);
    const nextLogs = replaceLog(logs, targetId, editedLog);
    persistLogs(nextLogs);
    return { logs: nextLogs, updatedLog: editedLog };
  }
  const oldPhoto = currentLog.photoId ? await getPhoto(currentLog.photoId) : null;
  let newPhotoId = "";
  let oldPhotoDeleted = false;
  try {
    let photoUpdate = { type: "remove" };
    if (photoChange.type === "replace") {
      const processed = await resizePhoto(photoChange.file);
      newPhotoId = createUuid();
      await savePhoto({ id: newPhotoId, logId: targetId, blob: processed.blob,
        width: processed.width, height: processed.height, type: processed.type,
        originalName: processed.originalName, createdAt: now.toISOString() });
      photoUpdate = { type: "replace", photoId: newPhotoId,
        photo: { width: processed.width, height: processed.height, type: processed.type } };
    }
    if (currentLog.photoId) {
      await deletePhoto(currentLog.photoId);
      oldPhotoDeleted = Boolean(oldPhoto);
    }
    const editedLog = createEditedLog(currentLog, values, photoUpdate);
    const nextLogs = replaceLog(logs, targetId, editedLog);
    persistLogs(nextLogs);
    return { logs: nextLogs, updatedLog: editedLog };
  } catch (error) {
    const rollbackErrors = [];
    if (oldPhotoDeleted) {
      try { await savePhoto(oldPhoto); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    if (newPhotoId) {
      try { await deletePhoto(newPhotoId); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    if (rollbackErrors.length) {
      const rollbackError = new Error("写真の復元に失敗しました。ページを閉じずに再試行してください。");
      rollbackError.cause = error;
      rollbackError.rollbackErrors = rollbackErrors;
      throw rollbackError;
    }
    throw error;
  }
}
