import os

import vertexai
from vertexai import agent_engines

from refractory_inventory_agent.agent import root_agent


PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "refractory-inventory-platform")
DEPLOY_REGION = os.getenv("AGENT_DEPLOY_REGION", "us-west1")
STAGING_BUCKET = os.getenv(
    "AGENT_STAGING_BUCKET",
    "gs://refractory-inventory-agent-staging-1052614770067",
)
AGENT_ENGINE_RESOURCE = os.getenv("AGENT_ENGINE_RESOURCE")


def main() -> None:
    client = vertexai.Client(project=PROJECT_ID, location=DEPLOY_REGION)
    app = agent_engines.AdkApp(agent=root_agent)

    config = {
        "display_name": "Refractory Inventory Planning Agent",
        "requirements": [
            "google-adk[a2a,agent-identity,mcp]>=1.29.0,<3",
            "google-cloud-aiplatform[agent_engines,adk]>=1.112.0",
            "google-auth>=2.40.0,<3",
            "cloudpickle>=3.0.0,<4",
            "pydantic>=2.10.0,<3",
        ],
        "extra_packages": ["./refractory_inventory_agent"],
        "staging_bucket": STAGING_BUCKET,
    }
    if AGENT_ENGINE_RESOURCE:
        remote_agent = client.agent_engines.update(
            name=AGENT_ENGINE_RESOURCE,
            agent=app,
            config=config,
        )
    else:
        remote_agent = client.agent_engines.create(agent=app, config=config)
    print(remote_agent.api_resource.name)


if __name__ == "__main__":
    main()
