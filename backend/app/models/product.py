from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    Numeric,
    Enum as SqlEnum,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.database import Base
from app.core.enums import ProductStatus, UnitOfMeasure


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        # SKU must be unique within a company (not globally), per spec.
        UniqueConstraint("company_id", "sku", name="uq_product_company_sku"),
        # Prevent duplicate product names within the same category.
        UniqueConstraint("category_id", "name", name="uq_product_category_name"),
    )

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)

    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False, index=True)

    name = Column(String(255), nullable=False)

    sku = Column(String(100), nullable=False, index=True)

    brand = Column(String(255), nullable=True)

    description = Column(Text, nullable=True)

    unit_price = Column(Numeric(12, 2), nullable=False)

    cost_price = Column(Numeric(12, 2), nullable=False)

    stock_quantity = Column(Integer, nullable=False, default=0)

    unit_of_measure = Column(
        SqlEnum(UnitOfMeasure, native_enum=False, length=20),
        default=UnitOfMeasure.PCS,
        nullable=False,
    )

    status = Column(
        SqlEnum(ProductStatus, native_enum=False, length=20),
        default=ProductStatus.ACTIVE,
        nullable=False,
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    company = relationship("Company")
    category = relationship("Category", back_populates="products")
