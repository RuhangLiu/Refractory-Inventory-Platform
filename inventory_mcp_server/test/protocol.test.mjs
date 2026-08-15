import assert from "node:assert/strict";
import test from "node:test";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

import { startInventoryMcpServer } from "../src/server.mjs";

test("independent MCP client lists and calls the only read-only tool", async (t) => {
  const lookup = async (input) => ({
    source_view:
      "refractory-inventory-platform.kaixiang_inventory.serving_inventory",
    query_mode: "fixed-parameterized-read-only",
    row_count: 1,
    records: [
      {
        product_code: input.product_code,
        warehouse: input.warehouse,
        available_quantity: 0,
        suggested_order_quantity: 102
      }
    ]
  });
  const server = await startInventoryMcpServer({
    host: "127.0.0.1",
    port: 0,
    lookup
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const address = server.address();
  const transport = new StreamableHTTPClientTransport(
    new URL(`http://127.0.0.1:${address.port}/mcp`)
  );
  const client = new Client({ name: "protocol-test", version: "1.0.0" });
  t.after(() => client.close());

  await client.connect(transport);
  const listed = await client.listTools();
  assert.deepEqual(
    listed.tools.map((tool) => tool.name),
    ["get_inventory_snapshot"]
  );
  assert.equal(listed.tools[0].annotations.readOnlyHint, true);
  assert.equal(listed.tools[0].annotations.destructiveHint, false);

  const result = await client.callTool({
    name: "get_inventory_snapshot",
    arguments: { product_code: "MCB-001", warehouse: "Chicago" }
  });
  assert.equal(result.isError, undefined);
  const payload = JSON.parse(result.content[0].text);
  assert.equal(payload.records[0].suggested_order_quantity, 102);
});
