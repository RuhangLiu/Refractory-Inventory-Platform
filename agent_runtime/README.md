# Refractory Inventory ADK Agent

This is the code-first version exported from Agent Studio and extended with:

- An authenticated custom MCP tool fixed to the read-only BigQuery
  `serving_inventory` view.
- Agent Registry Cloud Storage MCP tools, allowlisted to object listing, metadata, and reading.
- Vertex AI RAG Engine retrieval over the approved policy corpus.
- A zero-dollar authority boundary and mandatory human approval for procurement.

The hosted runtime is deployed as:

`projects/1052614770067/locations/us-west1/reasoningEngines/7636161031462453248`

The inventory tool is registered in Agent Registry as
`projects/refractory-inventory-platform/locations/global/services/refractory-inventory-mcp`.
Its Cloud Run service is private, returns HTTP 403 to unauthenticated callers,
and grants `roles/run.invoker` only to the existing Agent Engine service
identity. The server exposes exactly one allowlisted, parameterized,
non-destructive tool: `get_inventory_snapshot`.

The custom Agent Registry toolset uses a runtime `header_provider` to mint a
short-lived OIDC ID token with the Cloud Run service URL as its audience. The
token comes from the Agent Engine runtime identity; no credential, key, or
long-lived token is stored in source code.

## Cloud Shell test

```bash
cd agent_runtime
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
export GOOGLE_CLOUD_PROJECT=refractory-inventory-platform
export GOOGLE_GENAI_USE_VERTEXAI=TRUE
python smoke_test.py
```

## Deploy

Run `python deploy.py` only after `smoke_test.py` lists exactly the allowlisted
tools and completes the three-layer acceptance prompt.

The deployment creates or updates the project Vertex AI Reasoning Engine and uses its service agent plus a
dedicated `us-west1` staging bucket. It does not create an autonomous purchase
authority: every procurement action remains a human approval step.

After deployment, set `AGENT_ENGINE_RESOURCE` to the returned resource name and
run `python remote_test.py` to repeat the three-layer acceptance prompt against
the managed runtime.

## Verified managed-runtime result

The in-place Agent Engine update completed successfully and preserved the
existing resource name. `remote_test.py` exited with status `0` and verified
all acceptance facts in one managed response:

- `get_inventory_snapshot` returned the BigQuery record for `MCB-001` at
  `Chicago`.
- The deterministic suggested order quantity was `102`.
- Cloud Storage evidence included exception `EXC-2026-0814-001`.
- RAG retrieval cited policy `RIC-POL-001`.
- The response required human approval and kept autonomous financial authority
  at `$0`.
- No HTTP 403 or `PERMISSION_DENIED` error occurred.
