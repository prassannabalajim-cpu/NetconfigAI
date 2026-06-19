from typing import List, Optional, Dict, Any, Union
import os
import uuid
from typing import List, Optional, Dict, Any, Union
from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Dict, Any, Union
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.review import Review
from app.models.audit import AuditLog
from app.core.auth_dependencies import get_current_active_user
from app.services.report_service import ReportService
from app.config import settings

router = APIRouter()

@router.get("/{review_id}")
async def get_report(
    review_id: uuid.UUID,
    format: str = Query("pdf", description="pdf, markdown, or json"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """GET endpoint for report download — easier for browser downloads."""
    return await _generate_report(review_id, format, current_user, db)

@router.post("/{review_id}")
async def generate_report(
    review_id: uuid.UUID,
    format: str = Query("pdf", description="pdf, markdown, or json"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """POST endpoint for programmatic report generation."""
    return await _generate_report(review_id, format, current_user, db)

async def _generate_report(review_id, format, current_user, db):
    # Eager load relationships so report service has access to lists
    result = await db.execute(
        select(Review)
        .filter(Review.id == review_id)
        .options(
            selectinload(Review.diff_changes),
            selectinload(Review.compliance_findings),
            selectinload(Review.workflow_steps)
        )
    )
    review = result.scalars().first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
        
    report_service = ReportService()
    
    # Log audit
    audit = AuditLog(
        event_type="REPORT_GENERATED",
        event_description=f"User {current_user.email} generated report in {format} format for review: {review.title}",
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=current_user.role,
        review_id=review_id,
        payload={"format": format}
    )
    db.add(audit)
    await db.commit()

    if format.lower() == "pdf":
        file_path = os.path.join(settings.REPORT_OUTPUT_DIR, f"{review_id}.pdf")
        # Generate on the fly
        report_service.generate_pdf(review, file_path)
        return FileResponse(file_path, media_type="application/pdf", filename=f"ReviewReport_{review_id}.pdf")
        

    elif format.lower() == "json":
        json_data = report_service.generate_json(review)
        return JSONResponse(content=json_data)
        
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported report format. Use pdf, markdown, or json."
        )
