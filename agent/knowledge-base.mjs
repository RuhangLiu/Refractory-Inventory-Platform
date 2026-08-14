import { readFile } from "node:fs/promises";
import { parseCsv } from "../scripts/csv.mjs";
import { inventoryStatus, suggestedOrder } from "./replenishment-tool.mjs";

const projectRoot = new URL("../", import.meta.url);
const markdownSources = [
  ["README.md", "Platform overview"],
  ["docs/architecture.md", "Solution architecture"],
  ["docs/data-dictionary.md", "Data dictionary"],
  ["docs/gcp-runbook.md", "Google Cloud runbook"]
];

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "be",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "should",
  "the",
  "to",
  "we",
  "what",
  "which",
  "why",
  "with"
]);

function tokenize(text) {
  return (String(text).toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) || []).filter(
    (token) => token.length > 1 && !stopWords.has(token)
  );
}

function chunkMarkdown(text, source, fallbackTitle) {
  const chunks = [];
  let title = fallbackTitle;
  let buffer = [];
  const flush = () => {
    const content = buffer.join("\n").trim();
    if (content) {
      chunks.push({
        id: `${source}#${chunks.length + 1}`,
        source,
        title,
        text: content
      });
    }
    buffer = [];
  };

  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^#{1,6}\s+(.+)/);
    if (heading) {
      flush();
      title = heading[1].trim();
      continue;
    }
    if (!line.trim() && buffer.join(" ").length > 500) flush();
    else buffer.push(line);
  }
  flush();
  return chunks;
}

function productChunks(rows) {
  return rows.map((row) => ({
    id: `product:${row.product_code}`,
    source: "data/curated/products.csv",
    title: `${row.product_code} ${row.product_name}`,
    text:
      `${row.product_code} (${row.product_name}) is a ${row.category} supplied by ${row.supplier}. ` +
      `Unit: ${row.unit}; unit price: $${row.unit_price}; lead time: ${row.lead_time_days} days; ` +
      `baseline safety stock: ${row.safety_stock}; monthly demand baseline: ${row.monthly_demand_baseline}.`
  }));
}

function inventoryChunks(rows) {
  return rows.map((row) => ({
    id: `inventory:${row.product_code}:${row.warehouse}`,
    source: "data/curated/inventory.csv",
    title: `${row.product_code} at ${row.warehouse}`,
    text:
      `${row.product_code} (${row.product_name}) at ${row.warehouse}: current ${row.current_quantity} ${row.unit}, ` +
      `reserved ${row.reserved_quantity}, available ${row.available_quantity}, in transit ${row.in_transit_quantity}, ` +
      `safety stock ${row.safety_stock}, status ${inventoryStatus(row)}, suggested order ${suggestedOrder(row)} ${row.unit}. ` +
      `Supplier ${row.supplier}; lead time ${row.lead_time_days} days; last updated ${row.last_updated}.`
  }));
}

let knowledgePromise;

export async function loadKnowledgeBase() {
  if (!knowledgePromise) {
    knowledgePromise = (async () => {
      const markdown = await Promise.all(
        markdownSources.map(async ([source, title]) =>
          chunkMarkdown(await readFile(new URL(source, projectRoot), "utf8"), source, title)
        )
      );
      const [products, inventory] = await Promise.all([
        readFile(new URL("data/curated/products.csv", projectRoot), "utf8").then(parseCsv),
        readFile(new URL("data/curated/inventory.csv", projectRoot), "utf8").then(parseCsv)
      ]);
      return [...markdown.flat(), ...productChunks(products), ...inventoryChunks(inventory)];
    })();
  }
  return knowledgePromise;
}

export async function retrieveKnowledge(query, { limit = 5 } = {}) {
  const chunks = await loadKnowledgeBase();
  const queryText = String(query || "").trim().toLowerCase();
  const queryTerms = [...new Set(tokenize(queryText))];
  const documentFrequency = new Map();
  for (const term of queryTerms) {
    documentFrequency.set(
      term,
      chunks.reduce((count, chunk) => count + Number(tokenize(chunk.text).includes(term)), 0)
    );
  }

  const scored = chunks.map((chunk) => {
    const text = `${chunk.title} ${chunk.text}`.toLowerCase();
    const terms = tokenize(text);
    const frequencies = terms.reduce((map, term) => map.set(term, (map.get(term) || 0) + 1), new Map());
    let score = queryText && text.includes(queryText) ? 8 : 0;
    for (const term of queryTerms) {
      const tf = frequencies.get(term) || 0;
      const idf = Math.log((chunks.length + 1) / ((documentFrequency.get(term) || 0) + 1)) + 1;
      score += Math.min(tf, 4) * idf;
      if (chunk.title.toLowerCase().includes(term)) score += 2.5;
    }
    return { ...chunk, score: Number(score.toFixed(3)) };
  });

  const positive = scored.filter((chunk) => chunk.score > 0).sort((a, b) => b.score - a.score);
  return (positive.length ? positive : scored).slice(0, Math.max(1, Math.min(limit, 8)));
}

export function resetKnowledgeCache() {
  knowledgePromise = undefined;
}
