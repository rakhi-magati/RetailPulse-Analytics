from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, JSON, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_company_created", "company_id", "created_at"),
        Index("ix_audit_logs_company_action", "company_id", "action"),
        Index("ix_audit_logs_company_resource", "company_id", "resource_type"),
        Index("ix_audit_logs_company_user", "company_id", "user_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    action = Column(String(255), nullable=False, index=True)
    resource_type = Column(String(100), nullable=True, index=True)
    resource_id = Column(String(100), nullable=True, index=True)
    description = Column(String(1000), nullable=True)
    entity_name = Column(String(255), nullable=True)  # retained for existing audit events
    ip_address = Column(String(100), nullable=True)
    user_agent = Column(String(1000), nullable=True)
    browser = Column(String(255), nullable=True)  # legacy field, retained for compatibility
    before_values = Column(JSON, nullable=True)
    after_values = Column(JSON, nullable=True)
    status = Column(String(30), nullable=False, default="SUCCESS", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    company = relationship("Company")
    user = relationship("User")
