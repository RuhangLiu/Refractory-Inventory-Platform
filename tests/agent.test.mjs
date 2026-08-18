import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInventoryAgent } from "../agent/assistant.mjs";
import {
  extractManagedEventSummary,
  getAgentEngineConfiguration,
  parseSseEvents,
  runManagedAgent
} from "../agent/agent-engine-client.mjs";
import { retrieveKnowledge } from "../agent/knowledge-base.mjs";
import { recommendReplenishment } from "../agent/replenishment-tool.mjs";

test("RAG retrieval grounds a product-and-warehouse question", async () => {
  const sources = await retrieveKnowledge("MCB-001 inventory at Chicago", { limit: 4 });
  assert.ok(sources.some((source) => source.id === "inventory:MCB-001:Chicago"));
  assert.ok(sources.every((source) => source.source));
});

test("replenishment tool is deterministic and approval-gated", async () => {
  const result = await recommendReplenishment({
    productCode: "MCB-001",
    warehouse: "Chicago"
  });
  assert.equal(result.status, "Out of stock");
  assert.equal(result.suggested_order_quantity, 102);
  assert.equal(result.recommendation_only, true);
  assert.equal(result.human_approval_required, true);
});

test("agent calls one tool and returns a safe auditable trace", async () => {
  const result = await runInventoryAgent("Should we replenish MCB-001 at Chicago?", {
    forceLocal: true,
    persistTrace: false
  });
  assert.equal(result.tool_call.name, "recommend_replenishment");
  assert.equal(result.tool_result.suggested_order_quantity, 102);
  assert.match(result.answer, /planner approval/i);
  assert.match(result.answer, /\[S1\]/);
  assert.ok(result.trace.steps.some((step) => step.type === "retrieval"));
  assert.ok(result.trace.steps.some((step) => step.type === "tool_call"));
  assert.doesNotMatch(JSON.stringify(result.trace), /chain_of_thought/i);
});

test("agent answers Chinese questions in Chinese without translating product identifiers", async () => {
  const result = await runInventoryAgent("是否应该为芝加哥的 MCB-001 补货？为什么？", {
    forceLocal: true,
    persistTrace: false
  });
  assert.equal(result.tool_call.name, "recommend_replenishment");
  assert.equal(result.tool_call.arguments.warehouse, "Chicago");
  assert.match(result.answer, /人工审批/);
  assert.match(result.answer, /MCB-001/);
  assert.match(result.answer, /Chicago/);
  assert.match(result.answer, /[\u3400-\u9fff]/u);
});

test("Agent Card sets a zero-dollar authorization scope", async () => {
  const card = JSON.parse(
    await readFile(new URL("../agent/agent-card.json", import.meta.url), "utf8")
  );
  assert.equal(card.authorization_scope.maximum_financial_commitment_usd, 0);
  assert.ok(card.authorization_scope.prohibited_actions.includes("create_purchase_order"));
});

test("managed Agent Engine configuration validates the resource name", () => {
  const configuration = getAgentEngineConfiguration({
    AGENT_ENGINE_RESOURCE:
      "projects/1052614770067/locations/us-west1/reasoningEngines/7636161031462453248",
    AGENT_ENGINE_MODEL: "gemini-3.1-pro-preview"
  });
  assert.equal(configuration.location, "us-west1");
  assert.equal(configuration.id, "7636161031462453248");
  assert.equal(configuration.model, "gemini-3.1-pro-preview");
  assert.throws(
    () => getAgentEngineConfiguration({ AGENT_ENGINE_RESOURCE: "invalid" }),
    /projects\/\{project\}/
  );
});

test("managed Agent Engine SSE parser preserves tool calls and final answer", () => {
  const events = parseSseEvents(
    [
      'data: {"content":{"parts":[{"functionCall":{"name":"execute_sql_readonly","args":{"query":"SELECT 1"}}}]}}',
      "",
      'data: {"content":{"parts":[{"functionResponse":{"name":"execute_sql_readonly","response":{"rows":1}}}]}}',
      "",
      'data: {"content":{"parts":[{"text":"Verified managed answer."}]}}',
      ""
    ].join("\n")
  );
  const summary = extractManagedEventSummary(events);
  assert.equal(events.length, 3);
  assert.equal(summary.toolCalls[0].name, "execute_sql_readonly");
  assert.equal(summary.toolResults[0].name, "execute_sql_readonly");
  assert.equal(summary.answer, "Verified managed answer.");
});

test("managed Agent Engine adapter returns all three grounded layers", async () => {
  const frames = [
    { content: { parts: [{ functionCall: { name: "read_object", args: {} } }] } },
    {
      content: {
        parts: [
          {
            functionCall: {
              name: "get_inventory_snapshot",
              args: { product_code: "MCB-001", warehouse: "Chicago" }
            }
          }
        ]
      }
    },
    {
      content: {
        parts: [{ functionCall: { name: "retrieve_inventory_policy", args: { query: "policy" } } }]
      }
    },
    {
      content: {
        parts: [
          {
            text:
              "Replenish 102 pieces after human approval. Evidence: EXC-2026-0814-001 and RIC-POL-001."
          }
        ]
      }
    }
  ];
  const payload = frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join("");
  const result = await runManagedAgent("Should we replenish MCB-001 at Chicago?", {
    environment: {
      AGENT_ENGINE_RESOURCE:
        "projects/1052614770067/locations/us-west1/reasoningEngines/7636161031462453248"
    },
    authFactory: () => ({ getAccessToken: async () => "test-token" }),
    fetchImpl: async (_url, options) => {
      assert.match(options.headers.Authorization, /^Bearer /);
      return new Response(payload, { status: 200, headers: { "Content-Type": "text/event-stream" } });
    },
    persistTrace: false
  });
  assert.equal(result.generation_mode, "managed-agent-engine");
  assert.equal(result.sources.length, 3);
  assert.equal(result.tool_result.suggested_order_quantity, 102);
  assert.ok(result.trace.steps.some((step) => step.summary.includes("get_inventory_snapshot")));
});
