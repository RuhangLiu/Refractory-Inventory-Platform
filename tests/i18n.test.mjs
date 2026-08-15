import test from "node:test";
import assert from "node:assert/strict";
import { storedLanguage, translateText } from "../public/i18n.js";

test("interface text translates while unknown product data stays unchanged", () => {
  assert.equal(translateText("Inventory overview", "zh"), "库存总览");
  assert.equal(translateText("Out of stock", "zh"), "缺货");
  assert.equal(translateText("Future Product X-900", "zh"), "Future Product X-900");
  assert.equal(translateText("Future Product X-900", "en"), "Future Product X-900");
});

test("language preference defaults safely and restores supported choices", () => {
  assert.equal(storedLanguage({ getItem: () => "zh" }), "zh");
  assert.equal(storedLanguage({ getItem: () => "fr" }), "en");
  assert.equal(storedLanguage({ getItem: () => null }), "en");
});
