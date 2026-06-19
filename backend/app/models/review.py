import uuid
import enum
from datetime import datetime
from typing import List, Optional
from sqlalchemy import String, Float, Boolean, DateTime, Text, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.database import Base

class ReviewStatus(str, enum.Enum):
    draft = "draft"
    pending_review = "pending_review"
    in_review = "in_review"
    under_analysis = "under_analysis"
    approved = "approved"
    rejected = "rejected"
    closed = "closed"
    failed = "failed"

class RiskLevel(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"
    unknown = "unknown"

class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    ticket_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    config_type: Mapped[str] = mapped_column(String(100), nullable=False, default="GENERAL")
    cloud_provider: Mapped[str] = mapped_column(String(50), nullable=False, default="UNKNOWN")
    
    status: Mapped[ReviewStatus] = mapped_column(Enum(ReviewStatus), nullable=False, default=ReviewStatus.draft)
    risk_level: Mapped[RiskLevel] = mapped_column(Enum(RiskLevel), nullable=False, default=RiskLevel.unknown)
    
    overall_risk_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    compliance_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    ai_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ai_recommendation: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    auto_approve_if_low_risk: Mapped[bool] = mapped_column(Boolean, default=False)
    notify_manager: Mapped[bool] = mapped_column(Boolean, default=True)
    
    compliance_frameworks: Mapped[List[str]] = mapped_column(ARRAY(String), nullable=False, default=list)

    old_config_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("config_files.id"), nullable=True)
    new_config_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("config_files.id"), nullable=True)
    
    diff_result_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("diff_results.id"), nullable=True)
    analysis_result_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("analysis_results.id"), nullable=True)
    compliance_result_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("compliance_results.id"), nullable=True)

    submitted_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    reviewed_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    approval_comment: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    # old_config = relationship("ConfigFile", foreign_keys=[old_config_id])
    # new_config = relationship("ConfigFile", foreign_keys=[new_config_id])
    submitter = relationship("User", foreign_keys=[submitted_by_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by_id])
    
    diff_changes = relationship(
        "DiffChange",
        back_populates="review",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    compliance_findings = relationship(
        "ComplianceFinding",
        back_populates="review",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    workflow_steps = relationship(
        "WorkflowStep",
        back_populates="review",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
