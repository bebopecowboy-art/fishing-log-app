const SEARCH_FIELDS = ["name", "place", "method", "memo"];

export function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[ァ-ヶ]/gu, (character) => String.fromCodePoint(character.codePointAt(0) - 0x60))
    .trim();
}

export function createSearchTerms(query) {
  const normalized = normalizeSearchText(query);
  return normalized ? normalized.split(/\s+/u) : [];
}

export function readLogYearMonth(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/u.exec(String(value ?? "").trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const localDate = new Date(year, month - 1, day);
  if (localDate.getFullYear() !== year || localDate.getMonth() !== month - 1 || localDate.getDate() !== day) {
    return null;
  }
  return { year, month };
}

export function createLogYearOptions(logs) {
  return [...new Set(logs.flatMap((log) => {
    const date = readLogYearMonth(log?.date);
    return date ? [date.year] : [];
  }))].sort((a, b) => b - a);
}

export function filterFishingLogs(logs, query, filters = {}) {
  const terms = createSearchTerms(query);
  const selectedYear = Number(filters.year) || 0;
  const selectedMonth = Number(filters.month) || 0;

  return logs.flatMap((log, index) => {
    const date = readLogYearMonth(log?.date);
    if ((selectedYear && date?.year !== selectedYear) || (selectedMonth && date?.month !== selectedMonth)) {
      return [];
    }
    const searchableValues = SEARCH_FIELDS.map((field) => normalizeSearchText(log?.[field]));
    const matches = terms.every((term) => searchableValues.some((value) => value.includes(term)));
    return matches ? [{ log, index }] : [];
  });
}
