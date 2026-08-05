export function createUuid(cryptoApi = globalThis.crypto) {
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
  if (typeof cryptoApi?.getRandomValues !== "function") {
    throw new Error("UUIDを生成できません");
  }
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return [...bytes].map((value, index) => {
    const separator = [4, 6, 8, 10].includes(index) ? "-" : "";
    return `${separator}${value.toString(16).padStart(2, "0")}`;
  }).join("");
}

export function ensureLogIds(logs, uuidFactory = () => createUuid()) {
  if (!Array.isArray(logs)) return { logs: [], changed: false };
  let changed = false;
  const normalized = logs.map((log) => {
    if (!log || typeof log !== "object" || Array.isArray(log)) {
      changed = true;
      return { id: uuidFactory() };
    }
    if (typeof log.id === "string" && log.id.trim()) return log;
    changed = true;
    return { ...log, id: uuidFactory() };
  });
  return { logs: normalized, changed };
}
