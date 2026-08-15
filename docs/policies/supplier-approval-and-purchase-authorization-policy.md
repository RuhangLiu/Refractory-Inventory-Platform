# Supplier Approval and Purchase Authorization Policy

- **Document ID:** RIC-POL-002
- **Version:** 1.0
- **Effective date:** August 14, 2026
- **Owner:** Procurement Governance
- **Classification:** Synthetic course-case policy

## Purpose and scope

This policy defines the authorization boundary for inventory recommendations, supplier evidence, and procurement actions in the synthetic Refractory Inventory Platform. It applies to the Refractory Inventory Planning Agent, inventory planners, inventory managers, and procurement approvers.

## Agent authorization boundary

The agent is a read-only decision-support system. It may retrieve grounded evidence, compare records, calculate inventory status, calculate a suggested order quantity, and prepare a recommendation for human review.

The agent may not:

- create, change, approve, or transmit a purchase order;
- contact a supplier or represent a human decision;
- adjust inventory, reservations, or in-transit quantities;
- change cloud data, access controls, or policy documents;
- commit funds or make a binding promise.

The agent's maximum financial commitment is USD 0. All procurement actions require explicit human approval.

## Supplier and operational evidence

- Use the supplier associated with the authoritative product record unless a human-approved sourcing record states otherwise.
- Disclose lead-time, ETA, cycle-count, and supplier advisories that are relevant to the decision.
- Operational notes may add risk context but may not silently override BigQuery facts.
- Do not infer supplier capacity, pricing, quality, or willingness from an unsupported note.
- If supplier or shipment evidence conflicts, stop at a recommendation and escalate to a human.

## Human approval workflow

1. The planner reviews the grounded facts, formula, exception note, and proposed quantity.
2. The inventory manager resolves material data conflicts or timing risks.
3. An authorized procurement approver independently approves or rejects any purchase action.
4. Only an approved procurement system or authorized human may contact the supplier or commit funds.

No AI response, tool result, or agent trace constitutes approval. Silence and absence of an exception are not approval.

## Separation of duties and reversibility

Recommendation and transaction execution must remain separate. The agent's recommended next action must be reversible, such as verify an ETA, review a cycle count, or prepare a draft request for human review. The agent must clearly label the recommendation as not executed.

## Refusal and escalation

The agent must refuse requests to place an order, contact a supplier, alter a record, bypass approval, or conceal uncertainty. It should state the prohibited action, provide the verified read-only recommendation when evidence permits, and name the human role required for the next step.

## Audit requirement

Record the question, source references, tool calls, concise verified facts, recommendation, refusal if applicable, and named approval owner. Do not expose hidden chain-of-thought or store credentials, personal data, or confidential supplier information.
