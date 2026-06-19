import uuid
from typing import Optional
from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class ComplianceFinding(Base):
    __tablename__ = "compliance_findings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    review_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False, index=True)
    framework: Mapped[str] = mapped_column(String(50), nullable=False) # CIS | NIST | PCI_DSS | CUSTOM
    control_id: Mapped[str] = mapped_column(String(100), nullable=False) # e.g. CIS-4.1
    control_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="PASS") # PASS | FAIL | WARNING | NOT_APPLICABLE
    finding_description: Mapped[str] = mapped_column(Text, nullable=False)
    reremediation_guidance: Mapped[Optional[str]] = mapped_column(Text, nullable=True) # NOTE: renaming to match remediation_guidance below or keep it clean
    remediation_guidance: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    severity: Mapped[str] = mapped_column(String(50), nullable=False) # LOW | MEDIUM | HIGH | CRITICAL
    evidence: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    review = relationship("Review", back_populates="compliance_findings")
