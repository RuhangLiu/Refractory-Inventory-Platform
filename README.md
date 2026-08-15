# Refractory Inventory Platform

A cloud-ready inventory control product for a refractory materials company. It combines synthetic operational data with a real Federal Reserve steel-production series, surfaces low-stock decisions, and prepares a BigQuery ML demand forecast for a live Google Cloud deployment.

## What the application does

- Summarizes inventory value, available stock, action-required lines, and stock health
- Filters inventory by warehouse, product, category, supplier, and status
- Ranks low-stock and out-of-stock materials by replenishment gap
- Requires a human acknowledgment before any procurement follow-up
- Shows monthly synthetic sales and purchase activity
- Shows real steel-industry history and a labeled forecast
- Provides a grounded RAG assistant with cited curated-lake evidence
- Exposes one read-only replenishment recommendation through MCP
- Captures an auditable action trace without collecting hidden chain-of-thought
- Exports filtered inventory to CSV
- Documents source lineage and metric definitions in the product

## Data

- **Real public data:** Federal Reserve Board industrial production index for iron and steel products, FRED series `IPG3311A2N`
- **Synthetic data:** 30 refractory products, 90 product-warehouse inventory lines, and 4,320 monthly transaction rows

No real customer information or confidential company data is included.

## Run locally

```bash
npm ci
npm run fetch:fred
npm run generate
npm run validate:data
npm test
npm start
```

Open `http://localhost:8080`.

Open the **AI assistant** page to run the Module 8 RAG and agent workflow. Without
cloud credentials, the application uses a clearly labeled local grounded mode.
With Vertex AI configured in `.env.example`, Gemini generates the final response
from the same retrieved evidence and safety controls.

Use this acceptance question:

> Should we replenish MCB-001 at Chicago, and why?

The verified local preview displays the suggested order quantity `102`, cited
curated evidence, the read-only tool result, an auditable action trace, a maximum
financial authority of `$0`, and the required human approval. Local mode is a UI
preview; it is not a substitute for the managed three-layer Agent Engine trace.

## Agent and MCP demonstrations

```bash
npm run agent:demo
npm run mcp:demo
```

The MCP server can also be started directly with `npm run mcp:server`. It exposes
one tool, `recommend_replenishment`, plus a read-only Agent Card resource. See
[`docs/module-8-agentic-ai.md`](docs/module-8-agentic-ai.md) for architecture,
configuration, trace policy, assignment mapping, and screenshot guidance.

The exact five-slide evidence plan is in
[`docs/module-8-screenshot-checklist.md`](docs/module-8-screenshot-checklist.md).

The local version uses the generated serving snapshot and a clearly labeled seasonal baseline forecast. When `GCP_PROJECT_ID` and `BQ_DATASET` are configured, the server reads the BigQuery serving views and BigQuery ML output.

## Project structure

```text
data/
  raw/                 Unchanged FRED download
  curated/             Typed CSV inputs for BigQuery
  serving/             Local application snapshot
docs/                  Architecture, data dictionary, runbook, evidence checklist
agent/                 RAG, tool, Agent Card, trace store, and MCP server
public/                Inventory application
schemas/               Explicit BigQuery table schemas
scripts/               Data generation, validation, and GCP deployment
sql/                   Business, quality, and BigQuery ML SQL
tests/                 Data and metric checks
```

## Managed Google Cloud architecture

The school-account project `refractory-inventory-platform` contains the three
required grounding layers:

- **Structured:** BigQuery dataset `kaixiang_inventory` and the fixed serving
  view `serving_inventory`.
- **Unstructured:** a GCS operational exception object under
  `gs://ruhangliu-lake-curated/agent-inputs/`.
- **Vector:** a Vertex AI RAG corpus containing the approved replenishment and
  purchase-authorization policies.

The existing Vertex AI Agent Engine is deployed at
`projects/1052614770067/locations/us-west1/reasoningEngines/7636161031462453248`.
Agent Registry supplies the managed GCS and BigQuery connections and registers
the custom read-only inventory MCP service.

### Private inventory MCP boundary

`refractory-inventory-mcp` runs on Cloud Run in `us-central1` and exposes only
`get_inventory_snapshot`. It accepts a product code and allowlisted warehouse,
queries a fixed BigQuery view with parameterized SQL, and cannot modify data or
execute procurement. Cloud Run authentication remains enabled: anonymous
requests return HTTP 403, and the Agent Engine service identity is the approved
invoker. The runtime mints a short-lived OIDC ID token for the canonical Cloud
Run audience; no service-account key or long-lived bearer token is stored in the
repository.

Final managed-runtime validation exited successfully (`TEST_EXIT:0`) and
returned quantity `102`, exception `EXC-2026-0814-001`, policy `RIC-POL-001`,
and the mandatory human-approval boundary. Detailed evidence is documented in
[`docs/module-8-agentic-ai.md`](docs/module-8-agentic-ai.md).

Read [`docs/gcp-runbook.md`](docs/gcp-runbook.md) before making additional cloud
changes. Do not broaden IAM roles, allow unauthenticated MCP access, or create a
second Agent Engine merely for testing.

## Metric definitions

- **Available stock:** current quantity minus reserved quantity
- **Inventory value:** current quantity multiplied by unit price
- **Action required:** available stock is below safety stock
- **Suggested order:** 150% of safety stock minus available and in-transit quantities, floored at zero

The external forecast is a planning signal, not a product-level sales commitment. Procurement remains a human decision.
