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

export function filterFishingLogs(logs, query) {
  const terms = createSearchTerms(query);
  if (terms.length === 0) return logs.map((log, index) => ({ log, index }));

  return logs.flatMap((log, index) => {
    const searchableValues = SEARCH_FIELDS.map((field) => normalizeSearchText(log?.[field]));
    const matches = terms.every((term) => searchableValues.some((value) => value.includes(term)));
    return matches ? [{ log, index }] : [];
  });
}
