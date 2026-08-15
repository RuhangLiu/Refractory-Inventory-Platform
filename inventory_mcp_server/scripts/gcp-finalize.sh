#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="refractory-inventory-platform"
REGION="us-central1"
SERVICE_NAME="refractory-inventory-mcp"
AGENT_ENGINE_IDENTITY="service-1052614770067@gcp-sa-aiplatform-re.iam.gserviceaccount.com"
REGISTRY_LOCATION="global"

SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --format='value(status.url)')"

if [[ -z "${SERVICE_URL}" ]]; then
  echo "Cloud Run service URL was not returned." >&2
  exit 1
fi

echo "SERVICE_URL=${SERVICE_URL}"

UNAUTH_STATUS="$(curl -sS -o /dev/null -w '%{http_code}' "${SERVICE_URL}/health")"
echo "UNAUTHENTICATED_HEALTH_STATUS=${UNAUTH_STATUS}"
if [[ "${UNAUTH_STATUS}" != "403" ]]; then
  echo "Expected unauthenticated Cloud Run access to return HTTP 403." >&2
  exit 1
fi

gcloud run services add-iam-policy-binding "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --member "serviceAccount:${AGENT_ENGINE_IDENTITY}" \
  --role "roles/run.invoker" \
  --quiet

echo "AGENT_ENGINE_INVOKER_GRANTED=${AGENT_ENGINE_IDENTITY}"

ID_TOKEN="$(gcloud auth print-identity-token)"
AUTH_HEALTH="$(curl -sS \
  -H "Authorization: Bearer ${ID_TOKEN}" \
  "${SERVICE_URL}/health")"
echo "AUTHENTICATED_HEALTH=${AUTH_HEALTH}"

MCP_SERVER_URL="${SERVICE_URL}/mcp" \
MCP_ID_TOKEN="${ID_TOKEN}" \
npm run remote:test

if gcloud agent-registry services describe "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --location "${REGISTRY_LOCATION}" >/dev/null 2>&1; then
  echo "AGENT_REGISTRY_SERVICE_ALREADY_EXISTS=${SERVICE_NAME}"
else
  gcloud agent-registry services create "${SERVICE_NAME}" \
    --project "${PROJECT_ID}" \
    --location "${REGISTRY_LOCATION}" \
    --display-name "Refractory Inventory MCP" \
    --mcp-server-spec-type "tool-spec" \
    --mcp-server-spec-content "toolspec.json" \
    --interfaces "url=${SERVICE_URL}/mcp,protocolBinding=JSONRPC"
  echo "AGENT_REGISTRY_SERVICE_CREATED=${SERVICE_NAME}"
fi

gcloud agent-registry services describe "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --location "${REGISTRY_LOCATION}"
