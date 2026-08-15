import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { getInventorySnapshot } from "./inventory-query.mjs";

export function buildInventoryMcpServer({ lookup = getInventorySnapshot } = {}) {
  const server = new McpServer(
    {
      name: "refractory-inventory-readonly-mcp",
      version: "1.0.0"
    },
    {
      capabilities: { tools: {} },
      instructions:
        "This server exposes one fixed, parameterized, read-only inventory lookup. It cannot accept arbitrary SQL or change inventory and procurement data."
    }
  );

  server.registerTool(
    "get_inventory_snapshot",
    {
      title: "Get inventory snapshot",
      description:
        "Read one product-and-warehouse record from the fixed BigQuery serving_inventory view. The operation is read-only and never creates a purchase order.",
      inputSchema: z.object({
        product_code: z
          .string()
          .regex(/^[A-Za-z]{3}-\d{3}$/)
          .describe("Synthetic product code such as MCB-001."),
        warehouse: z
          .enum(["Chicago", "Houston", "Pittsburgh"])
          .describe("Exact synthetic warehouse name.")
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (input) => {
      try {
        const result = await lookup(input);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Inventory lookup failed: ${error.message}`
            }
          ]
        };
      }
    }
  );

  return server;
}
