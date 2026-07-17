from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum as SqlEnum, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.database import Base
from app.core.enums import CategoryStatus


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (
        # A company should not have two categories with the identical name.
        UniqueConstraint("company_id", "name", name="uq_category_company_name"),
    )

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)

    name = Column(String(255), nullable=False)

    description = Column(Text, nullable=True)

    status = Column(
        SqlEnum(CategoryStatus, native_enum=False, length=20),
        default=CategoryStatus.ACTIVE,
        nullable=False,
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    company = relationship("Company")
    products = relationship("Product", back_populates="category", cascade="all, delete-orphan")
