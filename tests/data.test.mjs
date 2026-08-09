import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dashboard = JSON.parse(
  await readFile(new URL("../data/serving/dashboard.json", import.meta.url), "utf8")
);

test("inventory quantities reconcile", () => {
  for (const row of dashboard.inventory) {
    assert.equal(
      row.available_quantity,
      row.current_quantity - row.reserved_quantity,
      `${row.product_code} at ${row.warehouse}`
    );
  }
});

test("dashboard includes actionable risk states", () => {
  const states = dashboard.inventory.map((row) => {
    if (row.available_quantity === 0) return "Out of stock";
    if (row.available_quantity < row.safety_stock * 0.5) return "Critical";
    if (row.available_quantity < row.safety_stock) return "Low";
    return "Healthy";
  });
  assert.ok(states.includes("Out of stock"));
  assert.ok(states.includes("Critical"));
  assert.ok(states.includes("Low"));
  assert.ok(states.includes("Healthy"));
});

test("real industry history is long enough for a forecast", () => {
  const observed = dashboard.demandSignal.filter((row) => row.series_type === "Observed");
  assert.ok(observed.length >= 48);
  assert.ok(observed.every((row) => Number.isFinite(row.actual_value)));
});

test("trend contains 24 monthly operational periods", () => {
  assert.equal(dashboard.monthlyActivity.length, 24);
});
