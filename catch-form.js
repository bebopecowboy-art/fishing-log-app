function pad(value) {
  return String(value).padStart(2, "0");
}

export function setCatchDateTime(elements, now = new Date()) {
  elements.catchDate.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  elements.catchTime.value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function resetCatchDateTimeIfDateCleared(elements, now = new Date()) {
  if (elements.catchDate.value) return false;
  setCatchDateTime(elements, now);
  return true;
}

export function readCatchDateTime(elements) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(elements.catchDate.value);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(elements.catchTime.value);
  if (!dateMatch || !timeMatch) throw new Error("釣果の日付と時刻を入力してください");
  const [, year, month, day] = dateMatch;
  const [, hour, minute] = timeMatch;
  const caughtAt = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  if (Number.isNaN(caughtAt.getTime())
      || caughtAt.getFullYear() !== Number(year)
      || caughtAt.getMonth() !== Number(month) - 1
      || caughtAt.getDate() !== Number(day)
      || caughtAt.getHours() !== Number(hour)
      || caughtAt.getMinutes() !== Number(minute)) {
    throw new Error("釣果の日付または時刻が正しくありません");
  }
  return {
    caughtAt,
    dateKey: `${year}-${month}-${day}`,
    date: `${Number(year)}/${Number(month)}/${Number(day)}`,
    time: `${hour}:${minute}`
  };
}

export function resetCatchForm(elements, clearSelectedPhoto, now = new Date()) {
  elements.fishingPlace.value = "";
  elements.fishName.value = "";
  elements.fishSize.value = "";
  elements.fishingMethod.value = "";
  elements.memo.value = "";
  setCatchDateTime(elements, now);
  clearSelectedPhoto();
}
