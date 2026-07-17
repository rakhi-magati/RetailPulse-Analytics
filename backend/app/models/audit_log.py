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

    # Name of the entity the action was performed on (e.g. a product or
    # category name). Optional because auth-related actions (login, etc.)
    # don't operate on a named entity.
    entity_name = Column(String(255), nullable=True)

    ip_address = Column(String(100), nullable=True)

    browser = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company")

    user = relationship("User")