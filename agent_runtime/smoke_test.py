import asyncio
import json

from vertexai import agent_engines

from refractory_inventory_agent.agent import (
    INVENTORY_READ_ONLY_TOOLS,
    STORAGE_READ_ONLY_TOOLS,
    inventory_toolset,
    root_agent,
    storage_toolset,
)


async def main() -> None:
    storage_tools = await storage_toolset.get_tools()
    inventory_tools = await inventory_toolset.get_tools()

    storage_names = sorted(tool.name for tool in storage_tools)
    inventory_names = sorted(tool.name for tool in inventory_tools)

    assert set(storage_names) == set(STORAGE_READ_ONLY_TOOLS), storage_names
    assert set(inventory_names) == set(INVENTORY_READ_ONLY_TOOLS), inventory_names
    assert not ({"write_text", "delete_object", "create_bucket"} & set(storage_names))

    print(
        json.dumps(
            {
                "inventory_mcp_tools": inventory_names,
                "bigquery_source_view": (
                    "refractory-inventory-platform.kaixiang_inventory."
                    "serving_inventory"
                ),
                "storage_tools": storage_names,
                "write_tools_exposed": False,
            },
            indent=2,
        )
    )

    app = agent_engines.AdkApp(agent=root_agent)
    prompt = (
        "Should we replenish MCB-001 at Chicago, and why? "
        "Use BigQuery, the Cloud Storage exception log, and the policy corpus."
    )
    final_text = None
    async for event in app.async_stream_query(
        user_id="inventory-smoke-test",
        message=prompt,
    ):
        event_data = event if isinstance(event, dict) else event.model_dump()
        content = event_data.get("content") or {}
        for part in content.get("parts") or []:
            if isinstance(part, dict) and part.get("text"):
                final_text = part["text"]

    if not final_text:
        raise RuntimeError("The acceptance prompt returned no final text.")
    print("\nACCEPTANCE_RESPONSE\n")
    print(final_text)


if __name__ == "__main__":
    asyncio.run(main())
