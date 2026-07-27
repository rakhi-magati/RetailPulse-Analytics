from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.enums import AdjustmentType, MovementType, StockStatus
from app.schemas.category import CategoryBrief


class ProductBrief(BaseModel):
    id: int
    name: str
    sku: str
    brand: Optional[str] = None
    unit_of_measure: str

    model_config = ConfigDict(from_attributes=True)


class InventoryOut(BaseModel):
    id: int
    company_id: int
    product_id: int
    current_stock: int
    reserved_stock: int
    available_stock: int
    reorder_level: int
    stock_status: StockStatus
    updated_at: Optional[datetime] = None
    product: Optional[ProductBrief] = None
    category: Optional[CategoryBrief] = None

    model_config = ConfigDict(from_attributes=True)


class StockAdjustmentCreate(BaseModel):
    adjustment_type: AdjustmentType
    quantity: int = Field(..., gt=0, description="Adjustment quantity must be greater than zero")
    reason: str = Field(..., min_length=1, max_length=255)
    remarks: Optional[str] = None

    @field_validator("reason")
    @classmethod
    def reason_required(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Every stock adjustment must include a reason")
        return v


class ReorderLevelUpdate(BaseModel):
    reorder_level: int = Field(..., ge=0, description="Reorder level cannot be negative")


class InventoryMovementOut(BaseModel):
    id: int
    inventory_id: int
    product_id: int
    product_name: Optional[str] = None
    sku: Optional[str] = None
    movement_type: MovementType
    quantity_changed: int
    previous_quantity: int
    updated_quantity: int
    reason: Optional[str] = None
    remarks: Optional[str] = None
    performed_by: int
    performed_by_name: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryDashboardSummary(BaseModel):
    total_products: int
    total_inventory_quantity: int
    low_stock_products: int
    out_of_stock_products: int


class CategoryBreakdownItem(BaseModel):
    category_id: Optional[int] = None
    category_name: str
    total_quantity: int


class StockStatusBreakdownItem(BaseModel):
    stock_status: StockStatus
    count: int


class InventoryCharts(BaseModel):
    by_category: List[CategoryBreakdownItem]
    by_stock_status: List[StockStatusBreakdownItem]
