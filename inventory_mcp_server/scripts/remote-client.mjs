import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const endpoint = process.env.MCP_SERVER_URL;
const token = process.env.MCP_ID_TOKEN;

if (!endpoint) {
  throw new Error("MCP_SERVER_URL must be set to the authenticated /mcp URL.");
}
if (!token) {
  throw new Error("MCP_ID_TOKEN must contain an OIDC ID token for the Cloud Run URL.");
}

const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
  authProvider: { token: async () => token }
});
const client = new Client({
  name: "module-8-independent-cloud-run-client",
  version: "1.0.0"
});

try {
  await client.connect(transport);
  const listed = await client.listTools();
  const result = await client.callTool({
    name: "get_inventory_snapshot",
    arguments: { product_code: "MCB-001", warehouse: "Chicago" }
  });

  console.log(
    JSON.stringify(
      {
        connected_client: "module-8-independent-cloud-run-client",
        endpoint,
        tools: listed.tools.map((tool) => tool.name),
        call: {
          name: "get_inventory_snapshot",
          arguments: { product_code: "MCB-001", warehouse: "Chicago" }
        },
        result: result.content
      },
      null,
      2
    )
  );
} finally {
  await client.close();
}
