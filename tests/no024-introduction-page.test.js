import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const htmlUrl = new URL("../about/index.html", import.meta.url);
const cssUrl = new URL("../about/about.css", import.meta.url);

test("No.024: introduction page files, metadata, and semantic regions exist", async () => {
  const [html, css] = await Promise.all([readFile(htmlUrl, "utf8"), readFile(cssUrl, "utf8")]);
  assert.match(html, /<meta charset="UTF-8">/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1\.0">/);
  assert.match(html, /<title>Otomo Fishing｜釣れた瞬間を30秒で記録<\/title>/);
  assert.match(html, /content="釣れた瞬間を30秒で記録。潮・天気・写真までひとつに残せる、登録不要のシンプルな釣果ログです。"/);
  assert.match(html, /<header[\s\S]*<main id="main">[\s\S]*<footer/);
  assert.doesNotMatch(html, /<script|https?:\/\/|href="#"/);
  assert.match(css, /prefers-reduced-motion/);
});

test("No.024: required sections and copy appear in the approved order", async () => {
  const html = await readFile(htmlUrl, "utf8");
  const markers = [
    "釣れた瞬間を、", "すぐ記録", "id=\"features\"", "釣果を、自分らしくシェア。", "次の一匹も、オトモと。", "<footer"
  ];
  let previous = -1;
  for (const marker of markers) {
    const position = html.indexOf(marker);
    assert(position > previous, `${marker} must follow the previous section`);
    previous = position;
  }
  for (const copy of [
    "30秒で記録。", "潮・天気・写真まで、", "無料で使ってみる", "登録不要・インストール不要",
    "あとで検索", "きれいに共有", "潮と天気をまとめて記録", "釣果をすぐに検索", "端末の中に保存",
    "Otomo Fishingをはじめる", "Otomo Fishing Beta"
  ]) assert(html.includes(copy), `missing required copy: ${copy}`);
});

test("No.024: header and both CTAs link relatively to the existing app", async () => {
  const html = await readFile(htmlUrl, "utf8");
  const appLinks = [...html.matchAll(/<a[^>]+href="\.\.\/"[^>]*>/g)];
  assert(appLinks.length >= 4, "brand, header, hero, and final CTA must reach the app");
  assert.match(html, /href="#features"[^>]*>使い方<\/a>/);
  assert.doesNotMatch(html, /href="\/(?!\/)/);
});

test("No.024: approved assets and intrinsic image dimensions are used without the reference image", async () => {
  const html = await readFile(htmlUrl, "utf8");
  assert.match(html, /\.\.\/assets\/otomo-fishing-logo-horizontal\.png/);
  assert.match(html, /\.\.\/assets\/otomo-character-empty-history\.png/);
  assert.match(html, /\.\.\/assets\/otomo-character-fishing-back-final\.png/);
  assert.match(html, /\.\.\/assets\/otomo-fishing-wordmark\.png/);
  assert.doesNotMatch(html, /introduction-page-design-reference/);
  assert.doesNotMatch(html, /<img(?![^>]*\bwidth=)(?![^>]*\bheight=)/);
  assert.match(html, /loading="lazy"/);
  for (const path of [
    "../assets/otomo-fishing-logo-horizontal.png", "../assets/otomo-character-empty-history.png",
    "../assets/otomo-character-fishing-back-final.png", "../assets/otomo-fishing-wordmark.png"
  ]) await access(new URL(path, htmlUrl));
});

test("No.024: four approved SNS card images appear in theme order", async () => {
  const html = await readFile(htmlUrl, "utf8");
  const paths = ["cream", "mint", "sky", "sand"].map(
    (theme) => `../assets/about/otomo-sns-card-${theme}.jpg`
  );
  let previous = -1;
  for (const path of paths) {
    const position = html.indexOf(path);
    assert(position > previous, `${path} must follow the previous card`);
    previous = position;
    await access(new URL(path, htmlUrl));
  }
  assert.doesNotMatch(html, /class="sample-card theme-|class="sample-photo"|2026\.08\.20|朝まずめ/);
});

test("No.024: responsive CSS covers required widths, avoids overflow, and keeps tap targets", async () => {
  const css = await readFile(cssUrl, "utf8");
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /@media \(max-width: 980px\)/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
});

test("No.024: app version is 0.22.3 and the root remains the application", async () => {
  const rootHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(rootHtml, /id="catchFormCard"/);
  assert.match(rootHtml, /Otomo Fishing Beta \/ Version 0\.22\.3/);
  assert.doesNotMatch(rootHtml, /about\/index\.html/);
});

test("No.024: local server resolves directory routes to index.html", async () => {
  const server = await readFile(new URL("../tools/serve.mjs", import.meta.url), "utf8");
  assert.match(server, /isDirectory\(\)[\s\S]*resolve\(file, "index\.html"\)/);
});
