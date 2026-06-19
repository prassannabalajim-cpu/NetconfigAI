import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import JSON as JSONB
from sqlalchemy.sql import func
from app.database import Base

class DiffResult(Base):
    __tablename__ = "diff_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # The review ID will be added to the review model itself to avoid circular dependency
    # or we can keep it here. Let's add it here as per the prompt pdf.
    review_id = Column(UUID(as_uuid=True), ForeignKey("reviews.id"), nullable=False)
    
    added_rules = Column(JSONB, nullable=True) # list of added configuration entries
    removed_rules = Column(JSONB, nullable=True)
    modified_rules = Column(JSONB, nullable=True) # each: {field, old_value, new_value, path}
    
    total_changes = Column(Integer, default=0)
    diff_summary = Column(String, nullable=True)
    raw_diff = Column(JSONB, nullable=True) # full deepdiff output
    
    computed_at = Column(DateTime(timezone=True), server_default=func.now())
