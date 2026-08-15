#!/usr/bin/env python3
"""Build the two RAG policy PDFs used by the Agent Studio corpus."""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    KeepTogether,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output" / "pdf"

NAVY = colors.HexColor("#16324F")
TEAL = colors.HexColor("#1F7A8C")
PALE = colors.HexColor("#EAF3F5")
INK = colors.HexColor("#202B33")
MUTED = colors.HexColor("#5D6B75")
LINE = colors.HexColor("#C7D3D9")


POLICIES = [
    {
        "filename": "Inventory_Replenishment_and_Safety_Stock_Policy.pdf",
        "title": "Inventory Replenishment and Safety Stock Policy",
        "id": "RIC-POL-001",
        "owner": "Inventory Planning and Controls",
        "summary": "Governs product-warehouse inventory classification, replenishment calculations, evidence precedence, exception handling, and human review.",
        "sections": [
            (
                "1. Purpose and scope",
                [
                    "This policy defines how the Refractory Inventory Planning Agent and human planners evaluate product-warehouse inventory conditions and calculate a read-only replenishment recommendation. It applies to the synthetic course-case platform only.",
                    "It does not authorize procurement, supplier contact, inventory adjustment, or financial commitment.",
                ],
            ),
            (
                "2. Authoritative data and evidence precedence",
                [
                    "BigQuery is authoritative for quantities, supplier, price, lead time, and record timestamps.",
                    "Cloud Storage operational notes provide exception context and may add a warning, but they do not silently replace a structured fact.",
                    "Approved RAG policy documents govern formulas, classification, approval, and escalation.",
                    "A conflict, missing fact, or stale record requires disclosure and human review. The agent must not guess.",
                ],
            ),
            (
                "3. Required calculations",
                [
                    "Available quantity = current quantity - reserved quantity.",
                    "Status = Out of stock when available quantity = 0; Critical when available quantity < 0.5 x safety stock; Low when available quantity < safety stock; Healthy otherwise.",
                    "Target stock = ceiling(1.5 x safety stock).",
                    "Suggested order quantity = max(0, target stock - available quantity - confirmed in-transit quantity).",
                    "Inventory value = current quantity x unit price.",
                ],
            ),
            (
                "4. Decision and escalation rules",
                [
                    "Only confirmed in-transit quantity may reduce the recommendation. A timing exception must be disclosed and verified before approval.",
                    "Out of stock, Critical, and Low records are action candidates. Healthy records are monitored unless an operational exception introduces material risk.",
                    "Every recommendation must show inputs, formula, result, timestamp, relevant exception, and approval status.",
                    "Missing or contradictory evidence produces an insufficient-evidence outcome rather than a numeric guess.",
                ],
            ),
            (
                "5. Worked example - MCB-001, Chicago",
                [
                    "Current = 0, reserved = 0, confirmed in transit = 90, and safety stock = 128. Available = 0 - 0 = 0, so status is Out of stock.",
                    "Target = ceiling(1.5 x 128) = 192. Suggested order = max(0, 192 - 0 - 90) = 102 pieces.",
                    "A later inbound ETA is disclosed, and a planner must verify the revised arrival date before approving procurement.",
                ],
            ),
            (
                "6. Audit requirement",
                [
                    "Record the question, grounded sources, tool calls, retrieved facts, calculation, policy rule, recommendation, and explicit human-approval state. Do not record or claim access to hidden model chain-of-thought.",
                ],
            ),
        ],
    },
    {
        "filename": "Supplier_Approval_and_Purchase_Authorization_Policy.pdf",
        "title": "Supplier Approval and Purchase Authorization Policy",
        "id": "RIC-POL-002",
        "owner": "Procurement Governance",
        "summary": "Defines the agent's zero-dollar authorization boundary, supplier evidence rules, human approval workflow, separation of duties, and refusal requirements.",
        "sections": [
            (
                "1. Purpose and scope",
                [
                    "This policy defines the authorization boundary for inventory recommendations, supplier evidence, and procurement actions in the synthetic Refractory Inventory Platform.",
                    "It applies to the planning agent, inventory planners, inventory managers, and procurement approvers.",
                ],
            ),
            (
                "2. Agent authorization boundary",
                [
                    "The agent may retrieve evidence, compare records, calculate inventory status and suggested order quantity, and prepare a recommendation for human review.",
                    "The agent may not create, change, approve, or transmit a purchase order; contact a supplier; adjust inventory; change cloud data or policy; or commit funds.",
                    "The agent's maximum financial commitment is USD 0. All procurement actions require explicit human approval.",
                ],
            ),
            (
                "3. Supplier and operational evidence",
                [
                    "Use the supplier associated with the authoritative product record unless a human-approved sourcing record states otherwise.",
                    "Disclose relevant lead-time, ETA, cycle-count, and supplier advisories.",
                    "Operational notes may add risk context but may not silently override BigQuery facts.",
                    "Do not infer supplier capacity, pricing, quality, or willingness from unsupported notes. Conflicting evidence requires human escalation.",
                ],
            ),
            (
                "4. Human approval workflow",
                [
                    "The planner reviews grounded facts, formula, exception note, and proposed quantity.",
                    "The inventory manager resolves material data conflicts or timing risks.",
                    "An authorized procurement approver independently approves or rejects any purchase action.",
                    "Only an approved procurement system or authorized human may contact a supplier or commit funds.",
                    "No AI response, tool result, or agent trace constitutes approval. Silence and absence of an exception are not approval.",
                ],
            ),
            (
                "5. Separation of duties and reversibility",
                [
                    "Recommendation and transaction execution remain separate. The agent's next action must be reversible, such as verifying an ETA, reviewing a cycle count, or preparing a draft request for human review.",
                    "The agent must clearly label every recommendation as not executed.",
                ],
            ),
            (
                "6. Refusal and escalation",
                [
                    "The agent must refuse requests to place an order, contact a supplier, alter a record, bypass approval, or conceal uncertainty.",
                    "It should state the prohibited action, provide a verified read-only recommendation when evidence permits, and name the human role required for the next step.",
                ],
            ),
            (
                "7. Audit requirement",
                [
                    "Record the question, source references, tool calls, concise verified facts, recommendation, refusal if applicable, and named approval owner. Do not expose hidden chain-of-thought or store credentials, personal data, or confidential supplier information.",
                ],
            ),
        ],
    },
]


def styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "PolicyTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=18.5,
            leading=21,
            textColor=NAVY,
            alignment=TA_LEFT,
            spaceAfter=5,
        ),
        "summary": ParagraphStyle(
            "Summary",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=11.5,
            textColor=INK,
            spaceAfter=5,
        ),
        "heading": ParagraphStyle(
            "Heading",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=10.7,
            leading=12.5,
            textColor=NAVY,
            spaceBefore=3.5,
            spaceAfter=2,
            keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.25,
            leading=10.45,
            textColor=INK,
            spaceAfter=2.5,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.25,
            leading=10.45,
            leftIndent=13,
            firstLineIndent=-8,
            bulletIndent=3,
            textColor=INK,
            spaceAfter=1.5,
        ),
        "meta_label": ParagraphStyle(
            "MetaLabel",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=8.5,
            textColor=MUTED,
        ),
        "meta_value": ParagraphStyle(
            "MetaValue",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.25,
            leading=9.5,
            textColor=INK,
        ),
        "tag": ParagraphStyle(
            "Tag",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7.8,
            leading=9,
            textColor=TEAL,
            alignment=TA_CENTER,
        ),
    }


def header_footer(canvas, doc, policy):
    canvas.saveState()
    width, height = letter
    canvas.setFillColor(NAVY)
    canvas.rect(0, height - 0.38 * inch, width, 0.38 * inch, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(0.62 * inch, height - 0.24 * inch, "REFRACTORY INVENTORY PLATFORM")
    canvas.drawRightString(width - 0.62 * inch, height - 0.24 * inch, policy["id"])
    canvas.setStrokeColor(LINE)
    canvas.line(0.62 * inch, 0.48 * inch, width - 0.62 * inch, 0.48 * inch)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.7)
    canvas.drawString(0.62 * inch, 0.28 * inch, "Synthetic course-case policy | No personal or confidential company data")
    canvas.drawRightString(width - 0.62 * inch, 0.28 * inch, f"Page {doc.page}")
    canvas.restoreState()


def build_policy(policy):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / policy["filename"]
    doc = BaseDocTemplate(
        str(output_path),
        pagesize=letter,
        rightMargin=0.65 * inch,
        leftMargin=0.65 * inch,
        topMargin=0.54 * inch,
        bottomMargin=0.56 * inch,
        title=policy["title"],
        author="Ruhang Liu",
        subject="Agent Studio RAG policy corpus",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="policy-frame")
    doc.addPageTemplates(
        [PageTemplate(id="policy", frames=[frame], onPage=lambda c, d: header_footer(c, d, policy))]
    )
    s = styles()
    story = [Spacer(1, 0.04 * inch), Paragraph(policy["title"], s["title"])]
    meta = [
        [Paragraph("DOCUMENT ID", s["meta_label"]), Paragraph(policy["id"], s["meta_value"]), Paragraph("VERSION", s["meta_label"]), Paragraph("1.0", s["meta_value"])],
        [Paragraph("OWNER", s["meta_label"]), Paragraph(policy["owner"], s["meta_value"]), Paragraph("EFFECTIVE", s["meta_label"]), Paragraph("August 14, 2026", s["meta_value"])],
    ]
    meta_table = Table(meta, colWidths=[0.94 * inch, 2.55 * inch, 0.9 * inch, 1.75 * inch])
    meta_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PALE),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 3.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
            ]
        )
    )
    story.extend(
        [
            meta_table,
            Spacer(1, 0.07 * inch),
            Paragraph(policy["summary"], s["summary"]),
            HRFlowable(width="100%", thickness=1.1, color=TEAL, spaceBefore=1, spaceAfter=2),
        ]
    )
    for heading, paragraphs in policy["sections"]:
        block = [Paragraph(heading, s["heading"])]
        for text in paragraphs:
            if len(paragraphs) > 1 and not heading.startswith("1."):
                block.append(Paragraph(f"- {text}", s["bullet"]))
            else:
                block.append(Paragraph(text, s["body"]))
        story.append(KeepTogether(block))
    story.extend(
        [
            Spacer(1, 0.035 * inch),
            Table(
                [[Paragraph("CONTROL", s["tag"]), Paragraph("READ-ONLY RECOMMENDATION", s["tag"]), Paragraph("HUMAN APPROVAL REQUIRED", s["tag"])]],
                colWidths=[0.8 * inch, 2.8 * inch, 2.8 * inch],
                style=TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), PALE),
                        ("BOX", (0, 0), (-1, -1), 0.7, TEAL),
                        ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("TOPPADDING", (0, 0), (-1, -1), 4),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ]
                ),
            ),
        ]
    )
    doc.build(story)
    return output_path


def main():
    for policy in POLICIES:
        print(build_policy(policy))


if __name__ == "__main__":
    main()
