import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";

function readPng(buffer) {
  assert.deepEqual(buffer.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const chunks = [];
  const idat = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    chunks.push(type);
    if (type === "IDAT") idat.push(data);
    offset += 12 + length;
    if (type === "IEND") break;
  }
  const ihdrOffset = 16;
  const width = buffer.readUInt32BE(ihdrOffset);
  const height = buffer.readUInt32BE(ihdrOffset + 4);
  assert.equal(buffer[ihdrOffset + 8], 8, "8-bit PNG expected");
  const colorType = buffer[ihdrOffset + 9];
  assert.ok(colorType === 6 || colorType === 2, "RGB or RGBA PNG expected");
  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const filtered = inflateSync(Buffer.concat(idat));
  const stride = width * bytesPerPixel;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = filtered[y * (stride + 1)];
    const row = filtered.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x += 1) {
      const left = x >= bytesPerPixel ? pixels[y * stride + x - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel ? pixels[(y - 1) * stride + x - bytesPerPixel] : 0;
      let value = row[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += Math.floor((left + up) / 2);
      else if (filter === 4) {
        const estimate = left + up - upperLeft;
        const pa = Math.abs(estimate - left), pb = Math.abs(estimate - up), pc = Math.abs(estimate - upperLeft);
        value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upperLeft;
      } else assert.equal(filter, 0, `unsupported PNG filter ${filter}`);
      pixels[y * stride + x] = value & 0xff;
    }
  }
  return { width, height, chunks, pixels, bytesPerPixel };
}

test("No.026: previous icon has the confirmed transparent outer padding", async () => {
  const original = readPng(await readFile(new URL("../assets/icons/otomo-icon-180.png", import.meta.url)));
  let transparent = 0;
  for (let index = 3; index < original.pixels.length; index += 4) {
    if (original.pixels[index] === 0) transparent += 1;
  }
  assert.equal(transparent, 11035);
});

test("No.026: final 180px icon has no fully transparent pixels, omits metadata, and preserves foreground pixels", async () => {
  const original = readPng(await readFile(new URL("../assets/icons/otomo-icon-180.png", import.meta.url)));
  const expectedColor = [0x5b, 0xb4, 0xb7];
  const candidate = readPng(await readFile(new URL("../assets/icons/otomo-fishing-icon-180.png", import.meta.url)));
  assert.deepEqual([candidate.width, candidate.height, candidate.bytesPerPixel], [180, 180, 4]);
  assert.ok(!candidate.chunks.some((chunk) => ["eXIf", "tEXt", "iTXt", "zTXt"].includes(chunk)));
  for (let index = 3; index < candidate.pixels.length; index += 4) assert.notEqual(candidate.pixels[index], 0);
  const backgroundStart = (20 * 180 + 90) * 4;
  assert.deepEqual([...candidate.pixels.subarray(backgroundStart, backgroundStart + 3)], expectedColor);
  for (let y = 36; y <= 148; y += 1) {
    for (let x = 36; x <= 143; x += 1) {
      const start = (y * 180 + x) * 4;
      const [red, green, blue, alpha] = original.pixels.subarray(start, start + 4);
      const distance = Math.hypot(red - 0x5b, green - 0xb4, blue - 0xb7);
      if (alpha > 0 && distance > 30) {
        assert.deepEqual(candidate.pixels.subarray(start, start + 4), original.pixels.subarray(start, start + 4));
      }
    }
  }
});

test("No.026: app pages reference the final favicon and apple-touch-icon", async () => {
  const [rootHtml, aboutHtml] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../about/index.html", import.meta.url), "utf8")
  ]);
  for (const html of [rootHtml, aboutHtml]) {
    assert.match(html, /rel="icon"[^>]*sizes="32x32"[^>]*otomo-fishing-icon-32\.png/);
    assert.match(html, /rel="apple-touch-icon"[^>]*sizes="180x180"[^>]*otomo-fishing-icon-180\.png/);
    assert.doesNotMatch(html, /padding-candidate/);
  }
  assert.match(rootHtml, /Otomo Fishing Beta \/ Version 0\.23\.0/);
});

test("No.026: current app has no Web App Manifest or maskable reference to leave stale", async () => {
  const [rootHtml, aboutHtml] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../about/index.html", import.meta.url), "utf8")
  ]);
  assert.doesNotMatch(rootHtml + aboutHtml, /rel="manifest"|maskable|192x192|512x512/i);
});

test("No.026: final 32px favicon has expected dimensions and no metadata", async () => {
  const favicon = readPng(await readFile(new URL("../assets/icons/otomo-fishing-icon-32.png", import.meta.url)));
  assert.deepEqual([favicon.width, favicon.height], [32, 32]);
  assert.ok(!favicon.chunks.some((chunk) => ["eXIf", "tEXt", "iTXt", "zTXt"].includes(chunk)));
});
