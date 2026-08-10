import test from "node:test";
import assert from "node:assert/strict";
import {
  createFishNameCandidates, filterFishNameCandidates, isValidFishName,
  normalizeFishName, prepareFishName, renderFishNameCandidates
} from "../fish-name.js";

test("fish names are normalized for saving", () => {
  assert.equal(prepareFishName(" アジ "), "アジ");
  assert.equal(prepareFishName("あじ"), "アジ");
  assert.equal(prepareFishName("ｱｼﾞ"), "アジ");
  assert.equal(prepareFishName("シーバス"), "シーバス");
  assert.equal(prepareFishName("サバ・フグ"), "サバ・フグ");
});

test("disallowed fish-name characters are rejected", () => {
  for (const value of ["鯵", "AJI", "アジ2", "アジ🐟", "アジ!"]) {
    assert.throws(() => prepareFishName(value), /カタカナ・ー・中点/);
  }
  assert.throws(() => prepareFishName("  "), /魚種を入力/);
  assert.equal(isValidFishName(normalizeFishName("あじ")), true);
});

test("an unchanged legacy fish name survives an unrelated edit", () => {
  assert.equal(prepareFishName("鯵", "鯵"), "鯵");
  assert.throws(() => prepareFishName("鯖", "鯵"), /カタカナ・ー・中点/);
});

test("history candidates are safe, unique, and newest-first", () => {
  const logs = [
    { name: " ヒラメ " }, { name: "あじ" }, { name: "ｱｼﾞ" },
    { name: "鯵" }, { name: "" }, { name: "アコウ" }
  ];
  assert.deepEqual(createFishNameCandidates(logs), ["ヒラメ", "アジ", "アコウ"]);
  assert.deepEqual(filterFishNameCandidates(createFishNameCandidates(logs), "あ"), ["アジ", "アコウ"]);
  assert.deepEqual(filterFishNameCandidates(createFishNameCandidates(logs), "ｱｺ"), ["アコウ"]);
});

test("candidate buttons fill the input through their selection callback", () => {
  const clicks = [];
  const container = {
    children: [], hidden: true,
    replaceChildren() { this.children = []; },
    append(child) { this.children.push(child); }
  };
  const documentApi = { createElement: () => ({
    listeners: {}, setAttribute() {},
    addEventListener(type, listener) { this.listeners[type] = listener; }
  }) };
  renderFishNameCandidates(container, ["アジ"], (value) => clicks.push(value), documentApi);
  assert.equal(container.hidden, false);
  container.children[0].listeners.click();
  assert.deepEqual(clicks, ["アジ"]);
});
