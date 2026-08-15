import assert from "node:assert/strict";
import test from "node:test";

import {
  INVENTORY_SQL,
  SOURCE_VIEW,
  getInventorySnapshot
} from "../src/inventory-query.mjs";

test("inventory query is fixed, parameterized, read-only, and bounded", async () => {
  let captured;
  const bigQueryClient = {
    async query(options) {
      captured = options;
      return [
        [
          {
            product_code: "MCB-001",
            warehouse: "Chicago",
            available_quantity: 0,
            suggested_order_quantity: 102
          }
        ]
      ];
    }
  };

  const result = await getInventorySnapshot(
    { product_code: "mcb-001", warehouse: "Chicago" },
    { bigQueryClient }
  );

  assert.equal(captured.query, INVENTORY_SQL);
  assert.equal(captured.params.product_code, "MCB-001");
  assert.equal(captured.params.warehouse, "Chicago");
  assert.equal(captured.useLegacySql, false);
  assert.equal(captured.maximumBytesBilled, "100000000");
  assert.match(captured.query, /WHERE product_code = @product_code/);
  assert.match(captured.query, /warehouse = @warehouse/);
  assert.doesNotMatch(captured.query, /\b(?:INSERT|UPDATE|DELETE|MERGE)\b/i);
  assert.equal(result.source_view, SOURCE_VIEW);
  assert.equal(result.row_count, 1);
  assert.equal(result.records[0].suggested_order_quantity, 102);
});

test("inventory query rejects unknown warehouses before BigQuery", async () => {
  let called = false;
  const bigQueryClient = {
    async query() {
      called = true;
      return [[]];
    }
  };

  await assert.rejects(
    () =>
      getInventorySnapshot(
        { product_code: "MCB-001", warehouse: "Other" },
        { bigQueryClient }
      ),
    /warehouse must be one of/
  );
  assert.equal(called, false);
});
