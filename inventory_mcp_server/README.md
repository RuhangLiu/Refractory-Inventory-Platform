# Authenticated Inventory MCP Server

This service implements the remote MCP evolution step: the
read-only inventory lookup is exposed as a remote MCP tool that an independent
client can list and call.

## Security boundary

- Exactly one tool: `get_inventory_snapshot`.
- Fixed source: `refractory-inventory-platform.kaixiang_inventory.serving_inventory`.
- Parameterized `product_code` and `warehouse`; arbitrary SQL is impossible.
- BigQuery billing is capped at 100 MB per request.
- Cloud Run authentication remains enabled.
- The runtime service account receives BigQuery Job User on the project and
  BigQuery Data Viewer only on the `kaixiang_inventory` dataset.
- The tool cannot create purchase orders, modify inventory, contact suppliers,
  or commit funds.

## Local verification

```bash
npm install
npm test
```

## Authenticated remote verification

```bash
export MCP_SERVER_URL="https://SERVICE_URL/mcp"
export MCP_ID_TOKEN="$(gcloud auth print-identity-token --audiences=https://SERVICE_URL)"
npm run remote:test
```

The expected tool list contains only `get_inventory_snapshot`. The acceptance
call uses `MCB-001` and `Chicago` and must return the fully qualified BigQuery
view plus the current synthetic inventory row.

## Deployed course environment

- Service: `refractory-inventory-mcp`
- Region: `us-central1`
- Revision: `refractory-inventory-mcp-00001-qdx`
- Canonical URL: `https://refractory-inventory-mcp-77qfs3f3uq-uc.a.run.app`
- MCP endpoint: `https://refractory-inventory-mcp-77qfs3f3uq-uc.a.run.app/mcp`
- Agent Registry service: `projects/refractory-inventory-platform/locations/global/services/refractory-inventory-mcp`

Validation confirmed that unauthenticated requests receive HTTP 403, while an
authorized identity token returns the health response and permits discovery of
exactly one tool. The Agent Engine service identity is the only Cloud Run
invoker granted for the managed integration.
