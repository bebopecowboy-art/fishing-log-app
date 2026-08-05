import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  calculateContainedSize,
  PHOTO_JPEG_QUALITY,
  PHOTO_MAX_EDGE,
  resizePhoto,
  UNSUPPORTED_IMAGE_MESSAGE
} from "../image-processor.js";
import { createUuid, ensureLogIds } from "../log-model.js";
import {
  deletePhoto,
  getPhoto,
  PHOTO_DB_NAME,
  PHOTO_STORE_NAME,
  savePhoto
} from "../photo-store.js";
import { formatCardDate, getCardViewModel, SNS_CARD_DEFAULTS, truncateText } from "../sns-card.js";

class FakeTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type) {
    (this.listeners.get(type) || []).forEach((listener) => listener());
  }
}

class FakeRequest extends FakeTarget {
  constructor() {
    super();
    this.result = undefined;
    this.error = null;
  }
}

function createFakeIndexedDb() {
  const records = new Map();
  const database = {
    objectStoreNames: { contains: () => true },
    createObjectStore() {},
    close() {},
    transaction() {
      const transaction = new FakeTarget();
      transaction.error = null;
      transaction.objectStore = () => ({
        put(record) {
          const request = new FakeRequest();
          queueMicrotask(() => {
            records.set(record.id, record);
            request.result = record.id;
            request.dispatch("success");
            setTimeout(() => transaction.dispatch("complete"), 0);
          });
          return request;
        },
        get(id) {
          const request = new FakeRequest();
          queueMicrotask(() => {
            request.result = records.get(id);
            request.dispatch("success");
            setTimeout(() => transaction.dispatch("complete"), 0);
          });
          return request;
        },
        delete(id) {
          const request = new FakeRequest();
          queueMicrotask(() => {
            records.delete(id);
            request.dispatch("success");
            setTimeout(() => transaction.dispatch("complete"), 0);
          });
          return request;
        }
      });
      return transaction;
    }
  };

  return {
    open(name) {
      assert.equal(name, PHOTO_DB_NAME);
      const request = new FakeRequest();
      request.result = database;
      queueMicrotask(() => request.dispatch("success"));
      return request;
    },
    records
  };
}

test("旧ログへUUIDを補完し、既存IDは維持する", () => {
  let sequence = 0;
  const result = ensureLogIds(
    [{ name: "アジ" }, { id: "existing-id", name: "メバル" }],
    () => `generated-${++sequence}`
  );
  assert.equal(result.changed, true);
  assert.equal(result.logs[0].id, "generated-1");
  assert.equal(result.logs[1].id, "existing-id");
});

test("UUID fallbackはRFC 4122 version 4形式を生成する", () => {
  const cryptoApi = {
    getRandomValues(bytes) {
      bytes.fill(1);
      return bytes;
    }
  };
  assert.match(createUuid(cryptoApi), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("縦長・横長画像を最大辺1600px以内へ縮小する", () => {
  assert.equal(PHOTO_MAX_EDGE, 1600);
  assert.equal(PHOTO_JPEG_QUALITY, 0.82);
  assert.deepEqual(calculateContainedSize(4000, 3000), { width: 1600, height: 1200 });
  assert.deepEqual(calculateContainedSize(3000, 4000), { width: 1200, height: 1600 });
  assert.deepEqual(calculateContainedSize(800, 600), { width: 800, height: 600 });
});

test("画像を白背景へ合成し、JPEG品質0.82で保存する", async () => {
  const calls = [];
  const context = {
    fillStyle: "",
    fillRect: (...args) => calls.push(["fillRect", ...args]),
    drawImage: (...args) => calls.push(["drawImage", ...args])
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    toBlob(callback, type, quality) {
      calls.push(["toBlob", type, quality]);
      callback(new Blob(["jpeg"], { type }));
    }
  };
  const bitmap = { width: 2400, height: 1200, close: () => calls.push(["close"]) };
  const result = await resizePhoto(
    new Blob(["png"], { type: "image/png" }),
    {
      createBitmap: async (_file, bitmapOptions) => {
        calls.push(["createBitmap", bitmapOptions.imageOrientation]);
        return bitmap;
      },
      createCanvas: () => canvas
    }
  );
  assert.deepEqual({ width: result.width, height: result.height, type: result.type }, {
    width: 1600,
    height: 800,
    type: "image/jpeg"
  });
  assert.equal(context.fillStyle, "#ffffff");
  assert.ok(calls.some((call) => call[0] === "fillRect" && call[3] === 1600 && call[4] === 800));
  assert.ok(calls.some((call) => call[0] === "toBlob" && call[1] === "image/jpeg" && call[2] === 0.82));
  assert.ok(calls.some((call) => call[0] === "close"));
});

test("デコードできない画像形式へ分かりやすいエラーを返す", async () => {
  await assert.rejects(
    () => resizePhoto(new Blob(["heic"], { type: "image/heic" }), {
      createBitmap: async () => { throw new Error("decode failed"); }
    }),
    new RegExp(UNSUPPORTED_IMAGE_MESSAGE)
  );
});

test("写真をIndexedDB相当ストアへ保存・再読込・削除できる", async () => {
  const indexedDb = createFakeIndexedDb();
  const record = { id: "photo-1", logId: "log-1", blob: new Blob(["jpeg"], { type: "image/jpeg" }) };
  await savePhoto(record, indexedDb);
  assert.equal((await getPhoto("photo-1", indexedDb)).logId, "log-1");
  await deletePhoto("photo-1", indexedDb);
  assert.equal(await getPhoto("photo-1", indexedDb), null);
  assert.equal(PHOTO_STORE_NAME, "catchPhotos");
});

test("IndexedDBが利用できない場合は写真保存を失敗させる", async () => {
  await assert.rejects(() => savePhoto({ id: "photo-1" }, null), /写真を保存できません/);
});

test("SNSカードは必須項目と既定の任意項目だけを構成する", () => {
  const model = getCardViewModel({
    name: "アジ",
    size: "24",
    place: "音戸町",
    weather: "晴れ",
    method: "アジング",
    memo: "表層で反応",
    date: "2026/7/25",
    tide: { tideCycle: "中潮", trendLabel: "下げ潮" }
  }, SNS_CARD_DEFAULTS);
  assert.equal(model.name, "アジ");
  assert.equal(model.size, "24cm");
  assert.equal(model.appName, "Fishing Log");
  assert.deepEqual(model.rows.map((row) => row.key), ["place", "tide", "weather", "memo"]);
});

test("表示OFFの場所はカードデータから完全に除外する", () => {
  const model = getCardViewModel(
    { place: "呉港", name: "アジ", size: "20" },
    { ...SNS_CARD_DEFAULTS, place: false }
  );
  assert.equal(model.rows.some((row) => row.key === "place"), false);
  assert.equal(JSON.stringify(model).includes("呉港"), false);
});

test("任意項目は個別にOFFにでき、必須項目は維持される", () => {
  const log = {
    name: "非常に長い魚種名",
    size: "123",
    place: "場所",
    weather: "晴れ",
    method: "釣り方",
    memo: "メモ",
    date: "2026/7/25",
    tide: { tideCycle: "中潮", trendLabel: "下げ潮" }
  };
  for (const key of Object.keys(SNS_CARD_DEFAULTS)) {
    const visibility = { place: true, tide: true, weather: true, method: true, memo: true, date: true, [key]: false };
    const model = getCardViewModel(log, visibility);
    assert.equal(model.rows.some((row) => row.key === key), false);
    assert.equal(model.name, log.name);
    assert.equal(model.size, "123cm");
    assert.equal(model.appName, "Fishing Log");
  }
});

test("長いメモはカード上だけ60文字で省略し、元データを変更しない", () => {
  const memo = "あ".repeat(61);
  const log = { memo };
  const model = getCardViewModel(log, SNS_CARD_DEFAULTS);
  assert.equal(model.rows.find((row) => row.key === "memo").value, `${"あ".repeat(60)}…`);
  assert.equal(log.memo, memo);
  assert.equal(truncateText("短いメモ"), "短いメモ");
});

test("日付を簡潔な形式へ変換する", () => {
  assert.equal(formatCardDate("2026/7/25"), "2026.07.25");
  assert.equal(SNS_CARD_DEFAULTS.date, false);
});

test("プレビューは4:5固定で、写真と情報欄を58:42に分ける", async () => {
  const css = await readFile(new URL("../style.css", import.meta.url), "utf8");
  assert.match(css, /\.sns-card-classic[\s\S]*?grid-template-rows:\s*58%\s+42%/);
  assert.match(css, /\.sns-card-classic[\s\S]*?aspect-ratio:\s*4\s*\/\s*5/);
  assert.match(css, /\.sns-card-photo[\s\S]*?touch-action:\s*none/);
  assert.doesNotMatch(css, /\.sns-card-classic[\s\S]*?overflow:\s*(auto|scroll)/);
});

test("SNSカード画面に保存・共有操作と詳細へ戻る操作を表示する", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const snsDialog = html.match(/<dialog id="snsCardDialog"[\s\S]*?<\/dialog>/)?.[0] || "";
  assert.ok(snsDialog);
  assert.match(snsDialog, /JPEGを保存/);
  assert.match(snsDialog, />共有</);
  assert.match(snsDialog, /詳細へ戻る/);
});
