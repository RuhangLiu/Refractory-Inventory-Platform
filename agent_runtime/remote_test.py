import asyncio
import os
from typing import Any

import vertexai


PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "refractory-inventory-platform")
DEPLOY_REGION = os.getenv("AGENT_DEPLOY_REGION", "us-west1")
AGENT_ENGINE = os.environ["AGENT_ENGINE_RESOURCE"]


def _event_to_data(value: Any) -> Any:
    if isinstance(value, (dict, list, str, int, float, bool)) or value is None:
        return value
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="python")
    if hasattr(value, "to_dict"):
        return value.to_dict()
    return value


def _collect_text(value: Any) -> list[str]:
    """Recursively collect textual payloads from SDK, ADK, or SSE wrappers."""
    value = _event_to_data(value)
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [text for item in value for text in _collect_text(item)]
    if not isinstance(value, dict):
        return []

    texts: list[str] = []
    for key, item in value.items():
        if key in {"text", "output_text", "final_output", "response"} and isinstance(
            item, str
        ):
            texts.append(item)
        elif key in {
            "content",
            "parts",
            "data",
            "event",
            "result",
            "response",
            "message",
            "artifacts",
            "updates",
        }:
            texts.extend(_collect_text(item))
    return texts


async def main() -> None:
    client = vertexai.Client(project=PROJECT_ID, location=DEPLOY_REGION)
    remote_agent = client.agent_engines.get(name=AGENT_ENGINE)
    prompt = (
        "Should we replenish MCB-001 at Chicago, and why? "
        "Use get_inventory_snapshot with product_code = 'MCB-001' and "
        "warehouse = 'Chicago'. Also use "
        "the Cloud Storage exception log and the policy corpus."
    )

    final_text = None
    event_summaries = []
    async for event in remote_agent.async_stream_query(
        user_id="module8-remote-acceptance",
        message=prompt,
    ):
        event_data = _event_to_data(event)
        event_summaries.append(
            {
                "type": type(event).__name__,
                "keys": list(event_data) if isinstance(event_data, dict) else None,
                "preview": repr(event_data)[:2000],
            }
        )
        texts = _collect_text(event_data)
        if texts:
            final_text = texts[-1]

    if not final_text:
        raise RuntimeError(
            "The deployed agent returned no recognized final text. "
            f"Event summaries: {event_summaries}"
        )
    lower_text = final_text.lower()
    if "permission_denied" in lower_text or "403" in lower_text:
        raise RuntimeError(f"The deployed agent returned an access error: {final_text}")

    required_evidence = {
        "calculated order quantity": "102" in final_text,
        "storage exception": "exc-2026-0814-001" in lower_text,
        "retrieved policy": "ric-pol-001" in lower_text
        or "ric-pol-002" in lower_text,
        "human approval control": "approval" in lower_text,
    }
    missing = [name for name, present in required_evidence.items() if not present]
    if missing:
        raise RuntimeError(
            "The deployed agent response is incomplete; missing "
            f"{', '.join(missing)}. Response: {final_text}"
        )
    print(final_text)


if __name__ == "__main__":
    asyncio.run(main())
