import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const htmlUrl = new URL("about/index.html", root);
const themes = [
  ["cream", "69EA0E6D-91DF-4D85-9A68-57AC7E9DCA15.jpeg"],
  ["mint", "98CFD638-7E6A-42AB-9F60-789BF9CB8DC1.jpeg"],
  ["sky", "C28B9F43-3401-4F83-993C-7CEC91FF359E.jpeg"],
  ["sand", "43DB308A-C8EC-4AB9-8FEE-C93F5FF2C013.jpeg"]
];

function markerCodes(buffer) {
  const codes = [];
  for (let offset = 2; offset < buffer.length;) {
    if (buffer[offset] !== 0xff) break;
    const code = buffer[offset + 1];
    codes.push(code);
    if (code === 0xda || code === 0xd9) break;
    if (code === 0xd8 || (code >= 0xd0 && code <= 0xd7)) offset += 2;
    else offset += 2 + buffer.readUInt16BE(offset + 2);
  }
  return codes;
}

function scanHash(buffer) {
  let offset = 2;
  while (offset < buffer.length && buffer[offset + 1] !== 0xda) {
    offset += 2 + buffer.readUInt16BE(offset + 2);
  }
  assert(offset < buffer.length, "JPEG must contain an SOS marker");
  return createHash("sha256").update(buffer.subarray(offset)).digest("hex");
}

function jpegDimensions(buffer) {
  for (let offset = 2; offset < buffer.length;) {
    const code = buffer[offset + 1];
    if (code >= 0xc0 && code <= 0xc3) {
      return [buffer.readUInt16BE(offset + 7), buffer.readUInt16BE(offset + 5)];
    }
    if (code === 0xda) break;
    offset += 2 + buffer.readUInt16BE(offset + 2);
  }
  return [];
}

test("No.024 additional fix: complete card JPEGs are used in cream, mint, sky, sand order", async () => {
  const html = await readFile(htmlUrl, "utf8");
  const cards = [...html.matchAll(/<img class="sample-card-image"[^>]+>/g)].map(([tag]) => tag);
  assert.equal(cards.length, 4);
  themes.forEach(([theme], index) => {
    assert.match(cards[index], new RegExp(`src="\\.\\.\\/assets\\/about\\/otomo-sns-card-${theme}\\.jpg"`));
    assert.match(cards[index], /width="1080" height="1350" loading="lazy" decoding="async"/);
    assert.match(cards[index], /alt="[^"]+"/);
  });
  const section = html.slice(html.indexOf('<section class="share-section"'), html.indexOf('<section class="final-cta"'));
  assert.doesNotMatch(section, /瀬戸内海|sample-card theme-|sample-photo|sample-heading|sample-wordmark|sample-otomo/);
});

test("No.024 additional fix: output JPEGs preserve pixels and omit removable metadata", async () => {
  for (const [theme, sourceName] of themes) {
    const [source, output] = await Promise.all([
      readFile(new URL(`assets/${sourceName}`, root)),
      readFile(new URL(`assets/about/otomo-sns-card-${theme}.jpg`, root))
    ]);
    assert.deepEqual(jpegDimensions(output), [1080, 1350]);
    assert.equal(scanHash(output), scanHash(source), `${theme} scan data must be unchanged`);
    const codes = markerCodes(output);
    assert(!codes.includes(0xe1), `${theme} must not contain APP1/EXIF`);
    assert(!codes.includes(0xed), `${theme} must not contain APP13`);
    assert(!codes.includes(0xfe), `${theme} must not contain comments`);
  }
});

test("No.024 additional fix: layout and Version 0.22.3 are retained", async () => {
  const [css, rootHtml] = await Promise.all([
    readFile(new URL("about/about.css", root), "utf8"),
    readFile(new URL("index.html", root), "utf8")
  ]);
  assert.match(css, /\.sample-card-image\s*\{[^}]*width:\s*100%[^}]*height:\s*auto[^}]*aspect-ratio:\s*4\s*\/\s*5/s);
  assert.doesNotMatch(css, /\.sample-card\s|\.theme-(?:cream|mint|sky|sand)|\.sample-photo|\.sample-heading|\.sample-wordmark|\.sample-otomo/);
  assert.match(css, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(rootHtml, /Otomo Fishing Beta \/ Version 0\.22\.3/);
});
