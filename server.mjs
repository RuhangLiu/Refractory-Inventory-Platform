// Refractory Inventory Platform application server.
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAgentStatus, runInventoryAgent } from "./agent/assistant.mjs";
import {
  getManagedAgentStatus,
  runManagedAgent
} from "./agent/agent-engine-client.mjs";
import { recommendReplenishment } from "./agent/replenishment-tool.mjs";
import { listTraces } from "./agent/trace-store.mjs";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(rootDir, "public");
const localDashboardPath = path.join(rootDir, "data", "serving", "dashboard.json");
const localActionsPath = path.join(rootDir, "data", "serving", "alert-actions.json");
const agentCardPath = path.join(rootDir, "agent", "agent-card.json");
const port = Number(process.env.PORT || 8080);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function jsonResponse(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function readRequestJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString("utf8");
  if (body.length > 100_000) throw new Error("Request body is too large.");
  return body ? JSON.parse(body) : {};
}

function cloudModeEnabled() {
  return Boolean(process.env.GCP_PROJECT_ID && process.env.BQ_DATASET);
}

async function queryCloudDashboard() {
  const { BigQuery } = await import("@google-cloud/bigquery");
  const projectId = process.env.GCP_PROJECT_ID;
  const dataset = process.env.BQ_DATASET;
  const location = process.env.BQ_LOCATION || "US";
  const client = new BigQuery({ projectId });
  const table = (name) => `\`${projectId}.${dataset}.${name}\``;

  const [inventoryRows] = await client.query({
    location,
    query: `
      SELECT *
      FROM ${table("serving_inventory")}
      ORDER BY inventory_status_rank, available_quantity, product_code, warehouse
    `
  });
  const [activityRows] = await client.query({
    location,
    query: `
      SELECT FORMAT_DATE('%Y-%m-%d', month) AS month, sales_quantity, purchase_quantity
      FROM ${table("monthly_inventory_activity")}
      ORDER BY month
    `
  });
  const [forecastRows] = await client.query({
    location,
    query: `
      SELECT FORMAT_DATE('%Y-%m-%d', observation_date) AS observation_date,
             actual_value,
             forecast_value,
             prediction_interval_lower_bound AS lower_bound,
             prediction_interval_upper_bound AS upper_bound,
             series_type
      FROM ${table("serving_demand_forecast")}
      ORDER BY observation_date
    `
  });

  return {
    generatedAt: new Date().toISOString(),
    mode: "cloud",
    inventory: inventoryRows,
    monthlyActivity: activityRows,
    demandSignal: forecastRows,
    source: {
      inventory: "Synthetic course-case operational data in BigQuery",
      demandSignal: "Federal Reserve Board via FRED, series IPG3311A2N",
      forecast: "BigQuery ML ARIMA_PLUS"
    }
  };
}

async function getDashboard() {
  if (cloudModeEnabled()) return queryCloudDashboard();
  const dashboard = await readJson(localDashboardPath, null);
  if (!dashboard) {
    throw new Error("Local dashboard data is missing. Run npm run fetch:fred and npm run generate.");
  }
  return dashboard;
}

async function getActions() {
  if (!cloudModeEnabled()) return readJson(localActionsPath, []);

  const { BigQuery } = await import("@google-cloud/bigquery");
  const projectId = process.env.GCP_PROJECT_ID;
  const dataset = process.env.BQ_DATASET;
  const client = new BigQuery({ projectId });
  const [rows] = await client.query({
    location: process.env.BQ_LOCATION || "US",
    query: `
      SELECT alert_id, product_code, warehouse, status, acknowledged_by, acknowledged_at
      FROM \`${projectId}.${dataset}.alert_actions\`
      ORDER BY acknowledged_at DESC
      LIMIT 500
    `
  });
  return rows;
}

async function saveAction(action) {
  const record = {
    alert_id: String(action.alertId || ""),
    product_code: String(action.productCode || ""),
    warehouse: String(action.warehouse || ""),
    status: "acknowledged",
    acknowledged_by: String(action.acknowledgedBy || "Warehouse planner"),
    acknowledged_at: new Date().toISOString()
  };
  if (!record.alert_id || !record.product_code || !record.warehouse) {
    throw new Error("alertId, productCode, and warehouse are required.");
  }

  if (cloudModeEnabled()) {
    const { BigQuery } = await import("@google-cloud/bigquery");
    const client = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
    await client
      .dataset(process.env.BQ_DATASET)
      .table("alert_actions")
      .insert([record]);
    return record;
  }

  const actions = await readJson(localActionsPath, []);
  const nextActions = [
    record,
    ...actions.filter((item) => item.alert_id !== record.alert_id)
  ];
  await writeFile(localActionsPath, `${JSON.stringify(nextActions, null, 2)}\n`, "utf8");
  return record;
}

async function serveStatic(requestPath, response) {
  const requested = requestPath === "/" ? "/index.html" : requestPath;
  const filePath =
    requested === "/vendor/chart.umd.js"
      ? path.join(rootDir, "node_modules", "chart.js", "dist", "chart.umd.js")
      : path.join(publicDir, requested);
  const normalized = path.normalize(filePath);
  const isPublic = normalized.startsWith(publicDir);
  const isVendor = normalized.includes(
    path.join("node_modules", "chart.js", "dist", "chart.umd.js")
  );
  if (!isPublic && !isVendor) {
    jsonResponse(response, 403, { error: "Forbidden" });
    return;
  }

  try {
    const content = await readFile(normalized);
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(normalized)] || "application/octet-stream",
      "Cache-Control": isVendor ? "public, max-age=3600" : "no-cache"
    });
    response.end(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      jsonResponse(response, 404, { error: "Not found" });
      return;
    }
    throw error;
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  try {
    if (request.method === "GET" && url.pathname === "/api/health") {
      const managedAgentStatus = getManagedAgentStatus();
      jsonResponse(response, 200, {
        status: "ok",
        mode: cloudModeEnabled() ? "cloud" : "local",
        agent_mode: managedAgentStatus?.generation_mode || getAgentStatus().generation_mode,
        timestamp: new Date().toISOString()
      });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/dashboard") {
      jsonResponse(response, 200, await getDashboard());
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/acknowledgments") {
      jsonResponse(response, 200, await getActions());
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/agent/status") {
      jsonResponse(response, 200, getManagedAgentStatus() || getAgentStatus());
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/agent/card") {
      jsonResponse(response, 200, JSON.parse(await readFile(agentCardPath, "utf8")));
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/agent/traces") {
      jsonResponse(response, 200, {
        traces: listTraces(url.searchParams.get("limit"))
      });
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/acknowledgments") {
      jsonResponse(response, 201, await saveAction(await readRequestJson(request)));
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/agent/ask") {
      const { question } = await readRequestJson(request);
      jsonResponse(
        response,
        200,
        await (getManagedAgentStatus()
          ? runManagedAgent(question)
          : runInventoryAgent(question))
      );
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/agent/recommend") {
      jsonResponse(response, 200, await recommendReplenishment(await readRequestJson(request)));
      return;
    }
    if (request.method === "GET") {
      await serveStatic(url.pathname, response);
      return;
    }
    jsonResponse(response, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    jsonResponse(response, 500, {
      error: "The request could not be completed.",
      detail: process.env.NODE_ENV === "production" ? undefined : error.message
    });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Refractory Inventory Platform listening on http://localhost:${port}`);
});
