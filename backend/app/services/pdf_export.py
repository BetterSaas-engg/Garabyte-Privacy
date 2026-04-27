"""
PDF export of a published assessment report.

Renders into a board-distributable artifact mirroring the on-site report:
header + tenant name, overall maturity card, dimension breakdown table,
findings split between cross-cutting and per-dimension, regulatory
citations and consulting hours where present, "Reviewed by Garabyte
Consulting · Published <date>" footer.

Pure ReportLab, no system deps. Returns bytes; routes wrap with
StreamingResponse + Content-Disposition headers.
"""

from __future__ import annotations

import io
from datetime import datetime
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


# Match the on-site palette as closely as a static PDF can.
NAVY_TEAL = colors.HexColor("#12283a")          # primary-800
NAVY_ACCENT = colors.HexColor("#2c5a73")        # primary-500
INK_BODY = colors.HexColor("#3a4550")           # ink-700
INK_MUTED = colors.HexColor("#6b7682")          # ink-500
INK_BORDER = colors.HexColor("#e4e7ea")         # ink-100
CREAM_BG = colors.HexColor("#faf8f3")           # cream-100

SEVERITY_COLORS = {
    "critical": colors.HexColor("#b85450"),
    "high":     colors.HexColor("#d48b2f"),
    "moderate": colors.HexColor("#7fa2b5"),
    "low":      colors.HexColor("#6b8e6b"),
}


def _styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    s: dict[str, ParagraphStyle] = {}
    s["title"] = ParagraphStyle(
        "title", parent=base["Title"], fontName="Helvetica-Bold",
        fontSize=22, leading=26, textColor=NAVY_TEAL,
        spaceAfter=4, alignment=TA_LEFT,
    )
    s["eyebrow"] = ParagraphStyle(
        "eyebrow", parent=base["Normal"], fontName="Helvetica-Bold",
        fontSize=8, leading=10, textColor=NAVY_ACCENT,
        spaceAfter=4,
    )
    s["meta"] = ParagraphStyle(
        "meta", parent=base["Normal"], fontName="Helvetica",
        fontSize=9, leading=12, textColor=INK_MUTED, spaceAfter=18,
    )
    s["h2"] = ParagraphStyle(
        "h2", parent=base["Heading2"], fontName="Helvetica-Bold",
        fontSize=14, leading=18, textColor=NAVY_TEAL,
        spaceBefore=14, spaceAfter=8,
    )
    s["h3"] = ParagraphStyle(
        "h3", parent=base["Heading3"], fontName="Helvetica-Bold",
        fontSize=11, leading=14, textColor=NAVY_TEAL,
        spaceBefore=10, spaceAfter=4,
    )
    s["body"] = ParagraphStyle(
        "body", parent=base["BodyText"], fontName="Helvetica",
        fontSize=10, leading=14, textColor=INK_BODY,
        spaceAfter=6,
    )
    s["muted"] = ParagraphStyle(
        "muted", parent=base["BodyText"], fontName="Helvetica",
        fontSize=9, leading=12, textColor=INK_MUTED,
        spaceAfter=4,
    )
    s["finding_dim"] = ParagraphStyle(
        "finding_dim", parent=base["Normal"], fontName="Helvetica-Bold",
        fontSize=8, leading=10, textColor=INK_MUTED, spaceAfter=2,
    )
    s["finding_title"] = ParagraphStyle(
        "finding_title", parent=base["Normal"], fontName="Helvetica-Bold",
        fontSize=11, leading=14, textColor=NAVY_TEAL, spaceAfter=4,
    )
    s["regulatory"] = ParagraphStyle(
        "regulatory", parent=base["BodyText"], fontName="Helvetica-Oblique",
        fontSize=8.5, leading=11, textColor=INK_MUTED,
        spaceAfter=4, leftIndent=8,
    )
    return s


def _esc(text: str | None) -> str:
    """ReportLab Paragraph parses a tiny HTML subset — escape the basics."""
    if text is None:
        return ""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _severity_pill(severity: str) -> str:
    """Inline-html severity badge that ReportLab Paragraph honors."""
    color = SEVERITY_COLORS.get(severity, SEVERITY_COLORS["moderate"])
    return (
        f'<font name="Helvetica-Bold" size="8" color="{color.hexval()}">'
        f'{severity.upper()}</font>'
    )


def render_assessment_pdf(
    *,
    tenant_name: str,
    tenant_jurisdiction: str | None,
    assessment_label: str | None,
    overall_score: float | None,
    overall_maturity: str | None,
    dimension_scores: list[dict[str, Any]],
    findings: list[dict[str, Any]],
    cover_note: str | None,
    published_at: datetime | None,
    rules_version: str | None,
) -> bytes:
    """
    Render a published assessment to PDF bytes. Caller is responsible for
    ensuring the data passed in is the customer-facing post-annotation view
    (no dismissed findings, etc.) — this function trusts its input.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=LETTER,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        title=f"Privacy Health Check — {tenant_name}",
        author="Garabyte Privacy",
    )
    s = _styles()
    flow: list[Any] = []

    # Header
    flow.append(Paragraph("PRIVACY HEALTH CHECK REPORT", s["eyebrow"]))
    flow.append(Paragraph(_esc(tenant_name), s["title"]))
    meta_parts: list[str] = []
    if tenant_jurisdiction:
        meta_parts.append(_esc(tenant_jurisdiction))
    if assessment_label:
        meta_parts.append(_esc(assessment_label))
    if published_at:
        meta_parts.append(f"Published {published_at.strftime('%B %d, %Y')}")
    meta_parts.append("Reviewed by Garabyte Consulting")
    flow.append(Paragraph(" · ".join(meta_parts), s["meta"]))

    # Cover note
    if cover_note:
        flow.append(Paragraph("CONSULTANT NOTE", s["eyebrow"]))
        flow.append(Paragraph(_esc(cover_note), s["body"]))
        flow.append(Spacer(1, 8))

    # Overall maturity
    flow.append(Paragraph("Overall maturity", s["h2"]))
    if overall_score is not None:
        score_pct = round(overall_score / 4.0 * 100)
        score_line = (
            f'<font size="22" color="{NAVY_TEAL.hexval()}"><b>{overall_score:.2f}</b></font>'
            f' <font size="10" color="{INK_MUTED.hexval()}">/ 4.00</font>'
        )
        if overall_maturity:
            score_line += (
                f'<font size="10" color="{INK_MUTED.hexval()}">'
                f' &nbsp;·&nbsp; {_esc(overall_maturity)} ({score_pct}/100 normalized)</font>'
            )
        flow.append(Paragraph(score_line, s["body"]))
    else:
        flow.append(Paragraph("Score not available.", s["muted"]))

    # Dimension breakdown table
    flow.append(Paragraph("Dimension breakdown", s["h2"]))
    table_data: list[list[Any]] = [["", "Dimension", "Score", "Maturity"]]
    for d in dimension_scores:
        table_data.append([
            d.get("dimension_id", ""),
            _esc(d.get("dimension_name", "")),
            f'{d.get("score", 0):.2f}' if d.get("score") is not None else "—",
            _esc(d.get("maturity_label", "")),
        ])
    dim_table = Table(
        table_data,
        colWidths=[0.4 * inch, 3.6 * inch, 0.7 * inch, 1.6 * inch],
    )
    dim_table.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 8),
        ("TEXTCOLOR", (0, 0), (-1, 0), INK_MUTED),
        ("BACKGROUND", (0, 0), (-1, 0), CREAM_BG),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, INK_BORDER),
        ("LINEBELOW", (0, 1), (-1, -1), 0.25, INK_BORDER),
        ("FONT", (0, 1), (-1, -1), "Helvetica", 9),
        ("TEXTCOLOR", (0, 1), (-1, -1), INK_BODY),
        ("ALIGN", (2, 1), (2, -1), "RIGHT"),
        ("FONT", (2, 1), (2, -1), "Helvetica-Bold", 9),
        ("TEXTCOLOR", (2, 1), (2, -1), NAVY_TEAL),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    flow.append(dim_table)

    # Findings — compound first, then per-dimension
    severity_rank = {"critical": 0, "high": 1, "moderate": 2, "low": 3}
    compound = [f for f in findings if f.get("dimension_id") == "compound"]
    per_dim = [f for f in findings if f.get("dimension_id") != "compound"]
    compound.sort(key=lambda f: severity_rank.get(f.get("severity", ""), 99))
    per_dim.sort(key=lambda f: severity_rank.get(f.get("severity", ""), 99))

    if compound:
        flow.append(Paragraph("Cross-cutting findings", s["h2"]))
        flow.append(Paragraph(
            "These findings emerge from a combination of dimensions — patterns a single "
            "dimension can&apos;t capture on its own.",
            s["muted"],
        ))
        for f in compound:
            _append_finding(flow, s, f, label="Cross-cutting")

    if per_dim:
        flow.append(Paragraph("Prioritized findings", s["h2"]))
        for f in per_dim:
            _append_finding(flow, s, f, label=f.get("dimension_id", ""))

    if not compound and not per_dim:
        flow.append(Paragraph("Findings", s["h2"]))
        flow.append(Paragraph(
            "No outstanding findings — the program is in good shape.",
            s["body"],
        ))

    # Footer
    flow.append(Spacer(1, 18))
    footer_bits = ["Confidential. Garabyte Privacy Health Check"]
    if rules_version:
        footer_bits.append(f"Rules version {rules_version}")
    footer_bits.append(f"Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}")
    flow.append(Paragraph(" · ".join(footer_bits), s["muted"]))

    doc.build(flow)
    return buffer.getvalue()


def _append_finding(flow: list[Any], s: dict[str, ParagraphStyle], f: dict[str, Any], label: str) -> None:
    severity = f.get("severity", "moderate")
    flow.append(Paragraph(
        f'{_esc(label).upper()} &nbsp;&nbsp; {_severity_pill(severity)}',
        s["finding_dim"],
    ))
    flow.append(Paragraph(_esc(f.get("finding_text") or ""), s["finding_title"]))
    rec = f.get("recommendation")
    if rec:
        flow.append(Paragraph(
            f'<font color="{INK_BODY.hexval()}"><b>Recommendation. </b></font>{_esc(rec)}',
            s["body"],
        ))
    reg = f.get("regulatory_risk")
    if reg:
        flow.append(Paragraph(_esc(reg), s["regulatory"]))
    hrs = f.get("typical_consulting_hours")
    if hrs:
        flow.append(Paragraph(
            f'<font color="{INK_MUTED.hexval()}">Typical consulting hours: {hrs}</font>',
            s["muted"],
        ))
    flow.append(Spacer(1, 4))
