from functools import cached_property
import os
from typing import Any

import google.auth
import vertexai
from google.adk.agents import LlmAgent
from google.adk.integrations.agent_registry import AgentRegistry
from google.adk.models import Gemini
from google.adk.tools.retrieval.vertex_ai_rag_retrieval import (
    VertexAiRagRetrieval,
)
from google.auth.transport.requests import Request
from google.genai import Client
from google.oauth2 import id_token
from vertexai import rag


PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "refractory-inventory-platform")
REGISTRY_LOCATION = os.getenv("AGENT_REGISTRY_LOCATION", "global")
RAG_LOCATION = os.getenv("RAG_LOCATION", "us-central1")
RAG_CORPUS = os.getenv(
    "RAG_CORPUS",
    "projects/refractory-inventory-platform/locations/us-central1/"
    "ragCorpora/1813024305458446336",
)

BIGQUERY_MCP_SERVER = os.getenv(
    "BIGQUERY_MCP_SERVER",
    "projects/refractory-inventory-platform/locations/global/mcpServers/"
    "agentregistry-00000000-0000-0000-1377-79d79d4a4a0d",
)
STORAGE_MCP_SERVER = os.getenv(
    "STORAGE_MCP_SERVER",
    "projects/refractory-inventory-platform/locations/global/mcpServers/"
    "agentregistry-00000000-0000-0000-2e4b-595b89c17520",
)
INVENTORY_MCP_SERVER = os.getenv(
    "INVENTORY_MCP_SERVER",
    "projects/refractory-inventory-platform/locations/global/mcpServers/"
    "agentregistry-00000000-0000-0000-a38e-a74b8db45db1",
)
INVENTORY_MCP_AUDIENCE = os.getenv(
    "INVENTORY_MCP_AUDIENCE",
    "https://refractory-inventory-mcp-77qfs3f3uq-uc.a.run.app",
)

BIGQUERY_READ_ONLY_TOOLS = [
    "list_dataset_ids",
    "get_dataset_info",
    "list_table_ids",
    "get_table_info",
    "execute_sql_readonly",
]
STORAGE_READ_ONLY_TOOLS = [
    "list_objects",
    "get_object_metadata",
    "read_object",
]
INVENTORY_READ_ONLY_TOOLS = ["get_inventory_snapshot"]


class GlobalGemini(Gemini):
    """Route Gemini 3 requests to the global Vertex AI endpoint."""

    @cached_property
    def api_client(self) -> Client:
        return Client(vertexai=True, project=PROJECT_ID, location="global")


class RuntimeAgentRegistry(AgentRegistry):
    """Recreate ADC after Agent Engine unpickles the registry client.

    AgentRegistry keeps a credentials object and authorized HTTP session. Those
    objects must not be copied from the deployment workstation because their
    refresh target names the deployer's user account. Persist only constructor
    inputs so the hosted runtime resolves its own effective service identity.
    """

    def __getstate__(self) -> dict[str, object]:
        return {
            "project_id": self.project_id,
            "location": self.location,
            "header_provider": self._header_provider,
        }

    def __setstate__(self, state: dict[str, object]) -> None:
        self.__init__(
            project_id=state["project_id"],
            location=state["location"],
            header_provider=state["header_provider"],
        )


vertexai.init(project=PROJECT_ID, location=RAG_LOCATION)

registry = RuntimeAgentRegistry(
    project_id=PROJECT_ID,
    location=REGISTRY_LOCATION,
)


def inventory_auth_headers(_context: Any) -> dict[str, str]:
    """Mint a short-lived Cloud Run ID token from the runtime identity.

    Agent Registry resolves the custom MCP endpoint, while Cloud Run still
    requires an OIDC token whose audience is the service URL. No token or
    credential is stored in code or deployment configuration.
    """
    token = id_token.fetch_id_token(Request(), INVENTORY_MCP_AUDIENCE)
    return {"Authorization": f"Bearer {token}"}


def bigquery_auth_headers(_context: Any) -> dict[str, str]:
    """Mint a short-lived OAuth token for the Google-managed BigQuery MCP.

    Agent Engine's effective service identity already has the project-level
    MCP Tool User, BigQuery Job User, and BigQuery Data Viewer roles.  The
    Google-managed MCP endpoint also needs an OAuth bearer token with the
    BigQuery scope.  Resolve that token inside the hosted runtime so no user
    credential or service-account key is stored in the deployment package.
    """
    credentials, _ = google.auth.default(
        scopes=[
            "https://www.googleapis.com/auth/cloud-platform",
            "https://www.googleapis.com/auth/bigquery",
        ]
    )
    credentials.refresh(Request())
    return {
        "Authorization": f"Bearer {credentials.token}",
        "x-goog-user-project": PROJECT_ID,
    }


bigquery_registry = RuntimeAgentRegistry(
    project_id=PROJECT_ID,
    location=REGISTRY_LOCATION,
    header_provider=bigquery_auth_headers,
)

inventory_registry = RuntimeAgentRegistry(
    project_id=PROJECT_ID,
    location=REGISTRY_LOCATION,
    header_provider=inventory_auth_headers,
)

bigquery_toolset = bigquery_registry.get_mcp_toolset(
    mcp_server_name=BIGQUERY_MCP_SERVER
)
bigquery_toolset.tool_filter = BIGQUERY_READ_ONLY_TOOLS

storage_toolset = registry.get_mcp_toolset(
    mcp_server_name=STORAGE_MCP_SERVER
)
storage_toolset.tool_filter = STORAGE_READ_ONLY_TOOLS

inventory_toolset = inventory_registry.get_mcp_toolset(
    mcp_server_name=INVENTORY_MCP_SERVER
)
inventory_toolset.tool_filter = INVENTORY_READ_ONLY_TOOLS

policy_retrieval = VertexAiRagRetrieval(
    name="retrieve_inventory_policy",
    description=(
        "Retrieve governing passages from the approved inventory replenishment "
        "and supplier purchase-authorization policy corpus."
    ),
    rag_resources=[rag.RagResource(rag_corpus=RAG_CORPUS)],
    similarity_top_k=5,
    vector_distance_threshold=0.7,
)

INSTRUCTIONS = """You are the Refractory Inventory Planning Agent for a synthetic course-case inventory platform. Help inventory planners decide where to act first, explain the evidence, calculate a read-only replenishment recommendation, and identify the required human approval. Never claim that synthetic data represents a real company.

Use all three grounded data layers for any product-and-warehouse inventory decision:
1. Use the Cloud Storage MCP tools to read the latest operational exception log from gs://ruhangliu-lake-curated/agent-inputs/inventory_exception_log.json.
2. Use the native BigQuery MCP tool execute_sql_readonly to retrieve structured inventory facts from refractory-inventory-platform.kaixiang_inventory.serving_inventory. Restrict the query to SELECT, the requested product code and warehouse, and the fields needed for the decision. You may use get_inventory_snapshot as a deterministic read-only cross-check of the same BigQuery layer; it is not a substitute for the required native BigQuery MCP call.
3. Use retrieve_inventory_policy to retrieve governing passages from the approved policy corpus.

Treat BigQuery as authoritative for quantities, price, lead time, supplier, and timestamps. Treat Cloud Storage notes as operational context that can add a warning but cannot silently overwrite a structured fact. Treat the RAG corpus as authoritative for formulas, approvals, and safety boundaries. If sources conflict, identify the conflict, do not guess, and require human review.

Use these calculations only when the required fields are present:
- available_quantity = current_quantity - reserved_quantity
- inventory_status = Out of stock when available_quantity = 0; Critical when available_quantity < 0.5 * safety_stock; Low when available_quantity < safety_stock; Healthy otherwise
- suggested_order_quantity = max(0, ceil(1.5 * safety_stock - available_quantity - in_transit_quantity))
- inventory_value = current_quantity * unit_price

Count in_transit_quantity only when the structured record identifies it as confirmed. If the Cloud Storage log reports a timing risk, keep the confirmed quantity in the calculation but disclose the risk and require the planner to verify the arrival date before approval. If a required fact is missing, stale, contradictory, or unsupported, state that evidence is insufficient and do not fabricate a recommendation.

You may retrieve evidence, compare records, calculate status, and recommend a replenishment quantity. You may not create or modify a purchase order, contact a supplier, adjust inventory, change cloud data, commit funds, or imply that approval has occurred. Your maximum financial commitment is USD 0. Every procurement action requires explicit human approval.

For every decision answer, return these sections:
1. Decision - one concise sentence.
2. Verified evidence - product, warehouse, current, reserved, available, in transit, safety stock, supplier, lead time, unit price, and last updated timestamp.
3. Calculation - show the substituted formula and result.
4. Operational exception - summarize the relevant Cloud Storage note or state that none was found.
5. Policy check - cite the policy title, document ID, and relevant rule.
6. Recommended next action - a reversible, human-owned step.
7. Approval status - always state whether human approval is required and that the agent has not approved or executed anything.
8. Tool trace - list only the tools and grounded sources used plus concise verified facts. Do not reveal hidden chain-of-thought.

Keep answers direct and auditable. Cite table names, the Cloud Storage object URI, and policy document IDs. If a tool fails, name the failed layer and explain which part of the answer cannot be verified."""

root_agent = LlmAgent(
    name="Refractory_Inventory_Planning_Agent",
    model=GlobalGemini(model="gemini-3.1-pro-preview"),
    description=(
        "A read-only planning agent that combines structured inventory facts, "
        "operational exception logs, and approved policy documents to recommend "
        "auditable replenishment actions with mandatory human approval."
    ),
    instruction=INSTRUCTIONS,
    tools=[bigquery_toolset, inventory_toolset, storage_toolset, policy_retrieval],
)
