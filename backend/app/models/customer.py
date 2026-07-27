from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.database import Base

class Customer(Base):
    __tablename__ = "customers"
    __table_args__ = (UniqueConstraint("company_id", "customer_id", name="uq_customer_company_customer_id"), UniqueConstraint("company_id", "email", name="uq_customer_company_email"), UniqueConstraint("company_id", "phone", name="uq_customer_company_phone"))
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    customer_id = Column(String(40), nullable=False, index=True)
    full_name = Column(String(255), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    phone = Column(String(50), nullable=False, index=True)
    gender = Column(String(30)); date_of_birth = Column(Date); address = Column(String(500))
    city = Column(String(100), index=True); state = Column(String(100), index=True); country = Column(String(100), index=True)
    customer_type = Column(String(30), nullable=False, default="RETAIL")
    preferred_sales_channel = Column(String(30)); status = Column(String(20), nullable=False, default="ACTIVE", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    company = relationship("Company"); sales = relationship("Sale", back_populates="customer")
    summary = relationship("CustomerPurchaseSummary", back_populates="customer", uselist=False, cascade="all, delete-orphan")
    timeline = relationship("CustomerTimeline", back_populates="customer", cascade="all, delete-orphan")

class CustomerPurchaseSummary(Base):
    __tablename__ = "customer_purchase_summary"
    id = Column(Integer, primary_key=True); customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, unique=True, index=True)
    total_orders = Column(Integer, default=0, nullable=False); total_revenue = Column(Numeric(14,2), default=0, nullable=False)
    total_products_purchased = Column(Integer, default=0, nullable=False); average_order_value = Column(Numeric(14,2), default=0, nullable=False)
    purchase_frequency = Column(Numeric(12,2), default=0, nullable=False); first_purchase_date = Column(DateTime(timezone=True)); last_purchase_date = Column(DateTime(timezone=True))
    favorite_product_id = Column(Integer, ForeignKey("products.id")); favorite_category_id = Column(Integer, ForeignKey("categories.id"))
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    customer = relationship("Customer", back_populates="summary")

class CustomerTimeline(Base):
    __tablename__ = "customer_timeline"
    id = Column(Integer, primary_key=True); customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    event_type = Column(String(60), nullable=False); description = Column(String(500), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    customer = relationship("Customer", back_populates="timeline")
