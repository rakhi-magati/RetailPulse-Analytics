from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    Enum as SqlEnum,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.database import Base
from app.core.enums import MovementType, StockStatus


class Inventory(Base):
    """
    One row per product. Mirrors the product's live stock position so the
    Inventory module can be queried/filtered/reported on independently of
    the Products module, while still remaining in lock-step with it.
    """

    __tablename__ = "inventory"
    __table_args__ = (
        UniqueConstraint("product_id", name="uq_inventory_product"),
    )

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)

    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)

    current_stock = Column(Integer, nullable=False, default=0)

    reserved_stock = Column(Integer, nullable=False, default=0)

    available_stock = Column(Integer, nullable=False, default=0)

    reorder_level = Column(Integer, nullable=False, default=10)

    stock_status = Column(
        SqlEnum(StockStatus, native_enum=False, length=20),
        default=StockStatus.IN_STOCK,
        nullable=False,
    )

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    company = relationship("Company")
    product = relationship("Product")
    movements = relationship(
        "InventoryMovement", back_populates="inventory", cascade="all, delete-orphan"
    )


class InventoryMovement(Base):
    """Immutable audit trail of every quantity change applied to an Inventory row."""

    __tablename__ = "inventory_movements"

    id = Column(Integer, primary_key=True, index=True)

    inventory_id = Column(Integer, ForeignKey("inventory.id"), nullable=False, index=True)

    movement_type = Column(
        SqlEnum(MovementType, native_enum=False, length=20),
        nullable=False,
    )

    quantity_changed = Column(Integer, nullable=False)

    previous_quantity = Column(Integer, nullable=False)

    updated_quantity = Column(Integer, nullable=False)

    reason = Column(String(255), nullable=True)

    remarks = Column(Text, nullable=True)

    performed_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    inventory = relationship("Inventory", back_populates="movements")
    performer = relationship("User")
