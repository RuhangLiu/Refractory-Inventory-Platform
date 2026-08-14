import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInventoryAgent } from "../agent/assistant.mjs";
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

test("Agent Card sets a zero-dollar authorization scope", async () => {
  const card = JSON.parse(
    await readFile(new URL("../agent/agent-card.json", import.meta.url), "utf8")
  );
  assert.equal(card.authorization_scope.maximum_financial_commitment_usd, 0);
  assert.ok(card.authorization_scope.prohibited_actions.includes("create_purchase_order"));
});
