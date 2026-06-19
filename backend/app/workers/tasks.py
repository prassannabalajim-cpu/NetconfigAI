import asyncio
import os
import json
import uuid
from datetime import datetime
from typing import Optional, List
from celery import shared_task
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.config import settings
from app.models.review import Review, ReviewStatus, RiskLevel
from app.models.diff_change import DiffChange
from app.models.compliance import ComplianceFinding
from app.models.workflow_step import WorkflowStep
from app.models.audit import AuditLog
from app.utils.logger import logger

# Worker session factory
async_engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(bind=async_engine, class_=AsyncSession, expire_on_commit=False)


def _simple_line_diff(old_content: str, new_content: str):
    """Fallback line-based diff engine when services are unavailable."""
    old_lines = old_content.splitlines()
    new_lines = new_content.splitlines()
    old_set = set(enumerate(old_lines))
    new_set = set(enumerate(new_lines))

    changes = []
    for i, line in enumerate(old_lines):
        if i < len(new_lines) and new_lines[i] != line:
            changes.append(DiffChange(
                change_type="MODIFIED",
                field_path=f"line.{i+1}",
                field_name=f"Line {i+1}",
                old_value=line,
                new_value=new_lines[i],
                risk_level="MEDIUM",
                risk_score=50.0,
                ai_explanation=f"Line {i+1} was modified.",
                affected_resource="Configuration file"
            ))
        elif i >= len(new_lines):
            changes.append(DiffChange(
                change_type="REMOVED",
                field_path=f"line.{i+1}",
                field_name=f"Line {i+1}",
                old_value=line,
                new_value=None,
                risk_level="LOW",
                risk_score=20.0,
                ai_explanation=f"Line {i+1} was removed.",
                affected_resource="Configuration file"
            ))

    for i in range(len(old_lines), len(new_lines)):
        changes.append(DiffChange(
            change_type="ADDED",
            field_path=f"line.{i+1}",
            field_name=f"Line {i+1}",
            old_value=None,
            new_value=new_lines[i],
            risk_level="MEDIUM",
            risk_score=40.0,
            ai_explanation=f"Line {i+1} was added.",
            affected_resource="Configuration file"
        ))

    return changes


async def _call_gemini_analysis(diff_summary: dict, config_type: str) -> dict:
    """Call Gemini AI for analysis. Falls back to rule-based if unavailable."""
    try:
        import google.generativeai as genai
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not set")
        
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(
            model_name=settings.GEMINI_MODEL or "gemini-1.5-flash",
            system_instruction=(
                "You are an expert network security analyst reviewing configuration changes. "
                "Always respond ONLY with valid JSON matching the requested schema."
            ),
            generation_config={"response_mime_type": "application/json"}
        )
        
        prompt = f"""
NETWORK CONFIGURATION CHANGE REVIEW REQUEST

Configuration Type: {config_type}
Total Changes: {diff_summary.get('total_changes', 0)}
Added Lines: {diff_summary.get('added', 0)}
Removed Lines: {diff_summary.get('removed', 0)}
Modified Lines: {diff_summary.get('modified', 0)}

Sample Changes (first 10):
{json.dumps(diff_summary.get('sample_changes', []), indent=2)}

Respond ONLY with this JSON:
{{
  "overall_risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "risk_score": <0-100>,
  "executive_summary": "<2-3 sentences for management>",
  "technical_summary": "<detailed technical analysis>",
  "ai_recommendation": "APPROVE|REVIEW|REJECT",
  "findings": [
    {{
      "change": "<what changed>",
      "impact": "<business/security impact>",
      "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
      "recommendation": "<specific action>"
    }}
  ],
  "conditions": ["<any conditional requirements>"]
}}
"""
        response = await model.generate_content_async(prompt)
        result = json.loads(response.text)
        result["ai_provider"] = "gemini"
        return result
    except Exception as e:
        logger.warning(f"Gemini AI failed, using rule-based fallback: {e}")
        return None


def _rule_based_risk(changes: list) -> dict:
    """Rule-based risk scoring fallback."""
    total = len(changes)
    if total == 0:
        return {
            "overall_risk_level": "LOW", "risk_score": 0.0,
            "executive_summary": "No configuration changes detected.",
            "technical_summary": "The uploaded configurations are identical.",
            "ai_recommendation": "APPROVE", "findings": [], "conditions": [],
            "ai_provider": "rule-engine"
        }

    critical = sum(1 for c in changes if c.risk_level == "CRITICAL")
    high = sum(1 for c in changes if c.risk_level == "HIGH")
    medium = sum(1 for c in changes if c.risk_level == "MEDIUM")

    if critical > 0:
        risk_level, score = "CRITICAL", min(90 + critical * 2, 100)
        recommendation = "REJECT"
    elif high > 2:
        risk_level, score = "HIGH", 75 + high
        recommendation = "REVIEW"
    elif high > 0 or medium > 5:
        risk_level, score = "MEDIUM", 50 + medium * 2
        recommendation = "REVIEW"
    else:
        risk_level, score = "LOW", max(5, medium * 5)
        recommendation = "APPROVE"

    return {
        "overall_risk_level": risk_level,
        "risk_score": float(min(score, 100)),
        "executive_summary": (
            f"Analysis detected {total} configuration changes: "
            f"{critical} critical, {high} high, {medium} medium risk items. "
            f"Recommendation: {recommendation}."
        ),
        "technical_summary": (
            f"Rule-based analysis of {total} changes. "
            f"Critical: {critical}, High: {high}, Medium: {medium}."
        ),
        "ai_recommendation": recommendation,
        "findings": [],
        "conditions": [],
        "ai_provider": "rule-engine"
    }


async def _execute_analysis_pipeline(review_id: str, old_path: Optional[str] = None, new_path: Optional[str] = None):
    logger.info(f"Starting analysis pipeline for review: {review_id}")
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Review).filter(Review.id == uuid.UUID(review_id)))
        review: Review = result.scalars().first()
        if not review:
            logger.error(f"Review not found: {review_id}")
            return

        try:
            review.status = ReviewStatus.under_analysis
            await session.commit()

            # Resolve file paths
            upload_dir = os.path.join(settings.UPLOAD_DIR, review_id)
            resolved_old = old_path or os.path.join(upload_dir, "old_config")
            resolved_new = new_path or os.path.join(upload_dir, "new_config")

            if not os.path.exists(resolved_old) or not os.path.exists(resolved_new):
                raise FileNotFoundError(f"Config files not found: {resolved_old}, {resolved_new}")

            with open(resolved_old, "r", encoding="utf-8", errors="replace") as f:
                old_content = f.read()
            with open(resolved_new, "r", encoding="utf-8", errors="replace") as f:
                new_content = f.read()

            # ── Step 1: Diff Engine ─────────────────────────────────────
            changes = []
            try:
                from app.services.diff_engine import ConfigDiffEngine
                from app.services.parser_service import ParserService
                old_dict = ParserService.parse_config(old_content, review.config_type)
                new_dict = ParserService.parse_config(new_content, review.config_type)
                diff_engine = ConfigDiffEngine()
                changes = diff_engine.compute_diff(old_dict, new_dict)
                logger.info(f"Diff engine produced {len(changes)} changes")
            except Exception as diff_err:
                logger.warning(f"Diff engine failed, using line-diff fallback: {diff_err}")
                changes = _simple_line_diff(old_content, new_content)

            # Save diff changes to DB
            for idx, c in enumerate(changes):
                c.review_id = review.id
                c.order_index = idx
                session.add(c)
            await session.commit()

            session.add(AuditLog(
                event_type="DIFF_CREATED",
                event_description=f"Diff produced {len(changes)} changes for review: {review.title}",
                review_id=review.id,
                payload={"changes_count": len(changes)}
            ))

            # ── Step 2: Compliance Engine ───────────────────────────────
            findings = []
            try:
                from app.services.compliance_engine import ComplianceEngine
                compliance_engine = ComplianceEngine()
                findings = compliance_engine.validate(changes, review.compliance_frameworks)
            except Exception as comp_err:
                logger.warning(f"Compliance engine failed: {comp_err}")

            failed_count = 0
            for f in findings:
                f.review_id = review.id
                session.add(f)
                if getattr(f, 'status', None) == "FAIL":
                    failed_count += 1
            await session.commit()

            total_checks = len(findings)
            compliance_score = ((total_checks - failed_count) / total_checks * 100.0) if total_checks > 0 else 100.0
            review.compliance_score = compliance_score

            session.add(AuditLog(
                event_type="COMPLIANCE_CHECKED",
                event_description=f"Compliance: {compliance_score:.1f}% ({failed_count}/{total_checks} failed)",
                review_id=review.id,
                payload={"total_checks": total_checks, "failed_checks": failed_count}
            ))
            await session.commit()

            # ── Step 3: AI Analysis (Gemini first, then rule-based) ─────
            diff_summary = {
                "total_changes": len(changes),
                "added": sum(1 for c in changes if c.change_type == "ADDED"),
                "removed": sum(1 for c in changes if c.change_type == "REMOVED"),
                "modified": sum(1 for c in changes if c.change_type == "MODIFIED"),
                "sample_changes": [
                    {
                        "type": c.change_type,
                        "field": c.field_name,
                        "old": c.old_value,
                        "new": c.new_value,
                        "risk": c.risk_level
                    }
                    for c in changes[:10]
                ]
            }

            ai_result = await _call_gemini_analysis(diff_summary, review.config_type)
            if ai_result is None:
                ai_result = _rule_based_risk(changes)

            overall_risk_str = ai_result.get("overall_risk_level", "MEDIUM").upper()
            risk_map = {
                "LOW": RiskLevel.low, "MEDIUM": RiskLevel.medium,
                "HIGH": RiskLevel.high, "CRITICAL": RiskLevel.critical
            }
            review.risk_level = risk_map.get(overall_risk_str, RiskLevel.medium)
            review.overall_risk_score = float(ai_result.get("risk_score", 50.0))
            review.ai_summary = ai_result.get("executive_summary", "")
            review.ai_recommendation = ai_result.get("ai_recommendation", "REVIEW")[:50]

            # Update DiffChanges with AI explanations if provided
            ai_findings = ai_result.get("findings", [])
            for idx, c in enumerate(changes):
                if idx < len(ai_findings):
                    c.ai_explanation = ai_findings[idx].get("impact", "")
                    session.add(c)

            session.add(AuditLog(
                event_type="ANALYSIS_COMPLETED",
                event_description=(
                    f"AI Analysis complete ({ai_result.get('ai_provider', 'unknown')}). "
                    f"Risk: {overall_risk_str}, Score: {review.overall_risk_score}"
                ),
                review_id=review.id,
                payload={"risk_level": overall_risk_str, "risk_score": review.overall_risk_score, "provider": ai_result.get("ai_provider")}
            ))

            # ── Step 4: Workflow Transition ──────────────────────────────
            ai_rec = ai_result.get("ai_recommendation", "REVIEW")
            if ai_rec == "APPROVE" and review.auto_approve_if_low_risk:
                review.status = ReviewStatus.approved
                step_status, step_comment = "APPROVED", "Auto-approved: AI assessed LOW risk."
            elif overall_risk_str == "CRITICAL":
                review.status = ReviewStatus.pending_review
                step_status, step_comment = "ESCALATED", "Escalated: CRITICAL risk detected by AI."
            else:
                review.status = ReviewStatus.pending_review
                step_status, step_comment = "PENDING_REVIEW", "Awaiting human review."

            session.add(WorkflowStep(
                review_id=review.id,
                step_number=1,
                status=step_status,
                actor_name="NetConfigAI Engine",
                actor_role="Automation",
                comment=step_comment
            ))

            await session.commit()
            logger.info(f"Pipeline completed for review {review_id}: {overall_risk_str} / {review.overall_risk_score}")

        except Exception as e:
            logger.exception(f"Pipeline failed for review {review_id}: {e}")
            try:
                review.status = ReviewStatus.failed
                session.add(AuditLog(
                    event_type="ANALYSIS_FAILED",
                    event_description=f"Pipeline failed: {str(e)[:500]}",
                    review_id=review.id
                ))
                await session.commit()
            except Exception:
                pass


@shared_task(name="app.workers.tasks.run_analysis_pipeline_task")
def run_analysis_pipeline_task(review_id: str, old_path: Optional[str] = None, new_path: Optional[str] = None):
    asyncio.run(_execute_analysis_pipeline(review_id, old_path, new_path))
