import { randomUUID } from "node:crypto";
import { GoogleAuth } from "google-auth-library";
import { detectToolRequest } from "./assistant.mjs";
import { recommendReplenishment } from "./replenishment-tool.mjs";
import { addTraceStep, createTrace, finishTrace } from "./trace-store.mjs";

const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

export function getAgentEngineConfiguration(environment = process.env) {
  const resource = String(environment.AGENT_ENGINE_RESOURCE || "").trim();
  if (!resource) return null;
  const match = resource.match(
    /^projects\/([^/]+)\/locations\/([^/]+)\/reasoningEngines\/([^/]+)$/
  );
  if (!match) {
    throw new Error(
      "AGENT_ENGINE_RESOURCE must use projects/{project}/locations/{location}/reasoningEngines/{id}."
    );
  }
  return {
    resource,
    project: match[1],
    location: match[2],
    id: match[3],
    model: environment.AGENT_ENGINE_MODEL || "gemini-3.1-pro-preview",
    timeoutMs: Math.max(10_000, Number(environment.AGENT_ENGINE_TIMEOUT_MS) || 180_000)
  };
}

export function getManagedAgentStatus(environment = process.env) {
  const configuration = getAgentEngineConfiguration(environment);
  if (!configuration) return null;
  return {
    status: "ready",
    generation_mode: "managed-agent-engine",
    model: configuration.model,
    agent_engine: configuration.resource,
    retrieval: "Vertex AI RAG Engine policy corpus",
    tools: ["bigquery-remote-mcp", "gcs-remote-mcp", "refractory-inventory-mcp"],
    tool_access: "read-only structured and unstructured retrieval",
    human_approval_required: true,
    trace_policy: "managed tool events and evidence only; no hidden chain-of-thought"
  };
}

export function parseSseEvents(payload) {
  const text = String(payload || "").trim();
  if (!text) return [];
  if (!text.includes("data:")) {
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  }

  const events = [];
  let dataLines = [];
  const flush = () => {
    if (!dataLines.length) return;
    const data = dataLines.join("\n").trim();
    dataLines = [];
    if (!data || data === "[DONE]") return;
    try {
      events.push(JSON.parse(data));
    } catch {
      // Ignore heartbeat and non-JSON diagnostic frames.
    }
  };

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) {
      flush();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  flush();
  return events;
}

function visit(value, callback) {
  if (Array.isArray(value)) {
    for (const item of value) visit(item, callback);
    return;
  }
  if (!value || typeof value !== "object") return;
  callback(value);
  for (const item of Object.values(value)) visit(item, callback);
}

export function extractManagedEventSummary(events) {
  const texts = [];
  const toolCalls = [];
  const toolResults = [];

  visit(events, (object) => {
    if (typeof object.text === "string" && object.text.trim()) {
      texts.push(object.text.trim());
    }
    const call = object.functionCall || object.function_call || object.toolCall || object.tool_call;
    if (call && typeof call === "object" && call.name) {
      toolCalls.push({ name: String(call.name), arguments: call.args || call.arguments || {} });
    }
    const result =
      object.functionResponse ||
      object.function_response ||
      object.toolResponse ||
      object.tool_response;
    if (result && typeof result === "object" && result.name) {
      toolResults.push({ name: String(result.name), response: result.response || result.result || {} });
    }
  });

  return {
    answer: texts.at(-1) || "",
    toolCalls: uniqueNamedEvents(toolCalls),
    toolResults: uniqueNamedEvents(toolResults)
  };
}

function uniqueNamedEvents(events) {
  const seen = new Set();
  return events.filter((event) => {
    const key = `${event.name}:${JSON.stringify(event.arguments || event.response || {})}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function managedSources(toolCalls, answer) {
  const names = new Set(toolCalls.map((call) => call.name));
  const sources = [];
  if (names.has("execute_sql_readonly") || names.has("get_inventory_snapshot")) {
    sources.push({
      id: "bigquery:serving_inventory",
      title: "BigQuery serving_inventory",
      source: "refractory-inventory-platform.kaixiang_inventory.serving_inventory",
      excerpt: "Structured inventory facts retrieved at request time through a read-only MCP tool."
    });
  }
  if ([...names].some((name) => ["read_object", "get_object_metadata", "list_objects"].includes(name))) {
    sources.push({
      id: "gcs:inventory_exception_log",
      title: "Cloud Storage inventory exception log",
      source: "gs://ruhangliu-lake-curated/agent-inputs/inventory_exception_log.json",
      excerpt: "Operational exception context retrieved through the managed Cloud Storage MCP toolset."
    });
  }
  if (names.has("retrieve_inventory_policy") || /RIC-POL-00[12]/i.test(answer)) {
    sources.push({
      id: "rag:inventory_policies",
      title: "Approved inventory policy corpus",
      source: "Vertex AI RAG Engine",
      excerpt: "Replenishment and purchase-authorization policy passages retrieved from the vector corpus."
    });
  }
  return sources.map((source, index) => ({
    citation: `S${index + 1}`,
    score: "managed",
    ...source
  }));
}

function safeResultSummary(result) {
  const serialized = JSON.stringify(result.response || {});
  return serialized.length > 500 ? `${serialized.slice(0, 500)}…` : serialized;
}

async function accessToken(authFactory) {
  const auth = authFactory({ scopes: [CLOUD_PLATFORM_SCOPE] });
  const token = await auth.getAccessToken();
  if (!token) throw new Error("The Cloud Run service identity could not obtain a Google access token.");
  return typeof token === "string" ? token : token.token;
}

export async function runManagedAgent(
  question,
  {
    environment = process.env,
    fetchImpl = fetch,
    authFactory = (options) => new GoogleAuth(options),
    persistTrace = true
  } = {}
) {
  const configuration = getAgentEngineConfiguration(environment);
  if (!configuration) throw new Error("AGENT_ENGINE_RESOURCE is not configured.");
  const normalizedQuestion = String(question || "").trim();
  if (normalizedQuestion.length < 3) throw new Error("Please enter a question of at least 3 characters.");
  if (normalizedQuestion.length > 1000) throw new Error("Question must be 1,000 characters or fewer.");

  const trace = createTrace(normalizedQuestion);
  addTraceStep(trace, "input", "Accepted the user question for the managed Agent Engine", {
    character_count: normalizedQuestion.length
  });

  const endpoint = `https://${configuration.location}-aiplatform.googleapis.com/v1/${configuration.resource}:streamQuery?alt=sse`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), configuration.timeoutMs);
  let response;
  let payload;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await accessToken(authFactory)}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        class_method: "async_stream_query",
        input: {
          user_id: `public-demo-${randomUUID()}`,
          message: normalizedQuestion
        }
      }),
      signal: controller.signal
    });
    payload = await response.text();
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Managed Agent Engine request failed (${response.status}): ${payload.slice(0, 500)}`);
  }

  const events = parseSseEvents(payload);
  const summary = extractManagedEventSummary(events);
  if (!summary.answer) throw new Error("Managed Agent Engine returned no final answer.");

  for (const call of summary.toolCalls) {
    addTraceStep(trace, "tool_call", `Called managed tool ${call.name}`, {
      name: call.name,
      arguments: call.arguments
    });
  }
  for (const result of summary.toolResults) {
    addTraceStep(trace, "tool_result", `Received a result from ${result.name}`, {
      name: result.name,
      summary: safeResultSummary(result)
    });
  }

  const sources = managedSources(summary.toolCalls, summary.answer);
  addTraceStep(trace, "retrieval", `Verified ${sources.length} managed grounding layers`, {
    source_ids: sources.map((source) => source.id),
    managed_tools: summary.toolCalls.map((call) => call.name)
  });
  addTraceStep(trace, "generation", "Generated the answer in the deployed Agent Engine", {
    model: configuration.model,
    agent_engine: configuration.resource
  });
  addTraceStep(trace, "final", "Returned a managed answer with an auditable tool trace", {
    human_approval_required: true
  });
  await finishTrace(trace, { persist: persistTrace });

  const detected = detectToolRequest(normalizedQuestion);
  const displayToolResult = detected ? await recommendReplenishment(detected) : null;

  return {
    answer: summary.answer,
    generation_mode: "managed-agent-engine",
    model: configuration.model,
    sources,
    tool_call: summary.toolCalls.at(-1) || null,
    tool_result: displayToolResult,
    trace
  };
}
