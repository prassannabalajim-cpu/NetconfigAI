import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import JSON as JSONB
from sqlalchemy.sql import func
from app.database import Base

class ConfigFile(Base):
    __tablename__ = "config_files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String, nullable=False)
    config_type = Column(String, nullable=False) # e.g., 'terraform', 'json', 'yaml', 'aws_sg'
    content = Column(String, nullable=False)
    parsed_content = Column(JSONB, nullable=True)
    file_size = Column(Integer, nullable=False)
    uploaded_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
