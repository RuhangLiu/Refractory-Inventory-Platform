import { appendFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const tracePath = new URL("../tmp/agent-traces.ndjson", import.meta.url);
const traces = [];

export function createTrace(question) {
  return {
    trace_id: randomUUID(),
    started_at: new Date().toISOString(),
    status: "running",
    question,
    notice: "Auditable action trace only; hidden chain-of-thought is not collected.",
    steps: []
  };
}

export function addTraceStep(trace, type, summary, details = {}) {
  trace.steps.push({
    sequence: trace.steps.length + 1,
    timestamp: new Date().toISOString(),
    type,
    summary,
    details
  });
}

export async function finishTrace(trace, { status = "complete", persist = true } = {}) {
  trace.status = status;
  trace.completed_at = new Date().toISOString();
  traces.unshift(structuredClone(trace));
  traces.splice(100);
  if (persist) {
    await mkdir(new URL("../tmp/", import.meta.url), { recursive: true });
    await appendFile(tracePath, `${JSON.stringify(trace)}\n`, "utf8");
  }
  return trace;
}

export function listTraces(limit = 10) {
  return traces.slice(0, Math.max(1, Math.min(Number(limit) || 10, 50)));
}
