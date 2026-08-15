import { GoogleGenAI } from "@google/genai";
import { retrieveKnowledge } from "./knowledge-base.mjs";
import { recommendReplenishment } from "./replenishment-tool.mjs";
import { addTraceStep, createTrace, finishTrace } from "./trace-store.mjs";

const warehouseAliases = [
  { name: "Chicago", aliases: ["chicago", "芝加哥"] },
  { name: "Houston", aliases: ["houston", "休斯敦", "休斯顿"] },
  { name: "Pittsburgh", aliases: ["pittsburgh", "匹兹堡"] }
];

function responseLanguage(question) {
  return /[\u3400-\u9fff]/u.test(question) ? "zh" : "en";
}

function modelConfiguration() {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (apiKey) {
    return {
      client: new GoogleGenAI({ apiKey, apiVersion: "v1beta" }),
      model,
      mode: "gemini-api"
    };
  }

  const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID;
  const useVertex = String(process.env.GOOGLE_GENAI_USE_VERTEXAI || "").toLowerCase() === "true";
  if (project && useVertex) {
    return {
      client: new GoogleGenAI({
        vertexai: true,
        project,
        location: process.env.GOOGLE_CLOUD_LOCATION || "global",
        apiVersion: "v1"
      }),
      model,
      mode: "vertex-ai"
    };
  }

  return { client: null, model: null, mode: "local-grounded" };
}

export function getAgentStatus() {
  const configuration = modelConfiguration();
  return {
    status: "ready",
    generation_mode: configuration.mode,
    model: configuration.model,
    retrieval: "local lexical RAG over curated lake data and project documentation",
    tool: "recommend_replenishment",
    tool_access: "read-only recommendation",
    human_approval_required: true,
    trace_policy: "actions and evidence only; no hidden chain-of-thought"
  };
}

function detectToolRequest(question) {
  const productCode = question.toUpperCase().match(/\b[A-Z]{3}-\d{3}\b/)?.[0];
  const normalized = question.toLowerCase();
  const warehouse = warehouseAliases.find((entry) =>
    entry.aliases.some((alias) => normalized.includes(alias))
  )?.name;
  const intent = /replenish|reorder|order|purchase|available|stock|inventory|\u8865\u8d27|\u91c7\u8d2d|\u5e93\u5b58|\u5efa\u8bae/i.test(question);
  return productCode && warehouse && intent ? { productCode, warehouse } : null;
}

function formatEvidence(sources) {
  return sources
    .map(
      (source, index) =>
        `[S${index + 1}] ${source.title}\nSource: ${source.source}\n${source.text}`
    )
    .join("\n\n");
}

function quantityLabel(value, unit) {
  return `${value} ${value === 1 ? unit : `${unit}s`}`;
}

function localGroundedAnswer(question, sources, toolResult) {
  const language = responseLanguage(question);
  if (toolResult) {
    if (language === "zh") {
      const status =
        {
          "Out of stock": "缺货",
          Critical: "严重不足",
          Low: "库存偏低",
          Healthy: "健康"
        }[toolResult.status] || toolResult.status;
      const orderSentence = toolResult.suggested_order_quantity
        ? `只读工具建议审核 ${quantityLabel(
            toolResult.suggested_order_quantity,
            toolResult.unit
          )} 的订购量。`
        : "只读工具目前不建议补货。";
      return (
        `${toolResult.product_code} 在 ${toolResult.warehouse} 的库存状态为${status}。` +
        `可用库存为 ${quantityLabel(toolResult.available_quantity, toolResult.unit)}，` +
        `安全库存为 ${quantityLabel(toolResult.safety_stock, toolResult.unit)}，` +
        `在途数量为 ${quantityLabel(toolResult.in_transit_quantity, toolResult.unit)}。${orderSentence}` +
        `这是只读建议；采购前必须由计划员人工审批。[S1]`
      );
    }
    const orderSentence = toolResult.suggested_order_quantity
      ? `The read-only tool suggests reviewing an order for ${quantityLabel(toolResult.suggested_order_quantity, toolResult.unit)}.`
      : "The read-only tool does not suggest a replenishment order at this time.";
    return (
      `${toolResult.product_code} at ${toolResult.warehouse} is ${toolResult.status.toLowerCase()}. ` +
      `Available inventory is ${quantityLabel(toolResult.available_quantity, toolResult.unit)}, ` +
      `safety stock is ${quantityLabel(toolResult.safety_stock, toolResult.unit)}, and ` +
      `${quantityLabel(toolResult.in_transit_quantity, toolResult.unit)} are in transit. ${orderSentence} ` +
      `${toolResult.rationale} This is a recommendation only and requires planner approval before procurement. [S1]`
    );
  }

  const lead = sources[0];
  const supporting = sources[1];
  if (language === "zh") {
    return [
      `针对“${question}”，检索到的项目证据提供了以下依据：`,
      `${lead.text} [S1]`,
      supporting ? `${supporting.text} [S2]` : "",
      "如需准确的产品级决策，请提供产品编码和仓库名称，以便调用只读补货工具。"
    ]
      .filter(Boolean)
      .join("\n\n");
  }
  return [
    `The retrieved project evidence most directly answers “${question}” with the following grounded information:`,
    `${lead.text} [S1]`,
    supporting ? `${supporting.text} [S2]` : "",
    "If a precise product-level decision is required, include a product code and warehouse so the read-only replenishment tool can be used."
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function generateWithGemini(configuration, question, sources, toolResult) {
  const language = responseLanguage(question);
  const toolEvidence = toolResult
    ? `\n\nREAD-ONLY TOOL RESULT:\n${JSON.stringify(toolResult, null, 2)}`
    : "";
  const response = await configuration.client.models.generateContent({
    model: configuration.model,
    contents:
      `QUESTION:\n${question}\n\nRETRIEVED EVIDENCE:\n${formatEvidence(sources)}${toolEvidence}`,
    config: {
      temperature: 0.1,
      systemInstruction:
        `You are an inventory planning assistant. Answer only from the supplied evidence. Cite evidence using [S1], [S2], and so on. If evidence is insufficient, say so. Tool output is a recommendation only: never claim that a purchase order was created, and always state that human approval is required. Do not reveal or invent hidden chain-of-thought. Respond in ${
          language === "zh" ? "Simplified Chinese" : "English"
        }. Keep product names, product codes, supplier names, warehouse names, and source identifiers exactly as provided.`
    }
  });
  return response.text?.trim() || localGroundedAnswer(question, sources, toolResult);
}

export async function runInventoryAgent(
  question,
  { forceLocal = false, persistTrace = true } = {}
) {
  const normalizedQuestion = String(question || "").trim();
  if (normalizedQuestion.length < 3) throw new Error("Please enter a question of at least 3 characters.");
  if (normalizedQuestion.length > 1000) throw new Error("Question must be 1,000 characters or fewer.");

  const trace = createTrace(normalizedQuestion);
  addTraceStep(trace, "input", "Accepted the user question", {
    character_count: normalizedQuestion.length
  });

  const sources = await retrieveKnowledge(normalizedQuestion, { limit: 5 });
  addTraceStep(trace, "retrieval", `Retrieved ${sources.length} grounded sources`, {
    source_ids: sources.map((source) => source.id),
    scores: sources.map((source) => source.score)
  });

  let toolCall = null;
  let toolResult = null;
  const detected = detectToolRequest(normalizedQuestion);
  if (detected) {
    toolCall = { name: "recommend_replenishment", arguments: detected };
    addTraceStep(trace, "tool_call", "Called the read-only replenishment tool", toolCall);
    toolResult = await recommendReplenishment(detected);
    addTraceStep(trace, "tool_result", "Received a recommendation requiring human approval", {
      product_code: toolResult.product_code,
      warehouse: toolResult.warehouse,
      status: toolResult.status,
      suggested_order_quantity: toolResult.suggested_order_quantity,
      human_approval_required: true
    });
  } else {
    addTraceStep(trace, "tool_decision", "No tool call was needed", {
      reason: "A product code, warehouse, and inventory decision intent were not all present."
    });
  }

  const configuration = forceLocal
    ? { client: null, model: null, mode: "local-grounded" }
    : modelConfiguration();
  addTraceStep(trace, "generation", `Generated a grounded answer using ${configuration.mode}`, {
    model: configuration.model,
    citations_required: true
  });

  let answer;
  try {
    answer = configuration.client
      ? await generateWithGemini(configuration, normalizedQuestion, sources, toolResult)
      : localGroundedAnswer(normalizedQuestion, sources, toolResult);
  } catch (error) {
    addTraceStep(trace, "generation_fallback", "Cloud generation failed; used local grounded output", {
      error_type: error.name
    });
    answer = localGroundedAnswer(normalizedQuestion, sources, toolResult);
    configuration.mode = "local-grounded-fallback";
  }

  addTraceStep(trace, "final", "Returned an answer with citations and safety controls", {
    cited_sources: Math.min(sources.length, answer.match(/\[S\d+\]/g)?.length || 0),
    human_approval_required: Boolean(toolResult)
  });
  await finishTrace(trace, { persist: persistTrace });

  return {
    answer,
    generation_mode: configuration.mode,
    model: configuration.model,
    sources: sources.map((source, index) => ({
      citation: `S${index + 1}`,
      id: source.id,
      title: source.title,
      source: source.source,
      score: source.score,
      excerpt: source.text.slice(0, 420)
    })),
    tool_call: toolCall,
    tool_result: toolResult,
    trace
  };
}
