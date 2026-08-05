export const SNS_PHOTO_SCALE_MIN = 1;
export const SNS_PHOTO_SCALE_MAX = 3;
export const SNS_PHOTO_ADJUSTMENT_DEFAULTS = Object.freeze({ x: 0, y: 0, scale: 1 });

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeSnsPhotoAdjustment(value = {}) {
  const x = Number(value.x);
  const y = Number(value.y);
  const scale = Number(value.scale);
  return {
    x: Number.isFinite(x) ? clamp(x, -1, 1) : 0,
    y: Number.isFinite(y) ? clamp(y, -1, 1) : 0,
    scale: Number.isFinite(scale) ? clamp(scale, SNS_PHOTO_SCALE_MIN, SNS_PHOTO_SCALE_MAX) : 1
  };
}

export function applySnsPhotoAdjustmentToLogs(logs, logId, adjustment) {
  const normalized = normalizeSnsPhotoAdjustment(adjustment);
  let updatedLog = null;
  const nextLogs = Array.isArray(logs) ? logs.map((log) => {
    if (log?.id !== logId) return log;
    updatedLog = { ...log, snsPhotoAdjustment: normalized };
    return updatedLog;
  }) : [];
  return { logs: nextLogs, updatedLog };
}

export function calculateSnsPhotoCrop(imageWidth, imageHeight, frameWidth, frameHeight, adjustment) {
  if (![imageWidth, imageHeight, frameWidth, frameHeight].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("写真サイズを確認できませんでした");
  }
  const normalized = normalizeSnsPhotoAdjustment(adjustment);
  const coverScale = Math.max(frameWidth / imageWidth, frameHeight / imageHeight) * normalized.scale;
  const sourceWidth = frameWidth / coverScale;
  const sourceHeight = frameHeight / coverScale;
  const availableX = imageWidth - sourceWidth;
  const availableY = imageHeight - sourceHeight;
  return {
    sourceX: availableX * ((normalized.x + 1) / 2),
    sourceY: availableY * ((normalized.y + 1) / 2),
    sourceWidth,
    sourceHeight
  };
}

export function drawAdjustedSnsPhoto(context, image, frameWidth, frameHeight, adjustment) {
  const crop = calculateSnsPhotoCrop(
    image.naturalWidth || image.width,
    image.naturalHeight || image.height,
    frameWidth,
    frameHeight,
    adjustment
  );
  context.clearRect(0, 0, frameWidth, frameHeight);
  context.drawImage(
    image,
    crop.sourceX,
    crop.sourceY,
    crop.sourceWidth,
    crop.sourceHeight,
    0,
    0,
    frameWidth,
    frameHeight
  );
}
