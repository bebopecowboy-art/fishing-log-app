import { normalizeSnsPhotoAdjustment } from "./sns-photo-adjustment.js";

export const SNS_PINCH_MIN_DISTANCE = 2;

function pointFromEvent(event) {
  return { x: Number(event.clientX), y: Number(event.clientY) };
}

function distance(points) {
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

function createGesture(pointers, adjustment) {
  const normalizedAdjustment = normalizeSnsPhotoAdjustment(adjustment);
  const points = [...pointers.values()];
  if (points.length >= 2) {
    const startDistance = distance(points.slice(0, 2));
    return Number.isFinite(startDistance) && startDistance >= SNS_PINCH_MIN_DISTANCE
      ? { type: "pinch", distance: startDistance, scale: normalizedAdjustment.scale }
      : null;
  }
  const point = points[0];
  return point ? { type: "drag", ...point, adjustment: normalizedAdjustment } : null;
}

export function createSnsPhotoGestureState() {
  return { pointers: new Map(), gesture: null };
}

export function startSnsPhotoPointer(state, event, adjustment) {
  state.pointers.set(event.pointerId, pointFromEvent(event));
  state.gesture = createGesture(state.pointers, adjustment);
  return state.gesture;
}

export function moveSnsPhotoPointer(state, event, adjustment, bounds = {}) {
  if (!state.pointers.has(event.pointerId)) return normalizeSnsPhotoAdjustment(adjustment);
  state.pointers.set(event.pointerId, pointFromEvent(event));
  const points = [...state.pointers.values()];

  if (points.length >= 2) {
    if (state.gesture?.type !== "pinch") state.gesture = createGesture(state.pointers, adjustment);
    if (state.gesture?.type !== "pinch") return normalizeSnsPhotoAdjustment(adjustment);
    const currentDistance = distance(points.slice(0, 2));
    if (!Number.isFinite(currentDistance) || currentDistance < SNS_PINCH_MIN_DISTANCE) {
      return normalizeSnsPhotoAdjustment(adjustment);
    }
    return normalizeSnsPhotoAdjustment({
      ...adjustment,
      scale: state.gesture.scale * (currentDistance / state.gesture.distance)
    });
  }

  if (points.length === 1) {
    if (state.gesture?.type !== "drag") state.gesture = createGesture(state.pointers, adjustment);
    if (state.gesture?.type !== "drag") return normalizeSnsPhotoAdjustment(adjustment);
    const width = Number(bounds.width);
    const height = Number(bounds.height);
    if (!(width > 0) || !(height > 0)) return normalizeSnsPhotoAdjustment(adjustment);
    return normalizeSnsPhotoAdjustment({
      ...adjustment,
      x: state.gesture.adjustment.x - ((points[0].x - state.gesture.x) * 2 / width),
      y: state.gesture.adjustment.y - ((points[0].y - state.gesture.y) * 2 / height)
    });
  }

  return normalizeSnsPhotoAdjustment(adjustment);
}

export function finishSnsPhotoPointer(state, pointerId, adjustment) {
  state.pointers.delete(pointerId);
  state.gesture = createGesture(state.pointers, normalizeSnsPhotoAdjustment(adjustment));
  return state.gesture;
}

export function cancelSnsPhotoGesture(state) {
  state.pointers.clear();
  state.gesture = null;
}
