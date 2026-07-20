from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum as SqlEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.database import Base
from app.core.enums import NotificationType


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)

    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)

    type = Column(
        SqlEnum(NotificationType, native_enum=False, length=20),
        nullable=False,
    )

    message = Column(String(500), nullable=False)

    is_read = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company")
    product = relationship("Product")
