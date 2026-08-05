export const PHOTO_DB_NAME = "fishing-log-app";
export const PHOTO_DB_VERSION = 1;
export const PHOTO_STORE_NAME = "catchPhotos";

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error || new Error("IndexedDBの処理に失敗しました")), { once: true });
  });
}

export function openPhotoDatabase(indexedDb = globalThis.indexedDB) {
  if (!indexedDb) return Promise.reject(new Error("このブラウザでは写真を保存できません"));
  const request = indexedDb.open(PHOTO_DB_NAME, PHOTO_DB_VERSION);
  request.addEventListener("upgradeneeded", () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(PHOTO_STORE_NAME)) {
      database.createObjectStore(PHOTO_STORE_NAME, { keyPath: "id" });
    }
  }, { once: true });
  return requestResult(request);
}

async function useStore(mode, action, indexedDb) {
  const database = await openPhotoDatabase(indexedDb);
  try {
    const transaction = database.transaction(PHOTO_STORE_NAME, mode);
    const store = transaction.objectStore(PHOTO_STORE_NAME);
    const result = await action(store);
    await new Promise((resolve, reject) => {
      transaction.addEventListener("complete", resolve, { once: true });
      transaction.addEventListener("abort", () => reject(transaction.error || new Error("写真データの処理が中止されました")), { once: true });
      transaction.addEventListener("error", () => reject(transaction.error || new Error("写真データの処理に失敗しました")), { once: true });
    });
    return result;
  } finally {
    database.close();
  }
}

export function savePhoto(record, indexedDb = globalThis.indexedDB) {
  return useStore("readwrite", (store) => requestResult(store.put(record)), indexedDb);
}

export function getPhoto(id, indexedDb = globalThis.indexedDB) {
  if (!id) return Promise.resolve(null);
  return useStore("readonly", (store) => requestResult(store.get(id)), indexedDb)
    .then((record) => record || null);
}

export function deletePhoto(id, indexedDb = globalThis.indexedDB) {
  if (!id) return Promise.resolve();
  return useStore("readwrite", (store) => requestResult(store.delete(id)), indexedDb);
}
