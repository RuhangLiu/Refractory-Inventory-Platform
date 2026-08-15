import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler } from "@modelcontextprotocol/server";

import { buildInventoryMcpServer } from "./mcp.mjs";

export async function startInventoryMcpServer({
  host = "0.0.0.0",
  port = Number(process.env.PORT || 8080),
  lookup
} = {}) {
  const handler = createMcpHandler(
    () => buildInventoryMcpServer({ lookup }),
    {
      legacy: "stateless",
      responseMode: "json",
      onerror: (error) => console.error("MCP request error", error)
    }
  );
  const mcpNodeHandler = toNodeHandler(handler, {
    onerror: (error) => console.error("MCP adapter error", error)
  });

  const server = createServer(async (request, response) => {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          status: "ok",
          service: "refractory-inventory-readonly-mcp",
          mcp_endpoint: "/mcp"
        })
      );
      return;
    }

    if (url.pathname !== "/mcp") {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    await mcpNodeHandler(request, response);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });

  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = await startInventoryMcpServer();
  const address = server.address();
  console.log(
    `Refractory Inventory read-only MCP server listening on ${address.address}:${address.port}`
  );
}
