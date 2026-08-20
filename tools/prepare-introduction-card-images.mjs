import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const files = [
  ["assets/69EA0E6D-91DF-4D85-9A68-57AC7E9DCA15.jpeg", "assets/about/otomo-sns-card-cream.jpg"],
  ["assets/98CFD638-7E6A-42AB-9F60-789BF9CB8DC1.jpeg", "assets/about/otomo-sns-card-mint.jpg"],
  ["assets/C28B9F43-3401-4F83-993C-7CEC91FF359E.jpeg", "assets/about/otomo-sns-card-sky.jpg"],
  ["assets/43DB308A-C8EC-4AB9-8FEE-C93F5FF2C013.jpeg", "assets/about/otomo-sns-card-sand.jpg"]
];

export function stripJpegMetadata(source) {
  if (source[0] !== 0xff || source[1] !== 0xd8) throw new Error("JPEG SOIがありません");
  const parts = [source.subarray(0, 2)];
  let offset = 2;
  while (offset < source.length) {
    if (source[offset] !== 0xff) throw new Error(`JPEG markerが不正です: ${offset}`);
    const markerStart = offset;
    while (source[offset] === 0xff) offset += 1;
    const marker = source[offset];
    offset += 1;
    if (marker === 0xda) {
      parts.push(source.subarray(markerStart));
      return Buffer.concat(parts);
    }
    if (marker === 0xd9) {
      parts.push(source.subarray(markerStart, offset));
      return Buffer.concat(parts);
    }
    const length = source.readUInt16BE(offset);
    const segmentEnd = offset + length;
    if (segmentEnd > source.length) throw new Error("JPEG segmentがファイル末尾を超えています");
    if (marker !== 0xe1 && marker !== 0xed && marker !== 0xfe) {
      parts.push(source.subarray(markerStart, segmentEnd));
    }
    offset = segmentEnd;
  }
  throw new Error("JPEG scan dataがありません");
}

async function main() {
  for (const [input, output] of files) {
    const inputPath = resolve(input);
    const outputPath = resolve(output);
    const source = await readFile(inputPath);
    const stripped = stripJpegMetadata(source);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, stripped);
    console.log(`${output}: ${source.length} -> ${stripped.length} bytes`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"))) {
  await main();
}
