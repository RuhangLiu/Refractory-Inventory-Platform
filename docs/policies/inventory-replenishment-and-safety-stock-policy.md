# Inventory Replenishment and Safety Stock Policy

- **Document ID:** RIC-POL-001
- **Version:** 1.0
- **Effective date:** August 14, 2026
- **Owner:** Inventory Planning and Controls
- **Classification:** Synthetic course-case policy

## Purpose and scope

This policy defines how the Refractory Inventory Planning Agent and human planners evaluate product-warehouse inventory conditions and calculate a read-only replenishment recommendation. It applies to the synthetic inventory platform only. It does not authorize procurement, supplier contact, inventory adjustment, or financial commitment.

## Authoritative data and evidence precedence

1. BigQuery is authoritative for quantities, supplier, price, lead time, and record timestamps.
2. Cloud Storage operational notes provide exception context and may add a warning, but they do not silently replace a structured fact.
3. Approved RAG policy documents govern formulas, classification, approval, and escalation.
4. A conflict, missing fact, or stale record requires disclosure and human review. The agent must not guess.

## Required calculations

- Available quantity = current quantity - reserved quantity.
- Inventory status is Out of stock when available quantity equals 0.
- Inventory status is Critical when available quantity is below 50 percent of safety stock.
- Inventory status is Low when available quantity is below safety stock.
- Inventory status is Healthy in all other cases.
- Target stock = ceiling of 1.5 multiplied by safety stock.
- Suggested order quantity = maximum of 0 and target stock - available quantity - confirmed in-transit quantity.
- Inventory value = current quantity multiplied by unit price.

Only confirmed in-transit quantity may reduce the suggested order quantity. A GCS timing exception does not automatically remove a confirmed shipment from the calculation; it must be disclosed and verified by a human before procurement approval.

## Decision and escalation rules

- Out of stock, Critical, and Low records are action candidates.
- Healthy records are monitored unless an operational exception introduces a material risk.
- The agent may calculate and explain a recommendation, but it may not execute an order.
- Every recommendation must show the inputs, formula, result, source timestamp, relevant exception, and approval status.
- Missing or contradictory evidence results in an insufficient-evidence outcome rather than a numeric guess.

## Worked example

For MCB-001 at Chicago, the structured record contains current quantity 0, reserved quantity 0, confirmed in-transit quantity 90, and safety stock 128. Available quantity is 0 - 0 = 0, so the status is Out of stock. Target stock is ceiling(1.5 x 128) = 192. Suggested order quantity is max(0, 192 - 0 - 90) = 102 pieces. A later inbound ETA must be disclosed, and a planner must verify the revised arrival date before approving procurement.

## Audit requirement

Record the question, grounded sources, tool calls, retrieved facts, calculation, policy rule, recommendation, and explicit human-approval state. Do not record or claim access to hidden model chain-of-thought.
