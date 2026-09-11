from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, JSON, String, Enum as SqlEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.enums import NotificationPriority, NotificationType
from app.database.database import Base


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user_created", "user_id", "created_at"),
        Index("ix_notifications_company_user_read", "company_id", "user_id", "is_read"),
        Index("ix_notifications_dedupe", "company_id", "user_id", "dedupe_key"),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    type = Column(SqlEnum(NotificationType, native_enum=False, length=40), nullable=False)
    title = Column(String(255), nullable=True)
    message = Column(String(1000), nullable=False)
    priority = Column(SqlEnum(NotificationPriority, native_enum=False, length=20), nullable=False, default=NotificationPriority.LOW)
    resource_type = Column(String(80), nullable=True)
    resource_id = Column(String(100), nullable=True)
    payload = Column(JSON, nullable=True)
    dedupe_key = Column(String(255), nullable=True)
    is_read = Column(Boolean, nullable=False, default=False, index=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    company = relationship("Company")
    product = relationship("Product")
    user = relationship("User")