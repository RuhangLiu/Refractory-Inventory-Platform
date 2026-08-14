import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(projectRoot, "agent", "mcp-server.mjs")],
  cwd: projectRoot,
  stderr: "pipe"
});
transport.stderr?.on("data", (chunk) => process.stderr.write(chunk));

const client = new Client({ name: "module-8-demo-client", version: "1.0.0" });
try {
  await client.connect(transport);
  const toolList = await client.listTools();
  const result = await client.callTool({
    name: "recommend_replenishment",
    arguments: { productCode: "MCB-001", warehouse: "Chicago" }
  });
  console.log(
    JSON.stringify(
      {
        connected_client: "module-8-demo-client",
        tools: toolList.tools.map((tool) => ({ name: tool.name, description: tool.description })),
        call: {
          name: "recommend_replenishment",
          arguments: { productCode: "MCB-001", warehouse: "Chicago" }
        },
        result: result.structuredContent || result.content
      },
      null,
      2
    )
  );
} finally {
  await client.close();
}
