from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.database import Base


# ============================================================================
# Customer
# ============================================================================


class Customer(Base):
    __tablename__ = "customers"

    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "customer_id",
            name="uq_customer_company_customer_id",
        ),
        UniqueConstraint(
            "company_id",
            "email",
            name="uq_customer_company_email",
        ),
        UniqueConstraint(
            "company_id",
            "phone",
            name="uq_customer_company_phone",
        ),
    )

    # ------------------------------------------------------------------------
    # Primary Key
    # ------------------------------------------------------------------------

    id = Column(
        Integer,
        primary_key=True,
    )

    # ------------------------------------------------------------------------
    # Company
    # ------------------------------------------------------------------------

    company_id = Column(
        Integer,
        ForeignKey("companies.id"),
        nullable=False,
        index=True,
    )

    # ------------------------------------------------------------------------
    # Customer Identification
    # ------------------------------------------------------------------------

    customer_id = Column(
        String(40),
        nullable=False,
        index=True,
    )

    full_name = Column(
        String(255),
        nullable=False,
        index=True,
    )

    first_name = Column(
        String(100),
        nullable=True,
    )

    last_name = Column(
        String(100),
        nullable=True,
    )

    # ------------------------------------------------------------------------
    # Contact Information
    # ------------------------------------------------------------------------

    email = Column(
        String(255),
        nullable=False,
        index=True,
    )

    phone = Column(
        String(50),
        nullable=False,
        index=True,
    )

    # ------------------------------------------------------------------------
    # Personal Information
    # ------------------------------------------------------------------------

    gender = Column(
        String(30),
        nullable=True,
    )

    date_of_birth = Column(
        Date,
        nullable=True,
    )

    # ------------------------------------------------------------------------
    # Address
    # ------------------------------------------------------------------------

    address = Column(
        String(500),
        nullable=True,
    )

    city = Column(
        String(100),
        nullable=True,
        index=True,
    )

    state = Column(
        String(100),
        nullable=True,
        index=True,
    )

    country = Column(
        String(100),
        nullable=True,
        index=True,
    )

    postal_code = Column(
        String(20),
        nullable=True,
    )

    # ------------------------------------------------------------------------
    # Customer Classification
    # ------------------------------------------------------------------------

    customer_type = Column(
        String(30),
        nullable=False,
        default="RETAIL",
    )

    preferred_sales_channel = Column(
        String(30),
        nullable=True,
    )

    status = Column(
        String(20),
        nullable=False,
        default="ACTIVE",
        index=True,
    )

    # ------------------------------------------------------------------------
    # Timestamps
    # ------------------------------------------------------------------------

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # ------------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------------

    company = relationship(
        "Company",
    )

    sales = relationship(
        "Sale",
        back_populates="customer",
    )

    summary = relationship(
        "CustomerPurchaseSummary",
        back_populates="customer",
        uselist=False,
        cascade="all, delete-orphan",
    )

    timeline = relationship(
        "CustomerTimeline",
        back_populates="customer",
        cascade="all, delete-orphan",
        order_by="CustomerTimeline.created_at.desc()",
    )


# ============================================================================
# Customer Purchase Summary
# ============================================================================


class CustomerPurchaseSummary(Base):
    __tablename__ = "customer_purchase_summary"

    # ------------------------------------------------------------------------
    # Primary Key
    # ------------------------------------------------------------------------

    id = Column(
        Integer,
        primary_key=True,
    )

    # ------------------------------------------------------------------------
    # Customer
    # ------------------------------------------------------------------------

    customer_id = Column(
        Integer,
        ForeignKey("customers.id"),
        nullable=False,
        unique=True,
        index=True,
    )

    # ------------------------------------------------------------------------
    # Purchase Metrics
    # ------------------------------------------------------------------------

    total_orders = Column(
        Integer,
        default=0,
        nullable=False,
    )

    total_revenue = Column(
        Numeric(14, 2),
        default=0,
        nullable=False,
    )

    total_products_purchased = Column(
        Integer,
        default=0,
        nullable=False,
    )

    average_order_value = Column(
        Numeric(14, 2),
        default=0,
        nullable=False,
    )

    purchase_frequency = Column(
        Numeric(12, 2),
        default=0,
        nullable=False,
    )

    # ------------------------------------------------------------------------
    # Purchase Dates
    # ------------------------------------------------------------------------

    first_purchase_date = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    last_purchase_date = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    # ------------------------------------------------------------------------
    # Favorite Product / Category
    # ------------------------------------------------------------------------

    favorite_product_id = Column(
        Integer,
        ForeignKey("products.id"),
        nullable=True,
    )

    favorite_category_id = Column(
        Integer,
        ForeignKey("categories.id"),
        nullable=True,
    )

    # ------------------------------------------------------------------------
    # Timestamp
    # ------------------------------------------------------------------------

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # ------------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------------

    customer = relationship(
        "Customer",
        back_populates="summary",
    )

    favorite_product = relationship(
        "Product",
        foreign_keys=[favorite_product_id],
    )

    favorite_category = relationship(
        "Category",
        foreign_keys=[favorite_category_id],
    )


# ============================================================================
# Customer Timeline
# ============================================================================


class CustomerTimeline(Base):
    __tablename__ = "customer_timeline"

    # ------------------------------------------------------------------------
    # Primary Key
    # ------------------------------------------------------------------------

    id = Column(
        Integer,
        primary_key=True,
    )

    # ------------------------------------------------------------------------
    # Customer
    # ------------------------------------------------------------------------

    customer_id = Column(
        Integer,
        ForeignKey("customers.id"),
        nullable=False,
        index=True,
    )

    # ------------------------------------------------------------------------
    # Timeline Event
    # ------------------------------------------------------------------------

    event_type = Column(
        String(60),
        nullable=False,
    )

    description = Column(
        String(500),
        nullable=False,
    )

    # ------------------------------------------------------------------------
    # Timestamp
    # ------------------------------------------------------------------------

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )

    # ------------------------------------------------------------------------
    # Relationship
    # ------------------------------------------------------------------------

    customer = relationship(
        "Customer",
        back_populates="timeline",
    )