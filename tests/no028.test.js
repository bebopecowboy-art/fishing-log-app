import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const publicRoot = "https://bebopecowboy-art.github.io/fishing-log-app/";
const description = "Otomo Fishingは、釣れた瞬間を手早く記録し、写真や潮・天気と一緒に振り返れる無料の釣果記録Webアプリです。登録不要でスマートフォンから使えます。";

test("No.028: Google所有権確認ファイルの名前と本文が完全一致する", async () => {
  const verification = await readFile(new URL("google83e30c054acb0a28.html", root), "utf8");
  assert.equal(verification, "google-site-verification: google83e30c054acb0a28.html");
});

test("No.028: 紹介ページに検索メタ情報、OGP、自然な名称が存在する", async () => {
  const html = await readFile(new URL("about/index.html", root), "utf8");
  assert.match(html, /<title>Otomo Fishing｜30秒で残せる釣果記録アプリ<\/title>/);
  assert.ok(html.includes(`<meta name="description" content="${description}">`));
  assert.ok(html.includes(`<link rel="canonical" href="${publicRoot}about/">`));
  for (const value of [
    '<meta property="og:type" content="website">',
    '<meta property="og:title" content="Otomo Fishing｜30秒で残せる釣果記録アプリ">',
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:url" content="${publicRoot}about/">`,
    '<meta property="og:site_name" content="Otomo Fishing">'
  ]) assert.ok(html.includes(value), `missing metadata: ${value}`);
  for (const text of ["Otomo Fishing", "オトモフィッシング", "釣果記録アプリ"]) {
    assert.ok(html.slice(html.indexOf("<body")).includes(text), `missing visible body text: ${text}`);
  }
  assert.doesNotMatch(html, /<meta[^>]+(?:name|content)=["'][^"']*noindex/i);
  assert.match(html, /<a[^>]+href="\.\.\/"/);
});

test("No.028: アプリ本体にdescription、自己canonical、紹介ページリンク、Versionが存在する", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  assert.match(html, /<meta name="description" content="[^"]+">/);
  assert.ok(html.includes(`<link rel="canonical" href="${publicRoot}">`));
  assert.doesNotMatch(html, /<meta[^>]+(?:name|content)=["'][^"']*noindex/i);
  assert.match(html, /<a[^>]+href="about\/"[^>]*>Otomo Fishingについて<\/a>/);
  assert.match(html, /Otomo Fishing Beta \/ Version 0\.23\.1/);
});

test("No.028: sitemap.xmlは指定された2つの正規URLだけを含む", async () => {
  const xml = await readFile(new URL("sitemap.xml", root), "utf8");
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">[\s\S]*<\/urlset>\s*$/);
  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(locations, [publicRoot, `${publicRoot}about/`]);
  assert.equal((xml.match(/<url>/g) ?? []).length, 2);
  assert.equal((xml.match(/<\/url>/g) ?? []).length, 2);
});
