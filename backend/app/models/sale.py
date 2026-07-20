from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Numeric,
    Enum as SqlEnum,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.database import Base
from app.core.enums import SalesChannel, PaymentMethod


class Sale(Base):
    __tablename__ = "sales"
    __table_args__ = (
        # Invoice numbers must be unique within each company.
        UniqueConstraint("company_id", "invoice_number", name="uq_sale_company_invoice"),
    )

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)

    invoice_number = Column(String(50), nullable=False, index=True)

    customer_name = Column(String(255), nullable=False)

    sale_date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    sales_channel = Column(
        SqlEnum(SalesChannel, native_enum=False, length=20),
        nullable=False,
    )

    payment_method = Column(
        SqlEnum(PaymentMethod, native_enum=False, length=20),
        nullable=False,
    )

    subtotal = Column(Numeric(12, 2), nullable=False, default=0)
    discount_total = Column(Numeric(12, 2), nullable=False, default=0)
    tax_total = Column(Numeric(12, 2), nullable=False, default=0)
    total_amount = Column(Numeric(12, 2), nullable=False, default=0)

    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    company = relationship("Company")
    creator = relationship("User")
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True, index=True)

    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False, index=True)

    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)

    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)

    quantity = Column(Integer, nullable=False)

    unit_price = Column(Numeric(12, 2), nullable=False)

    discount = Column(Numeric(12, 2), nullable=False, default=0)

    tax = Column(Numeric(12, 2), nullable=False, default=0)

    total = Column(Numeric(12, 2), nullable=False)

    sale = relationship("Sale", back_populates="items")
    product = relationship("Product")
    category = relationship("Category")
