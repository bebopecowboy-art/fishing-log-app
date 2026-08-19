export function parseTideLine(line) {
  if (line.length !== 136) throw new Error(`136 columns required; got ${line.length}`);
  const hourly = Array.from({ length: 24 }, (_, index) => Number(line.slice(index * 3, index * 3 + 3)));
  const yy = Number(line.slice(72, 74));
  const month = Number(line.slice(74, 76));
  const day = Number(line.slice(76, 78));
  const providerStationId = line.slice(78, 80);
  const parseEvents = (start, type) => Array.from({ length: 4 }, (_, index) => {
    const offset = start + index * 7;
    const rawTime = line.slice(offset, offset + 4);
    const rawHeight = line.slice(offset + 4, offset + 7);
    if (rawTime === "9999" || rawHeight === "999") return null;
    const hour = Number(rawTime.slice(0, 2));
    const minute = Number(rawTime.slice(2, 4));
    if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
      throw new Error(`invalid event time: ${rawTime}`);
    }
    return [type, `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`, Number(rawHeight)];
  }).filter(Boolean);
  return {
    date: `${2000 + yy}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    providerStationId,
    hourly,
    extremes: [...parseEvents(80, "high"), ...parseEvents(108, "low")]
  };
}
