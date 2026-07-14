from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    action = Column(String(255), nullable=False)

    ip_address = Column(String(100), nullable=True)

    browser = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company")

    user = relationship("User")