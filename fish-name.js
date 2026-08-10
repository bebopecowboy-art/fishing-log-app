const ALLOWED_FISH_NAME_PATTERN = /^[\u30A1-\u30FA\u30FC\u30FB]+$/u;

export function normalizeFishName(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFKC")
    .replace(/[\u3041-\u3096]/gu, (character) =>
      String.fromCharCode(character.charCodeAt(0) + 0x60));
}

export function isValidFishName(value) {
  return Boolean(value) && ALLOWED_FISH_NAME_PATTERN.test(value);
}

export function prepareFishName(value, unchangedLegacyValue) {
  const rawValue = String(value ?? "");
  if (rawValue && unchangedLegacyValue !== undefined
    && rawValue === String(unchangedLegacyValue ?? "")) {
    return rawValue;
  }
  const normalized = normalizeFishName(rawValue);
  if (!normalized) throw new Error("魚種を入力してください。");
  if (!isValidFishName(normalized)) {
    throw new Error("魚種名にはカタカナ・ー・中点のみ使用できます。");
  }
  return normalized;
}

export function createFishNameCandidates(logs) {
  const candidates = [];
  const seen = new Set();
  for (const log of Array.isArray(logs) ? logs : []) {
    const normalized = normalizeFishName(log?.name);
    if (!isValidFishName(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    candidates.push(normalized);
  }
  return candidates;
}

export function filterFishNameCandidates(candidates, input, limit = 8) {
  const query = normalizeFishName(input);
  return candidates
    .filter((candidate) => !query || candidate.includes(query))
    .slice(0, limit);
}

export function renderFishNameCandidates(container, candidates, onSelect,
  documentApi = globalThis.document) {
  container.replaceChildren();
  for (const candidate of candidates) {
    const button = documentApi.createElement("button");
    button.type = "button";
    button.className = "fish-name-candidate";
    button.setAttribute("role", "option");
    button.textContent = candidate;
    button.addEventListener("pointerdown", (event) => event.preventDefault());
    button.addEventListener("click", () => onSelect(candidate));
    container.append(button);
  }
  container.hidden = candidates.length === 0;
}
