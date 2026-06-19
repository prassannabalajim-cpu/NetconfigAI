import json
import os

from datetime import datetime
from typing import Dict, Any, List
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.piecharts import Pie
from app.models.review import Review

RISK_COLORS = {
    "LOW": colors.HexColor("#10B981"),
    "MEDIUM": colors.HexColor("#F59E0B"),
    "HIGH": colors.HexColor("#F97316"),
    "CRITICAL": colors.HexColor("#EF4444"),
    "UNKNOWN": colors.HexColor("#6B7280")
}

class ReportService:
    def generate_pdf(self, review: Review, output_path: str) -> str:
        """
        Generates an enterprise-grade PDF report using ReportLab.
        """
        # Ensure output directory exists
        dir_name = os.path.dirname(output_path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)

        doc = SimpleDocTemplate(
            output_path,
            pagesize=A4,
            rightMargin=20*mm,
            leftMargin=20*mm,
            topMargin=25*mm,
            bottomMargin=20*mm
        )

        styles = getSampleStyleSheet()

        # Custom styles
        title_style = ParagraphStyle(
            "DocTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=24,
            leading=28,
            textColor=colors.HexColor("#1E293B"),
            alignment=TA_LEFT,
            spaceAfter=15
        )

        h1_style = ParagraphStyle(
            "SectionH1",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            textColor=colors.HexColor("#3B82F6"),
            spaceBefore=15,
            spaceAfter=10,
            keepWithNext=True
        )

        h2_style = ParagraphStyle(
            "SectionH2",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=colors.HexColor("#10B981"),
            spaceBefore=10,
            spaceAfter=8,
            keepWithNext=True
        )

        body_style = ParagraphStyle(
            "BodyTextCustom",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#334155"),
            spaceAfter=8
        )

        meta_label_style = ParagraphStyle(
            "MetaLabel",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#0F172A")
        )

        story = []

        # 1. Header / Cover Block
        story.append(Paragraph("AI Network Config Diff Review Report", title_style))
        
        # Meta Table
        submitter_str = str(review.submitted_by_id)
        meta_data = [
            [Paragraph("Review Title:", meta_label_style), Paragraph(review.title, body_style)],
            [Paragraph("Review ID:", meta_label_style), Paragraph(str(review.id), body_style)],
            [Paragraph("Config Type:", meta_label_style), Paragraph(review.config_type, body_style)],
            [Paragraph("Cloud Provider:", meta_label_style), Paragraph(review.cloud_provider, body_style)],
            [Paragraph("Generated At:", meta_label_style), Paragraph(datetime.now().strftime("%Y-%m-%d %H:%M:%S"), body_style)],
            [Paragraph("Submitted By:", meta_label_style), Paragraph(submitter_str, body_style)]
        ]
        meta_table = Table(meta_data, colWidths=[130, 350])
        meta_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 15))

        # Risk Summary Banner Table
        review_risk_level = (review.risk_level or 'UNKNOWN').upper()
        risk_color = RISK_COLORS.get(review_risk_level, colors.gray)
        risk_label_style = ParagraphStyle(
            "RiskLabel",
            fontName="Helvetica-Bold",
            fontSize=12,
            textColor=colors.white,
            alignment=TA_CENTER
        )
        risk_banner_data = [
            [
                Paragraph(f"OVERALL RISK: {review_risk_level} (Score: {review.overall_risk_score or 0.0:.1f}/100)", risk_label_style),
                Paragraph(f"COMPLIANCE SCORE: {review.compliance_score or 0.0:.1f}%", risk_label_style)
            ]
        ]
        risk_banner_table = Table(risk_banner_data, colWidths=[240, 240])
        risk_banner_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), risk_color),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 10),
            ('TOPPADDING', (0,0), (-1,-1), 10),
        ]))
        story.append(risk_banner_table)
        story.append(Spacer(1, 20))

        # 2. Executive Summary & Graph
        story.append(Paragraph("Executive Summary & Risk Evaluation", h1_style))
        summary_text = review.ai_summary or "No executive summary available."
        story.append(Paragraph(summary_text, body_style))
        story.append(Spacer(1, 10))

        # Draw a simple pie chart if there are changes
        if review.diff_changes:
            risk_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
            for c in review.diff_changes:
                rl = c.risk_level.upper() if c.risk_level else "UNKNOWN"
                if rl in risk_counts:
                    risk_counts[rl] += 1
            
            active_risks = [(k, v) for k, v in risk_counts.items() if v > 0]
            if active_risks:
                d = Drawing(400, 160)
                pie = Pie()
                pie.x = 130
                pie.y = 20
                pie.width = 120
                pie.height = 120
                pie.data = [v for k, v in active_risks]
                pie.labels = [f"{k} ({v})" for k, v in active_risks]
                
                # Colors
                for i, (k, v) in enumerate(active_risks):
                    pie.slices[i].fillColor = RISK_COLORS.get(k, colors.gray)
                
                d.add(pie)
                story.append(KeepTogether([
                    Paragraph("Risk Distribution of Config Changes:", ParagraphStyle("bold", fontName="Helvetica-Bold", fontSize=10)),
                    d
                ]))
        story.append(Spacer(1, 15))

        # 3. Addressed Configurations & Good Practices
        story.append(Paragraph("Addressed Configurations & Good Practices", h1_style))
        story.append(Paragraph("The following configuration components were reviewed and deemed secure and compliant with best practices:", body_style))
        
        good_findings = [f for f in review.compliance_findings if f.status == "PASS"]
        if good_findings:
            good_data = [[Paragraph("Framework", meta_label_style), Paragraph("Secure Control Addressed", meta_label_style)]]
            for gf in good_findings:
                good_data.append([
                    Paragraph(gf.framework, body_style),
                    Paragraph(f"{gf.control_id}: {gf.control_name}", body_style)
                ])
            good_table = Table(good_data, colWidths=[100, 380])
            good_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#10B981")),
                ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E5E7EB")),
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F0FDF4")]),
                ('BOTTOMPADDING', (0,0), (-1,-1), 6),
                ('TOPPADDING', (0,0), (-1,-1), 6),
            ]))
            story.append(good_table)
        else:
            story.append(Paragraph("No specific positive configurations or passing compliance checks were logged.", body_style))
        story.append(Spacer(1, 20))

        # 4. Changes Table
        story.append(Paragraph(f"Configuration Changes Details", h1_style))
        if review.diff_changes:
            table_header_style = ParagraphStyle("THeader", fontName="Helvetica-Bold", fontSize=9, leading=11, textColor=colors.white)
            table_body_style = ParagraphStyle("TBody", fontName="Helvetica", fontSize=8, leading=10)
            
            changes_data = [[
                Paragraph("Field", table_header_style),
                Paragraph("Type", table_header_style),
                Paragraph("Old Value", table_header_style),
                Paragraph("New Value", table_header_style),
                Paragraph("Risk", table_header_style)
            ]]

            for c in review.diff_changes:
                c_risk = (c.risk_level or "UNKNOWN").upper()
                changes_data.append([
                    Paragraph((c.field_name or "N/A")[:30], table_body_style),
                    Paragraph((c.change_type or "N/A"), table_body_style),
                    Paragraph(str(c.old_value or "")[:40], table_body_style),
                    Paragraph(str(c.new_value or "")[:40], table_body_style),
                    Paragraph(f"<font color='{RISK_COLORS.get(c_risk, colors.black).hexval()}'><b>{c_risk}</b></font>", table_body_style)
                ])

            changes_table = Table(changes_data, colWidths=[100, 50, 140, 140, 50])
            changes_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#3B82F6")),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E5E7EB")),
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
                ('BOTTOMPADDING', (0,0), (-1,-1), 6),
                ('TOPPADDING', (0,0), (-1,-1), 6),
            ]))
            story.append(changes_table)
        else:
            story.append(Paragraph("No changes detected in configuration files.", body_style))
        story.append(Spacer(1, 20))

        # 5. Compliance Violations
        story.append(Paragraph("Compliance Violations", h1_style))
        bad_findings = [f for f in review.compliance_findings if f.status != "PASS"]
        if bad_findings:
            comp_header_style = ParagraphStyle("CHeader", fontName="Helvetica-Bold", fontSize=9, leading=11, textColor=colors.white)
            comp_body_style = ParagraphStyle("CBody", fontName="Helvetica", fontSize=8, leading=10)
            
            comp_data = [[
                Paragraph("Framework", comp_header_style),
                Paragraph("Control ID", comp_header_style),
                Paragraph("Control Name", comp_header_style),
                Paragraph("Status", comp_header_style),
                Paragraph("Severity", comp_header_style)
            ]]

            for f in bad_findings:
                status_color = colors.HexColor("#EF4444")
                comp_data.append([
                    Paragraph(f.framework, comp_body_style),
                    Paragraph(f.control_id, comp_body_style),
                    Paragraph(f.control_name, comp_body_style),
                    Paragraph(f"<font color='{status_color.hexval()}'><b>{f.status}</b></font>", comp_body_style),
                    Paragraph(f.severity, comp_body_style)
                ])

            comp_table = Table(comp_data, colWidths=[70, 70, 200, 70, 70])
            comp_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#EF4444")),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E5E7EB")),
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#FEF2F2")]),
                ('BOTTOMPADDING', (0,0), (-1,-1), 6),
                ('TOPPADDING', (0,0), (-1,-1), 6),
            ]))
            story.append(comp_table)
        else:
            story.append(Paragraph("No compliance violations found.", body_style))
        story.append(Spacer(1, 20))

        def add_header_footer(canvas, doc):
            canvas.saveState()
            canvas.setFillColor(colors.HexColor("#3B82F6"))
            canvas.setFont("Helvetica-Bold", 8)
            canvas.drawString(20*mm, 287*mm, "AI Network Config Diff Reviewer — CONFIDENTIAL")
            canvas.setStrokeColor(colors.HexColor("#3B82F6"))
            canvas.setLineWidth(0.5)
            canvas.line(20*mm, 285*mm, 190*mm, 285*mm)
            
            canvas.setFont("Helvetica", 8)
            canvas.setFillColor(colors.HexColor("#64748B"))
            canvas.drawString(20*mm, 10*mm, datetime.now().strftime("%Y-%m-%d"))
            canvas.drawRightString(190*mm, 10*mm, f"Page {doc.page}")
            canvas.restoreState()

        doc.build(story, onFirstPage=add_header_footer, onLaterPages=add_header_footer)
        return output_path

    def generate_json(self, review: Review) -> Dict[str, Any]:
        """
        Generates a machine-readable JSON export.
        """
        review_risk_level = (review.risk_level or 'UNKNOWN').upper()
        return {
            "schema_version": "1.0",
            "generated_at": datetime.now().isoformat() + "Z",
            "review": {
                "id": str(review.id),
                "title": review.title,
                "config_type": review.config_type,
                "cloud_provider": review.cloud_provider,
                "ticket_id": review.ticket_id,
                "status": review.status,
                "overall_risk_level": review_risk_level,
                "overall_risk_score": review.overall_risk_score,
                "compliance_score": review.compliance_score,
                "ai_recommendation": review.ai_recommendation,
                "ai_summary": review.ai_summary,
                "compliance_frameworks": review.compliance_frameworks,
                "created_at": review.created_at.isoformat() + "Z",
            },
            "diff_changes": [
                {
                    "field_path": c.field_path,
                    "field_name": c.field_name,
                    "change_type": c.change_type,
                    "old_value": c.old_value,
                    "new_value": c.new_value,
                    "risk_level": c.risk_level,
                    "risk_score": c.risk_score,
                    "ai_explanation": c.ai_explanation,
                }
                for c in review.diff_changes
            ] if review.diff_changes else [],
            "compliance_findings": [
                {
                    "framework": f.framework,
                    "control_id": f.control_id,
                    "control_name": f.control_name,
                    "status": f.status,
                    "severity": f.severity,
                    "finding": f.finding_description,
                    "remediation": f.remediation_guidance
                }
                for f in review.compliance_findings
            ] if review.compliance_findings else [],
            "workflow": [
                {
                    "step": s.step_number,
                    "status": s.status,
                    "actor": s.actor_name,
                    "role": s.actor_role,
                    "comment": s.comment,
                    "timestamp": s.created_at.isoformat() + "Z"
                }
                for s in review.workflow_steps
            ] if review.workflow_steps else []
        }

report_service = ReportService()
