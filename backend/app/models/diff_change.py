import uuid
from typing import Optional
from sqlalchemy import String, Float, Text, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class DiffChange(Base):
    __tablename__ = "diff_changes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    review_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False, index=True)
    change_type: Mapped[str] = mapped_column(String(50), nullable=False) # ADDED | REMOVED | MODIFIED
    field_path: Mapped[str] = mapped_column(String(500), nullable=False)
    field_name: Mapped[str] = mapped_column(String(255), nullable=False)
    old_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    new_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    risk_level: Mapped[str] = mapped_column(String(50), nullable=False, default="LOW") # LOW | MEDIUM | HIGH | CRITICAL
    risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    ai_explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    affected_resource: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    cis_control_ref: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    nist_control_ref: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    review = relationship("Review", back_populates="diff_changes")
