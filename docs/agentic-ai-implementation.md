# RAG, Agent, and MCP Implementation

## Outcome

The Refractory Inventory Planning Agent extends the existing curated lake and inventory application in three required stages:

1. **Grounded RAG assistant:** retrieves evidence from curated product and inventory CSV files plus the platform documentation, then returns an answer with `[S1]`, `[S2]`, and similar citations.
2. **Agent with one tool:** calls `recommend_replenishment` only when the question contains a product code, a supported warehouse, and inventory-decision intent.
3. **MCP server:** exposes the read-only inventory lookup both as a local stdio demonstration and as a private remote MCP service on Cloud Run. Agent Registry connects the deployed Agent Engine to the remote service with short-lived OIDC authentication.

The design deliberately stops at a recommendation. It cannot create purchase orders, contact suppliers, or commit funds.

## Architecture

```text
Planner question
      |
      v
Lexical retrieval over curated lake data + project documentation
      |
      +---- cited evidence -----------------------------+
      |                                                 |
      v                                                 v
Tool router -- product + warehouse + intent? --> recommend_replenishment
      |                                                 |
      +---------------- evidence + tool result ----------+
                              |
                              v
            Gemini on Vertex AI or local grounded fallback
                              |
                              v
             Answer + citations + auditable action trace

Independent MCP client --> stdio MCP server --> recommend_replenishment

Managed Agent Engine --> Agent Registry --> OIDC-authenticated Cloud Run MCP
                                             |
                                             v
                               read-only BigQuery serving view
```

## Knowledge sources

- `data/curated/products.csv`
- `data/curated/inventory.csv`
- `README.md`
- `docs/architecture.md`
- `docs/data-dictionary.md`
- `docs/gcp-runbook.md`

The operational records are synthetic course-case data. The steel-industry series is public FRED data. No personal or confidential company data is used.

## Run locally

```bash
npm ci
npm test
npm start
```

Visit `http://localhost:8080/#assistant` and use this question:

> Should we replenish MCB-001 at Chicago, and why?

This example retrieves the exact curated inventory row, calls the single tool, returns the suggested quantity, and states that human approval is required.

## Vertex AI configuration

The default without credentials is `local-grounded`, which is deterministic and suitable for tests. To use Gemini through Vertex AI, configure Application Default Credentials and these environment variables:

```bash
export GOOGLE_GENAI_USE_VERTEXAI=true
export GOOGLE_CLOUD_PROJECT=refractory-inventory-platform
export GOOGLE_CLOUD_LOCATION=global
export GEMINI_MODEL=gemini-2.5-flash
npm start
```

An API key can be used instead with `GEMINI_API_KEY`. API keys remain server-side and must never be committed or placed in browser JavaScript.

## MCP demonstration

Run an independent client that spawns the stdio server, lists its tools, and calls the replenishment tool:

```bash
npm run mcp:demo
```

Start the server alone for an MCP host or MCP Inspector:

```bash
npm run mcp:server
```

Example host configuration:

```json
{
  "mcpServers": {
    "refractory-inventory": {
      "command": "node",
      "args": ["/absolute/path/to/agent/mcp-server.mjs"]
    }
  }
}
```

The server exposes:

- Tool: `recommend_replenishment`
- Resource: `agent://refractory-inventory/card`

## Managed GCP deployment evidence

The production-style course deployment reuses the existing school-account GCP
project and the existing Agent Engine. It does not create a second autonomous
agent or grant the student account direct access to the private MCP endpoint.

- GCP project: `refractory-inventory-platform` (`1052614770067`)
- Existing Agent Engine: `projects/1052614770067/locations/us-west1/reasoningEngines/7636161031462453248`
- Private Cloud Run service: `refractory-inventory-mcp`
- Deployed revision: `refractory-inventory-mcp-00001-qdx`
- MCP endpoint: `https://refractory-inventory-mcp-77qfs3f3uq-uc.a.run.app/mcp`
- Agent Registry service: `projects/refractory-inventory-platform/locations/global/services/refractory-inventory-mcp`
- Registry MCP resource: `projects/1052614770067/locations/global/mcpServers/agentregistry-00000000-0000-0000-a38e-a74b8db45db1`
- MCP runtime identity: `refractory-inventory-mcp@refractory-inventory-platform.iam.gserviceaccount.com`
- Authorized caller: `service-1052614770067@gcp-sa-aiplatform-re.iam.gserviceaccount.com`

The Cloud Run service rejects unauthenticated requests with HTTP 403. The
Agent Engine runtime mints a short-lived OIDC ID token for the canonical Cloud
Run URL through the Agent Registry toolset `header_provider`; no service-account
key or long-lived bearer token is stored in the repository.

Final managed-runtime acceptance completed successfully (`TEST_EXIT:0`). For
`MCB-001` at `Chicago`, the agent retrieved the BigQuery inventory snapshot,
calculated a suggested order quantity of `102`, cited exception
`EXC-2026-0814-001`, applied policy `RIC-POL-001`, and preserved mandatory human
approval with a maximum autonomous financial commitment of `$0`.

## Auditable trace

Each assistant request records:

1. Input accepted
2. Retrieved source identifiers and relevance scores
3. Tool selection decision
4. Tool arguments and safe result summary, when applicable
5. Generation mode and citation requirement
6. Final safety check

The trace is returned by the API and appended to the ignored local file `tmp/agent-traces.ndjson`. It does **not** collect or expose hidden chain-of-thought. This provides an inspectable decision record without claiming access to private model reasoning.

## What became harder at each step

### Step 1: Prompt to RAG

The main difficulty was grounding. A fluent answer is not enough; retrieval must select the exact product, warehouse, metric definition, or architecture evidence and keep citations attached to the final response.

### Step 2: RAG to agent with a tool

The main difficulty was controlled action selection. The system must distinguish a general knowledge question from a product-level replenishment decision, validate the tool arguments, and preserve a human approval boundary.

### Step 3: Tool to MCP server

The main difficulty was interoperability and identity-aware access. The tool
needed a strict schema, stable structured output, transport-safe logging, a
private Cloud Run deployment, Agent Registry registration, and an OIDC token
whose audience exactly matches the canonical Cloud Run service URL. The final
remote test confirmed that the managed Agent Engine—not an unauthenticated
browser session—can invoke the tool.

## Accountability and Agent Card answer

Accountability is shared, but the builder and platform are responsible for enforceable limits, validation, monitoring, and safe defaults. The user is responsible for approvals made with adequate disclosure, and the counterparty's builder is responsible for misleading claims or unsafe behavior from its own agent.

If only one Agent Card field could be required, it would be **`authorization_scope`**. It must state the allowed and prohibited actions, the maximum financial commitment, and the actions that require human approval. This project's maximum financial commitment is `$0`.

## Recommended screenshots

1. AI assistant page showing a grounded answer and `[S1]` citation.
2. Retrieved Sources panel showing curated file paths and relevance scores.
3. Tool Action panel showing `recommend_replenishment`, suggested quantity, and human approval control.
4. Auditable Trace panel showing retrieval, tool call, tool result, generation, and final steps.
5. Terminal output from `npm run mcp:demo` showing the independent client, listed tool, arguments, and result.
6. Agent Card JSON or `/api/agent/card` showing `authorization_scope` and a zero-dollar limit.
