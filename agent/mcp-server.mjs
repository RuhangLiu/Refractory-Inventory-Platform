import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { recommendReplenishment } from "./replenishment-tool.mjs";

const agentCardUrl = new URL("./agent-card.json", import.meta.url);

export function buildMcpServer() {
  const server = new McpServer(
    { name: "refractory-inventory-agent", version: "1.0.0" },
    {
      capabilities: { tools: {}, resources: {} },
      instructions:
        "Use the single read-only replenishment tool for product-and-warehouse inventory decisions. All procurement actions require human approval."
    }
  );

  server.registerTool(
    "recommend_replenishment",
    {
      title: "Recommend inventory replenishment",
      description:
        "Return a read-only replenishment recommendation for one product code and warehouse. This tool never creates a purchase order.",
      inputSchema: z.object({
        productCode: z.string().regex(/^[A-Za-z]{3}-\d{3}$/),
        warehouse: z.enum(["Chicago", "Houston", "Pittsburgh"])
      }),
      outputSchema: z.object({
        product_code: z.string(),
        product_name: z.string(),
        warehouse: z.string(),
        supplier: z.string(),
        unit: z.string(),
        status: z.string(),
        current_quantity: z.number(),
        reserved_quantity: z.number(),
        available_quantity: z.number(),
        safety_stock: z.number(),
        in_transit_quantity: z.number(),
        suggested_order_quantity: z.number(),
        lead_time_days: z.number(),
        recommendation_only: z.boolean(),
        human_approval_required: z.boolean(),
        source: z.string(),
        rationale: z.string()
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ productCode, warehouse }) => {
      try {
        const recommendation = await recommendReplenishment({ productCode, warehouse });
        return {
          content: [{ type: "text", text: JSON.stringify(recommendation, null, 2) }],
          structuredContent: recommendation
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: error.message }]
        };
      }
    }
  );

  server.registerResource(
    "agent-card",
    "agent://refractory-inventory/card",
    {
      title: "Refractory Inventory Planning Agent Card",
      description: "Capabilities, authorization scope, data policy, and trace policy.",
      mimeType: "application/json"
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: readFileSync(agentCardUrl, "utf8")
        }
      ]
    })
  );

  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.error("Refractory Inventory MCP server listening on stdio");
  const handle = serveStdio(() => buildMcpServer());
  process.on("SIGINT", () => void handle.close());
}
