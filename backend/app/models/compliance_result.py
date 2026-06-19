import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import JSON as JSONB
from sqlalchemy.sql import func
from app.database import Base

class ComplianceStatus(str, enum.Enum):
    compliant = "compliant"
    non_compliant = "non_compliant"
    partial = "partial"

class ComplianceResult(Base):
    __tablename__ = "compliance_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    review_id = Column(UUID(as_uuid=True), ForeignKey("reviews.id"), nullable=False)
    
    cis_violations = Column(JSONB, nullable=True)
    nist_violations = Column(JSONB, nullable=True)
    pci_violations = Column(JSONB, nullable=True)
    custom_policy_violations = Column(JSONB, nullable=True)
    
    overall_compliance_status = Column(Enum(ComplianceStatus), nullable=False)
    total_violations = Column(Integer, default=0)
    
    validated_at = Column(DateTime(timezone=True), server_default=func.now())
