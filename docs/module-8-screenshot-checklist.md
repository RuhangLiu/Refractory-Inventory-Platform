# Module 8 Five-Slide Evidence Checklist

This checklist follows the assignment's required five-slide structure. Do not
turn every screenshot into a separate slide. Combine the evidence below into
exactly five slides and place a short caption under every image.

## Slide 1 - Title and Architectural Map

**Required content**

- Project title: Refractory Inventory Planning Agent
- Student: Ruhang Liu
- Operational problem: identify inventory shortages and recommend a safe,
  evidence-backed replenishment quantity.
- Three named data layers:
  - BigQuery: `refractory-inventory-platform.kaixiang_inventory.serving_inventory`
  - Cloud Storage: `gs://ruhangliu-lake-curated/agent-inputs/inventory_exception_log.json`
  - RAG Engine: inventory replenishment and purchase-authorization policy PDFs
- Flow diagram: BigQuery + GCS + RAG Engine -> Agent Studio / Agent Engine ->
  planner answer -> human approval.

**Caption**

> Figure 1. The planning agent combines live structured inventory facts,
> operational exception notes, and stable policy knowledge while retaining a
> mandatory human approval boundary.

**Status:** Content is ready; the architecture graphic still needs to be placed
in the final deck.

## Slide 2 - System Configuration and Prompt Design

**Screenshot 2A - Active tools**

Capture the Agent Studio or Agent Engine configuration with all of these visible:

- Gemini 3.1 Pro model
- BigQuery MCP toolset
- GCS MCP toolset
- RAG corpus
- Private `refractory-inventory-mcp`, if the pane has enough room

> Figure 2. Active Agent Studio tools connect the structured BigQuery layer,
> unstructured Cloud Storage layer, and policy RAG corpus through controlled,
> read-only interfaces.

**Screenshot 2B - System instructions**

Show the instructions that require all three evidence layers, use a fixed
replenishment formula, prohibit purchase execution, set the financial limit to
USD 0, and require human approval.

> Figure 3. The system prompt defines source authority, deterministic formulas,
> tool-use boundaries, conflict handling, and mandatory human approval.

**Status:** Prompt text is ready. The final screenshot must prove that the
native BigQuery MCP, GCS MCP, and RAG corpus are visibly active in Agent Studio.

## Slide 3 - Interactive Execution Trace

**Screenshot 3A - Successful answer**

Use the test question:

> Should we replenish MCB-001 at Chicago, and why?

The visible response must include:

- BigQuery inventory facts for `MCB-001` at `Chicago`
- Suggested order quantity `102`
- Cloud Storage exception `EXC-2026-0814-001`
- RAG policy `RIC-POL-001`
- Human approval required and no transaction executed

> Figure 4. The successful evaluation run reconciles structured inventory,
> operational exception, and policy evidence before recommending 102 pieces.

**Screenshot 3B - Sequential tool trace**

Show the tool sequence, not hidden chain-of-thought:

1. Read the GCS exception object.
2. Retrieve the BigQuery inventory snapshot through MCP.
3. Retrieve the governing RAG policy.
4. Calculate the recommendation.
5. Return an approval-gated answer.

> Figure 5. The auditable execution trace records grounded tool calls and
> verified outputs without exposing or claiming private chain-of-thought.

**Status:** Managed remote acceptance passed with `TEST_EXIT:0`; the Cloud Shell
result is evidence-ready. A simulator-pane capture is still preferred because
the assignment explicitly names the Agent Studio simulator.

## Slide 4 - App Deployment Showcase

**Screenshot 4A - Deployed web interface**

Show the AI planning assistant with the answer, retrieved sources, tool action,
Agent Card, and auditable trace visible. The current local preview already shows
the suggested order `102`, `[S1]` citation, USD 0 authority, and human approval.

> Figure 6. The planner-facing application presents a grounded answer, cited
> evidence, a read-only tool result, and the approval boundary in one view.

**Screenshot 4B - Active serverless URL**

Show the Build App deployment result and paste the active URL as selectable text
on the slide. Do not use `localhost` as the submitted application link.

> Figure 7. The serverless application provides an accessible interface for
> planners to review recommendations and evidence without granting autonomous
> purchasing authority.

**Status:** Local UI is visually verified and ready for preview. The assignment
still requires a Build App-generated, accessible serverless URL for submission.

## Slide 5 - Strategic Outcomes and Concepts Learned

No console screenshot is required unless space permits. Use two concise sections:

**MCP open standards**

> MCP decouples tool discovery and invocation from the agent implementation.
> This project could register read-only BigQuery, GCS, and custom inventory tools
> without embedding service-specific API calls in the model prompt.

**Hybrid grounding**

> RAG embeddings provide stable policy context, while MCP retrieves volatile
> inventory and exception facts at run time. The agent uses policy to govern the
> decision and live data to calculate the current recommendation.

Add the measured outcome: the managed Agent Engine successfully returned the
quantity `102`, cited the exception and policy, and preserved human approval.

## Final capture checks

- [ ] Exactly five slides.
- [ ] Every image has a numbered caption.
- [ ] Slide 2 visibly proves the three required connected data layers.
- [ ] Slide 3 proves sequential GCS, BigQuery, and RAG use without runtime errors.
- [ ] Slide 4 contains an accessible Build App serverless URL, not localhost.
- [ ] The tool result says recommendation only; no purchase order was created.
- [ ] The deck names the data synthetic/public and contains no confidential data.
- [ ] Text remains readable at normal presentation zoom.
